"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const db_1 = __importDefault(require("./config/db"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const responseHandler_1 = require("./utils/responseHandler");
const errorMiddleware_1 = require("./middleware/errorMiddleware");
dotenv_1.default.config();
const port = process.env.PORT || 5000;
(0, db_1.default)();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
app.use("/api/auth", authRoutes_1.default);
app.get("/", (req, res) => {
    (0, responseHandler_1.sendResponse)(res, 200, true, "API is running...");
});
// Error handling middleware
app.use(errorMiddleware_1.errorHandler);
const server = app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
const socket_1 = require("./socket");
(0, socket_1.initSocket)(server);
exports.default = app;
