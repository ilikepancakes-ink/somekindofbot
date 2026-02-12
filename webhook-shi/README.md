# Status Webhook Server

A TypeScript/Express server that receives status updates from various platforms and provides an API to retrieve the current status.

## Endpoints

### Status Receiver Endpoints

- `POST /status/rec/discord` - Receive Discord status updates
- `POST /status/rec/github` - Receive GitHub status updates  
- `POST /status/rec/cloudflare` - Receive Cloudflare status updates
- `POST /status/rec/aws` - Receive AWS status updates

### Status Pull Endpoint

- `GET /status/int/pull?platform=<platform>` - Get status for specific platform
- `GET /status/int/pull` - Get status for all platforms

### Health Check

- `GET /health` - Health check endpoint

## Usage

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start

# Or run in development mode
npm run dev
```

## Integration with Main Project

The webhook server is integrated with the main bot project and can be started alongside other services using:

```bash
cd bot && npm run deploy
```

This will start:
- The Discord bot
- The website server  
- The webhook status server (on port 5642)

## Status Data Format

The server stores status data with the following structure:

```typescript
{
  platform: string,
  status: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage',
  message?: string,
  timestamp: number,
  components?: Component[]
}
```

## Supported Platforms

- Discord
- GitHub
- Cloudflare
- AWS

Each platform has its own webhook endpoint and data format handling.