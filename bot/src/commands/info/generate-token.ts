import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import axios from 'axios';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('generate-token')
    .setDescription('Generate an auth token for the management panel'),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const botAdminUserId = process.env.BOT_ADMIN_USER_ID;

    // Detailed logging for admin authentication
    console.log(`🔐 Admin Auth Check:`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Expected Admin ID: ${botAdminUserId || 'NOT SET'}`);
    console.log(`   Username: ${interaction.user.username}#${interaction.user.discriminator}`);
    console.log(`   Match: ${userId === botAdminUserId ? '✅ YES' : '❌ NO'}`);

    // Check if BOT_ADMIN_USER_ID is set
    if (!botAdminUserId) {
      console.error('❌ BOT_ADMIN_USER_ID environment variable is not set!');
      await interaction.reply({
        content: '❌ Server configuration error: Admin user ID not configured.',
        ephemeral: true
      });
      return;
    }

    // Check if the user is the admin
    if (userId !== botAdminUserId) {
      console.warn(`🚫 Unauthorized token generation attempt by user ${interaction.user.username}#${interaction.user.discriminator} (ID: ${userId})`);
      console.warn(`   Expected admin ID: ${botAdminUserId}`);

      await interaction.reply({
        content: `❌ Access denied. This command is restricted to the bot administrator.\n\n**Debug Info:**\n• Your User ID: \`${userId}\`\n• Required Admin ID: \`${botAdminUserId}\``,
        ephemeral: true
      });
      return;
    }

    console.log(`✅ Admin authentication successful for ${interaction.user.username}#${interaction.user.discriminator}`);

    try {
      // Call the web server to generate a token
      const response = await axios.post('http://localhost:2976/api/generate-token', {
        userId: userId
      });

      if (response.data.success) {
        await interaction.reply({
          content: `✅ Auth token generated successfully!\n\n**Token:** \`${response.data.token}\`\n\n**Login URL:** ${response.data.loginUrl}\n\n⚠️ Keep this token secure and do not share it with anyone.`,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: '❌ Failed to generate auth token.',
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Error generating token:', error);
      await interaction.reply({
        content: '❌ An error occurred while generating the auth token.',
        ephemeral: true
      });
    }
  },
};
