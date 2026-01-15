import { Events } from 'discord.js';
import * as path from 'path';
const { getXPSettings, addXP, getXPUser, getXPLevel } = require(path.join(__dirname, '../xpDatabase'));

module.exports = {
  name: Events.MessageReactionAdd,
  once: false,
  execute(reaction: any, user: any) {
    (async () => {
      try {
        // Ignore bot reactions
        if (user.bot) return;

        // Check if this is a guild message
        if (!reaction.message.guild) return;

        // Check if XP is enabled for this guild
        const settings = await getXPSettings(reaction.message.guild.id);
        if (!settings || !settings.enabled) return;

        // Don't give XP for self-reactions
        if (reaction.message.author.id === user.id) return;

        // Get current XP of the message author
        const userXP = await getXPUser(reaction.message.guild.id, reaction.message.author.id);
        const currentXP = userXP ? userXP.xp : 0;
        const oldLevel = Math.floor(currentXP / 100);

        // Add 1 XP for the reaction
        await addXP(reaction.message.guild.id, reaction.message.author.id, 1);

        // Check for level up
        const newXP = currentXP + 1;
        const newLevel = Math.floor(newXP / 100);

        if (newLevel > oldLevel) {
          // User leveled up
          const levelRole = await getXPLevel(reaction.message.guild.id, newLevel);
          if (levelRole) {
            try {
              const member = await reaction.message.guild.members.fetch(reaction.message.author.id);
              await member.roles.add(levelRole.role_id);
            } catch (error) {
              console.error('Error assigning level role:', error);
            }
          }

          // Send DM to user
          try {
            const nextLevel = newLevel + 1;
            const requiredXP = nextLevel * 100;
            const dmMessage = `Congrats, ${reaction.message.author.username}! you are now at ${newXP}xp and at level${newLevel}! next level is ${nextLevel} and that needs ${requiredXP}! remember you get 10 xp for every message and 1 xp for every reaction!`;

            await reaction.message.author.send(dmMessage);
          } catch (error) {
            console.error('Error sending level up DM:', error);
            // User might have DMs disabled, which is fine
          }
        }
      } catch (error) {
        console.error('Error in messageReactionAdd:', error);
      }
    })();
  },
};
