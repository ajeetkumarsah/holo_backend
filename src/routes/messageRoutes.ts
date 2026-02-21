import express from 'express';
import { protect } from '../middleware/authMiddleware';
import ChatMessage from '../models/ChatMessage';
import Conversation from '../models/Conversation';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * GET /api/messages/conversations
 * Returns all conversations for the authenticated user.
 */
router.get('/conversations', protect, async (req: any, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    
    // Find all conversations where user is a member
    const conversations = await Conversation.find({
      members: { $in: [userId] }
    })
    .populate('members', 'fullName avatar email phoneNumber')
    .sort({ lastTimestamp: -1 })
    .lean();

    const mapped = await Promise.all(conversations.map(async (conv: any) => {
      // Find the "other" user in the conversation
      const otherUser = conv.members.find((m: any) => m._id.toString() !== userId.toString());
      
      // Calculate unread count (messages in this conversation NOT sent by me and NOT read)
      const unreadCount = await ChatMessage.countDocuments({
        conversationId: conv._id.toString(),
        sender: { $ne: userId },
        readAt: { $exists: false }
      });

      return {
        id: conv._id.toString(),
        name: otherUser?.fullName || 'Unknown',
        avatar_url: otherUser?.avatar || '',
        last_message: conv.lastMessage || '',
        last_timestamp: conv.lastTimestamp || 0,
        unread_count: unreadCount,
        is_online: false, // Placeholder for real-time status
      };
    }));

    res.json({ status: true, data: mapped });
  } catch (err) {
    console.error('Fetch conversations error:', err);
    res.status(500).json({ status: false, message: 'Failed to fetch conversations' });
  }
});

/**
 * GET /api/messages/:conversationId
 * Returns message history for a specific conversation.
 */
router.get('/:conversationId', protect, async (req: any, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const messages = await ChatMessage.find({ conversationId })
      .sort({ timestamp: 1 })
      .lean();

    const mapped = messages.map((msg: any) => ({
      id: msg._id.toString(),
      conversationId: msg.conversationId,
      senderName: '', // Frontend resolves this via conversation info
      senderAvatar: '',
      body: msg.body,
      timestamp: msg.timestamp,
      isMine: msg.sender.toString() === userId.toString(),
      deliveredAt: msg.deliveredAt,
      readAt: msg.readAt,
      status: msg.readAt ? 3 : (msg.deliveredAt ? 2 : 1), // Map to MessageStatus enum
    }));

    res.json({ status: true, data: mapped });
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ status: false, message: 'Failed to fetch messages' });
  }
});

export default router;
