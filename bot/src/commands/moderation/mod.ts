import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType, ChannelType } from 'discord.js';
import axios from 'axios';
import * as path from 'path';
const { getGuildStats, createModerationLog } = require(path.join(__dirname, '../../database'));

// Helper functions from user.ts
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

const developerBadges: { [key: string]: string } = {
  'BOT_ADMIN_USER_ID': 'webmaster :3',
};

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
    .addSubcommandGroup(subcommandGroup =>
      subcommandGroup
        .setName('category')
        .setDescription('Category management commands')
        .addSubcommand(subcommand =>
          subcommand
            .setName('add')
            .setDescription('Add a category')
            .addStringOption(option =>
              option.setName('name')
                .setDescription('The name of the category')
                .setRequired(true)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('delete')
            .setDescription('Delete a category')
            .addChannelOption(option =>
              option.setName('category')
                .setDescription('The category to delete')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildCategory))))
    .addSubcommand(subcommand =>
      subcommand
        .setName('profile')
        .setDescription('View comprehensive user information and check blacklist status')
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

    // Fetch the blacklist data
    let blacklistData: string[] = [];
    try {
      const response = await axios.get('https://raw.githubusercontent.com/RuyokiVenyl/Ro-Cleaner-Reborn/refs/heads/main/List%20Of%20Suspicious%20Servers/user_ids.txt');
      blacklistData = response.data.split('\n').map((id: string) => id.trim()).filter((id: string) => id);
    } catch (error) {
      console.error('Error fetching blacklist data:', error);
    }

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

          const banEmbed = new EmbedBuilder()
            .setTimestamp()
            .setFooter({ text: `Moderator: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTitle('🔨 User Banned')
            .setDescription(`${targetUser.username} has been banned from the server`)
            .setColor(0xFF0000)
            .addFields(
              { name: 'User', value: `${targetUser}`, inline: true },
              { name: 'User ID', value: targetUser.id, inline: true },
              { name: 'Reason', value: reason, inline: false }
            );

          await interaction.reply({ embeds: [banEmbed] });

          // Send log to webhook
          const stats = await getGuildStats(interaction.guild.id);
          if (stats && stats.log_webhook_url) {
            try {
              await axios.post(stats.log_webhook_url, {
                embeds: [banEmbed.toJSON()]
              });
            } catch (logError) {
              console.error('Error sending log to webhook:', logError);
            }
          }
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

          const kickEmbed = new EmbedBuilder()
            .setTimestamp()
            .setFooter({ text: `Moderator: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTitle('👢 User Kicked')
            .setDescription(`${targetMember.user.username} has been kicked from the server`)
            .setColor(0xFFA500)
            .addFields(
              { name: 'User', value: `${targetMember.user}`, inline: true },
              { name: 'User ID', value: targetMember.user.id, inline: true },
              { name: 'Reason', value: reason, inline: false }
            );

          await interaction.reply({ embeds: [kickEmbed] });

          // Send log to webhook
          const kickStats = await getGuildStats(interaction.guild.id);
          if (kickStats && kickStats.log_webhook_url) {
            try {
              await axios.post(kickStats.log_webhook_url, {
                embeds: [kickEmbed.toJSON()]
              });
            } catch (logError) {
              console.error('Error sending log to webhook:', logError);
            }
          }
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
          const timeoutEmbed = new EmbedBuilder()
            .setTimestamp()
            .setFooter({ text: `Moderator: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTitle('⏰ User Timed Out')
            .setDescription(`${targetMember.user.username} has been timed out until ${cetTime} CET`)
            .setColor(0xFFFF00)
            .addFields(
              { name: 'User', value: `${targetMember.user}`, inline: true },
              { name: 'User ID', value: targetMember.user.id, inline: true },
              { name: 'Duration', value: `${duration} minutes`, inline: true },
              { name: 'Ends at', value: cetTime + ' CET', inline: true },
              { name: 'Reason', value: reason, inline: false }
            );

          await interaction.reply({ embeds: [timeoutEmbed] });

          // Send log to webhook
          const timeoutStats = await getGuildStats(interaction.guild.id);
          if (timeoutStats && timeoutStats.log_webhook_url) {
            try {
              await axios.post(timeoutStats.log_webhook_url, {
                embeds: [timeoutEmbed.toJSON()]
              });
            } catch (logError) {
              console.error('Error sending log to webhook:', logError);
            }
          }
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

          const warnEmbed = new EmbedBuilder()
            .setTimestamp()
            .setFooter({ text: `Moderator: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTitle('⚠️ User Warned')
            .setDescription(`${targetUser.username} has been warned`)
            .setColor(0xFFA500)
            .addFields(
              { name: 'User', value: `${targetUser}`, inline: true },
              { name: 'User ID', value: targetUser.id, inline: true },
              { name: 'Reason', value: reason, inline: false }
            );

          await interaction.reply({ embeds: [warnEmbed] });

          // Send log to webhook
          const warnStats = await getGuildStats(interaction.guild.id);
          if (warnStats && warnStats.log_webhook_url) {
            try {
              await axios.post(warnStats.log_webhook_url, {
                embeds: [warnEmbed.toJSON()]
              });
            } catch (logError) {
              console.error('Error sending log to webhook:', logError);
            }
          }
          break;


        case 'category':
          const categorySubcommand = interaction.options.getSubcommand();
          
          if (categorySubcommand === 'add') {
            // Check if user has Manage Channels permission
            if (!interaction.member.permissions.has('ManageChannels')) {
              return await interaction.reply({ content: 'You need Manage Channels permission to use this command.', flags: 64 });
            }
            
            const categoryName = interaction.options.getString('name');
            
            // Create the category
            const newCategory = await interaction.guild.channels.create({
              name: categoryName,
              type: ChannelType.GuildCategory
            });

            const categoryAddEmbed = new EmbedBuilder()
              .setTimestamp()
              .setFooter({ text: `Moderator: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
              .setTitle('➕ Category Added')
              .setDescription(`Category ${newCategory} has been created`)
              .setColor(0x00FF00)
              .addFields(
                { name: 'Category', value: `${newCategory}`, inline: true },
                { name: 'Category ID', value: newCategory.id, inline: true }
              );

            await interaction.reply({ embeds: [categoryAddEmbed] });
          } else if (categorySubcommand === 'delete') {
            // Check if user has Manage Channels permission
            if (!interaction.member.permissions.has('ManageChannels')) {
              return await interaction.reply({ content: 'You need Manage Channels permission to use this command.', flags: 64 });
            }
            
            const category = interaction.options.getChannel('category');
            
            // Delete the category
            await category.delete();

            const categoryDeleteEmbed = new EmbedBuilder()
              .setTimestamp()
              .setFooter({ text: `Moderator: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
              .setTitle('🗑️ Category Deleted')
              .setDescription(`Category ${category.name} has been deleted`)
              .setColor(0xFF0000)
              .addFields(
                { name: 'Category', value: `${category.name}`, inline: true },
                { name: 'Category ID', value: category.id, inline: true }
              );

            await interaction.reply({ embeds: [categoryDeleteEmbed] });
          }
          break;

        case 'profile':
          // Get user information
          const userOption = interaction.options.getUser('user');
          const profileUser = userOption || interaction.user;
          const profileMember = interaction.guild?.members.cache.get(profileUser.id);

          let bannerUrl: string | null = null;
          try {
            const fetchedUser = await interaction.client.users.fetch(profileUser.id);
            if (fetchedUser.banner) {
              bannerUrl = fetchedUser.bannerURL({ size: 1024 });
            }
          } catch (error) {
            // Ignore errors
          }

          let status = 'offline';
          let deviceStr = 'Unknown';
          let activityStr = 'None';

          if (profileMember && profileMember.presence) {
            status = profileMember.presence.status || 'offline';
            if (status === 'online' && profileMember.presence.clientStatus) {
              if (profileMember.presence.clientStatus.desktop) deviceStr = 'Desktop';
              else if (profileMember.presence.clientStatus.mobile) deviceStr = 'Mobile';
              else if (profileMember.presence.clientStatus.web) deviceStr = 'Website';
            }

            if (profileMember.presence.activities && profileMember.presence.activities.length > 0) {
              const activity = profileMember.presence.activities[0];
              switch (activity.type) {
                case 0: // Playing
                  activityStr = `Playing ${activity.name}`;
                  break;
                case 1: // Streaming
                  activityStr = `Streaming on ${activity.platform}`;
                  break;
                case 2: // Listening
                  if (activity.name === 'Spotify') {
                    activityStr = `Listening to ${activity.details} by ${activity.state}`;
                  } else {
                    activityStr = `Listening to ${activity.name}`;
                  }
                  break;
                case 3: // Watching
                  activityStr = `Watching ${activity.name}`;
                  break;
                case 4: // Custom
                  activityStr = activity.emoji ? `${activity.emoji} ${activity.state || activity.name}` : (activity.state || activity.name);
                  break;
                case 5: // Competing
                  activityStr = `Competing in ${activity.name}`;
                  break;
                default:
                  activityStr = activity.name || 'Unknown activity';
              }
            }
          }

          activityStr = truncateFieldValue(activityStr);

          let rolesStr = 'None';
          if (profileMember && profileMember.roles.cache.size > 1) {
            const roles = profileMember.roles.cache
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
          if (profileUser.flags) {
            for (const [flag, emoji] of Object.entries(badgeMap)) {
              if ((profileUser.flags as any)[flag]) {
                badges.push(emoji);
              }
            }
          }

          const developerBadge = developerBadges[profileUser.id];
          if (developerBadge) {
            badges.push(developerBadge);
          }

          const badgeStr = badges.join(', ');

          const profileEmbed = new EmbedBuilder()
            .setTitle(`User Info: ${profileMember?.displayName || profileUser.displayName}`)
            .setDescription(`Profile of ${profileUser}`)
            .setColor(profileMember?.displayHexColor || 0x0099ff)
            .setThumbnail(profileUser.displayAvatarURL({ dynamic: true }));

          if (bannerUrl) {
            profileEmbed.setImage(bannerUrl);
          }

          if (badgeStr) {
            profileEmbed.addFields({ name: 'Badges', value: badgeStr, inline: false });
          }

          profileEmbed.addFields(
            { name: 'Nickname', value: profileMember?.nickname || 'None', inline: true },
            { name: 'Username', value: profileUser.username, inline: true },
            { name: 'User ID', value: profileUser.id, inline: true },
            { name: 'Status', value: status.charAt(0).toUpperCase() + status.slice(1), inline: true },
            { name: 'Device', value: deviceStr, inline: true },
            { name: 'Activity', value: activityStr, inline: true },
            { name: 'Roles', value: rolesStr, inline: false }
          );

          const accountAge = formatTimeDifference(profileUser.createdAt);
          const accountCreatedText = `${profileUser.createdAt.toISOString().slice(0, 19).replace('T', ' ')} UTC\n(${accountAge} ago)`;
          profileEmbed.addFields({ name: 'Account Created', value: accountCreatedText, inline: true });

          if (profileMember?.joinedAt) {
            const serverJoinAge = formatTimeDifference(profileMember.joinedAt);
            const joinedServerText = `${profileMember.joinedAt.toISOString().slice(0, 19).replace('T', ' ')} UTC\n(${serverJoinAge} ago)`;
            profileEmbed.addFields({ name: 'Joined Server', value: joinedServerText, inline: true });
          }

          // Add blacklist check
          const isBlacklisted = blacklistData.includes(profileUser.id);
          if (isBlacklisted) {
            profileEmbed.addFields(
              { name: 'Blacklist Status', value: '⚠️ BLACKLISTED - User is on the RoCleaner blacklist! This means they were/are in a roblox sexual roleplay server.', inline: false }
            );
          } else {
            profileEmbed.addFields(
              { name: 'Blacklist Status', value: '✅ CLEAR - User is not on any blacklist.', inline: false }
            );
          }

          profileEmbed.setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
          });

          await interaction.reply({ embeds: [profileEmbed] });
          break;

        default:
          return await interaction.reply({ content: 'Unknown subcommand.', flags: 64 });
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