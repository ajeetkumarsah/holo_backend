"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    // Handle JSON parsing errors (e.g. body-parser SyntaxError)
    if (err instanceof SyntaxError && 'body' in err && err.type === 'entity.parse.failed') {
        return res.status(400).json({
            status: false,
            message: "Invalid JSON format. Please check your request body."
        });
    }
    res.status(statusCode).json({
        status: false,
        message: err.message || "Internal Server Error",
        stack: process.env.NODE_ENV === "production" ? null : err.stack,
    });
};
exports.errorHandler = errorHandler;
