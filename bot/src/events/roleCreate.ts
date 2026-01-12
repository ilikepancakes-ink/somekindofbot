import { Events, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import * as path from 'path';
const { getGuildStats } = require(path.join(__dirname, '../database'));

module.exports = {
  name: Events.GuildRoleCreate,
  once: false,
  execute(role: any) {
    (async () => {
      try {
        const stats = await getGuildStats(role.guild.id);
        if (!stats || !stats.log_webhook_url) return;

        const logEmbed = new EmbedBuilder()
          .setTitle('🎭 Role Created')
          .setDescription(`A new role was created`)
          .addFields(
            { name: 'Role', value: `${role}`, inline: true },
            { name: 'Role ID', value: role.id, inline: true },
            { name: 'Color', value: role.hexColor, inline: true }
          )
          .setColor(role.color || 0x00AAFF)
          .setTimestamp();

        await axios.post(stats.log_webhook_url, {
          embeds: [logEmbed.toJSON()]
        });
      } catch (error) {
        console.error('Error sending log to webhook:', error);
      }
    })();
  },
};
