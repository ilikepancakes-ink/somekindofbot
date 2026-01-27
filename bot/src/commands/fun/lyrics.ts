import { CommandInteraction, EmbedBuilder, SlashCommandBuilder, CacheType, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import axios from 'axios';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Fetch lyrics for a song with Spotify preview')
    .addStringOption(option =>
      option.setName('song')
        .setDescription('The name of the song')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('artist')
        .setDescription('The artist of the song')
        .setRequired(false)),
  
  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const songName = interaction.options.getString('song', true);
    const artistName = interaction.options.getString('artist');

    try {
      await interaction.deferReply();

      // First, search for the song on Genius for lyrics
      const searchResponse = await axios.get(
        `https://api.genius.com/search?q=${encodeURIComponent(songName)}${artistName ? `+${encodeURIComponent(artistName)}` : ''}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.GENIUS_ACCESS_TOKEN}`
          }
        }
      );

      const hits = searchResponse.data.response.hits;
      if (!hits || hits.length === 0) {
        return interaction.editReply({ content: 'No results found for this song.' });
      }

      // Find the best match
      let bestMatch = hits[0];
      if (artistName) {
        const exactMatch = hits.find((hit: any) => 
          hit.result.artist_names.toLowerCase().includes(artistName.toLowerCase())
        );
        if (exactMatch) bestMatch = exactMatch;
      }

      const songUrl = bestMatch.result.url;
      const title = bestMatch.result.title;
      const artist = bestMatch.result.artist_names;

      // Fetch the lyrics page
      const lyricsResponse = await axios.get(songUrl);
      const lyricsHtml = lyricsResponse.data;

      // Extract lyrics using regex
      const lyricsMatch = lyricsHtml.match(/<div[^>]*class="Lyrics__Container.*?">(.*?)<\/div>/s);
      let lyrics = lyricsMatch ? lyricsMatch[1] : 'Lyrics not found on this page.';

      // Clean up the lyrics
      lyrics = lyrics
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&/g, '&')
        .replace(/"/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      // Search for the song on Spotify to get preview URL
      let spotifyPreviewUrl = null;
      let spotifyTrackUrl = null;
      let spotifyAlbumArt = null;

      if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
        try {
          // Get Spotify access token
          const tokenResponse = await axios.post(
            'https://accounts.spotify.com/api/token',
            'grant_type=client_credentials',
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')
              }
            }
          );

          const accessToken = tokenResponse.data.access_token;

          // Search for the song on Spotify
          const spotifySearchQuery = artistName ? `${songName} ${artistName}` : songName;
          const spotifyResponse = await axios.get(
            `https://api.spotify.com/v1/search`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              },
              params: {
                q: spotifySearchQuery,
                type: 'track',
                limit: 1
              }
            }
          );

          if (spotifyResponse.data.tracks.items.length > 0) {
            const track = spotifyResponse.data.tracks.items[0];
            spotifyPreviewUrl = track.preview_url;
            spotifyTrackUrl = track.external_urls.spotify;
            spotifyAlbumArt = track.album.images[0]?.url;
          }
        } catch (spotifyError) {
          console.error('Error fetching from Spotify:', spotifyError);
        }
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${title} - ${artist}`)
        .setDescription(lyrics.length > 2048 ? lyrics.substring(0, 2045) + '...' : lyrics)
        .setURL(songUrl)
        .setColor('#1DB954') // Spotify green
        .setFooter({ text: 'Powered by Genius' });

      if (spotifyAlbumArt) {
        embed.setThumbnail(spotifyAlbumArt);
      }

      // Create action row with preview button
      const row = new ActionRowBuilder<ButtonBuilder>();
      const buttonCustomId = `lyrics_preview_${Date.now()}`;
      const previewButton = new ButtonBuilder()
        .setCustomId(buttonCustomId)
        .setLabel('🎵 Preview Song')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!spotifyPreviewUrl);

      row.addComponents(previewButton);

      // Add Spotify link if available
      if (spotifyTrackUrl) {
        embed.addFields({
          name: '🎵 Spotify',
          value: `[Listen on Spotify](${spotifyTrackUrl})`,
          inline: true
        });
      }

      await interaction.editReply({ 
        embeds: [embed], 
        components: spotifyPreviewUrl ? [row] : [] 
      });

      // Handle button interaction for preview
      if (spotifyPreviewUrl) {
        const filter = (i: any) => i.customId === buttonCustomId;
        const collector = interaction.channel?.createMessageComponentCollector({ 
          filter, 
          componentType: ComponentType.Button,
          time: 600000 // 10 minutes
        });

        collector?.on('collect', async (i) => {
          if (i.customId === buttonCustomId) {
            try {
              // Fetch the audio file
              const audioResponse = await axios.get(spotifyPreviewUrl, { 
                responseType: 'arraybuffer',
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              });

              // Create a temporary audio file
              const fs = require('fs');
              const path = require('path');
              const tempDir = path.join(__dirname, '../../temp');
              
              // Create temp directory if it doesn't exist
              if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
              }

              const tempFile = path.join(tempDir, `preview_${Date.now()}.mp3`);
              fs.writeFileSync(tempFile, audioResponse.data);

              // Send the audio file
              await i.reply({ 
                content: `🎵 Here's a preview of "${title}" by ${artist}:`,
                files: [tempFile]
              });

              // Clean up the temp file after 5 minutes
              setTimeout(() => {
                if (fs.existsSync(tempFile)) {
                  fs.unlinkSync(tempFile);
                }
              }, 300000);

            } catch (audioError) {
              console.error('Error fetching audio preview:', audioError);
              await i.reply({ 
                content: 'Sorry, I couldn\'t fetch the audio preview. Please try again later.'
              });
            }
          }
        });

        collector?.on('end', () => {
          // Disable the button after timeout
          previewButton.setDisabled(true);
          interaction.editReply({ components: [row] });
        });
      }

    } catch (error) {
      console.error('Error fetching lyrics:', error);
      await interaction.editReply({ 
        content: 'An error occurred while fetching the lyrics. Please try again later.' 
      });
    }
  }
};
