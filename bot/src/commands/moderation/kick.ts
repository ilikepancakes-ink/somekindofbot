import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType } from 'discord.js';
import axios from 'axios';
import * as path from 'path';
const { getGuildStats } = require(path.join(__dirname, '../../database'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kicks a user from the server')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The user to kick')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('The reason for the kick')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setContexts([InteractionContextType.Guild]),

  async execute(interaction: any) {
    if (!interaction.guild) {
      return await interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
    }

    const target = interaction.options.getMember('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) {
      return await interaction.reply({ content: 'User not found in this server.', flags: 64 });
    }

    try {
      await target.kick(reason);
      await interaction.reply(`${target.user.username} has been kicked for: ${reason}`);

      // Send log to webhook
      const stats = await getGuildStats(interaction.guild.id);
      if (stats && stats.log_webhook_url) {
        const logEmbed = new EmbedBuilder()
          .setTitle('👢 User Kicked')
          .setDescription(`${target.user.username} was kicked from the server`)
          .addFields(
            { name: 'User', value: `${target.user}`, inline: true },
            { name: 'User ID', value: target.user.id, inline: true },
            { name: 'Moderator', value: `${interaction.user}`, inline: true },
            { name: 'Reason', value: reason, inline: false }
          )
          .setColor(0xFFA500)
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
      await interaction.reply({ content: 'Failed to kick the user.', flags: 64 });
    }
  },
};
