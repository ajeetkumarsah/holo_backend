"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.verifyOTP = exports.forgotPassword = exports.getMe = exports.loginUser = exports.registerUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const OTP_1 = __importDefault(require("../models/OTP"));
const emailService_1 = require("../utils/emailService");
// Generate JWT Token
const generateToken = (id) => {
    return jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET || "secret", {
        expiresIn: "30d",
    });
};
// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { fullName, email, password } = req.body;
    try {
        if (!fullName || !email || !password) {
            res.status(400).json({ message: "Please add all fields" });
            return;
        }
        // Check if user exists
        const userExists = yield User_1.default.findOne({ email });
        if (userExists) {
            res.status(400).json({ message: "User already exists" });
            return;
        }
        // Hash password
        const salt = yield bcryptjs_1.default.genSalt(10);
        const hashedPassword = yield bcryptjs_1.default.hash(password, salt);
        // Create user
        const user = yield User_1.default.create({
            fullName,
            email,
            password: hashedPassword,
        });
        if (user) {
            res.status(201).json({
                _id: user.id,
                fullName: user.fullName,
                email: user.email,
                token: generateToken(user.id),
            });
        }
        else {
            res.status(400).json({ message: "Invalid user data" });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.registerUser = registerUser;
// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    try {
        const user = yield User_1.default.findOne({ email });
        if (user && (yield bcryptjs_1.default.compare(password, user.password || ""))) {
            res.json({
                _id: user.id,
                fullName: user.fullName,
                email: user.email,
                token: generateToken(user.id),
            });
        }
        else {
            res.status(401).json({ message: "Invalid credentials" });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.loginUser = loginUser;
// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getMe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield User_1.default.findById(req.user.id);
    if (user) {
        res.status(200).json({
            id: user._id,
            fullName: user.fullName,
            email: user.email,
        });
    }
    else {
        res.status(404).json({ message: "User not found" });
    }
});
exports.getMe = getMe;
// @desc    Request Password Reset (Send OTP)
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    try {
        const user = yield User_1.default.findOne({ email });
        if (!user) {
            // For security, don't reveal if user exists
            res.status(200).json({
                message: "If an account exists with that email, an OTP has been sent.",
            });
            return;
        }
        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        // Set expiry to 10 minutes from now
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        // Save OTP to database
        yield OTP_1.default.create({
            email,
            otp: otpCode,
            expiresAt,
        });
        // Send OTP via email
        const emailSent = yield (0, emailService_1.sendOTPEmail)(email, otpCode);
        if (emailSent) {
            res.status(200).json({
                message: "If an account exists with that email, an OTP has been sent.",
            });
        }
        else {
            res.status(500).json({ message: "Error sending OTP email" });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.forgotPassword = forgotPassword;
// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, otp } = req.body;
    try {
        const otpRecord = yield OTP_1.default.findOne({
            email,
            otp,
            isUsed: false,
            expiresAt: { $gt: new Date() },
        });
        if (!otpRecord) {
            res.status(400).json({ message: "Invalid or expired OTP" });
            return;
        }
        // Mark OTP as used
        otpRecord.isUsed = true;
        yield otpRecord.save();
        // Generate a temporary reset token (valid for 15 minutes)
        const resetToken = jsonwebtoken_1.default.sign({ email, purpose: "password_reset" }, process.env.JWT_SECRET || "secret", { expiresIn: "15m" });
        res.status(200).json({
            message: "OTP verified successfully",
            resetToken,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.verifyOTP = verifyOTP;
// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { resetToken, newPassword } = req.body;
    try {
        // Verify reset token
        const decoded = jsonwebtoken_1.default.verify(resetToken, process.env.JWT_SECRET || "secret");
        if (!decoded || decoded.purpose !== "password_reset") {
            res.status(400).json({ message: "Invalid or expired reset token" });
            return;
        }
        const email = decoded.email;
        const user = yield User_1.default.findOne({ email });
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        // Hash new password
        const salt = yield bcryptjs_1.default.genSalt(10);
        const hashedPassword = yield bcryptjs_1.default.hash(newPassword, salt);
        // Update user password
        user.password = hashedPassword;
        yield user.save();
        // Invalidate any remaining OTPs for this email
        yield OTP_1.default.updateMany({ email }, { isUsed: true });
        res.status(200).json({ message: "Password reset successfully" });
    }
    catch (error) {
        res.status(400).json({ message: "Invalid or expired reset token" });
    }
});
exports.resetPassword = resetPassword;
