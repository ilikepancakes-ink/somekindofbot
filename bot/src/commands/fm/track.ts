import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { getFMUser } from '../../database';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('track')
    .setDescription('Gets info about the track you\'re listening to or searching for')
    .addStringOption(option =>
      option.setName('track')
        .setDescription('The track to search for (optional, defaults to now playing)')
        .setRequired(false)),

  async execute(interaction: any) {
    const trackQuery = interaction.options.getString('track');

    const fmUser = await getFMUser(interaction.user.id);
    if (!fmUser || !fmUser.lastfm_username) {
      return interaction.reply({ content: 'You need to connect your Last.fm account first. Use /login.', ephemeral: true });
    }

    try {
      let trackInfo;

      if (trackQuery) {
        // Search for track
        const searchResponse = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(trackQuery)}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=1`);
        const track = searchResponse.data.results.trackmatches.track[0];
        if (!track) {
          return interaction.reply({ content: 'Track not found.', ephemeral: true });
        }

        // Get full info
        const infoResponse = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist=${encodeURIComponent(track.artist)}&track=${encodeURIComponent(track.name)}&api_key=${process.env.LASTFM_API_KEY}&format=json`);
        trackInfo = infoResponse.data.track;
      } else {
        // Get now playing
        const recentResponse = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${fmUser.lastfm_username}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=1`);
        const track = recentResponse.data.recenttracks.track[0];
        if (!track || !track['@attr'] || track['@attr'].nowplaying !== 'true') {
          return interaction.reply({ content: 'You are not currently playing a track.', ephemeral: true });
        }

        const infoResponse = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist=${encodeURIComponent(track.artist['#text'])}&track=${encodeURIComponent(track.name)}&api_key=${process.env.LASTFM_API_KEY}&format=json`);
        trackInfo = infoResponse.data.track;
      }

      const embed = new EmbedBuilder()
        .setTitle(trackInfo.name)
        .setDescription(`by ${trackInfo.artist.name}`)
        .setColor(0xff0000)
        .addFields(
          { name: 'Album', value: trackInfo.album ? trackInfo.album.title : 'N/A', inline: true },
          { name: 'Listeners', value: trackInfo.listeners, inline: true },
          { name: 'Playcount', value: trackInfo.playcount, inline: true },
          { name: 'User Playcount', value: trackInfo.userplaycount || '0', inline: true }
        );

      if (trackInfo.album && trackInfo.album.image && trackInfo.album.image[3]) {
        embed.setThumbnail(trackInfo.album.image[3]['#text']);
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Failed to fetch track info.', ephemeral: true });
    }
  },
};
