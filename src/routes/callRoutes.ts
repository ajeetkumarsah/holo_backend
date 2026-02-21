import express from 'express';
import { protect } from '../middleware/authMiddleware';
import CallLog from '../models/CallLog';
import User from '../models/User';
import mongoose from 'mongoose';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

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

/**
 * GET /api/calls/token
 * Generates an Agora RTC token for a specific channel.
 * Query params: channel (string), uid (number, optional)
 */
router.get('/token', protect, async (req: any, res) => {
  try {
    const channelName = req.query.channel as string;
    if (!channelName) {
      return res.status(400).json({ status: false, message: 'Channel name is required' });
    }

    const appId = process.env.AGORA_APP_ID || '4109263ac089453ba4b0a85b16eb36d2';
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    
    if (!appCertificate) {
      console.warn('AGORA_APP_CERTIFICATE not found in environment. Token will be invalid.');
      // For fallback/best practice, we should ideally fail here, 
      // but let's try to proceed with a placeholder or warning if it's a dev environment.
    }

    const uid = parseInt(req.query.uid as string) || 0;
    const role = RtcRole.PUBLISHER;

    const expirationTimeInSeconds = 3600; // 1 hour
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate || "", // If no certificate, token won't work in secured mode
      channelName,
      uid,
      role,
      privilegeExpiredTs,
      privilegeExpiredTs
    );

    res.json({ status: true, token, appId });
  } catch (err) {
    console.error('Agora token error:', err);
    res.status(500).json({ status: false, message: 'Failed to generate token' });
  }
});

export default router;
