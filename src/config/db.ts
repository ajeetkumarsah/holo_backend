import mongoose from "mongoose";

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.warn("MONGO_URI not found in environment variables");
      throw new Error("MONGO_URI is required");
    }
    
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    // Don't exit process in serverless environment
    throw error;
  }
};

export default connectDB;
