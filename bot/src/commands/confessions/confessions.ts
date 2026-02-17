import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ComponentType, 
  PermissionFlagsBits, 
  InteractionContextType,
  ModalSubmitInteraction,
  ButtonInteraction,
  Message,
  ThreadChannel,
  Guild,
  GuildMember,
  User,
  Channel,
  TextChannel,
  MessagePayload,
  MessageCreateOptions
} from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';

// Configuration interface
interface ConfessionConfig {
  confession_channel_id?: string;
  logging_channel_id?: string;
}

interface ServerConfigs {
  [guildId: string]: ConfessionConfig;
}

// Global configuration storage
let configs: ServerConfigs = {};

// Load configurations from file
function loadConfigs(): ServerConfigs {
  const configPath = path.join(__dirname, 'confession_configs.json');
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.error('Error loading confession configs:', error);
      return {};
    }
  }
  return {};
}

// Save configurations to file
function saveConfigs() {
  const configPath = path.join(__dirname, 'confession_configs.json');
  try {
    fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
  } catch (error) {
    console.error('Error saving confession configs:', error);
  }
}

// Initialize configs
configs = loadConfigs();

// Confession Modal
class ConfessionModal extends ModalBuilder {
  constructor(customId: string) {
    super();
    this.setCustomId(customId);
    this.setTitle('Submit Anonymous Confession');

    const confessionInput = new TextInputBuilder()
      .setCustomId('confession_text')
      .setLabel('Your anonymous confession')
      .setPlaceholder('Type your confession here...')
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(2000)
      .setRequired(true);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(confessionInput);
    this.addComponents(firstActionRow);
  }
}

// Anonymous Reply Modal
class AnonymousReplyModal extends ModalBuilder {
  private messageId: string;

  constructor(customId: string, messageId: string) {
    super();
    this.setCustomId(customId);
    this.setTitle('Anonymous Reply');

    this.messageId = messageId;

    const replyInput = new TextInputBuilder()
      .setCustomId('reply_text')
      .setLabel('Your anonymous reply')
      .setPlaceholder('Type your anonymous reply here...')
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(2000)
      .setRequired(true);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(replyInput);
    this.addComponents(firstActionRow);
  }

  getMessageId(): string {
    return this.messageId;
  }
}

// Confession View with persistent button
export class ConfessionView extends ActionRowBuilder<ButtonBuilder> {
  constructor() {
    super();
    
    const confessButton = new ButtonBuilder()
      .setCustomId('confess_button')
      .setLabel('📝 Confess')
      .setStyle(ButtonStyle.Primary);

    this.addComponents(confessButton);
  }
}

// Setup command group
const setupGroup = {
  name: 'setup',
  description: 'Setup commands for the confessions cog',
  guild_only: true,
  subcommands: {
    logs: {
      name: 'logs',
      description: 'Setup logging for confessions',
      subcommands: {
        set: {
          name: 'set',
          description: 'Set the channel for logging confessions',
          options: [
            {
              type: 7, // Channel type
              name: 'channel',
              description: 'The channel to set as the logging channel',
              required: true
            }
          ],
          default_member_permissions: '0x8' // Administrator permission
        }
      }
    },
    channel: {
      name: 'channel',
      description: 'Setup the confession channel',
      subcommands: {
        set: {
          name: 'set',
          description: 'Set the channel for anonymous confessions',
          options: [
            {
              type: 7, // Channel type
              name: 'channel',
              description: 'The channel to set as the confession channel',
              required: true
            }
          ],
          default_member_permissions: '0x8' // Administrator permission
        }
      }
    },
    post_button: {
      name: 'post-button',
      description: 'Post a confess button in the current channel',
      default_member_permissions: '0x8' // Administrator permission
    }
  }
};

