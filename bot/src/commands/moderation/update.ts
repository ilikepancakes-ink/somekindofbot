import { SlashCommandBuilder } from 'discord.js';
import { exec } from 'child_process';
import { join } from 'path';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('update')
    .setDescription('Update the bot to the latest version'),

  async execute(interaction: any) {
    await interaction.deferReply({ ephemeral: true });

    const adminId = process.env.BOT_ADMIN_USER_ID?.trim();
    if (!adminId) {
      return interaction.editReply({ content: 'BOT_ADMIN_USER_ID environment variable is not set.' });
    }

    if (interaction.user.id !== adminId) {
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

      try {
        // Reload commands after update
        const { loadCommands } = require('../../index');
        await loadCommands();
        await interaction.editReply({ content: `Bot updated and commands reloaded successfully!\n\`\`\`\n${stdout}\n\`\`\`` });
      } catch (reloadError: any) {
        console.error(`Error reloading commands: ${reloadError.message}`);
        await interaction.editReply({ content: `Bot updated but failed to reload commands: ${reloadError.message}\n\`\`\`\n${stdout}\n\`\`\`` });
      }
    });
  },
};
