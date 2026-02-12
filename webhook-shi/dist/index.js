"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
// Import route handlers
const discord_1 = require("./routes/discord");
const github_1 = require("./routes/github");
const cloudflare_1 = require("./routes/cloudflare");
const aws_1 = require("./routes/aws");
const pull_1 = require("./routes/pull");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Status receiver endpoints
app.post('/status/rec/discord', discord_1.handleDiscordWebhook);
app.post('/status/rec/github', github_1.handleGitHubWebhook);
app.post('/status/rec/cloudflare', cloudflare_1.handleCloudflareWebhook);
app.post('/status/rec/aws', aws_1.handleAWSWebhook);
// Status pull endpoint
app.get('/status/int/pull', pull_1.getStatus);
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
// Start server
app.listen(PORT, () => {
    console.log(`Status webhook server running on port ${PORT}`);
    console.log(`Discord webhook: POST /status/rec/discord`);
    console.log(`GitHub webhook: POST /status/rec/github`);
    console.log(`Cloudflare webhook: POST /status/rec/cloudflare`);
    console.log(`AWS webhook: POST /status/rec/aws`);
    console.log(`Status pull: GET /status/int/pull?platform=<platform>`);
    console.log(`Health check: GET /health`);
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});
