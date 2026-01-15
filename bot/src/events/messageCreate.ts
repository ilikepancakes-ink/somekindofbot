import { Events } from 'discord.js';
import * as path from 'path';
const { getTicketByChannel, createTicketMessage } = require(path.join(__dirname, '../database'));
const { getXPSettings, addXP, getXPUser, getXPLevel, getAllXPLevels } = require(path.join(__dirname, '../xpDatabase'));

module.exports = {
  name: Events.MessageCreate,
  once: false,
  execute(message: any) {
    (async () => {
      try {
        // Ignore bot messages
        if (message.author.bot) return;

        // Handle XP tracking
        if (message.guild) {
          const settings = await getXPSettings(message.guild.id);
          if (settings && settings.enabled) {
            // Get current XP
            const userXP = await getXPUser(message.guild.id, message.author.id);
            const currentXP = userXP ? userXP.xp : 0;
            const oldLevel = Math.floor(currentXP / 100);

            // Add 10 XP
            await addXP(message.guild.id, message.author.id, 10);

            // Check for level up
            const newXP = currentXP + 10;
            const newLevel = Math.floor(newXP / 100);

            if (newLevel > oldLevel) {
              // User leveled up
              const levelRole = await getXPLevel(message.guild.id, newLevel);
              if (levelRole) {
                try {
                  const member = await message.guild.members.fetch(message.author.id);
                  await member.roles.add(levelRole.role_id);
                } catch (error) {
                  console.error('Error assigning level role:', error);
                }
              }
            }
          }
        }

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
        console.error('Error in messageCreate:', error);
      }
    })();
  },
};
