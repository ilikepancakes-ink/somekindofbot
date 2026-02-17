import { Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import * as path from 'path';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
const execAsync = promisify(exec);
const { getTicketByChannel, createTicketMessage, getBetterEmbedsSettings, createBetterEmbedsMessage } = require(path.join(__dirname, '../database'));
const { getXPSettings, addXP, getXPUser, getXPLevel, getAllXPLevels, getXPBlockedRoles } = require(path.join(__dirname, '../xpDatabase'));

interface XPBlockedRole {
  guild_id: string;
  role_id: string;
}

async function handleBetterEmbeds(message: any) {
  console.log(`[BetterEmbeds] Checking message ${message.id} in guild ${message.guild?.id}`);
  console.log(`[BetterEmbeds] Message content: "${message.content}"`);

  // Check if message has embeds from target platforms
  const targetProviders = ['Spotify', 'YouTube', 'Twitter', 'TikTok', 'Instagram'];
  const relevantEmbeds = message.embeds.filter((embed: any) =>
    embed.provider && targetProviders.some(provider =>
      embed.provider.name?.toLowerCase().includes(provider.toLowerCase())
    )
  );

  console.log(`[BetterEmbeds] Found ${relevantEmbeds.length} relevant embeds out of ${message.embeds.length} total embeds`);
  console.log(`[BetterEmbeds] Embed providers:`, message.embeds.map((e: any) => e.provider?.name));

  // If no embeds found, check for URLs in message content as fallback
  if (relevantEmbeds.length === 0) {
    const urls = extractUrlsFromMessage(message.content);
    console.log(`[BetterEmbeds] Found ${urls.length} URLs in message content:`, urls);

    for (const url of urls) {
      const platform = detectPlatformFromUrl(url);
      if (platform) {
        console.log(`[BetterEmbeds] Processing URL from platform: ${platform} - ${url}`);
        try {
          if (platform === 'spotify') {
            await handleSpotifyUrl(message, url);
          } else if (['youtube', 'tiktok', 'instagram', 'twitter'].includes(platform)) {
            await handleVideoUrl(message, url, platform);
          }
        } catch (error) {
          console.error('Error processing URL:', error);
        }
      }
    }
    return;
  }

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

function extractUrlsFromMessage(content: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = content.match(urlRegex);
  return matches || [];
}

function detectPlatformFromUrl(url: string): string | null {
  if (url.includes('spotify.com')) return 'spotify';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  return null;
}

async function handleSpotifyUrl(message: any, url: string) {
  // Extract Spotify ID and create a mock embed object
  const trackId = extractSpotifyId(url);
  if (!trackId) return;

  try {
    const accessToken = await getSpotifyAccessToken();

    // Get track data
    let trackData;
    try {
      trackData = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch (error: any) {
      if (error.response?.status === 403 || error.response?.status === 401) {
        console.log('[BetterEmbeds] Spotify token expired, refreshing...');
        // Clear cached token to force refresh
        spotifyToken = null;
        const newToken = await getSpotifyAccessToken();
        trackData = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
          headers: { 'Authorization': `Bearer ${newToken}` }
        });
      } else {
        throw error;
      }
    }

    const track = trackData.data;

    // Get audio features for additional stats
    let audioFeaturesData;
    try {
      audioFeaturesData = await axios.get(`https://api.spotify.com/v1/audio-features/${trackId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch (error: any) {
      if (error.response?.status === 403 || error.response?.status === 401) {
        console.log('[BetterEmbeds] Spotify token expired during audio features fetch, refreshing...');
        // Clear cached token to force refresh
        spotifyToken = null;
        const newToken = await getSpotifyAccessToken();
        audioFeaturesData = await axios.get(`https://api.spotify.com/v1/audio-features/${trackId}`, {
          headers: { 'Authorization': `Bearer ${newToken}` }
        });
      } else {
        // If audio features fail, continue without them
        console.log('[BetterEmbeds] Could not fetch audio features, continuing without them');
        audioFeaturesData = { data: { key: -1, tempo: 0, danceability: 0, energy: 0 } };
      }
    }

    const audioFeatures = audioFeaturesData.data;

    const spotifyEmbed = new EmbedBuilder()
      .setTitle(`🎵 ${track.name}`)
      .setDescription(`By ${track.artists.map((a: any) => a.name).join(', ')}`)
      .setURL(url)
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
      .setURL(url);

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
      url: url,
      created_at: Date.now()
    });

  } catch (error) {
    console.error('Error fetching Spotify data:', error);
  }
}

