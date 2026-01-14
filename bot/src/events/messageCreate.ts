import { Events } from 'discord.js';
import * as path from 'path';
const { getTicketByChannel, createTicketMessage } = require(path.join(__dirname, '../database'));

module.exports = {
  name: Events.MessageCreate,
  once: false,
  execute(message: any) {
    (async () => {
      try {
        // Ignore bot messages
        if (message.author.bot) return;

        // Check if this is a ticket channel
        const ticket = await getTicketByChannel(message.channel.id);
        if (!ticket) return;

        // Log the message
        await createTicketMessage({
          ticket_id: ticket.id,
          message_id: message.id,
          author_id: message.author.id,
          author_username: message.author.username,
          content: message.content || '[No content]',
          created_at: message.createdTimestamp,
        });
      } catch (error) {
        console.error('Error logging ticket message:', error);
      }
    })();
  },
};
