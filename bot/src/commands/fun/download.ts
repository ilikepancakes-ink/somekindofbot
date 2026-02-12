import { CommandInteraction, EmbedBuilder, SlashCommandBuilder, CacheType, ChatInputCommandInteraction } from 'discord.js';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('download')
    .setDescription('Download a video from any supported site using yt-dlp')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('The URL of the video to download')
        .setRequired(true)),
  
  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const videoUrl = interaction.options.getString('url', true);

    try {
      await interaction.deferReply();

      // Validate URL
      if (!videoUrl || !videoUrl.startsWith('http')) {
        return interaction.editReply({ content: 'Please provide a valid URL.' });
      }

      await interaction.editReply({ content: '🔍 Analyzing video...' });

      // Create downloads directory if it doesn't exist
      const downloadsDir = path.join(__dirname, '../../downloads');
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `download_${timestamp}`;

      try {
        await interaction.editReply({ content: `📥 Downloading video...` });

        // Use yt-dlp to download the video
        const ytDlpCommand = `yt-dlp -o "${path.join(downloadsDir, filename)}.%(ext)s" "${videoUrl}"`;
        
        const { stdout, stderr } = await execAsync(ytDlpCommand, { 
          timeout: 300000 // 5 minute timeout
        });

        // Find the downloaded file (yt-dlp adds extension)
        const files = fs.readdirSync(downloadsDir);
        const downloadedFile = files.find(f => f.startsWith(filename));
        
        if (!downloadedFile) {
          return interaction.editReply({ 
            content: '❌ Failed to find downloaded file.' 
          });
        }

        const filePath = path.join(downloadsDir, downloadedFile);
        const fileSize = fs.statSync(filePath).size;

        // Check file size limit (8MB for Discord)
        const maxSize = 8 * 1024 * 1024; // 8MB in bytes
        if (fileSize > maxSize) {
          fs.unlinkSync(filePath);
          return interaction.editReply({ 
            content: `❌ File too large (${(fileSize / (1024 * 1024)).toFixed(2)} MB). Maximum size is 8MB.` 
          });
        }

        await interaction.editReply({ 
          content: `✅ Download complete! Uploading to Discord...`,
          files: [filePath]
        });

        // Clean up the file after upload
        setTimeout(() => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }, 5000);

      } catch (downloadError) {
        console.error('Error downloading video:', downloadError);
        
        // Clean up any partial files
        const files = fs.readdirSync(downloadsDir);
        const partialFiles = files.filter(f => f.startsWith(filename));
        partialFiles.forEach(f => {
          const filePath = path.join(downloadsDir, f);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });

        await interaction.editReply({ 
          content: '❌ Failed to download video. Please check the URL and try again.' 
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
