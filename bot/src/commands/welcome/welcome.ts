import { SlashCommandBuilder, ChannelType } from 'discord.js';
import * as path from 'path';
const { getGuildStats, setGuildStats } = require(path.join(__dirname, '../../database'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Manage welcome messages')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Set up the welcome channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('The channel to send welcome messages to')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('titleset')
        .setDescription('Set the welcome title')
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('The title for welcome messages')
            .setRequired(true)
        )
    )
    .setDMPermission(true),

  async execute(interaction: any) {
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      await interaction.deferReply();

      let stats = await getGuildStats(guild.id);
      if (!stats) {
        stats = { guild_id: guild.id };
      }

      if (subcommand === 'setup') {
        const channel = interaction.options.getChannel('channel');
        stats.welcome_channel_id = channel.id;
        await setGuildStats(stats);
        await interaction.editReply({ content: `Welcome channel set to ${channel}!` });
      } else if (subcommand === 'titleset') {
        const title = interaction.options.getString('title');
        stats.welcome_title = title;
        await setGuildStats(stats);
        await interaction.editReply({ content: `Welcome title set to "${title}"!` });
      }
    } catch (error) {
      console.error('Error in welcome command:', error);
      try {
        await interaction.editReply({ content: 'An error occurred while setting up welcome messages.' });
      } catch {
        // Ignore if interaction is expired
      }
    }
  },
};
