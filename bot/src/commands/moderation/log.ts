import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();
const { getGuildStats, setGuildStats } = require(path.join(__dirname, '../../database'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('log')
    .setDescription('Manage server logging')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Set up logging webhook in a channel')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel to send logs to')
            .setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(true),

  async execute(interaction: any, isAdmin: boolean = false) {
    if (!interaction.guild) {
      return await interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
    }

    // Check if user has Manage Guild permission or is bot admin
    if (!isAdmin && !interaction.member.permissions.has('ManageGuild')) {
      return await interaction.reply({ content: 'You need Manage Guild permission to use this command.', flags: 64 });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setup') {
      const channel = interaction.options.getChannel('channel');

      if (channel.type !== 0) { // GuildText
        return await interaction.reply({ content: 'Please select a text channel.', flags: 64 });
      }

      try {
        // Create webhook
        const webhook = await channel.createWebhook({
          name: 'Server Logs',
          avatar: interaction.guild.iconURL({ dynamic: true }) || undefined,
        });

        // Save webhook URL to DB
        let stats = await getGuildStats(interaction.guild.id);
        if (!stats) {
          stats = { guild_id: interaction.guild.id };
        }
        stats.log_webhook_url = webhook.url;
        await setGuildStats(stats);

        await interaction.reply({ content: `Logging webhook set up in ${channel}! All server events will be logged here.`, flags: 64 });
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Failed to set up logging webhook. Make sure I have the Manage Webhooks permission.', flags: 64 });
      }
    }
  },
};
