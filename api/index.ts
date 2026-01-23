import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "../src/config/db";
import authRoutes from "../src/routes/authRoutes";

dotenv.config();

// Connect to database
connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("API is running...");
});

// Export the Express app as a serverless function
export default app;