// Main confessions command group
module.exports = {
  data: new SlashCommandBuilder()
    .setName('confessions')
    .setDescription('Anonymous confessions system')
    .addSubcommand(subcommand =>
      subcommand
        .setName('submit')
        .setDescription('Submit an anonymous confession')
        .addStringOption(option =>
          option.setName('confession')
            .setDescription('Your anonymous confession')
            .setRequired(true)
            .setMaxLength(2000))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup-logs')
        .setDescription('Set the channel for logging confessions')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel to set as the logging channel')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup-channel')
        .setDescription('Set the channel for anonymous confessions')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel to set as the confession channel')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('post-button')
        .setDescription('Post a confess button in the current channel')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM]),

  async execute(interaction: any) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'submit') {
      await handleConfessionSubmit(interaction);
    } else if (subcommand === 'setup-logs') {
      await handleSetupLogs(interaction);
    } else if (subcommand === 'setup-channel') {
      await handleSetupChannel(interaction);
    } else if (subcommand === 'post-button') {
      await handlePostButton(interaction);
    }
  },

  // Handle modal submissions
  handleModalSubmit: async (interaction: ModalSubmitInteraction) => {
    if (interaction.customId === 'confession_modal') {
      await handleConfessionModal(interaction);
    } else if (interaction.customId === 'anonymous_reply_modal') {
      await handleAnonymousReplyModal(interaction);
    }
  },

  // Handle button interactions
  handleButtonInteraction: async (interaction: ButtonInteraction) => {
    if (interaction.customId === 'confess_button') {
      await handleConfessButton(interaction);
    } else if (interaction.customId === 'reply_to_confession') {
      await handleReplyButton(interaction);
    }
  },

  // Handle message events for thread replies
  handleMessage: async (message: Message) => {
    // Ignore messages from the bot itself or DMs
    if (message.author.bot || message.channel.type === 1) { // DM channel type
      return;
    }

    // Handle anonymous replies in confession threads
    if (message.channel.isThread()) {
      const thread = message.channel as ThreadChannel;
      
      // Get the parent message of the thread
      let parentMessage: Message | undefined;
      try {
        if (thread.parent && 'messages' in thread.parent) {
          parentMessage = await thread.parent.messages.fetch(thread.id);
        }
      } catch (error) {
        // If we can't fetch the parent message, it might not be a confession thread
        return;
      }

      // Check if the parent message is a confession embed
      if (parentMessage && parentMessage.embeds.length > 0 && 
          parentMessage.embeds[0].footer?.text === 'Anonymous Confession') {
        
        // Delete the user's message
        await message.delete();

        // Send the message anonymously in the thread
        const anonymousEmbed = new EmbedBuilder()
          .setDescription(message.content)
          .setColor(0x808080) // Grey color for replies
          .setFooter({ text: 'Anonymous Reply' });

        const sentReply = await thread.send({ embeds: [anonymousEmbed] });

        // Log the reply if logging is enabled
        const guildId = message.guild!.id;
        const loggingChannelId = configs[guildId]?.logging_channel_id;
        if (loggingChannelId) {
          const loggingChannel = message.client.channels.cache.get(loggingChannelId) as TextChannel;
          if (loggingChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle('New Anonymous Reply Submitted (Direct Message)')
              .setDescription(`Reply from: ${message.author.displayName}\nReply: ${message.content}\nOriginal Confession Message ID: ${parentMessage.id}\nReply Message ID: ${sentReply.id}\nThread: ${thread}`)
              .setColor(0xffa500) // Orange color
              .setTimestamp();

            await loggingChannel.send({ embeds: [logEmbed] });
          }
        }
      }
    }
  }
};

// Helper functions
async function handleConfessionSubmit(interaction: any) {
  const confession = interaction.options.getString('confession');
  
  // Create the confession embed
  const embed = new EmbedBuilder()
    .setDescription(confession)
    .setColor(0x0099ff) // Blue color
    .setFooter({ text: 'Anonymous Confession' });

  // Send ephemeral confirmation to the user
  await interaction.reply({ 
    content: 'Your confession has been submitted anonymously.', 
    ephemeral: true 
  });

  // Get the confession channel from configs
  const guildId = interaction.guild.id;
  const confessionChannelId = configs[guildId]?.confession_channel_id;
  const confessionChannel = confessionChannelId ? interaction.client.channels.cache.get(confessionChannelId) as TextChannel : null;

  if (confessionChannel) {
    // Create a view with a reply button
    const view = new ConfessionView();

    const sentMessage = await confessionChannel.send({ 
      embeds: [embed], 
      components: [view] 
    });

    // Check if logging is enabled and send log message
    const loggingChannelId = configs[guildId]?.logging_channel_id;
    if (loggingChannelId) {
      const loggingChannel = interaction.client.channels.cache.get(loggingChannelId) as TextChannel;
      if (loggingChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('New Confession Submitted')
          .setDescription(`Confession from: ${interaction.user.displayName}\nConfession: ${confession}\nMessage ID: ${sentMessage.id}`)
          .setColor(0x00ff00) // Green color
          .setTimestamp();

        await loggingChannel.send({ embeds: [logEmbed] });
      }
    }
  } else {
    // Inform the user if the confession channel is not set
    await interaction.followUp({ 
      content: 'Error: Confession channel is not set. Please contact an administrator.', 
      ephemeral: true 
    });
  }
}

async function handleSetupLogs(interaction: any) {
  const channel = interaction.options.getChannel('channel') as TextChannel;
  const guildId = interaction.guild.id;

  if (!configs[guildId]) {
    configs[guildId] = {};
  }
  configs[guildId].logging_channel_id = channel.id;
  saveConfigs();

  await interaction.reply({ 
    content: `Logging channel set to ${channel}`, 
    ephemeral: true 
  });
}

async function handleSetupChannel(interaction: any) {
  const channel = interaction.options.getChannel('channel') as TextChannel;
  const guildId = interaction.guild.id;

  if (!configs[guildId]) {
    configs[guildId] = {};
  }
  configs[guildId].confession_channel_id = channel.id;
  saveConfigs();

  await interaction.reply({ 
    content: `Confession channel set to ${channel}`, 
    ephemeral: true 
  });
}