async function handleVideoUrl(message: any, url: string, platform: string) {
  try {
    // Get video info using yt-dlp
    const infoCommand = `yt-dlp --dump-json "${url}"`;
    const infoOutput = await execAsync(infoCommand);
    const videoInfo = JSON.parse(infoOutput.stdout);

    // Determine platform emoji
    let platformEmoji = '🎥';
    if (platform === 'youtube') platformEmoji = '📺';
    else if (platform === 'tiktok') platformEmoji = '🎵';
    else if (platform === 'instagram') platformEmoji = '📸';
    else if (platform === 'twitter') platformEmoji = '🐦';

    // Create embed with video stats
    const videoEmbed = new EmbedBuilder()
      .setTitle(`${platformEmoji} ${videoInfo.title || 'Video'}`)
      .setURL(url)
      .setThumbnail(videoInfo.thumbnail)
      .setColor(getPlatformColor(platform.charAt(0).toUpperCase() + platform.slice(1)))
      .addFields(
        { name: 'Duration', value: formatDuration(videoInfo.duration * 1000), inline: true },
        { name: 'Views', value: formatNumber(videoInfo.view_count || 0), inline: true },
        { name: 'Likes', value: formatNumber(videoInfo.like_count || 0), inline: true },
        { name: 'Uploader', value: videoInfo.uploader || 'Unknown', inline: true },
        { name: 'Upload Date', value: formatDate(videoInfo.upload_date), inline: true },
        { name: 'Resolution', value: `${videoInfo.width}x${videoInfo.height}`, inline: true }
      )
      .setFooter({ text: `${platform.charAt(0).toUpperCase() + platform.slice(1)} • ${formatFileSize(videoInfo.filesize || videoInfo.filesize_approx || 0)}` });

    // Create visit button
    const visitButton = new ButtonBuilder()
      .setLabel(`🔗 View on ${platform.charAt(0).toUpperCase() + platform.slice(1)}`)
      .setStyle(ButtonStyle.Link)
      .setURL(url);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(visitButton);

    // Download and upload video
    const tempFile = `/tmp/${Date.now()}_${Math.random()}.mp4`;
    await execAsync(`yt-dlp -f best[height<=720] -o "${tempFile}" "${url}"`);

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
      platform: platform,
      url: url,
      created_at: Date.now()
    });

    // Clean up temp file
    fs.unlinkSync(tempFile);

  } catch (error) {
    console.error('Error processing video URL:', error);
  }
}

let spotifyToken: { token: string; expires: number } | null = null;

module.exports = {
  name: Events.MessageCreate,
  once: false,
  execute(message: any) {
    (async () => {
      try {
        // Ignore bot messages
        if (message.author.bot) return;

        // Handle XP tracking
        if (message.guild) {
          const settings = await getXPSettings(message.guild.id);
          console.log(`XP Debug: Guild ${message.guild.name}, Settings:`, settings);
          if (settings && settings.enabled) {
            // Check if user has blocked roles
            const member = await message.guild.members.fetch(message.author.id);
            const blockedRoles = await getXPBlockedRoles(message.guild.id);
            const hasBlockedRole = blockedRoles.some((blockedRole: XPBlockedRole) => member.roles.cache.has(blockedRole.role_id));

            if (!hasBlockedRole) {
              // Get current XP
              const userXP = await getXPUser(message.guild.id, message.author.id);
              const currentXP = userXP ? userXP.xp : 0;
              const oldLevel = Math.floor(currentXP / 100);

              // Add 3 XP
              await addXP(message.guild.id, message.author.id, 3);

              // Check for level up
              const newXP = currentXP + 3;
              const newLevel = Math.floor(newXP / 100);

              if (newLevel > oldLevel) {
                // User leveled up
                const levelRole = await getXPLevel(message.guild.id, newLevel);
                if (levelRole) {
                  try {
                    await member.roles.add(levelRole.role_id);
                  } catch (error) {
                    console.error('Error assigning level role:', error);
                  }
                }

                // Send DM to user
                try {
                  const nextLevel = newLevel + 1;
                  const requiredXP = nextLevel * 100;
                  const dmMessage = `Congrats, ${message.author.username}! you are now at ${newXP}xp and at level${newLevel}! next level is ${nextLevel} and that needs ${requiredXP}! remember you get 3 xp for every message and 1 xp for every reaction!`;

                  await message.author.send(dmMessage);
                } catch (error) {
                  console.error('Error sending level up DM:', error);
                  // User might have DMs disabled, which is fine
                }
              }
            }
          }
        }

        // Handle better embeds
        if (message.guild) {
          const betterEmbedsSettings = await getBetterEmbedsSettings(message.guild.id);
          if (betterEmbedsSettings && betterEmbedsSettings.enabled) {
            await handleBetterEmbeds(message);
          }
        }

        // Handle confessions thread replies
        if (message.channel.isThread()) {
          const { handleMessage } = require(path.join(__dirname, '../commands/confessions/confessions'));
          await handleMessage(message);
        }

        // Check if this is a ticket channel
        const ticket = await getTicketByChannel(message.channel.id);
        if (!ticket) return;

        // Log the message
        await createTicketMessage({
          ticket_id: ticket.id,
          message_id: message.id,
          author_id: message.author.id,
          author_username: message.author.username,
          content: message.content || '[No content]',
          created_at: message.createdTimestamp,
        });
      } catch (error) {
        console.error('Error in messageCreate:', error);
      }
    })();
  },
};
