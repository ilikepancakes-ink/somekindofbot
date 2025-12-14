import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import axios from 'axios';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('generate-token')
    .setDescription('Generate an auth token for the management panel'),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const botAdminUserId = process.env.BOT_ADMIN_USER_ID;

    // Check if the user is the admin
    if (userId !== botAdminUserId) {
      await interaction.reply({
        content: '❌ You do not have permission to generate auth tokens.',
        ephemeral: true
      });
      return;
    }

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
