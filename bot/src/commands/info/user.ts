import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';

const BOT_ADMIN_USER_ID = process.env.BOT_ADMIN_USER_ID;

const developerBadges: { [key: string]: string } = {
  [BOT_ADMIN_USER_ID || '']: 'webmaster :3',
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

    let status: string | null = null;
    let deviceStr: string | null = null;
    let activityStr: string | null = null;

    if (member) {
      const presence = member.presence;
      status = presence?.status || null;
      
      if (status === 'online') {
        if (presence?.clientStatus?.desktop) {
          deviceStr = 'Desktop';
        } else if (presence?.clientStatus?.mobile) {
          deviceStr = 'Mobile';
        } else if (presence?.clientStatus?.web) {
          deviceStr = 'Website';
        } else {
          deviceStr = 'Unknown (no client status detected)';
        }
      } else if (status === 'offline') {
        deviceStr = 'Unknown (user is offline)';
      } else if (status) {
        deviceStr = `Unknown (${status})`;
      } else {
        deviceStr = 'Unknown (no status detected)';
      }

      if (presence?.activities && presence.activities.length > 0) {
        const activity = presence.activities[0];
        
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
        } else {
          activityStr = `Activity (${activity.type}): ${activity.name}`;
        }
      } else {
        activityStr = 'None (no activities detected)';
      }
    } else {
      deviceStr = 'Unknown (no member object)';
      activityStr = 'None (no member object)';
    }

    activityStr = truncateFieldValue(activityStr || '');

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
      PremiumEarlySupporter: '🕰️ Early Supporter',
      TeamPseudoUser: '👥 Team User',
      BugHunterLevel2: '🐞 Bug Hunter Level 2',
      VerifiedBot: '🤖 Verified Bot',
      VerifiedDeveloper: '🛠️ Early Verified Bot Dev',
      CertifiedModerator: '🛡️ Certified Mod',
    };

    const badges: string[] = [];
    if (targetUser.flags) {
      for (const [flag, emoji] of Object.entries(badgeMap)) {
        if (targetUser.flags?.has(flag as any)) {
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

    // Count how many servers the user is in with the bot
    let mutualServersCount = 0;
    try {
      const guilds = interaction.client.guilds.cache;
      for (const [guildId, guild] of guilds) {
        try {
          const member = await guild.members.fetch(targetUser.id);
          if (member) mutualServersCount++;
        } catch (error) {
          // User is not in this server, continue
        }
      }
    } catch (error) {
      // Ignore errors
    }

    embed.addFields(
      { name: 'Username', value: targetUser.username, inline: true },
      { name: 'User ID', value: targetUser.id, inline: true },
      { name: 'Status', value: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown', inline: true },
      { name: 'Device', value: deviceStr, inline: true },
      { name: 'Activity', value: activityStr, inline: true },
      { name: 'Mutual Servers with the bot', value: mutualServersCount.toString(), inline: true },
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

    try {
      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (error: any) {
      if (error.code === 10062) {
        // Interaction expired, ignore
        return;
      }
      throw error;
    }
  },
};
