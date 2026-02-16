import mongoose from "mongoose";

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.warn("MONGO_URI not found in environment variables");
      throw new Error("MONGO_URI is required");
    }

    const uri = process.env.MONGO_URI;
    if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
      console.error("Invalid MONGO_URI scheme. URI must start with mongodb:// or mongodb+srv://");
      // Log masked URI for debugging (mask password)
      const maskedUri = uri.replace(/:([^@]+)@/, ":****@");
      console.error(`Received MONGO_URI (masked): ${maskedUri}`);
      throw new Error("Invalid MONGO_URI scheme");
    }
    
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    // Don't exit process in serverless environment
    throw error;
  }
};

export default connectDB;
