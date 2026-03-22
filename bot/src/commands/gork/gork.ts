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
    
    // Create a proper mock message object that matches Discord.js Message interface
    const mockMessage = {
      id: interaction.id,
      content: message,
      author: interaction.user,
      channel: interaction.channel,
      guild: interaction.guild,
      attachments: new Map(),
      embeds: [],
      mentions: {
        users: new Map(),
        has: (user: any) => false,
        everyone: false,
        roles: new Map()
      },
      reference: null,
      createdTimestamp: Date.now(),
      editedTimestamp: null,
      type: 'DEFAULT',
      system: false,
      pinned: false,
      tts: false,
      nonce: null,
      webhookId: null,
      activity: null,
      applicationId: null,
      flags: 0,
      stickers: new Map(),
      components: [],
      cleanContent: message,
      member: interaction.member,
      reactions: new Map(),
      url: `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${interaction.id}`,
      
      // Methods
      reply: async (content: any) => {
        console.log(`[Gork Command] Sending reply: ${typeof content === 'string' ? content.substring(0, 100) : 'embed'}`);
        if (typeof content === 'string') {
          return await interaction.reply(content);
        } else if (content.embeds) {
          return await interaction.reply({ embeds: [content.embeds] });
        } else {
          return await interaction.reply(content);
        }
      },
      
      delete: async () => {
        // No-op for slash command context
        return;
      },
      
      edit: async (content: any) => {
        // No-op for slash command context
        return;
      },
      
      react: async (emoji: any) => {
        // No-op for slash command context
        return;
      },
      
      fetch: async () => {
        return mockMessage;
      }
    };

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
