import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "../src/config/db";
import authRoutes from "../src/routes/authRoutes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes
app.use("/api/auth", authRoutes);

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "API is running..." });
});

app.get("/api", (req: Request, res: Response) => {
  res.json({ message: "API is running..." });
});

// Connect to database once
let isConnected = false;

const handler = async (req: Request, res: Response) => {
  // Connect to DB on first request
  if (!isConnected) {
    try {
      await connectDB();
      isConnected = true;
    } catch (error) {
      console.error("Database connection error:", error);
    }
  }
  
  // Handle request with Express app
  app(req, res);
};

export default handler;
