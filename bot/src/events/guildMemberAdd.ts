import { Events, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import * as path from 'path';
const { getGuildStats } = require(path.join(__dirname, '../database'));

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  execute(member: any) {
    console.log('=== GuildMemberAdd event triggered ===');
    console.log('Member:', member.user.tag, 'ID:', member.user.id);

    // Check if user should be banned
    (async () => {
      console.log('Checking if user should be banned...');
      if (member.user.id === '1313344624873705544') {
        try {
          console.log('User matches banned ID, attempting ban...');
          await member.ban({
            reason: 'Permanently banned user ID 1313344624873705544',
            days: 7 // Delete 7 days of messages (optional)
          });
          console.log('Permanently banned user ID 1313344624873705544');
          return; // Exit early, don't send welcome message
        } catch (banError) {
          console.error('Error banning user:', banError);
        }
      } else {
        console.log('User does not match banned ID, proceeding with welcome message');
      }
    })();

    // Send welcome message if configured
    (async () => {
      console.log('Checking welcome message configuration...');
      try {
        const stats = await getGuildStats(member.guild.id);
        if (!stats || !stats.welcome_channel_id || !stats.welcome_title) return;

        const channel = member.guild.channels.cache.get(stats.welcome_channel_id);
        if (!channel || !channel.isTextBased()) return;

        // Calculate account age
        const createdAt = member.user.createdAt;
        const now = new Date();
        const diffMs = now.getTime() - createdAt.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const years = Math.floor(diffDays / 365);
        const months = Math.floor((diffDays % 365) / 30);
        const days = diffDays % 30;

        const accountAge = `${years} Years, ${months} months, ${days} days`;

        // Get member number (total members)
        const memberNumber = member.guild.memberCount;

        const embed = new EmbedBuilder()
          .setTitle(`${stats.welcome_title} 🎉`)
          .setDescription(`Welcome ${member} to ${member.guild.name}!`)
          .addFields(
            { name: 'Member', value: member.displayName, inline: true },
            { name: 'Account Created', value: createdAt.toDateString(), inline: true },
            { name: 'Account Age', value: accountAge, inline: true },
            { name: '\u200B', value: '\u200B', inline: false }, // Spacer
            { name: '📊 Server Statistics', value: `Total Members: ${memberNumber}\nYou are member ${memberNumber}`, inline: false },
            { name: '💬 Feel free to introduce yourself and have fun!', value: '\u200B', inline: false }
          )
          .setColor(0x00FF00)
          .setTimestamp();

        await channel.send({ embeds: [embed] });

        // Send log to webhook
        if (stats.log_webhook_url) {
          const logEmbed = new EmbedBuilder()
            .setTitle('👋 Member Joined')
            .setDescription(`${member.user.tag} joined the server`)
            .addFields(
              { name: 'User', value: `${member.user}`, inline: true },
              { name: 'User ID', value: member.user.id, inline: true },
              { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: true }
            )
            .setColor(0x00FF00)
            .setTimestamp();

          try {
            await axios.post(stats.log_webhook_url, {
              embeds: [logEmbed.toJSON()]
            });
          } catch (logError) {
            console.error('Error sending log to webhook:', logError);
          }
        }
      } catch (error) {
        console.error('Error sending welcome message:', error);
      }
    })();
  },
};
