import { CommandInteraction, EmbedBuilder, SlashCommandBuilder, CacheType, ChatInputCommandInteraction } from 'discord.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('review')
    .setDescription('Review code for safety using ollama model smollm:135m')
    .addSubcommand(subcommand =>
      subcommand
        .setName('code')
        .setDescription('Review code text for safety')
        .addStringOption(option =>
          option.setName('code')
            .setDescription('The code to review')
            .setRequired(true)
            .setMaxLength(2000)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('file')
        .setDescription('Review a code file for safety')
        .addAttachmentOption(option =>
          option.setName('file')
            .setDescription('The code file to review')
            .setRequired(true))),

  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    try {
      await interaction.deferReply();

      const subcommand = interaction.options.getSubcommand();
      
      let codeToReview = '';

      if (subcommand === 'code') {
        codeToReview = interaction.options.getString('code', true);
      } else if (subcommand === 'file') {
        const attachment = interaction.options.getAttachment('file', true);
        
        // Check if the file is a supported code file
        const supportedExtensions = ['.js', '.ts', '.py', '.java', '.c', '.cpp', '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.html', '.css', '.sql'];
        const fileExtension = attachment.name.substring(attachment.name.lastIndexOf('.'));
        
        if (!supportedExtensions.includes(fileExtension)) {
          return interaction.editReply({ 
            content: '❌ Unsupported file type. Please upload a code file with one of these extensions: ' + supportedExtensions.join(', ') 
          });
        }

        // Download the file content
        try {
          const response = await fetch(attachment.url);
          const fileContent = await response.text();
          
          // Check file size (limit to 5000 characters for safety)
          if (fileContent.length > 5000) {
            return interaction.editReply({ 
              content: '❌ File too large. Please upload a file with less than 5000 characters.' 
            });
          }
          
          codeToReview = fileContent;
        } catch (error) {
          console.error('Error downloading file:', error);
          return interaction.editReply({ 
            content: '❌ Failed to download file. Please try again.' 
          });
        }
      }

      // Validate code input
      if (!codeToReview || codeToReview.trim().length === 0) {
        return interaction.editReply({ 
          content: '❌ Please provide code to review.' 
        });
      }

      await interaction.editReply({ 
        content: '🔍 Analyzing code with AI model...' 
      });

      // Prepare the prompt for ollama
      const prompt = `Review the following code for safety and security issues. 

      IMPORTANT: You MUST respond with ONLY ONE of these EXACT responses and NOTHING ELSE:
      "Yes! this code is safe and not dangerous"
      "No! this code is not safe and should not be ran!"

      Code to review:
      \`\`\`
      ${codeToReview}
      \`\`\`

      Focus your analysis on:
      - Malicious code (backdoors, trojans, etc.)
      - Security vulnerabilities
      - Dangerous system operations
      - Suspicious network operations
      - Code injection risks
      - File system manipulation risks

      CRITICAL: Your response MUST be EXACTLY one of the two strings above. Do NOT add any explanation, reasoning, or additional text. Do NOT say "Based on my analysis..." or "The code is...". Simply output the exact string that matches your assessment.

      Example of CORRECT responses:
      Yes! this code is safe and not dangerous
      No! this code is not safe and should not be ran!

      Example of INCORRECT responses:
      Based on my analysis, this code is safe.
      The code appears to be safe and not dangerous.
      After reviewing the code, I believe it is safe.

      You MUST choose one of the two exact responses and output ONLY that string.`;

      try {
        // Call ollama with the smollm:135m model
        const { stdout, stderr } = await execAsync(`echo "${prompt}" | ollama run smollm:135m`, { 
          timeout: 30000 // 30 second timeout
        });

        // Clean up the response and check for the exact responses
        const response = stdout.trim();
        let finalResponse = '';
        let isSafe = false;

        if (response.includes('Yes! this code is safe and not dangerous')) {
          finalResponse = 'Yes! this code is safe and not dangerous';
          isSafe = true;
        } else if (response.includes('No! this code is not safe and should not be ran!')) {
          finalResponse = 'No! this code is not safe and should not be ran!';
          isSafe = false;
        } else {
          // Fallback if the model doesn't respond with exact text
          finalResponse = '⚠️ Unable to determine safety with confidence. Please review manually.';
        }

        // Create embed response
        const embed = new EmbedBuilder()
          .setTitle('🔒 Code Safety Review')
          .setDescription(`**Input Type:** ${subcommand === 'code' ? 'Text Input' : 'File Upload'}\n\n**Result:** ${finalResponse}`)
          .setColor(isSafe ? '#00FF00' : '#FF0000')
          .setTimestamp()
          .setFooter({ text: 'Powered by ollama smollm:135m' });

        await interaction.editReply({ 
          embeds: [embed]
        });

      } catch (ollamaError) {
        console.error('Error with ollama:', ollamaError);
        
        // Check if ollama is installed
        try {
          await execAsync('ollama --version');
        } catch (versionError) {
          return interaction.editReply({ 
            content: '❌ Ollama is not installed or not accessible. Please install ollama and ensure the smollm:135m model is available.' 
          });
        }

        return interaction.editReply({ 
          content: '❌ Failed to analyze code. The ollama model may not be available or there was an error processing the request.' 
        });
      }

    } catch (error) {
      console.error('Error in review command:', error);
      await interaction.editReply({ 
        content: '❌ An unexpected error occurred. Please try again later.' 
      });
    }
  }
};