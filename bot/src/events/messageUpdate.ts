import { Events, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import * as path from 'path';
const { getGuildStats } = require(path.join(__dirname, '../database'));

module.exports = {
  name: Events.MessageUpdate,
  once: false,
  execute(oldMessage: any, newMessage: any) {
    (async () => {
      try {
        // Ignore bot messages and messages without content changes
        if (oldMessage.author.bot || oldMessage.content === newMessage.content) return;

        const stats = await getGuildStats(oldMessage.guild.id);
        if (!stats || !stats.log_webhook_url) return;

        const logEmbed = new EmbedBuilder()
          .setTitle('📝 Message Edited')
          .setDescription(`A message was edited in ${oldMessage.channel}`)
          .addFields(
            { name: 'Author', value: `${oldMessage.author}`, inline: true },
            { name: 'Channel', value: `${oldMessage.channel}`, inline: true },
            { name: 'Message ID', value: oldMessage.id, inline: true },
            { name: 'Before', value: oldMessage.content.length > 1024 ? oldMessage.content.substring(0, 1021) + '...' : oldMessage.content || 'No content', inline: false },
            { name: 'After', value: newMessage.content.length > 1024 ? newMessage.content.substring(0, 1021) + '...' : newMessage.content || 'No content', inline: false }
          )
          .setColor(0xFFA500)
          .setTimestamp()
          .setFooter({ text: `User ID: ${oldMessage.author.id}` });

        await axios.post(stats.log_webhook_url, {
          embeds: [logEmbed.toJSON()]
        });
      } catch (error) {
        console.error('Error sending message edit log to webhook:', error);
      }
    })();
  },
};
