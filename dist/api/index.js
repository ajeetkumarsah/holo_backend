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
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const db_1 = __importDefault(require("../src/config/db"));
const authRoutes_1 = __importDefault(require("../src/routes/authRoutes"));
const errorMiddleware_1 = require("../src/middleware/errorMiddleware");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
// Routes
app.use("/api/auth", authRoutes_1.default);
app.get("/", (req, res) => {
    res.json({ message: "API is running..." });
});
app.get("/api", (req, res) => {
    res.json({ message: "API is running..." });
});
app.use(errorMiddleware_1.errorHandler);
// Connect to database once
let isConnected = false;
const handler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Connect to DB on first request
    if (!isConnected) {
        try {
            yield (0, db_1.default)();
            isConnected = true;
        }
        catch (error) {
            console.error("Database connection error:", error);
        }
    }
    // Handle request with Express app
    app(req, res);
});
exports.default = handler;
