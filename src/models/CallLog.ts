import mongoose, { Schema, Document } from 'mongoose';

export type CallStatus = 'completed' | 'missed' | 'declined';

export interface ICallLog extends Document {
  callerId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  status: CallStatus;
  startedAt: Date;
  endedAt?: Date;
  duration?: number; // seconds
}

const CallLogSchema = new Schema<ICallLog>(
  {
    callerId:   { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status:     { type: String, enum: ['completed', 'missed', 'declined'], required: true },
    startedAt:  { type: Date, required: true },
    endedAt:    { type: Date },
    duration:   { type: Number }, // seconds, null for missed/declined
  },
  { timestamps: false }
);

export default mongoose.model<ICallLog>('CallLog', CallLogSchema);
