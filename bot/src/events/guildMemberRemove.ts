import { Events, EmbedBuilder } from 'discord.js';
import * as path from 'path';
const { getGuildStats } = require(path.join(__dirname, '../database'));

module.exports = {
  name: Events.GuildMemberRemove,
  once: false,
  execute(member: any) {
    // Send goodbye message if configured
    (async () => {
      try {
        const stats = await getGuildStats(member.guild.id);
        if (!stats || !stats.goodbye_channel_id || !stats.goodbye_title) return;

        const channel = member.guild.channels.cache.get(stats.goodbye_channel_id);
        if (!channel || !channel.isTextBased()) return;

        const embed = new EmbedBuilder()
          .setTitle(`${stats.goodbye_title} 😢`)
          .setDescription(`Goodbye ${member.user.username}! We'll miss you in ${member.guild.name}.`)
          .setColor(0xFF0000)
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      } catch (error) {
        console.error('Error sending goodbye message:', error);
      }
    })();
  },
};
