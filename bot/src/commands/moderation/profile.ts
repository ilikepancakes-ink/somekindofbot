import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';
import * as path from 'path';
const { getGuildStats, getModerationLogsByUser, getModerationSummaryByUser } = require(path.join(__dirname, '../../database'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modprofile')
    .setDescription('View a user\'s moderation profile')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to view the profile for')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setContexts([InteractionContextType.Guild]),

  async execute(interaction: any) {
    if (!interaction.guild) {
      return await interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
    }

    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.guild.members.cache.get(targetUser.id);

    // Check permissions
    const member = interaction.member;
    if (!member.permissions.has) {
      return await interaction.reply({ content: 'You do not have permission to use this command.', flags: 64 });
    }

    if (!member.permissions.has('KickMembers')) {
      return await interaction.reply({ content: 'You need Kick Members permission to use this command.', flags: 64 });
    }

    // Get user's moderation actions and summary
    const moderationActions = await getModerationLogsByUser(targetUser.id, interaction.guild.id);
    const summary = await getModerationSummaryByUser(targetUser.id, interaction.guild.id);

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`Moderation Profile: ${targetMember?.displayName || targetUser.username}`)
      .setDescription(`Profile for ${targetUser}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setColor(0xFFA500)
      .setFooter({
        text: `Requested by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true })
      })
      .setTimestamp();

    // Add user info
    embed.addFields(
      { name: 'Username', value: targetUser.username, inline: true },
      { name: 'User ID', value: targetUser.id, inline: true },
      { name: 'Joined Server', value: targetMember?.joinedAt ? `<t:${Math.floor(targetMember.joinedAt.getTime() / 1000)}:R>` : 'Not a member', inline: true }
    );

    // Add action counts
    embed.addFields({
      name: 'Moderation Summary',
      value: `**Warns:** ${summary.warns}\n**Timeouts:** ${summary.timeouts}\n**Kicks:** ${summary.kicks}\n**Bans:** ${summary.bans}`,
      inline: false
    });

    // Add recent actions
    if (moderationActions.length > 0) {
      const recentActions = moderationActions.slice(0, 5);

      let actionsText = '';
      recentActions.forEach((action: any) => {
        const timeAgo = `<t:${Math.floor(action.timestamp / 1000)}:R>`;
        const emoji = getActionEmoji(action.action_type);
        actionsText += `${emoji} **${action.action_type.toUpperCase()}** by <@${action.moderator_id}> ${timeAgo}\n`;
        if (action.reason) actionsText += `   Reason: ${action.reason}\n`;
        if (action.duration) actionsText += `   Duration: ${action.duration} minutes\n`;
        actionsText += '\n';
      });

      embed.addFields({
        name: 'Recent Actions',
        value: actionsText || 'No recent actions',
        inline: false
      });
    } else {
      embed.addFields({
        name: 'Recent Actions',
        value: 'No moderation actions found',
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });
  },
};

// Helper function to get action emoji
function getActionEmoji(type: string): string {
  switch (type) {
    case 'warn': return '⚠️';
    case 'timeout': return '⏰';
    case 'kick': return '👢';
    case 'ban': return '🔨';
    default: return '📝';
  }
}
