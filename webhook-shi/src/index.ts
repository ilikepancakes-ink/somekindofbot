import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import route handlers
import { handleDiscordWebhook } from './routes/discord';
import { handleGitHubWebhook } from './routes/github';
import { handleCloudflareWebhook } from './routes/cloudflare';
import { handleAWSWebhook } from './routes/aws';
import { getStatus } from './routes/pull';
import { handleStatusCommand } from './discordCommand';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5642;

// Middleware
app.use(cors());
app.use(express.json());

// Status receiver endpoints
app.post('/status/rec/discord', handleDiscordWebhook);
app.post('/status/rec/github', handleGitHubWebhook);
app.post('/status/rec/cloudflare', handleCloudflareWebhook);
app.post('/status/rec/aws', handleAWSWebhook);

// Status pull endpoint
app.get('/status/int/pull', getStatus);

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