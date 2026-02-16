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
exports.checkRegisteredUsers = exports.resetPassword = exports.verifyOTP = exports.forgotPassword = exports.getMe = exports.loginUser = exports.registerUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const OTP_1 = __importDefault(require("../models/OTP"));
const emailService_1 = require("../utils/emailService");
const responseHandler_1 = require("../utils/responseHandler");
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
    const { fullName, email, password, phone } = req.body;
    try {
        if (!fullName || !email || !password || !phone) {
            return (0, responseHandler_1.sendResponse)(res, 400, false, "Please add all fields");
        }
        // Check if user exists by email or phone
        const userExists = yield User_1.default.findOne({
            $or: [{ email }, { phoneNumber: phone }]
        });
        if (userExists) {
            if (userExists.email === email) {
                return (0, responseHandler_1.sendResponse)(res, 400, false, "Email already registered");
            }
            if (userExists.phoneNumber === phone) {
                return (0, responseHandler_1.sendResponse)(res, 400, false, "Phone number already registered");
            }
            return (0, responseHandler_1.sendResponse)(res, 400, false, "User already exists");
        }
        // Hash password
        const salt = yield bcryptjs_1.default.genSalt(10);
        const hashedPassword = yield bcryptjs_1.default.hash(password, salt);
        // Create user
        const user = yield User_1.default.create({
            fullName,
            email,
            phoneNumber: phone,
            password: hashedPassword,
        });
        if (user) {
            return (0, responseHandler_1.sendResponse)(res, 201, true, "User registered successfully", {
                _id: user.id,
                fullName: user.fullName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                token: generateToken(user.id),
            });
        }
        else {
            return (0, responseHandler_1.sendResponse)(res, 400, false, "Invalid user data");
        }
    }
    catch (error) {
        return (0, responseHandler_1.sendResponse)(res, 500, false, error.message);
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
            return (0, responseHandler_1.sendResponse)(res, 200, true, "Login successful", {
                _id: user.id,
                fullName: user.fullName,
                email: user.email,
                token: generateToken(user.id),
            });
        }
        else {
            return (0, responseHandler_1.sendResponse)(res, 401, false, "Invalid credentials");
        }
    }
    catch (error) {
        return (0, responseHandler_1.sendResponse)(res, 500, false, error.message);
    }
});
exports.loginUser = loginUser;
// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getMe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield User_1.default.findById(req.user.id);
    if (user) {
        return (0, responseHandler_1.sendResponse)(res, 200, true, "User data fetched successfully", {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
        });
    }
    else {
        return (0, responseHandler_1.sendResponse)(res, 404, false, "User not found");
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
            return (0, responseHandler_1.sendResponse)(res, 200, true, "Success, an OTP has been sent.");
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
            return (0, responseHandler_1.sendResponse)(res, 200, true, "Success, an OTP has been sent.");
        }
        else {
            return (0, responseHandler_1.sendResponse)(res, 500, false, "Error sending OTP email");
        }
    }
    catch (error) {
        return (0, responseHandler_1.sendResponse)(res, 500, false, error.message);
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
            return (0, responseHandler_1.sendResponse)(res, 400, false, "Invalid or expired OTP");
        }
        // Mark OTP as used
        otpRecord.isUsed = true;
        yield otpRecord.save();
        // Generate a temporary reset token (valid for 15 minutes)
        const resetToken = jsonwebtoken_1.default.sign({ email, purpose: "password_reset" }, process.env.JWT_SECRET || "secret", { expiresIn: "15m" });
        return (0, responseHandler_1.sendResponse)(res, 200, true, "OTP verified successfully", {
            resetToken,
        });
    }
    catch (error) {
        return (0, responseHandler_1.sendResponse)(res, 500, false, error.message);
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
            return (0, responseHandler_1.sendResponse)(res, 400, false, "Invalid or expired reset token");
        }
        const email = decoded.email;
        const user = yield User_1.default.findOne({ email });
        if (!user) {
            return (0, responseHandler_1.sendResponse)(res, 404, false, "User not found");
        }
        // Hash new password
        const salt = yield bcryptjs_1.default.genSalt(10);
        const hashedPassword = yield bcryptjs_1.default.hash(newPassword, salt);
        // Update user password
        user.password = hashedPassword;
        yield user.save();
        // Invalidate any remaining OTPs for this email
        yield OTP_1.default.updateMany({ email }, { isUsed: true });
        return (0, responseHandler_1.sendResponse)(res, 200, true, "Password reset successfully");
    }
    catch (error) {
        return (0, responseHandler_1.sendResponse)(res, 400, false, "Invalid or expired reset token");
    }
});
exports.resetPassword = resetPassword;
// @desc    Check if contacts are registered users
// @route   POST /api/users/check-registered
// @access  Private
const checkRegisteredUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { identifiers } = req.body;
    try {
        if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) {
            return (0, responseHandler_1.sendResponse)(res, 400, false, "Please provide identifiers array");
        }
        // Find users by email OR phone number
        const users = yield User_1.default.find({
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
        return (0, responseHandler_1.sendResponse)(res, 200, true, "Registered users fetched successfully", {
            registeredUsers
        });
    }
    catch (error) {
        return (0, responseHandler_1.sendResponse)(res, 500, false, error.message);
    }
});
exports.checkRegisteredUsers = checkRegisteredUsers;
