import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "../src/config/db";
import authRoutes from "../src/routes/authRoutes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.get("/api", (req, res) => {
  res.send("API is running...");
});

// Connect to database on first request
let isConnected = false;
const connectToDatabase = async () => {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
};

// Export handler for Vercel
export default async (req: any, res: any) => {
  await connectToDatabase();
  return app(req, res);
};

