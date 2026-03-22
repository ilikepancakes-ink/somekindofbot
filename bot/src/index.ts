import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

config();

import { Gork } from './cogs/gork';

import './server';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

(client as any).commands = new Collection();

async function loadCommands() {
  const commands: any[] = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFolders = fs.readdirSync(commandsPath);

  (client as any).commands.clear();

  const fileExtension = __filename.endsWith('.ts') ? '.ts' : '.js';

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith(fileExtension));

    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);

      delete require.cache[require.resolve(filePath)];

      let command = require(filePath);
      // some modules export with `export default {...}` when using ts-node/ESM
      command = command.default || command;

      if (command.data && command.execute) {
        command.group = folder;
        // Some commands export the raw JSON (from toJSON()) instead of a builder.
        // Normalize so we always have an object with a name and a toJSON-compatible value.
        let data = command.data;
        if (typeof data.toJSON === 'function') {
          data = data.toJSON();
        }

        (client as any).commands.set(data.name, command);
        commands.push(data);
      } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    }
  }

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

    const fileExtension = __filename.endsWith('.ts') ? '.ts' : '.js';
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

    // Initialize Gork cog
    const gork = new Gork(client);
    (client as any).gork = gork;

    await client.login(process.env.DISCORD_TOKEN);
    console.log('Bot logged in successfully!');
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main();

export { client, loadCommands };
