import { Events } from 'discord.js';
import * as path from 'path';
const { getAllGuildStats } = require(path.join(__dirname, '../database'));

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client: any) {
    console.log(`Ready! Logged in as ${client.user.tag}`);

    // Update stats channels every 1.5 minutes
    setInterval(async () => {
      try {
        const allStats = await getAllGuildStats();
        for (const stats of allStats) {
          const guild = client.guilds.cache.get(stats.guild_id);
          if (!guild) continue;

          // Calculate current stats
          const memberCount = guild.memberCount;
          const daysSince = Math.floor((Date.now() - guild.createdTimestamp) / (1000 * 60 * 60 * 24));
          const roleCount = guild.roles.cache.size;
          const channelCount = guild.channels.cache.size;

          // Update Members channel
          if (stats.member_channel_id) {
            const channel = guild.channels.cache.get(stats.member_channel_id);
            if (channel) await channel.setName(`Members: ${memberCount}`);
          }

          // Update Days channel
          if (stats.days_channel_id) {
            const channel = guild.channels.cache.get(stats.days_channel_id);
            if (channel) await channel.setName(`Days: ${daysSince}`);
          }

          // Update Roles channel
          if (stats.roles_channel_id) {
            const channel = guild.channels.cache.get(stats.roles_channel_id);
            if (channel) await channel.setName(`Roles: ${roleCount}`);
          }

          // Update Channels channel
          if (stats.channels_channel_id) {
            const channel = guild.channels.cache.get(stats.channels_channel_id);
            if (channel) await channel.setName(`Channels: ${channelCount}`);
          }
        }
      } catch (error) {
        console.error('Error updating stats channels:', error);
      }
    }, 90000); // 1.5 minutes
  },
};
