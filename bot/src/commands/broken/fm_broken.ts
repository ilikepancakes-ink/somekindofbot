import { SlashCommandBuilder } from 'discord.js';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fm')
    .setDescription('FM commands are currently unavailable (broken)'),

  async execute(interaction: any) {
    await interaction.reply({
      content: '🚨 FM commands are currently unavailable due to technical issues. Please try again later.',
      ephemeral: true
    });
  },
};
