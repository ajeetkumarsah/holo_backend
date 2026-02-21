import { WebSocket, WebSocketServer } from "ws";
import { Server, IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import User from "./models/User";
import ChatMessage from "./models/ChatMessage";
import Conversation from "./models/Conversation";
import CallLog from "./models/CallLog";
import mongoose from "mongoose";

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

// Track active calls: callerId -> { receiverId, startedAt }
const activeCalls = new Map<string, { receiverId: string; startedAt: Date }>();

export const initSocket = (server: Server) => {
  const wss = new WebSocketServer({ server, path: "/chat-ws" });

  const clients = new Map<string, ExtendedWebSocket>();

  wss.on("connection", async (ws: ExtendedWebSocket, req: IncomingMessage) => {
    // 1. Auth
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(1008, "Token required");
      return;
    }

    try {
      const decoded: any = jwt.verify(
        token,
        process.env.JWT_SECRET || "secret"
      );
      ws.userId = decoded.id;
      ws.isAlive = true;

      // Keep track of client
      if (ws.userId) {
        clients.set(ws.userId, ws);
        console.log(`User connected: ${ws.userId}`);
      }
    } catch (err) {
      ws.close(1008, "Invalid token");
      return;
    }

    // 2. Pong heartbeat
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    // 3. Handle messages
    ws.on("message", async (data: string) => {
      try {
        const parsed = JSON.parse(data);
        const { type } = parsed;

        if (type === "message:send") {
          await handleMessageSend(ws, parsed, clients);
        } else if (type === "message:read") {
          handleMessageRead(ws, parsed, clients);
        } else if (type.startsWith("call:")) {
          await handleCallSignaling(ws, parsed, clients);
        }
      } catch (e) {
        console.error("Socket message error:", e);
      }
    });

    // 4. Cleanup
    ws.on("close", () => {
      if (ws.userId) {
        clients.delete(ws.userId);
        console.log(`User disconnected: ${ws.userId}`);
      }
    });
  });

  // Heartbeat interval
  const interval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      const extWs = ws as ExtendedWebSocket;
      if (extWs.isAlive === false) return ws.terminate();
      extWs.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));
};

// Handlers

async function handleMessageSend(
  ws: ExtendedWebSocket,
  data: any,
  clients: Map<string, ExtendedWebSocket>
) {
  const { conversationId, body } = data;
  const senderId = ws.userId;
  if (!senderId) return;

  try {
    const newMessage = await ChatMessage.create({
      conversationId,
      sender: new mongoose.Types.ObjectId(senderId),
      body,
      timestamp: Date.now(),
    });

    ws.send(
      JSON.stringify({
        type: "message:sent",
        message: newMessage,
        tempId: data.tempId,
      })
    );

    clients.forEach((client, clientId) => {
      if (clientId !== senderId && client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "message:new",
            message: {
              id: newMessage._id,
              conversationId,
              sender: senderId,
              body,
              timestamp: newMessage.timestamp,
            },
          })
        );
      }
    });
  } catch (error) {
    console.error("Error saving message:", error);
  }
}

function handleMessageRead(
  ws: ExtendedWebSocket,
  data: any,
  clients: Map<string, ExtendedWebSocket>
) {
  // notify sender that message was read — placeholder
}

// VIDEO CALL SIGNALING
async function handleCallSignaling(
  ws: ExtendedWebSocket,
  data: any,
  clients: Map<string, ExtendedWebSocket>
) {
  const { type, toUserId } = data;
  const fromUserId = ws.userId;
  if (!fromUserId) return;

  if (!toUserId) {
    console.warn("Call signaling missing toUserId", data);
    return;
  }

  const target = clients.get(toUserId);

  if (type === "call:incoming" || type === "call:invite") {
    // ── Look up caller's display name from DB ──
    let callerName = "Unknown";
    try {
      const caller = await User.findById(fromUserId).select("fullName name");
      callerName = (caller as any)?.fullName || (caller as any)?.name || callerName;
    } catch (_) {}

    // Track call start time
    activeCalls.set(fromUserId, { receiverId: toUserId, startedAt: new Date() });

    if (target && target.readyState === WebSocket.OPEN) {
      target.send(
        JSON.stringify({
          ...data,
          fromUserId,
          callerName,       // ← inject real name
          type: "call:incoming",
        })
      );
    } else {
      ws.send(JSON.stringify({ type: "call:error", message: "User is offline" }));
    }
    return;
  }

  if (type === "call:ended") {
    const callInfo = activeCalls.get(fromUserId) ?? activeCalls.get(toUserId);
    if (callInfo) {
      const endedAt = new Date();
      const durationSec = Math.round((endedAt.getTime() - callInfo.startedAt.getTime()) / 1000);
      try {
        await CallLog.create({
          callerId:   new mongoose.Types.ObjectId(callInfo.receiverId === toUserId ? fromUserId : toUserId),
          receiverId: new mongoose.Types.ObjectId(callInfo.receiverId === toUserId ? toUserId : fromUserId),
          status: durationSec > 3 ? "completed" : "missed",
          startedAt: callInfo.startedAt,
          endedAt,
          duration: durationSec > 3 ? durationSec : undefined,
        });
      } catch (e) { console.error("CallLog save error:", e); }
      activeCalls.delete(fromUserId);
      activeCalls.delete(toUserId);
    }
  }

  if (type === "call:declined") {
    const callInfo = activeCalls.get(toUserId); // toUserId is the caller here
    if (callInfo) {
      try {
        await CallLog.create({
          callerId:   new mongoose.Types.ObjectId(toUserId),
          receiverId: new mongoose.Types.ObjectId(fromUserId),
          status: "declined",
          startedAt: callInfo.startedAt,
          endedAt: new Date(),
        });
      } catch (e) { console.error("CallLog save error:", e); }
      activeCalls.delete(toUserId);
    }
  }

  // Forward to target
  if (target && target.readyState === WebSocket.OPEN) {
    target.send(JSON.stringify({ ...data, fromUserId }));
  } else if (type !== "call:ended" && type !== "call:declined") {
    ws.send(JSON.stringify({ type: "call:error", message: "User is offline" }));
  }
}
