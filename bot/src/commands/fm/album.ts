import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { getFMUser } from '../../database';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('album')
    .setDescription('Gets info about the current or searched album')
    .addStringOption(option =>
      option.setName('album')
        .setDescription('The album to search for (optional, defaults to current)')
        .setRequired(false)),

  async execute(interaction: any) {
    const albumQuery = interaction.options.getString('album');

    const fmUser = await getFMUser(interaction.user.id);
    if (!fmUser || !fmUser.lastfm_username) {
      return interaction.reply({ content: 'You need to connect your Last.fm account first. Use /login.', ephemeral: true });
    }

    try {
      let albumInfo;

      if (albumQuery) {
        // Search for album
        const searchResponse = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(albumQuery)}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=1`);
        const album = searchResponse.data.results.albummatches.album[0];
        if (!album) {
          return interaction.reply({ content: 'Album not found.', ephemeral: true });
        }

        // Get full info
        const infoResponse = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=album.getInfo&artist=${encodeURIComponent(album.artist)}&album=${encodeURIComponent(album.name)}&api_key=${process.env.LASTFM_API_KEY}&format=json`);
        albumInfo = infoResponse.data.album;
      } else {
        // Get current album from recent track
        const recentResponse = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${fmUser.lastfm_username}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=1`);
        const track = recentResponse.data.recenttracks.track[0];
        if (!track) {
          return interaction.reply({ content: 'No recent tracks found.', ephemeral: true });
        }

        const infoResponse = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=album.getInfo&artist=${encodeURIComponent(track.artist['#text'])}&album=${encodeURIComponent(track.album['#text'])}&api_key=${process.env.LASTFM_API_KEY}&format=json`);
        albumInfo = infoResponse.data.album;
      }

      const embed = new EmbedBuilder()
        .setTitle(albumInfo.name)
        .setDescription(`by ${albumInfo.artist}`)
        .setColor(0xff0000)
        .addFields(
          { name: 'Listeners', value: albumInfo.listeners, inline: true },
          { name: 'Playcount', value: albumInfo.playcount, inline: true },
          { name: 'User Playcount', value: albumInfo.userplaycount || '0', inline: true }
        );

      if (albumInfo.image && albumInfo.image[3]) {
        embed.setThumbnail(albumInfo.image[3]['#text']);
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Failed to fetch album info.', ephemeral: true });
    }
  },
};
