import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';

// Configuration interface
interface ConfessionConfig {
  confession_channel_id?: string;
  logging_channel_id?: string;
}

interface ServerConfigs {
  [guildId: string]: ConfessionConfig;
}

// Load configurations from file
function loadConfigs(): ServerConfigs {
  const configPath = path.join(__dirname, 'confession_configs.json');
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.error('Error loading confession configs:', error);
      return {};
    }
  }
  return {};
}

// Save configurations to file
function saveConfigs(configs: ServerConfigs) {
  const configPath = path.join(__dirname, 'confession_configs.json');
  try {
    fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
  } catch (error) {
    console.error('Error saving confession configs:', error);
  }
}

// Load initial configs
let configs = loadConfigs();

// Setup command group
module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup commands for the confessions cog')
    .setContexts([InteractionContextType.Guild])
    .addSubcommand(subcommand =>
      subcommand
        .setName('logs-set')
        .setDescription('Set the channel for logging confessions')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel to set as the logging channel')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('channel-set')
        .setDescription('Set the channel for anonymous confessions')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel to set as the confession channel')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('post-button')
        .setDescription('Post a confess button in the current channel')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: any) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'logs-set') {
      await handleSetupLogsSet(interaction);
    } else if (subcommand === 'channel-set') {
      await handleSetupChannelSet(interaction);
    } else if (subcommand === 'post-button') {
      await handleSetupPostButton(interaction);
    }
  }
};

async function handleSetupLogsSet(interaction: any) {
  const channel = interaction.options.getChannel('channel');
  const guildId = interaction.guild.id;

  if (!configs[guildId]) {
    configs[guildId] = {};
  }
  configs[guildId].logging_channel_id = channel.id;
  saveConfigs(configs);

  await interaction.reply({ 
    content: `Logging channel set to ${channel}`, 
    ephemeral: true 
  });
}

async function handleSetupChannelSet(interaction: any) {
  const channel = interaction.options.getChannel('channel');
  const guildId = interaction.guild.id;

  if (!configs[guildId]) {
    configs[guildId] = {};
  }
  configs[guildId].confession_channel_id = channel.id;
  saveConfigs(configs);

  await interaction.reply({ 
    content: `Confession channel set to ${channel}`, 
    ephemeral: true 
  });
}

async function handleSetupPostButton(interaction: any) {
  // Create embed for the confess button
  const embed = new EmbedBuilder()
    .setTitle('📝 Anonymous Confessions')
    .setDescription('Click the button below to submit an anonymous confession.')
    .setColor(0x0099ff) // Blue color
    .setFooter({ text: 'Your confession will be posted anonymously' });

  // Create the view with the confess button
  const { ConfessionView } = await import('./confessions');
  const view = new ConfessionView();

  // Send the message with the button
  await interaction.reply({ embeds: [embed], components: [view] });
  await interaction.followUp({ 
    content: 'Confess button posted successfully!', 
    ephemeral: true 
  });
}
