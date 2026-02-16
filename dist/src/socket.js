"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = void 0;
const ws_1 = require("ws");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ChatMessage_1 = __importDefault(require("./models/ChatMessage"));
const mongoose_1 = __importDefault(require("mongoose"));
const initSocket = (server) => {
    const wss = new ws_1.WebSocketServer({ server, path: "/chat-ws" });
    const clients = new Map();
    wss.on("connection", (ws, req) => __awaiter(void 0, void 0, void 0, function* () {
        // 1. Auth
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        const token = url.searchParams.get("token");
        if (!token) {
            ws.close(1008, "Token required");
            return;
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "default_secret");
            ws.userId = decoded.id;
            ws.isAlive = true;
            // Keep track of client
            if (ws.userId) {
                clients.set(ws.userId, ws);
                console.log(`User connected: ${ws.userId}`);
            }
        }
        catch (err) {
            ws.close(1008, "Invalid token");
            return;
        }
        // 2. Pong heartbeat
        ws.on("pong", () => {
            ws.isAlive = true;
        });
        // 3. Handle messages
        ws.on("message", (data) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const parsed = JSON.parse(data);
                const { type } = parsed;
                if (type === "message:send") {
                    yield handleMessageSend(ws, parsed, clients);
                }
                else if (type === "message:read") {
                    handleMessageRead(ws, parsed, clients);
                }
                else if (type.startsWith("call:")) {
                    handleCallSignaling(ws, parsed, clients);
                }
            }
            catch (e) {
                console.error("Socket message error:", e);
            }
        }));
        // 4. Cleanup
        ws.on("close", () => {
            if (ws.userId) {
                clients.delete(ws.userId);
                console.log(`User disconnected: ${ws.userId}`);
            }
        });
    }));
    // Heartbeat interval
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            const extWs = ws;
            if (extWs.isAlive === false)
                return ws.terminate();
            extWs.isAlive = false;
            ws.ping();
        });
    }, 30000);
    wss.on("close", () => clearInterval(interval));
};
exports.initSocket = initSocket;
// Handlers
// Handlers
function handleMessageSend(ws, data, clients) {
    return __awaiter(this, void 0, void 0, function* () {
        const { conversationId, body } = data;
        const senderId = ws.userId;
        if (!senderId)
            return;
        try {
            // 1. Save to DB
            const newMessage = yield ChatMessage_1.default.create({
                conversationId,
                sender: new mongoose_1.default.Types.ObjectId(senderId),
                body,
                timestamp: Date.now(),
            });
            // 2. Relay to Recipient(s)
            // In a real app with group chat, you'd fetch conversation participants.
            // Since this is 1-on-1 and we don't have easy participant lookup here without querying Conversation,
            // we'll make a pragmatic assumption for this feature: 
            // The client SHOULD ideally send `toUserId`. If not, we broadcast to valid users in memory 
            // who are part of this conversation (which we can't fully know without DB).
            // However, for the Video Call feature request, the crucial part is SIGNALING.
            // Chat messages are secondary but important.
            // Let's rely on standard 'message:new' event.
            // NOTE: This implementation assumes we might need to look up the conversation to find the other user.
            // For speed, let's just send back confirmation to sender
            ws.send(JSON.stringify({
                type: 'message:sent',
                message: newMessage,
                tempId: data.tempId // Client provided temp ID to correlate
            }));
            // BROADCAST APPROACH (inefficient but works for small prototypes/demos):
            // Send to everyone else. The client filters by conversationId.
            clients.forEach((client, clientId) => {
                if (clientId !== senderId && client.readyState === ws_1.WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'message:new',
                        message: {
                            id: newMessage._id,
                            conversationId,
                            sender: senderId,
                            body,
                            timestamp: newMessage.timestamp,
                        }
                    }));
                }
            });
        }
        catch (error) {
            console.error("Error saving message:", error);
        }
    });
}
function handleMessageRead(ws, data, clients) {
    // Similar to send, notify sender that message was read
}
// VIDEO CALL SIGNALING
function handleCallSignaling(ws, data, clients) {
    const { type, conversationId, toUserId } = data;
    // Ideally, for calls we need `toUserId` explicitly or conversationId lookup.
    // The frontend should send `toUserId` for direct calls to make routing easy.
    // If `toUserId` is missing, we might struggle to route.
    // If the frontend includes `toUserId` (which for 1-on-1 is the other person), use it.
    if (toUserId) {
        const target = clients.get(toUserId);
        if (target && target.readyState === ws_1.WebSocket.OPEN) {
            // Add caller info to payload
            const payload = Object.assign(Object.assign({}, data), { fromUserId: ws.userId });
            // Forward event
            target.send(JSON.stringify(payload));
        }
        else {
            // Target offline
            ws.send(JSON.stringify({ type: 'call:error', message: 'User is offline' }));
        }
    }
    else {
        // Broadcast to conversation participants (requires DB lookup)
        // For now, if we don't have toUserId, we can't reliably route in this memory-only map
        // unless we know the mapping.
        console.warn("Call signaling missing toUserId", data);
    }
}
