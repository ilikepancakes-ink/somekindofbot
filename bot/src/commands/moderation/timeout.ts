import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { promises as fs } from 'fs';
import { join } from 'path';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Times out a user for a specified duration')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The user to timeout')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('Duration in minutes (max 40320 minutes = 28 days)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('The reason for the timeout')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: any) {
    const target = interaction.options.getMember('target');
    const duration = interaction.options.getInteger('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) {
      return interaction.reply({ content: 'User not found in this server.', flags: 64 });
    }

    try {
      await target.timeout(duration * 60 * 1000, reason);
      await interaction.reply(`${target.user.username} has been timed out for ${duration} minutes. Reason: ${reason}`);

      // Log the timeout in CET
      const logsDir = join(__dirname, '../../logs');
      await fs.mkdir(logsDir, { recursive: true });
      const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'CET' });
      const logEntry = `[${timestamp}] User ${target.user.tag} timed out for ${duration} minutes in ${interaction.guild.name} by ${interaction.user.tag}. Reason: ${reason}\n`;
      await fs.appendFile(join(logsDir, 'timeouts.log'), logEntry);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Failed to timeout the user.', flags: 64 });
    }
  },
};
