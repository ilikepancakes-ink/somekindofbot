import { Events, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import * as path from 'path';
const { getGuildStats } = require(path.join(__dirname, '../database'));

module.exports = {
  name: Events.MessageDelete,
  once: false,
  execute(deletedMessage: any) {
    (async () => {
      try {
        // Ignore bot messages
        if (deletedMessage.author.bot) return;

        const stats = await getGuildStats(deletedMessage.guild.id);
        if (!stats || !stats.log_webhook_url) return;

        const logEmbed = new EmbedBuilder()
          .setTitle('🗑️ Message Deleted')
          .setDescription(`A message was deleted in ${deletedMessage.channel}`)
          .addFields(
            { name: 'Author', value: `${deletedMessage.author}`, inline: true },
            { name: 'Channel', value: `${deletedMessage.channel}`, inline: true },
            { name: 'Message ID', value: deletedMessage.id, inline: true },
            { name: 'Content', value: deletedMessage.content.length > 1024 ? deletedMessage.content.substring(0, 1021) + '...' : deletedMessage.content || 'No content', inline: false }
          )
          .setColor(0xFF0000)
          .setTimestamp()
          .setFooter({ text: `User ID: ${deletedMessage.author.id}` });

        await axios.post(stats.log_webhook_url, {
          embeds: [logEmbed.toJSON()]
        });
      } catch (error) {
        console.error('Error sending message delete log to webhook:', error);
      }
    })();
  },
};
