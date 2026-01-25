import mongoose, { Document, Schema } from "mongoose";

export interface IOTP extends Document {
  email: string;
  otp: string;
  createdAt: Date;
  expiresAt: Date;
  isUsed: boolean;
}

const OTPSchema: Schema = new Schema({
  email: {
    type: String,
    required: true,
    index: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: "1h" }, // TTL index to auto-delete after 1 hour (though we check for 10 min)
  },
  isUsed: {
    type: Boolean,
    default: false,
  },
});

const OTP = mongoose.model<IOTP>("OTP", OTPSchema);

export default OTP;
