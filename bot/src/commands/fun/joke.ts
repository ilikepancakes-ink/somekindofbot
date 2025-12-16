import { SlashCommandBuilder, InteractionReplyOptions } from 'discord.js';
import axios from 'axios';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('joke')
    .setDescription('Get a random joke')
    .setDMPermission(true),

  async execute(interaction: any) {
    try {
      const response = await axios.get('https://v2.jokeapi.dev/joke/Any?type=single');
      const joke = response.data.joke;

      await interaction.reply(joke);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Failed to fetch a joke. Try again later!', flags: 64 }); // 64 is ephemeral flag
    }
  },
};
