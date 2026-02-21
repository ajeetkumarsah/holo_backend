import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";
import OTP from "../models/OTP";
import { sendOTPEmail } from "../utils/emailService";
import { sendResponse } from "../utils/responseHandler";

// Generate JWT Token
const generateToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "secret", {
    expiresIn: "30d",
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { fullName, email, password, phone } = req.body;

  try {
    if (!fullName || !email || !password || !phone) {
      return sendResponse(res, 400, false, "Please add all fields");
    }

    // Check if user exists by email or phone
    const userExists = await User.findOne({ 
      $or: [{ email }, { phoneNumber: phone }] 
    });

    if (userExists) {
      if (userExists.email === email) {
        return sendResponse(res, 400, false, "Email already registered");
      }
      if (userExists.phoneNumber === phone) {
        return sendResponse(res, 400, false, "Phone number already registered");
      }
      return sendResponse(res, 400, false, "User already exists");
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      fullName,
      email,
      phoneNumber: phone,
      password: hashedPassword,
    });

    if (user) {
      return sendResponse(res, 201, true, "User registered successfully", {
        _id: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        token: generateToken(user.id),
      });
    } else {
      return sendResponse(res, 400, false, "Invalid user data");
    }
  } catch (error) {
    return sendResponse(res, 500, false, (error as Error).message);
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password || ""))) {
      return sendResponse(res, 200, true, "Login successful", {
        _id: user.id,
        fullName: user.fullName,
        email: user.email,
        token: generateToken(user.id),
      });
    } else {
      return sendResponse(res, 401, false, "Invalid credentials");
    }
  } catch (error) {
    return sendResponse(res, 500, false, (error as Error).message);
  }
};

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (
  req: Request | any,
  res: Response
): Promise<any> => {
  const user = await User.findById(req.user.id);

  if (user) {
    return sendResponse(res, 200, true, "User data fetched successfully", {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      bio: user.bio,
      avatar: user.avatar,
    });
  } else {
    return sendResponse(res, 404, false, "User not found");
  }
};

// @desc    Request Password Reset (Send OTP)
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      // For security, don't reveal if user exists
      return sendResponse(res, 200, true, "Success, an OTP has been sent.");
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiry to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Save OTP to database
    await OTP.create({
      email,
      otp: otpCode,
      expiresAt,
    });

    // Send OTP via email
    const emailSent = await sendOTPEmail(email, otpCode);

    if (emailSent) {
      return sendResponse(res, 200, true, "Success, an OTP has been sent.");
    } else {
      return sendResponse(res, 500, false, "Error sending OTP email");
    }
  } catch (error) {
    return sendResponse(res, 500, false, (error as Error).message);
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTP = async (req: Request, res: Response): Promise<any> => {
  const { email, otp } = req.body;

  try {
    const otpRecord = await OTP.findOne({
      email,
      otp,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return sendResponse(res, 400, false, "Invalid or expired OTP");
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Generate a temporary reset token (valid for 15 minutes)
    const resetToken = jwt.sign(
      { email, purpose: "password_reset" },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "15m" }
    );

    return sendResponse(res, 200, true, "OTP verified successfully", {
      resetToken,
    });
  } catch (error) {
    return sendResponse(res, 500, false, (error as Error).message);
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { resetToken, newPassword } = req.body;

  try {
    // Verify reset token
    const decoded = jwt.verify(
      resetToken,
      process.env.JWT_SECRET || "secret"
    ) as any;

    if (!decoded || decoded.purpose !== "password_reset") {
      return sendResponse(res, 400, false, "Invalid or expired reset token");
    }

    const email = decoded.email;
    const user = await User.findOne({ email });

    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user password
    user.password = hashedPassword;
    await user.save();

    // Invalidate any remaining OTPs for this email
    await OTP.updateMany({ email }, { isUsed: true });

    return sendResponse(res, 200, true, "Password reset successfully");
  } catch (error) {
    return sendResponse(res, 400, false, "Invalid or expired reset token");
  }
};

// @desc    Check if contacts are registered users
// @route   POST /api/users/check-registered
// @access  Private
export const checkRegisteredUsers = async (
  req: Request | any,
  res: Response
): Promise<any> => {
  const { identifiers } = req.body;

  try {
    if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) {
      return sendResponse(res, 400, false, "Please provide identifiers array");
    }

    // Find users by email OR phone number
    const users = await User.find({
      $or: [
        { email: { $in: identifiers } },
        { phoneNumber: { $in: identifiers } }
      ]
    }).select('_id email phoneNumber fullName');

    // Create a map of registered identifiers to user info
    const registeredUsers = users.flatMap(user => {
      const matches = [];
      
      // Add match for email if it's in the identifiers list
      if (user.email && identifiers.includes(user.email)) {
        matches.push({
          identifier: user.email,
          userId: user._id,
          fullName: user.fullName
        });
      }
      
      // Add match for phone if it's in the identifiers list
      if (user.phoneNumber && identifiers.includes(user.phoneNumber)) {
        matches.push({
          identifier: user.phoneNumber,
          userId: user._id,
          fullName: user.fullName
        });
      }
      
      return matches;
    });

    return sendResponse(res, 200, true, "Registered users fetched successfully", {
      registeredUsers
    });
  } catch (error) {
    return sendResponse(res, 500, false, (error as Error).message);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/me
// @access  Private
export const updateProfile = async (
  req: Request | any,
  res: Response
): Promise<any> => {
  const { fullName, bio, avatar } = req.body;

  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    if (fullName) user.fullName = fullName;
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    return sendResponse(res, 200, true, "Profile updated successfully", {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      bio: user.bio,
      avatar: user.avatar,
    });
  } catch (error) {
    return sendResponse(res, 500, false, (error as Error).message);
  }
};
