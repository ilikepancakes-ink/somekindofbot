import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';

const BOT_ADMIN_USER_ID = process.env.BOT_ADMIN_USER_ID;

const developerBadges: { [key: string]: string } = {
  [BOT_ADMIN_USER_ID || '']: '🛡️ OpenGuard Developer',
};

const truncateFieldValue = (text: string, maxLength: number = 1020): string => {
  if (text.length > maxLength) {
    return text.slice(0, maxLength - 3) + '...';
  }
  return text;
};

const formatTimeDifference = (pastTime: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - pastTime.getTime();
  const totalMinutes = Math.floor(diffMs / (1000 * 60));

  const years = Math.floor(totalMinutes / (365 * 24 * 60));
  let remainingMinutes = totalMinutes % (365 * 24 * 60);

  const days = Math.floor(remainingMinutes / (24 * 60));
  remainingMinutes = remainingMinutes % (24 * 60);

  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);

  if (parts.length === 0) return 'Less than a minute';

  return parts.join(', ');
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('Get information about a user')
    .addSubcommand(subcommand =>
      subcommand
        .setName('about')
        .setDescription('Display comprehensive info about a user or yourself')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to get info about (optional)')
            .setRequired(false)))
    .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM]),

  async execute(interaction: any) {
    const userOption = interaction.options.getUser('user');
    const targetUser = userOption || interaction.user;
    const member = interaction.guild?.members.cache.get(targetUser.id);

    let bannerUrl: string | null = null;
    try {
      const fetchedUser = await interaction.client.users.fetch(targetUser.id);
      if (fetchedUser.banner) {
        bannerUrl = fetchedUser.bannerURL({ size: 1024 });
      }
    } catch (error) {
      // Ignore errors
    }

    let status = 'Unknown';
    let deviceStr = 'Unknown';
    let activityStr = 'None';

    if (member) {
      status = member.presence?.status || 'offline';
      if (status === 'online') {
        if (member.presence?.clientStatus?.desktop) deviceStr = 'Desktop';
        else if (member.presence?.clientStatus?.mobile) deviceStr = 'Mobile';
        else if (member.presence?.clientStatus?.web) deviceStr = 'Website';
      }

      if (member.presence?.activities && member.presence.activities.length > 0) {
        const activity = member.presence.activities[0];
        if (activity.type === 0) { // Playing
          activityStr = `Playing ${activity.name}`;
        } else if (activity.type === 1) { // Streaming
          activityStr = `Streaming on ${activity.platform}`;
        } else if (activity.type === 4) { // Custom
          activityStr = activity.emoji ? `${activity.emoji} ${activity.state || activity.name}` : (activity.state || activity.name);
        } else if (activity.type === 2) { // Listening
          if (activity.name === 'Spotify') {
            activityStr = `Listening to ${activity.details} by ${activity.state}`;
          } else {
            activityStr = `Listening to ${activity.name}`;
          }
        }
      }
    }

    activityStr = truncateFieldValue(activityStr);

    let rolesStr = 'None';
    if (member && member.roles.cache.size > 0) {
      const roles = member.roles.cache
        .filter((role: any) => role.name !== '@everyone')
        .sort((a: any, b: any) => b.position - a.position)
        .map((role: any) => role.toString());
      if (roles.length > 0) {
        rolesStr = roles.join(', ');
        rolesStr = truncateFieldValue(rolesStr);
      }
    }

    const badgeMap: { [key: string]: string } = {
      Staff: '🛡️ Discord Staff',
      Partner: '⭐ Partner',
      Hypesquad: '🏆 HypeSquad Event',
      BugHunterLevel1: '🐛 Bug Hunter',
      HypeSquadOnlineHouse1: '🦁 Bravery',
      HypeSquadOnlineHouse2: '🧠 Brilliance',
      HypeSquadOnlineHouse3: '⚖️ Balance',
      EarlySupporter: '🕰️ Early Supporter',
      TeamPseudoUser: '👥 Team User',
      BugHunterLevel2: '🐞 Bug Hunter Level 2',
      VerifiedBot: '🤖 Verified Bot',
      EarlyVerifiedBotDeveloper: '🛠️ Early Verified Bot Dev',
      DiscordCertifiedModerator: '🛡️ Certified Mod',
      ActiveDeveloper: '🧑‍💻 Active Developer',
    };

    const badges: string[] = [];
    if (targetUser.flags) {
      for (const [flag, emoji] of Object.entries(badgeMap)) {
        if ((targetUser.flags as any)[flag]) {
          badges.push(emoji);
        }
      }
    }

    const developerBadge = developerBadges[targetUser.id];
    if (developerBadge) {
      badges.push(developerBadge);
    }

    const badgeStr = badges.join(', ');

    const embed = new EmbedBuilder()
      .setTitle(`User Info: ${member?.displayName || targetUser.displayName}`)
      .setDescription(`Profile of ${targetUser}`)
      .setColor(member?.displayHexColor || 0x0099ff)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));

    if (bannerUrl) {
      embed.setImage(bannerUrl);
    }

    if (badgeStr) {
      embed.addFields({ name: 'Badges', value: badgeStr, inline: false });
    }

    embed.addFields(
      { name: 'Nickname', value: member?.nickname || 'None', inline: true },
      { name: 'Username', value: targetUser.username, inline: true },
      { name: 'User ID', value: targetUser.id, inline: true },
      { name: 'Status', value: status.charAt(0).toUpperCase() + status.slice(1), inline: true },
      { name: 'Device', value: deviceStr, inline: true },
      { name: 'Activity', value: activityStr, inline: true },
      { name: 'Roles', value: rolesStr, inline: false }
    );

    const accountAge = formatTimeDifference(targetUser.createdAt);
    const accountCreatedText = `${targetUser.createdAt.toISOString().slice(0, 19).replace('T', ' ')} UTC\n(${accountAge} ago)`;
    embed.addFields({ name: 'Account Created', value: accountCreatedText, inline: true });

    if (member?.joinedAt) {
      const serverJoinAge = formatTimeDifference(member.joinedAt);
      const joinedServerText = `${member.joinedAt.toISOString().slice(0, 19).replace('T', ' ')} UTC\n(${serverJoinAge} ago)`;
      embed.addFields({ name: 'Joined Server', value: joinedServerText, inline: true });
    }

    embed.setFooter({
      text: `Requested by ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL({ dynamic: true })
    });

    const viewButton = new ButtonBuilder()
      .setCustomId(`user_permissions_${targetUser.id}`)
      .setLabel('View Permissions')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(viewButton);

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
