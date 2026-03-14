import { CommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('gork')
  .setDescription('Interact with Gork, the AI assistant')
  .addStringOption(option =>
    option.setName('message')
      .setDescription('Your message to Gork')
      .setRequired(true));

export async function execute(interaction: CommandInteraction) {
  console.log(`[Gork Command] Processing slash command from ${interaction.user.username}`);
  
  if (!interaction.isChatInputCommand()) {
    console.log(`[Gork Command] Not a chat input command, ignoring`);
    return;
  }

  const message = interaction.options.getString('message', true);
  console.log(`[Gork Command] User message: ${message}`);
  
  // Create a mock message object for Gork to process
  const mockMessage = {
    ...interaction,
    content: message,
    author: interaction.user,
    channel: interaction.channel,
    mentions: {
      users: new Map(),
      has: (user: any) => false
    },
    reference: null,
    attachments: new Map(),
    reply: async (content: any) => {
      console.log(`[Gork Command] Sending reply: ${typeof content === 'string' ? content.substring(0, 100) : 'embed'}`);
      if (typeof content === 'string') {
        return await interaction.reply(content);
      } else if (content.embeds) {
        return await interaction.reply({ embeds: [content.embeds] });
      } else {
        return await interaction.reply(content);
      }
    }
  };

  try {
    // Get the Gork instance from the client
    const gork = (interaction.client as any).gork;
    console.log(`[Gork Command] Gork instance found: ${!!gork}`);
    
    if (!gork) {
      console.log(`[Gork Command] Gork instance not found`);
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription('Gork is not available. Please contact the bot administrator.')
        .setColor(0xff0000);
      
      return await interaction.reply({ embeds: [errorEmbed] });
    }

    console.log(`[Gork Command] Calling gork.on_message()`);
    // Process the message through Gork
    await gork.on_message(mockMessage as any);
    console.log(`[Gork Command] Gork processing completed successfully`);
  } catch (error) {
    console.error('Error processing Gork command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription(`An error occurred while processing your request: ${error}`)
      .setColor(0xff0000);
    
    await interaction.reply({ embeds: [errorEmbed] });
  }
}
