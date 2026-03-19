import express from "express";
import {
  registerUser,
  loginUser,
  getMe,
  forgotPassword,
  verifyOTP,
  resetPassword,
  checkRegisteredUsers,
  updateProfile,
  updateFcmToken,
  getUserById,
} from "../controllers/authController";
import { protect } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, getMe);
router.put("/me", protect, updateProfile);
router.put("/fcm-token", protect, updateFcmToken);

// Password Reset Routes
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOTP);
router.post("/reset-password", resetPassword);

// User Routes
router.post("/check-registered", protect, checkRegisteredUsers);
router.get("/users/:id", protect, getUserById);

export default router;

