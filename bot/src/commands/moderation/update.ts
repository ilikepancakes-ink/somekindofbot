import { SlashCommandBuilder } from 'discord.js';
import { exec } from 'child_process';
import { join } from 'path';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('update')
    .setDescription('Update the bot to the latest version'),

  async execute(interaction: any) {
    await interaction.deferReply({ ephemeral: true });

    if (!process.env.BOT_ADMIN_USER_ID) {
      return interaction.editReply({ content: 'BOT_ADMIN_USER_ID environment variable is not set.' });
    }

    if (interaction.user.id !== process.env.BOT_ADMIN_USER_ID) {
      return interaction.editReply({ content: 'You do not have permission to use this command.' });
    }

    const botDir = join(__dirname, '../../..');

    exec('git pull', { cwd: botDir }, async (error, stdout, stderr) => {
      if (error) {
        console.error(`Error updating bot: ${error.message}`);
        return interaction.editReply({ content: `Failed to update the bot: ${error.message}` });
      }

      if (stderr) {
        console.log(`Git stderr: ${stderr}`);
      }

      console.log(`Bot updated: ${stdout}`);
      await interaction.editReply({ content: `Bot updated successfully!\n\`\`\`\n${stdout}\n\`\`\`` });
    });
  },
};
