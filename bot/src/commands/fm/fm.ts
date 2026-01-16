import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { getFMUser } from '../../database';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fm')
    .setDescription('Shows your last 1–2 scrobbles')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to get scrobbles for (optional)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Display mode')
        .setRequired(false)
        .addChoices(
          { name: 'embedtiny', value: 'embedtiny' },
          { name: 'embedmini', value: 'embedmini' },
          { name: 'embedfull', value: 'embedfull' },
          { name: 'textmini', value: 'textmini' },
          { name: 'textfull', value: 'textfull' },
          { name: 'oneline', value: 'oneline' }
        )),

  async execute(interaction: any) {
    const userOption = interaction.options.getUser('user');
    const targetUser = userOption || interaction.user;
    const mode = interaction.options.getString('mode') || 'embedmini';

    const fmUser = await getFMUser(targetUser.id);
    if (!fmUser || !fmUser.lastfm_username) {
      return interaction.reply({ content: `${targetUser.username} has not connected their Last.fm account. Use /login to connect.`, ephemeral: true });
    }

    try {
      const response = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${fmUser.lastfm_username}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=2`);
      const data = response.data;

      if (!data.recenttracks || !data.recenttracks.track || data.recenttracks.track.length === 0) {
        return interaction.reply({ content: 'No recent tracks found.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(`${fmUser.lastfm_username}'s Recent Scrobbles`)
        .setColor(0xff0000);

      data.recenttracks.track.forEach((track: any, index: number) => {
        const artist = track.artist['#text'];
        const name = track.name;
        const album = track.album['#text'];
        const nowPlaying = track['@attr'] && track['@attr'].nowplaying === 'true';

        let description = `${index + 1}. ${artist} - ${name}`;
        if (album) description += ` (${album})`;
        if (nowPlaying) description += ' (Now Playing)';

        embed.addFields({ name: '\u200B', value: description, inline: false });
      });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Failed to fetch scrobbles.', ephemeral: true });
    }
  },
};
