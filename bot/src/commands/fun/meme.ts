import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Get a random meme')
    .setDMPermission(true),

  async execute(interaction: any) {
    try {
      const response = await axios.get('https://meme-api.com/gimme');
      const meme = response.data;

      const embed = new EmbedBuilder()
        .setTitle(meme.title)
        .setImage(meme.url)
        .setFooter({ text: `👍 ${meme.ups} | Author: ${meme.author}` })
        .setColor(0x00ff00);

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Failed to fetch a meme. Try again later!', flags: 64 });
    }
  },
};
