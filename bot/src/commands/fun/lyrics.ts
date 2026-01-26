import { CommandInteraction, EmbedBuilder, SlashCommandBuilder, CacheType, ChatInputCommandInteraction } from 'discord.js';
import axios from 'axios';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Fetch lyrics for a song')
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
      // First, search for the song on Genius
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
        return interaction.reply({ content: 'No results found for this song.', ephemeral: true });
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

      // Extract lyrics using regex (this is a simplified approach)
      // In a real implementation, you'd want to use a more robust HTML parser
      const lyricsMatch = lyricsHtml.match(/<div[^>]*class="Lyrics__Container.*?">(.*?)<\/div>/s);
      let lyrics = lyricsMatch ? lyricsMatch[1] : 'Lyrics not found on this page.';

      // Clean up the lyrics
      lyrics = lyrics
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&/g, '&')
        .replace(/"/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${title} - ${artist}`)
        .setDescription(lyrics.length > 4096 ? lyrics.substring(0, 4093) + '...' : lyrics)
        .setURL(songUrl)
        .setColor('#FF69B4')
        .setFooter({ text: 'Powered by Genius' });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching lyrics:', error);
      await interaction.reply({ 
        content: 'An error occurred while fetching the lyrics. Please try again later.', 
        ephemeral: true 
      });
    }
  }
};