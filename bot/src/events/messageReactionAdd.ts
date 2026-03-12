import { Events } from 'discord.js';
import * as path from 'path';
const { getXPSettings, addXP, getXPUser, getXPLevel } = require(path.join(__dirname, '../xpDatabase'));
const { getStarboardSettings, getStarboardMessage, createStarboardMessage, updateStarboardMessage } = require(path.join(__dirname, '../database'));

module.exports = {
  name: Events.MessageReactionAdd,
  once: false,
  execute(reaction: any, user: any) {
    (async () => {
      try {
        // Debug logging for all reactions
        console.log(`Reaction Debug: ${user.username} reacted with ${reaction.emoji.name} (${reaction.emoji.id || 'unicode'}) to message ${reaction.message.id} in ${reaction.message.guild.name}`);
        
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

        // Starboard functionality
        await handleStarboardReaction(reaction, user);
      } catch (error) {
        console.error('Error in messageReactionAdd:', error);
      }
    })();
  },
};

async function handleStarboardReaction(reaction: any, user: any) {
  try {
    // Check if starboard is configured for this guild
    const starboardSettings = await getStarboardSettings(reaction.message.guild.id);
    if (!starboardSettings || !starboardSettings.channel_id || !starboardSettings.required_stars) {
      return;
    }

    // Check if this is a star reaction (:star:)
    const starEmoji = reaction.emoji.name === 'star';
    if (!starEmoji) {
      return;
    }

    // Get current star count (including the new reaction)
    const starCount = reaction.count;

    // Check if we've reached the required threshold
    if (starCount >= starboardSettings.required_stars) {
      // Check if this message is already on the starboard
      let starboardMessage = await getStarboardMessage(reaction.message.id);

      if (!starboardMessage) {
        // Create new starboard entry
        starboardMessage = {
          guild_id: reaction.message.guild.id,
          original_message_id: reaction.message.id,
          starboard_message_id: null,
          star_count: starCount,
          last_updated: Date.now()
        };

        const starboardMessageId = await createStarboardMessage(starboardMessage);
        starboardMessage.id = starboardMessageId;
      } else {
        // Update existing starboard entry
        await updateStarboardMessage(reaction.message.id, starCount);
      }

      // Create or update the starboard embed
      await updateStarboardEmbed(reaction.message, starboardSettings, starboardMessage, starCount);
    }
  } catch (error) {
    console.error('Error handling starboard reaction:', error);
  }
}

async function updateStarboardEmbed(message: any, starboardSettings: any, starboardMessage: any, starCount: number) {
  try {
    const guild = message.guild;
    const channel = guild.channels.cache.get(starboardSettings.channel_id);
    
    if (!channel) {
      console.error('Starboard channel not found');
      return;
    }

    // Create the starboard embed
    const embed = createStarboardEmbed(message, starCount);

    if (starboardMessage.starboard_message_id) {
      // Update existing starboard message
      try {
        const starboardMsg = await channel.messages.fetch(starboardMessage.starboard_message_id);
        await starboardMsg.edit({ embeds: [embed] });
      } catch (error) {
        console.error('Error updating starboard message:', error);
        // If update fails, create a new message
        const newStarboardMsg = await channel.send({ embeds: [embed] });
        await updateStarboardMessage(message.id, starCount, newStarboardMsg.id);
      }
    } else {
      // Create new starboard message
      const starboardMsg = await channel.send({ embeds: [embed] });
      await updateStarboardMessage(message.id, starCount, starboardMsg.id);
    }
  } catch (error) {
    console.error('Error updating starboard embed:', error);
  }
}

function createStarboardEmbed(message: any, starCount: number) {
  const embed = {
    color: 0xffd700, // Gold color for starboard
    author: {
      name: message.author.username,
      icon_url: message.author.displayAvatarURL({ dynamic: true })
    },
    description: message.content || '*(No text content)*',
    fields: [
      {
        name: 'Original Message',
        value: `[Jump to message](${message.url})`,
        inline: true
      },
      {
        name: 'Stars',
        value: `⭐ ${starCount}`,
        inline: true
      },
      {
        name: 'Channel',
        value: message.channel.toString(),
        inline: true
      }
    ],
    timestamp: message.createdAt.toISOString(),
    footer: {
      text: `User ID: ${message.author.id}`
    }
  };

  // Add images if the message has attachments
  if (message.attachments.size > 0) {
    const image = message.attachments.first();
    if (image && image.height) { // Check if it's an image
      (embed as any).image = { url: image.url };
    }
  }

  return embed;
}
