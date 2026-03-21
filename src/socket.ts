import { WebSocket, WebSocketServer } from "ws";
import { Server, IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import User from "./models/User";
import ChatMessage from "./models/ChatMessage";
import Conversation from "./models/Conversation";
import CallLog from "./models/CallLog";
import mongoose from "mongoose";
import { sendPushNotification } from "./utils/fcmService";

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
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(1008, "Token required");
      return;
    }

    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "secret");
      ws.userId = decoded.id;
      ws.isAlive = true;
      if (ws.userId) {
        clients.set(ws.userId, ws);
        console.log(`User connected: ${ws.userId}`);
      }
    } catch (err) {
      ws.close(1008, "Invalid token");
      return;
    }

    ws.on("pong", () => { ws.isAlive = true; });

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

    ws.on("close", () => {
      if (ws.userId) {
        clients.delete(ws.userId);
        console.log(`User disconnected: ${ws.userId}`);
      }
    });
  });

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

async function handleMessageSend(
  ws: ExtendedWebSocket,
  data: any,
  clients: Map<string, ExtendedWebSocket>
) {
  const { conversationId, toUserId, body } = data;
  const senderId = ws.userId;
  if (!senderId || !toUserId || !body) return;

  try {
    const senderObjId = new mongoose.Types.ObjectId(senderId);
    const receiverObjId = new mongoose.Types.ObjectId(toUserId);

    // Resolve or create conversation
    let conversation =
      conversationId && typeof conversationId === "string"
        ? await Conversation.findById(conversationId)
        : null;

    if (
      conversation &&
      !(
        (conversation as any).members?.some(
          (m: any) => m.toString() === senderObjId.toString()
        ) &&
        (conversation as any).members?.some(
          (m: any) => m.toString() === receiverObjId.toString()
        )
      )
    ) {
      conversation = null;
    }

    if (!conversation) {
      conversation = await Conversation.findOne({
        members: { $all: [senderObjId, receiverObjId], $size: 2 },
      });
      if (!conversation) {
        conversation = await Conversation.create({
          members: [senderObjId, receiverObjId],
          lastMessage: body,
          lastTimestamp: Date.now(),
        });
      }
    }

    const newMessage = await ChatMessage.create({
      conversationId: (conversation as any)._id.toString(),
      sender: senderObjId,
      body,
      timestamp: Date.now(),
    });

    (conversation as any).lastMessage = body;
    (conversation as any).lastTimestamp = (newMessage as any).timestamp;
    await (conversation as any).save();

    // Ack sender (include real conversationId so frontend can migrate from temp ID)
    const sender = clients.get(senderId);
    if (sender && sender.readyState === WebSocket.OPEN) {
      sender.send(
        JSON.stringify({
          type: "message:ack",
          messageId: newMessage._id,
          tempId: data.tempId,
          conversationId: (conversation as any)._id.toString(),
        })
      );
    }

    // Fetch sender info + receiver FCM token in parallel
    let senderName = "User";
    let senderAvatar = "";
    let receiverFcmToken = "";
    try {
      const [senderUser, receiverUser] = await Promise.all([
        User.findById(senderId).select("fullName name avatar"),
        User.findById(toUserId).select("fcmToken"),
      ]);
      senderName =
        (senderUser as any)?.fullName ||
        (senderUser as any)?.name ||
        senderName;
      senderAvatar = (senderUser as any)?.avatar || "";
      receiverFcmToken = (receiverUser as any)?.fcmToken || "";
    } catch (_) {}

    const messagePayload = JSON.stringify({
      type: "message:new",
      message: {
        id: newMessage._id,
        conversationId: (conversation as any)._id.toString(),
        sender: senderId,
        senderName,
        senderAvatar,
        toUserId,
        body,
        timestamp: newMessage.timestamp,
      },
    });

    // Echo message:new to sender so their conversation list updates in real-time
    // (especially important for new conversations where conversationId gets assigned)
    if (sender && sender.readyState === WebSocket.OPEN) {
      sender.send(messagePayload);
    }

    const receiver = clients.get(toUserId);
    if (receiver && receiver.readyState === WebSocket.OPEN) {
      // Receiver is online — deliver via WebSocket
      receiver.send(messagePayload);

      // Mark as delivered back to sender
      if (sender && sender.readyState === WebSocket.OPEN) {
        sender.send(
          JSON.stringify({
            type: "message:delivered",
            messageId: newMessage._id,
            deliveredAt: Date.now(),
          })
        );
      }
    } else if (receiverFcmToken) {
      // Receiver is offline — send FCM push notification
      await sendPushNotification({
        token: receiverFcmToken,
        title: senderName,
        body,
        data: {
          type: "message:new",
          conversationId: (conversation as any)._id.toString(),
          messageId: String(newMessage._id),
          senderId,
          senderName,
          senderAvatar,
          body,
          timestamp: String(newMessage.timestamp),
        },
      });
    }
  } catch (error) {
    console.error("Error saving message:", error);
  }
}

