import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType } from 'discord.js';
import axios from 'axios';
import * as path from 'path';
const { getGuildStats } = require(path.join(__dirname, '../../database'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warns a user')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The user to warn')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('The reason for the warning')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setContexts([InteractionContextType.Guild]),

  async execute(interaction: any) {
    if (!interaction.guild) {
      return await interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
    }

    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await interaction.reply(`${target.username} has been warned for: ${reason}`);

      // Send log to webhook
      const stats = await getGuildStats(interaction.guild.id);
      if (stats && stats.log_webhook_url) {
        const logEmbed = new EmbedBuilder()
          .setTitle('⚠️ User Warned')
          .setDescription(`${target.username} was warned`)
          .addFields(
            { name: 'User', value: `${target}`, inline: true },
            { name: 'User ID', value: target.id, inline: true },
            { name: 'Moderator', value: `${interaction.user}`, inline: true },
            { name: 'Reason', value: reason, inline: false }
          )
          .setColor(0xFFA500)
          .setThumbnail(target.displayAvatarURL({ dynamic: true }))
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
      await interaction.reply({ content: 'Failed to warn the user.', flags: 64 });
    }
  },
};
