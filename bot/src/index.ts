import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables FIRST
config();

import './server';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// Collection to store commands
(client as any).commands = new Collection();

async function loadCommands() {
  const commands: any[] = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFolders = fs.readdirSync(commandsPath);

  // Clear existing commands
  (client as any).commands.clear();

  // Determine file extension based on current file (ts for dev, js for built)
  const fileExtension = __filename.endsWith('.ts') ? '.ts' : '.js';

  for (const folder of commandFolders) 
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith(fileExtension));

    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);

      // Clear require cache to reload the module
      delete require.cache[require.resolve(filePath)];

      const command = require(filePath);

      if (command.data && command.execute) {
        // Store the group (folder name) with the command
        command.group = folder;
        (client as any).commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
      } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    }
  }

  // Register commands with Discord
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

  console.log(`Started refreshing ${commands.length} application (/) commands.`);

  const data: any = await rest.put(
    Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
    { body: commands },
  );

  console.log(`Successfully reloaded ${data.length} application (/) commands.`);
 }

async function main() {
  try {
    await loadCommands();

    // Determine file extension based on current file (ts for dev, js for built)
    const fileExtension = __filename.endsWith('.ts') ? '.ts' : '.js';

    // Load events
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(fileExtension));

    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const event = require(filePath);

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
      } else {
        client.on(event.name, (...args) => event.execute(...args));
      }
    }

    await client.login(process.env.DISCORD_TOKEN);
    console.log('Bot logged in successfully!');
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main();

// Export for external use (e.g., in update command)
export { client, loadCommands };
