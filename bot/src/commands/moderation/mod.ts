import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType } from 'discord.js';
import axios from 'axios';
import * as path from 'path';
const { getGuildStats, createModerationLog } = require(path.join(__dirname, '../../database'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Moderation commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('ban')
        .setDescription('Bans a user from the server')
        .addUserOption(option =>
          option.setName('target')
            .setDescription('The user to ban')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('The reason for the ban')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('kick')
        .setDescription('Kicks a user from the server')
        .addUserOption(option =>
          option.setName('target')
            .setDescription('The user to kick')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('The reason for the kick')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
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
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('warn')
        .setDescription('Warns a user')
        .addUserOption(option =>
          option.setName('target')
            .setDescription('The user to warn')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('The reason for the warning')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('profile')
        .setDescription('View a user\'s moderation profile')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to view the profile for')
            .setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setContexts([InteractionContextType.Guild]),

  async execute(interaction: any) {
    if (!interaction.guild) {
      return await interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
    }

    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('target');
    const targetMember = interaction.options.getMember('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Check permissions
    const member = interaction.member;
    if (!member.permissions.has) {
      return await interaction.reply({ content: 'You do not have permission to use this command.', flags: 64 });
    }

    switch (subcommand) {
      case 'ban':
        if (!member.permissions.has('BanMembers')) {
          return await interaction.reply({ content: 'You need Ban Members permission to use this command.', flags: 64 });
        }
        break;
      case 'kick':
      case 'warn':
        if (!member.permissions.has('KickMembers')) {
          return await interaction.reply({ content: 'You need Kick Members permission to use this command.', flags: 64 });
        }
        break;
      case 'timeout':
        if (!member.permissions.has('ModerateMembers')) {
          return await interaction.reply({ content: 'You need Moderate Members permission to use this command.', flags: 64 });
        }
        break;
    }

    const embed = new EmbedBuilder()
      .setTimestamp()
      .setFooter({ text: `Moderator: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

    let title: string;
    let description: string;
    let color: number;
    let thumbnail: string;

    try {
      switch (subcommand) {
        case 'ban':
          await interaction.guild.members.ban(targetUser, { reason });
          
          // Log the moderation action
          await createModerationLog({
            guild_id: interaction.guild.id,
            user_id: targetUser.id,
            moderator_id: interaction.user.id,
            action_type: 'ban',
            reason: reason,
            timestamp: Date.now()
          });
          
          title = '🔨 User Banned';
          description = `${targetUser.username} has been banned from the server`;
          color = 0xFF0000;
          thumbnail = targetUser.displayAvatarURL({ dynamic: true });
          embed.addFields(
            { name: 'User', value: `${targetUser}`, inline: true },
            { name: 'User ID', value: targetUser.id, inline: true },
            { name: 'Reason', value: reason, inline: false }
          );
          break;

        case 'kick':
          if (!targetMember) {
            return await interaction.reply({ content: 'User not found in this server.', flags: 64 });
          }
          await targetMember.kick(reason);
          
          // Log the moderation action
          await createModerationLog({
            guild_id: interaction.guild.id,
            user_id: targetUser.id,
            moderator_id: interaction.user.id,
            action_type: 'kick',
            reason: reason,
            timestamp: Date.now()
          });
          
          title = '👢 User Kicked';
          description = `${targetMember.user.username} has been kicked from the server`;
          color = 0xFFA500;
          thumbnail = targetMember.user.displayAvatarURL({ dynamic: true });
          embed.addFields(
            { name: 'User', value: `${targetMember.user}`, inline: true },
            { name: 'User ID', value: targetMember.user.id, inline: true },
            { name: 'Reason', value: reason, inline: false }
          );
          break;

        case 'timeout':
          if (!targetMember) {
            return await interaction.reply({ content: 'User not found in this server.', flags: 64 });
          }
          const duration = interaction.options.getInteger('duration');
          await targetMember.timeout(duration * 60 * 1000, reason);
          
          // Log the moderation action
          await createModerationLog({
            guild_id: interaction.guild.id,
            user_id: targetUser.id,
            moderator_id: interaction.user.id,
            action_type: 'timeout',
            reason: reason,
            duration: duration,
            timestamp: Date.now()
          });
          
          const endTime = new Date(Date.now() + duration * 60 * 1000);
          const cetTime = endTime.toLocaleString('en-GB', { timeZone: 'Europe/Paris', hour12: false });
          title = '⏰ User Timed Out';
          description = `${targetMember.user.username} has been timed out until ${cetTime} CET`;
          color = 0xFFFF00;
          thumbnail = targetMember.user.displayAvatarURL({ dynamic: true });
          embed.addFields(
            { name: 'User', value: `${targetMember.user}`, inline: true },
            { name: 'User ID', value: targetMember.user.id, inline: true },
            { name: 'Duration', value: `${duration} minutes`, inline: true },
            { name: 'Ends at', value: cetTime + ' CET', inline: true },
            { name: 'Reason', value: reason, inline: false }
          );
          break;

        case 'warn':
          // Log the moderation action
          await createModerationLog({
            guild_id: interaction.guild.id,
            user_id: targetUser.id,
            moderator_id: interaction.user.id,
            action_type: 'warn',
            reason: reason,
            timestamp: Date.now()
          });
          
          title = '⚠️ User Warned';
          description = `${targetUser.username} has been warned`;
          color = 0xFFA500;
          thumbnail = targetUser.displayAvatarURL({ dynamic: true });
          embed.addFields(
            { name: 'User', value: `${targetUser}`, inline: true },
            { name: 'User ID', value: targetUser.id, inline: true },
            { name: 'Reason', value: reason, inline: false }
          );
          break;

        default:
          return await interaction.reply({ content: 'Unknown subcommand.', flags: 64 });
      }

      embed.setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setThumbnail(thumbnail);

      await interaction.reply({ embeds: [embed] });

      // Send log to webhook
      const stats = await getGuildStats(interaction.guild.id);
      if (stats && stats.log_webhook_url) {
        const logEmbed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(description.replace('has been', 'was'))
          .addFields(embed.data.fields!)
          .setColor(color)
          .setThumbnail(thumbnail)
          .setTimestamp()
          .setFooter({ text: `Moderator: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

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
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription(`Failed to ${subcommand} the user.`)
        .setColor(0xFF0000)
        .setTimestamp();
      await interaction.reply({ embeds: [errorEmbed], flags: 64 });
    }
  },
};