async function handlePostButton(interaction: any) {
  // Create embed for the confess button
  const embed = new EmbedBuilder()
    .setTitle('📝 Anonymous Confessions')
    .setDescription('Click the button below to submit an anonymous confession.')
    .setColor(0x0099ff) // Blue color
    .setFooter({ text: 'Your confession will be posted anonymously' });

  // Create the view with the confess button
  const view = new ConfessionView();

  // Send the message with the button
  await interaction.reply({ embeds: [embed], components: [view] });
  await interaction.followUp({ 
    content: 'Confess button posted successfully!', 
    ephemeral: true 
  });
}

// Helper functions for modals and buttons
async function handleConfessionModal(interaction: ModalSubmitInteraction) {
  const confessionText = interaction.fields.getTextInputValue('confession_text');
  
  // Create the confession embed
  const embed = new EmbedBuilder()
    .setDescription(confessionText)
    .setColor(0x0099ff) // Blue color
    .setFooter({ text: 'Anonymous Confession' });

  // Get the confession channel from configs
  const guildId = interaction.guild!.id;
  const confessionChannelId = configs[guildId]?.confession_channel_id;
  const confessionChannel = confessionChannelId ? interaction.client.channels.cache.get(confessionChannelId) as TextChannel : null;

  if (confessionChannel) {
    // Create a view with a reply button
    const view = new ConfessionView();

    const sentMessage = await confessionChannel.send({ 
      embeds: [embed], 
      components: [view] 
    });

    // Check if logging is enabled and send log message
    const loggingChannelId = configs[guildId]?.logging_channel_id;
    if (loggingChannelId) {
      const loggingChannel = interaction.client.channels.cache.get(loggingChannelId) as TextChannel;
      if (loggingChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('New Confession Submitted')
          .setDescription(`Confession from: ${interaction.user.displayName}\nConfession: ${confessionText}\nMessage ID: ${sentMessage.id}`)
          .setColor(0x00ff00) // Green color
          .setTimestamp();

        await loggingChannel.send({ embeds: [logEmbed] });
      }
    }

    // Confirm to the user
    await interaction.reply({ 
      content: 'Your confession has been submitted anonymously.', 
      ephemeral: true 
    });
  } else {
    // Inform the user if the confession channel is not set
    await interaction.reply({ 
      content: 'Error: Confession channel is not set. Please contact an administrator.', 
      ephemeral: true 
    });
  }
}

async function handleAnonymousReplyModal(interaction: ModalSubmitInteraction) {
  const replyText = interaction.fields.getTextInputValue('reply_text');
  
  // Try to find existing thread or create a new one
  let thread: ThreadChannel | null = null;
  
  try {
    // Check if there's already a thread for this message
    const messageId = (interaction.message as Message).id;
    const confessionChannel = interaction.channel as TextChannel;
    
    for (const existingThread of confessionChannel.threads.cache.values()) {
      if (existingThread.name === 'Confession Reply Thread') {
        // Simple heuristic to check if this thread was created from our message
        if (Math.abs(parseInt(existingThread.id) - parseInt(messageId)) < 1000) {
          thread = existingThread;
          break;
        }
      }
    }
  } catch (error) {
    // Continue if thread checking fails
  }

  // If no thread exists, create one
  if (!thread) {
    const confessionMessage = interaction.message as Message;
    if (confessionMessage.inGuild()) {
      thread = await confessionMessage.startThread({
        name: 'Confession Reply Thread',
        autoArchiveDuration: 60
      });
    }
  }

  // Send the anonymous reply in the thread
  if (thread) {
    const anonymousEmbed = new EmbedBuilder()
      .setDescription(replyText)
      .setColor(0x808080) // Grey color for replies
      .setFooter({ text: 'Anonymous Reply' });

    const sentReply = await thread.send({ embeds: [anonymousEmbed] });

    // Log the reply if logging is enabled
    const guildId = interaction.guild!.id;
    const loggingChannelId = configs[guildId]?.logging_channel_id;
    if (loggingChannelId) {
      const loggingChannel = interaction.client.channels.cache.get(loggingChannelId) as TextChannel;
      if (loggingChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('New Anonymous Reply Submitted')
          .setDescription(`Reply from: ${interaction.user.displayName}\nReply: ${replyText}\nOriginal Confession Message ID: ${(interaction.message as Message).id}\nReply Message ID: ${sentReply.id}\nThread: ${thread?.name || 'Unknown'}`)
          .setColor(0xffa500) // Orange color
          .setTimestamp();

        await loggingChannel.send({ embeds: [logEmbed] });
      }
    }

    // Confirm to the user
    await interaction.reply({ 
      content: `Your anonymous reply has been sent in ${thread}`, 
      ephemeral: true 
    });
  } else {
    await interaction.reply({ 
      content: 'Error: Could not create or find a thread for this confession.', 
      ephemeral: true 
    });
  }
}

async function handleConfessButton(interaction: ButtonInteraction) {
  // Show the confession modal
  const modal = new ConfessionModal('confession_modal');
  await interaction.showModal(modal);
}

async function handleReplyButton(interaction: ButtonInteraction) {
  // Show the anonymous reply modal
  const modal = new AnonymousReplyModal('anonymous_reply_modal', interaction.message.id);
  await interaction.showModal(modal);
}

