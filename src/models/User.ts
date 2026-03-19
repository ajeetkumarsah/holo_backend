import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  fullName: string;
  email: string;
  phoneNumber?: string;
  password?: string;
  bio?: string;
  avatar?: string;
  fcmToken?: string;
  createdAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    bio: { type: String, default: "Hey there! I am using HoloLink." },
    avatar: { type: String, default: "" },
    fcmToken: { type: String, default: "" },
  },
  { timestamps: true }
);

const User = mongoose.model<IUser>("User", UserSchema);
export default User;
