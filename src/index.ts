import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db";
import authRoutes from "./routes/authRoutes";
import callRoutes from "./routes/callRoutes";

import { sendResponse } from "./utils/responseHandler";
import { errorHandler } from "./middleware/errorMiddleware";

dotenv.config();

const port = process.env.PORT || 5000;

connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/api/auth",  authRoutes);
app.use("/api/calls", callRoutes);


app.get("/", (req, res) => {
  sendResponse(res, 200, true, "API is running...");
});

// Error handling middleware
app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

import { initSocket } from "./socket";
initSocket(server);

export default app;