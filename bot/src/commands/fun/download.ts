import { CommandInteraction, EmbedBuilder, SlashCommandBuilder, CacheType, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';

interface DownloadRecord {
  id?: number;
  user_id: string;
  video_url: string;
  filename: string;
  original_filename: string;
  file_path: string;
  created_at: number;
  expires_at: number;
}

// Import database functions
const { createDownloadRecord, getDownloadRecord, cleanupExpiredDownloads } = require('./../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('download')
    .setDescription('Download a video from YouTube or other supported sites')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('The URL of the video to download')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('format')
        .setDescription('Download format (audio/video)')
        .setRequired(false)
        .addChoices(
          { name: 'Video (MP4)', value: 'video' },
          { name: 'Audio (MP3)', value: 'audio' }
        )),
  
  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const videoUrl = interaction.options.getString('url', true);
    const format = interaction.options.getString('format') || 'video';

    try {
      await interaction.deferReply();

      // Clean up expired downloads first
      await cleanupExpiredDownloads();

      // Validate URL
      if (!videoUrl || !videoUrl.startsWith('http')) {
        return interaction.editReply({ content: 'Please provide a valid URL.' });
      }

      // Check if URL is supported by ytdl-core
      if (!ytdl.validateURL(videoUrl)) {
        return interaction.editReply({ content: 'Invalid or unsupported URL. Please provide a YouTube or supported site URL.' });
      }

      await interaction.editReply({ content: '🔍 Analyzing video...' });

      // Get video info
      let info;
      try {
        info = await ytdl.getInfo(videoUrl);
      } catch (error) {
        console.error('Error getting video info:', error);
        return interaction.editReply({ content: 'Failed to analyze video. Please check the URL and try again.' });
      }

      const title = info.videoDetails.title;
      const author = info.videoDetails.author.name;
      const duration = info.videoDetails.lengthSeconds;

      // Check duration limit (5 minutes max)
      const durationSeconds = parseInt(duration);
      if (durationSeconds > 300) {
        return interaction.editReply({ 
          content: `Video is too long (${Math.floor(durationSeconds / 60)}:${durationSeconds % 60}). Maximum duration is 5 minutes.` 
        });
      }

      await interaction.editReply({ content: `📥 Downloading "${title}"...` });

      // Generate unique filename
      const fileHash = crypto.createHash('md5').update(videoUrl + Date.now()).digest('hex').substring(0, 8);
      const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      const filename = format === 'audio' 
        ? `${safeTitle}_${fileHash}.mp3`
        : `${safeTitle}_${fileHash}.mp4`;

      // Create downloads directory if it doesn't exist
      const downloadsDir = path.join(__dirname, '../../downloads');
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
      }

      const filePath = path.join(downloadsDir, filename);

      try {
        // Download video
        const downloadPromise = new Promise<void>((resolve, reject) => {
          const stream = ytdl(videoUrl, {
            quality: format === 'audio' ? 'highestaudio' : 'highest',
            filter: format === 'audio' ? 'audioonly' : 'videoandaudio'
          });

          stream.pipe(fs.createWriteStream(filePath));

          stream.on('end', () => resolve());
          stream.on('error', reject);
        });

        await downloadPromise;

        // Store download record
        const downloadRecord: DownloadRecord = {
          user_id: interaction.user.id,
          video_url: videoUrl,
          filename: filename,
          original_filename: title,
          file_path: filePath,
          created_at: Date.now(),
          expires_at: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        };

        await createDownloadRecord(downloadRecord);

        // Create embed
        const embed = new EmbedBuilder()
          .setTitle('✅ Download Ready')
          .setDescription(`**${title}**\nby ${author}`)
          .setColor('#00FF00')
          .addFields(
            { name: 'Format', value: format === 'audio' ? 'Audio (MP3)' : 'Video (MP4)', inline: true },
            { name: 'Duration', value: `${Math.floor(durationSeconds / 60)}:${durationSeconds % 60}`, inline: true },
            { name: 'File Size', value: `${(fs.statSync(filePath).size / (1024 * 1024)).toFixed(2)} MB`, inline: true }
          )
          .setFooter({ text: 'Link expires in 24 hours' });

        // Create action row with download button
        const row = new ActionRowBuilder<ButtonBuilder>();
        const downloadButton = new ButtonBuilder()
          .setCustomId(`download_${filename}`)
          .setLabel('📥 Download File')
          .setStyle(ButtonStyle.Success);

        row.addComponents(downloadButton);

        await interaction.editReply({ 
          embeds: [embed], 
          components: [row] 
        });

        // Handle button interaction
        const filter = (i: any) => i.customId === `download_${filename}`;
        const collector = interaction.channel?.createMessageComponentCollector({ 
          filter, 
          componentType: ComponentType.Button,
          time: 600000 // 10 minutes
        });

        collector?.on('collect', async (i) => {
          if (i.customId === `download_${filename}`) {
            try {
              // Check if file still exists
              if (!fs.existsSync(filePath)) {
                await i.reply({ 
                  content: '❌ File no longer available. Please try the command again.',
                  ephemeral: true 
                });
                return;
              }

              // Get download link from website
              const websiteUrl = process.env.WEBSITE_URL || 'https://c18h24o2.0x409.nl';
              const downloadLink = `${websiteUrl}/bot/features/download/command/${filename}`;

              await i.reply({ 
                content: `📥 Here's your download link: ${downloadLink}\n\n*Link expires in 24 hours*`,
                ephemeral: true 
              });

            } catch (error) {
              console.error('Error handling download button:', error);
              await i.reply({ 
                content: '❌ Error generating download link. Please try again.',
                ephemeral: true 
              });
            }
          }
        });

        collector?.on('end', () => {
          // Disable the button after timeout
          downloadButton.setDisabled(true);
          interaction.editReply({ components: [row] });
        });

      } catch (downloadError) {
        console.error('Error downloading video:', downloadError);
        
        // Clean up partial file if it exists
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        await interaction.editReply({ 
          content: '❌ Failed to download video. Please try again later.' 
        });
      }

    } catch (error) {
      console.error('Error in download command:', error);
      await interaction.editReply({ 
        content: '❌ An unexpected error occurred. Please try again later.' 
      });
    }
  }
};