async function handleMessageRead(
  ws: ExtendedWebSocket,
  data: any,
  clients: Map<string, ExtendedWebSocket>
) {
  const { conversationId, messageId } = data;
  const readerId = ws.userId;
  if (!readerId) return;

  try {
    const timestamp = Date.now();
    const query: any = {
      conversationId,
      sender: { $ne: readerId },
      readAt: { $exists: false },
    };
    if (messageId) query._id = messageId;

    await ChatMessage.updateMany(query, { readAt: timestamp });

    clients.forEach((client, clientId) => {
      if (clientId !== readerId && client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "message:read",
            conversationId,
            messageId,
            readAt: timestamp,
          })
        );
      }
    });
  } catch (e) {
    console.error("Error updating read status:", e);
  }
}

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
    let callerName = "Unknown";
    try {
      const caller = await User.findById(fromUserId).select("fullName name");
      callerName =
        (caller as any)?.fullName || (caller as any)?.name || callerName;
    } catch (_) {}

    activeCalls.set(fromUserId, { receiverId: toUserId, startedAt: new Date() });

    if (target && target.readyState === WebSocket.OPEN) {
      target.send(
        JSON.stringify({ ...data, fromUserId, callerName, type: "call:incoming" })
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
      const durationSec = Math.round(
        (endedAt.getTime() - callInfo.startedAt.getTime()) / 1000
      );
      try {
        await CallLog.create({
          callerId: new mongoose.Types.ObjectId(
            callInfo.receiverId === toUserId ? fromUserId : toUserId
          ),
          receiverId: new mongoose.Types.ObjectId(
            callInfo.receiverId === toUserId ? toUserId : fromUserId
          ),
          status: durationSec > 3 ? "completed" : "missed",
          startedAt: callInfo.startedAt,
          endedAt,
          duration: durationSec > 3 ? durationSec : undefined,
        });
      } catch (e) {
        console.error("CallLog save error:", e);
      }
      activeCalls.delete(fromUserId);
      activeCalls.delete(toUserId);

      [fromUserId, toUserId].forEach((id) => {
        const client = clients.get(id);
        if (client && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "history:updated" }));
        }
      });
    }
  }

  if (type === "call:declined") {
    const callInfo = activeCalls.get(toUserId);
    if (callInfo) {
      try {
        await CallLog.create({
          callerId: new mongoose.Types.ObjectId(toUserId),
          receiverId: new mongoose.Types.ObjectId(fromUserId),
          status: "declined",
          startedAt: callInfo.startedAt,
          endedAt: new Date(),
        });
      } catch (e) {
        console.error("CallLog save error:", e);
      }
      activeCalls.delete(toUserId);

      [fromUserId, toUserId].forEach((id) => {
        const client = clients.get(id);
        if (client && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "history:updated" }));
        }
      });
    }
  }

  if (target && target.readyState === WebSocket.OPEN) {
    target.send(JSON.stringify({ ...data, fromUserId }));
  } else if (type !== "call:ended" && type !== "call:declined") {
    ws.send(JSON.stringify({ type: "call:error", message: "User is offline" }));
  }
}
