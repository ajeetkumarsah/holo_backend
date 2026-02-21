import express from 'express';
import { protect } from '../middleware/authMiddleware';
import CallLog from '../models/CallLog';
import User from '../models/User';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * GET /api/calls/history
 * Returns the call history for the authenticated user (as caller OR receiver).
 * Sorted by most recent first.
 */
router.get('/history', protect, async (req: any, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const logs = await CallLog.find({
      $or: [{ callerId: userId }, { receiverId: userId }],
    })
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('callerId',   'fullName name _id')
      .populate('receiverId', 'fullName name _id')
      .lean();

    const myId = userId.toString();

    const mapped = logs.map((log: any) => {
      const callerIdStr   = log.callerId?._id?.toString();
      const isOutgoing    = callerIdStr === myId;
      const other         = isOutgoing ? log.receiverId : log.callerId;
      const otherName     = other?.fullName || other?.name || 'Unknown';
      const otherUserId   = other?._id?.toString() ?? '';

      return {
        id:           log._id?.toString(),
        otherUserId,
        otherUserName: otherName,
        direction:     isOutgoing ? 'outgoing' : 'incoming',
        status:        log.status,  // completed | missed | declined
        startedAt:     log.startedAt,
        endedAt:       log.endedAt,
        duration:      log.duration,
      };
    });

    res.json({ status: true, data: mapped });
  } catch (err) {
    console.error('Call history error:', err);
    res.status(500).json({ status: false, message: 'Failed to fetch call history' });
  }
});

export default router;
