import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType } from 'discord.js';
import axios from 'axios';
import * as path from 'path';
const { getGuildStats } = require(path.join(__dirname, '../../database'));

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
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts([InteractionContextType.Guild]),

  async execute(interaction: any) {
    if (!interaction.guild) {
      return await interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
    }
    const target = interaction.options.getMember('target');
    const duration = interaction.options.getInteger('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) {
      return interaction.reply({ content: 'User not found in this server.', flags: 64 });
    }

    try {
      await target.timeout(duration * 60 * 1000, reason);
      await interaction.reply(`${target.user.username} has been timed out for ${duration} minutes. Reason: ${reason}`);

      // Send log to webhook
      const stats = await getGuildStats(interaction.guild.id);
      if (stats && stats.log_webhook_url) {
        const logEmbed = new EmbedBuilder()
          .setTitle('⏰ User Timed Out')
          .setDescription(`${target.user.username} was timed out for ${duration} minutes`)
          .addFields(
            { name: 'User', value: `${target.user}`, inline: true },
            { name: 'User ID', value: target.user.id, inline: true },
            { name: 'Duration', value: `${duration} minutes`, inline: true },
            { name: 'Moderator', value: `${interaction.user}`, inline: true },
            { name: 'Reason', value: reason, inline: false }
          )
          .setColor(0xFFFF00)
          .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp();

        try {
          await axios.post(stats.log_webhook_url, {
            embeds: [logEmbed.toJSON()]
          });
        } catch (logError) {
          console.error('Error sending log to webhook:', logError);
        }
      }
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Failed to timeout the user.', flags: 64 });
    }
  },
};
