import { Events, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import * as path from 'path';
const { getGuildStats } = require(path.join(__dirname, '../database'));

module.exports = {
  name: Events.ChannelCreate,
  once: false,
  execute(channel: any) {
    (async () => {
      try {
        const stats = await getGuildStats(channel.guild.id);
        if (!stats || !stats.log_webhook_url) return;

        const logEmbed = new EmbedBuilder()
          .setTitle('📺 Channel Created')
          .setDescription(`A new channel was created`)
          .addFields(
            { name: 'Channel', value: `${channel}`, inline: true },
            { name: 'Channel ID', value: channel.id, inline: true },
            { name: 'Type', value: channel.type === 0 ? 'Text' : channel.type === 2 ? 'Voice' : 'Other', inline: true }
          )
          .setColor(0x00AAFF)
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
