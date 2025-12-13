# Multi-Purpose Discord Bot

A TypeScript Discord bot with moderation, fun, and information commands.

## Features

### Moderation Commands
- `/ban` - Ban a user from the server
- `/kick` - Kick a user from the server
- `/timeout` - Timeout a user for a specified duration

### Fun Commands
- `/joke` - Get a random joke
- `/meme` - Get a random meme

### Information Commands
- `/serverinfo` - Get information about the server
- `/userinfo` - Get information about a user

## Setup

1. Clone this repository and navigate to the bot directory
2. Install dependencies: `npm install`
3. Create a `.env` file based on `.env.example` and fill in your bot's token and client ID
4. Build the project: `npm run build`
5. Deploy slash commands: `npm run deploy`
6. Start the bot: `npm start`

## Environment Variables

- `DISCORD_TOKEN` - Your Discord bot token from the Discord Developer Portal
- `CLIENT_ID` - Your Discord application client ID

## Development

- `npm run dev` - Run the bot in development mode with ts-node
- `npm run watch` - Watch for TypeScript changes and rebuild automatically

## Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section and create a bot
4. Copy the token and client ID
5. Invite the bot to your server with appropriate permissions

## Permissions Required

The bot needs the following permissions:
- Send Messages
- Use Slash Commands
- Ban Members
- Kick Members
- Moderate Members
- View Channels
- Read Message History
