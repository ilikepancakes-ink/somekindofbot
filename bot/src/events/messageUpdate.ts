import { Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
const execAsync = promisify(exec);
import * as path from 'path';
const { getGuildStats, getTicketByChannel, updateTicketMessage, getBetterEmbedsSettings, createBetterEmbedsMessage } = require(path.join(__dirname, '../database'));

// Helper functions (duplicated from messageCreate.ts)
async function handleBetterEmbeds(message: any) {
  console.log(`[BetterEmbeds] Checking message ${message.id} in guild ${message.guild?.id}`);

  // Check if message has embeds from target platforms
  const targetProviders = ['Spotify', 'YouTube', 'Twitter', 'TikTok', 'Instagram'];
  const relevantEmbeds = message.embeds.filter((embed: any) =>
    embed.provider && targetProviders.some(provider =>
      embed.provider.name?.toLowerCase().includes(provider.toLowerCase())
    )
  );

  console.log(`[BetterEmbeds] Found ${relevantEmbeds.length} relevant embeds out of ${message.embeds.length} total embeds`);
  console.log(`[BetterEmbeds] Embed providers:`, message.embeds.map((e: any) => e.provider?.name));

  if (relevantEmbeds.length === 0) return;

  // Process each relevant embed
  for (const embed of relevantEmbeds) {
    try {
      console.log(`[BetterEmbeds] Processing embed from provider: ${embed.provider?.name}`);
      if (embed.provider?.name?.toLowerCase().includes('spotify')) {
        await handleSpotifyEmbed(message, embed);
      } else if (embed.provider?.name?.toLowerCase().includes('youtube') ||
                 embed.provider?.name?.toLowerCase().includes('tiktok') ||
                 embed.provider?.name?.toLowerCase().includes('instagram') ||
                 embed.provider?.name?.toLowerCase().includes('twitter')) {
        await handleVideoEmbed(message, embed);
      }
    } catch (error) {
      console.error('Error processing embed:', error);
    }
  }
}

async function handleSpotifyEmbed(message: any, embed: any) {
  // Extract Spotify URL from embed
  const spotifyUrl = embed.url;
  if (!spotifyUrl) return;

  // Use Spotify API to get track info
  const trackId = extractSpotifyId(spotifyUrl);
  if (!trackId) return;

  try {
    const accessToken = await getSpotifyAccessToken();
    const trackData = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const track = trackData.data;

    // Get audio features for additional stats
    const audioFeaturesData = await axios.get(`https://api.spotify.com/v1/audio-features/${trackId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const audioFeatures = audioFeaturesData.data;

    const spotifyEmbed = new EmbedBuilder()
      .setTitle(`🎵 ${track.name}`)
      .setDescription(`By ${track.artists.map((a: any) => a.name).join(', ')}`)
      .setURL(spotifyUrl)
      .setThumbnail(track.album.images[0]?.url)
      .setColor(0x1DB954)
      .addFields(
        { name: 'Album', value: track.album.name, inline: true },
        { name: 'Duration', value: formatDuration(track.duration_ms), inline: true },
        { name: 'Popularity', value: `${track.popularity}/100`, inline: true },
        { name: 'Key', value: getKeyName(audioFeatures.key), inline: true },
        { name: 'BPM', value: `${Math.round(audioFeatures.tempo)}`, inline: true },
        { name: 'Danceability', value: `${Math.round(audioFeatures.danceability * 100)}%`, inline: true },
        { name: 'Energy', value: `${Math.round(audioFeatures.energy * 100)}%`, inline: true },
        { name: 'Release Date', value: new Date(track.album.release_date).getFullYear().toString(), inline: true }
      )
      .setFooter({ text: `Spotify • ${track.album.total_tracks} tracks in album` });

    // Create visit button
    const visitButton = new ButtonBuilder()
      .setLabel('🎧 Listen on Spotify')
      .setStyle(ButtonStyle.Link)
      .setURL(spotifyUrl);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(visitButton);

    // Send the embed message
    const sentMessage = await message.channel.send({
      embeds: [spotifyEmbed],
      components: [row]
    });

    // Store in database for persistence
    await createBetterEmbedsMessage({
      guild_id: message.guild.id,
      channel_id: message.channel.id,
      message_id: sentMessage.id,
      original_message_id: message.id,
      platform: 'spotify',
      url: spotifyUrl,
      created_at: Date.now()
    });

  } catch (error) {
    console.error('Error fetching Spotify data:', error);
  }
}

async function handleVideoEmbed(message: any, embed: any) {
  const videoUrl = embed.url;
  if (!videoUrl) return;

  try {
    // Get video info using yt-dlp
    const infoCommand = `yt-dlp --dump-json "${videoUrl}"`;
    const infoOutput = await execAsync(infoCommand);
    const videoInfo = JSON.parse(infoOutput.stdout);

    // Determine platform
    let platform = 'video';
    let platformEmoji = '🎥';
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      platform = 'YouTube';
      platformEmoji = '📺';
    } else if (videoUrl.includes('tiktok.com')) {
      platform = 'TikTok';
      platformEmoji = '🎵';
    } else if (videoUrl.includes('instagram.com')) {
      platform = 'Instagram';
      platformEmoji = '📸';
    } else if (videoUrl.includes('twitter.com') || videoUrl.includes('x.com')) {
      platform = 'Twitter';
      platformEmoji = '🐦';
    }

    // Create embed with video stats
    const videoEmbed = new EmbedBuilder()
      .setTitle(`${platformEmoji} ${videoInfo.title || 'Video'}`)
      .setURL(videoUrl)
      .setThumbnail(videoInfo.thumbnail)
      .setColor(getPlatformColor(platform))
      .addFields(
        { name: 'Duration', value: formatDuration(videoInfo.duration * 1000), inline: true },
        { name: 'Views', value: formatNumber(videoInfo.view_count || 0), inline: true },
        { name: 'Likes', value: formatNumber(videoInfo.like_count || 0), inline: true },
        { name: 'Uploader', value: videoInfo.uploader || 'Unknown', inline: true },
        { name: 'Upload Date', value: formatDate(videoInfo.upload_date), inline: true },
        { name: 'Resolution', value: `${videoInfo.width}x${videoInfo.height}`, inline: true }
      )
      .setFooter({ text: `${platform} • ${formatFileSize(videoInfo.filesize || videoInfo.filesize_approx || 0)}` });

    // Create visit button
    const visitButton = new ButtonBuilder()
      .setLabel(`🔗 View on ${platform}`)
      .setStyle(ButtonStyle.Link)
      .setURL(videoUrl);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(visitButton);

    // Download and upload video
    const tempFile = `/tmp/${Date.now()}_${Math.random()}.mp4`;
    await execAsync(`yt-dlp -f best[height<=720] -o "${tempFile}" "${videoUrl}"`);

    // Send embed with video attachment
    const sentMessage = await message.channel.send({
      embeds: [videoEmbed],
      files: [{ attachment: tempFile, name: 'video.mp4' }],
      components: [row]
    });

    // Store in database for persistence
    await createBetterEmbedsMessage({
      guild_id: message.guild.id,
      channel_id: message.channel.id,
      message_id: sentMessage.id,
      original_message_id: message.id,
      platform: platform.toLowerCase(),
      url: videoUrl,
      created_at: Date.now()
    });

    // Clean up temp file
    fs.unlinkSync(tempFile);

  } catch (error) {
    console.error('Error processing video embed:', error);
  }
}

function extractSpotifyId(url: string): string | null {
  const match = url.match(/spotify\.com\/(?:track|album|playlist)\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

async function getSpotifyAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured');
  }

  const response = await axios.post('https://accounts.spotify.com/api/token', null, {
    params: { grant_type: 'client_credentials' },
    auth: { username: clientId, password: clientSecret }
  });

  return response.data.access_token;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function getKeyName(key: number): string {
  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return keys[key] || 'Unknown';
}

function getPlatformColor(platform: string): number {
  const colors: { [key: string]: number } = {
    'YouTube': 0xFF0000,
    'TikTok': 0x000000,
    'Instagram': 0xE4405F,
    'Twitter': 0x1DA1F2,
    'video': 0x7289DA
  };
  return colors[platform] || 0x7289DA;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'Unknown';
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  return `${day}/${month}/${year}`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return 'Unknown';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

module.exports = {
  name: Events.MessageUpdate,
  once: false,
  execute(oldMessage: any, newMessage: any) {
    (async () => {
      try {
        // Handle better embeds for messages that gained embeds
        if (newMessage.guild && oldMessage.embeds.length < newMessage.embeds.length) {
          const betterEmbedsSettings = await getBetterEmbedsSettings(newMessage.guild.id);
          if (betterEmbedsSettings && betterEmbedsSettings.enabled) {
            // Get new embeds that weren't in the old message
            const newEmbeds = newMessage.embeds.slice(oldMessage.embeds.length);
            const targetProviders = ['Spotify', 'YouTube', 'Twitter', 'TikTok', 'Instagram'];

            for (const embed of newEmbeds) {
              if (embed.provider && targetProviders.some(provider =>
                embed.provider.name?.toLowerCase().includes(provider.toLowerCase())
              )) {
                console.log(`[BetterEmbeds] Processing newly added embed from provider: ${embed.provider?.name}`);
                if (embed.provider?.name?.toLowerCase().includes('spotify')) {
                  await handleSpotifyEmbed(newMessage, embed);
                } else if (embed.provider?.name?.toLowerCase().includes('youtube') ||
                           embed.provider?.name?.toLowerCase().includes('tiktok') ||
                           embed.provider?.name?.toLowerCase().includes('instagram') ||
                           embed.provider?.name?.toLowerCase().includes('twitter')) {
                  await handleVideoEmbed(newMessage, embed);
                }
              }
            }
          }
        }

        // Ignore bot messages and messages without content changes
        if (oldMessage.author.bot || oldMessage.content === newMessage.content) return;

        // Check if this is a ticket channel
        const ticket = await getTicketByChannel(oldMessage.channel.id);
        if (ticket) {
          // Update ticket message
          await updateTicketMessage(oldMessage.id, newMessage.content || '[No content]', newMessage.editedTimestamp || Date.now());
        } else {
          // Regular message logging
          const stats = await getGuildStats(oldMessage.guild.id);
          if (!stats || !stats.log_webhook_url) return;

          const logEmbed = new EmbedBuilder()
            .setTitle('📝 Message Edited')
            .setDescription(`A message was edited in ${oldMessage.channel}`)
            .addFields(
              { name: 'Author', value: `${oldMessage.author}`, inline: true },
              { name: 'Channel', value: `${oldMessage.channel}`, inline: true },
              { name: 'Message ID', value: oldMessage.id, inline: true },
              { name: 'Before', value: oldMessage.content.length > 1024 ? oldMessage.content.substring(0, 1021) + '...' : oldMessage.content || 'No content', inline: false },
              { name: 'After', value: newMessage.content.length > 1024 ? newMessage.content.substring(0, 1021) + '...' : newMessage.content || 'No content', inline: false }
            )
            .setColor(0xFFA500)
            .setTimestamp()
            .setFooter({ text: `User ID: ${oldMessage.author.id}` });

          await axios.post(stats.log_webhook_url, {
            embeds: [logEmbed.toJSON()]
          });
        }
      } catch (error) {
        console.error('Error handling message update:', error);
      }
    })();
  },
};
