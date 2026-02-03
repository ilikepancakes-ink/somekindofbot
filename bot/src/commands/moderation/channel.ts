import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType, ChannelType } from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Channel management commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a channel')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('The name of the channel to create')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a channel')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel to delete')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('lockdown')
        .setDescription('Lockdown or lift lockdown on a channel')
        .addStringOption(option =>
          option.setName('action')
            .setDescription('The lockdown action to perform')
            .setRequired(true)
            .addChoices(
              { name: 'Enable', value: 'enable' },
              { name: 'Lift', value: 'lift' }
            )))
    .addSubcommandGroup(subcommandGroup =>
      subcommandGroup
        .setName('category')
        .setDescription('Category management commands')
        .addSubcommand(subcommand =>
          subcommand
            .setName('add')
            .setDescription('Add a category')
            .addStringOption(option =>
              option.setName('name')
                .setDescription('The name of the category')
                .setRequired(true)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('delete')
            .setDescription('Delete a category')
            .addChannelOption(option =>
              option.setName('category')
                .setDescription('The category to delete')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildCategory))))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setContexts([InteractionContextType.Guild]),

  async execute(interaction: any) {
    if (!interaction.guild) {
      return await interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
    }

    const subcommand = interaction.options.getSubcommand();
    
    // Check if user has Manage Channels permission or is bot admin
    const isAdmin = process.env.BOT_ADMIN_USER_ID && interaction.user.id === process.env.BOT_ADMIN_USER_ID;
    if (!isAdmin && !interaction.member.permissions.has('ManageChannels')) {
      return await interaction.reply({ content: 'You need Manage Channels permission to use this command.', flags: 64 });
    }

    try {
      switch (subcommand) {
        case 'add':
          const channelName = interaction.options.getString('name');
          
          // Create the channel
          const newChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText
          });

          const addChannelType = newChannel.type === 0 ? 'Text' : newChannel.type === 2 ? 'Voice' : 'Other';
          const channelAddEmbed = new EmbedBuilder()
            .setTimestamp()
            .setFooter({ text: `Moderator: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTitle('➕ Channel Added')
            .setDescription(`Channel ${newChannel} has been created`)
            .setColor(0x00FF00)
            .addFields(
              { name: 'Channel', value: `${newChannel}`, inline: true },
              { name: 'Channel ID', value: newChannel.id, inline: true },
              { name: 'Type', value: addChannelType, inline: true }
            );

          await interaction.reply({ embeds: [channelAddEmbed] });
          break;

        case 'delete':
          const channelToDelete = interaction.options.getChannel('channel');
          
          // Delete the channel
          await channelToDelete.delete();

          const channelType = channelToDelete.type === 0 ? 'Text' : channelToDelete.type === 2 ? 'Voice' : 'Other';
          const channelDeleteEmbed = new EmbedBuilder()
            .setTimestamp()
            .setFooter({ text: `Moderator: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTitle('🗑️ Channel Deleted')
            .setDescription(`Channel ${channelToDelete.name} has been deleted`)
            .setColor(0xFF0000)
            .addFields(
              { name: 'Channel', value: `${channelToDelete.name}`, inline: true },
              { name: 'Channel ID', value: channelToDelete.id, inline: true },
              { name: 'Type', value: channelType, inline: true }
            );

          await interaction.reply({ embeds: [channelDeleteEmbed] });
          break;

        case 'lockdown':
          const action = interaction.options.getString('action');
          const channel = interaction.channel;

          if (action === 'enable') {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
              SendMessages: false
            });

            await interaction.reply(`Lockdown enabled on ${channel}.`);
          } else if (action === 'lift') {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
              SendMessages: null
            });

            await interaction.reply(`Lockdown lifted on ${channel}.`);
          }
          break;

        case 'category':
          const categorySubcommand = interaction.options.getSubcommand(true);
          
          if (categorySubcommand === 'add') {
            // Check if user has Manage Channels permission or is bot admin
            const isAdmin = process.env.BOT_ADMIN_USER_ID && interaction.user.id === process.env.BOT_ADMIN_USER_ID;
            if (!isAdmin && !interaction.member.permissions.has('ManageChannels')) {
              return await interaction.reply({ content: 'You need Manage Channels permission to use this command.', flags: 64 });
            }
            
            const categoryName = interaction.options.getString('name');
            
            // Create the category
            const newCategory = await interaction.guild.channels.create({
              name: categoryName,
              type: ChannelType.GuildCategory
            });

            const categoryAddEmbed = new EmbedBuilder()
              .setTimestamp()
              .setFooter({ text: `Moderator: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
              .setTitle('➕ Category Added')
              .setDescription(`Category ${newCategory} has been created`)
              .setColor(0x00FF00)
              .addFields(
                { name: 'Category', value: `${newCategory}`, inline: true },
                { name: 'Category ID', value: newCategory.id, inline: true }
              );

            await interaction.reply({ embeds: [categoryAddEmbed] });
          } else if (categorySubcommand === 'delete') {
            // Check if user has Manage Channels permission or is bot admin
            const isAdmin = process.env.BOT_ADMIN_USER_ID && interaction.user.id === process.env.BOT_ADMIN_USER_ID;
            if (!isAdmin && !interaction.member.permissions.has('ManageChannels')) {
              return await interaction.reply({ content: 'You need Manage Channels permission to use this command.', flags: 64 });
            }
            
            const category = interaction.options.getChannel('category');
            
            // Delete the category
            await category.delete();

            const categoryDeleteEmbed = new EmbedBuilder()
              .setTimestamp()
              .setFooter({ text: `Moderator: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
              .setTitle('🗑️ Category Deleted')
              .setDescription(`Category ${category.name} has been deleted`)
              .setColor(0xFF0000)
              .addFields(
                { name: 'Category', value: `${category.name}`, inline: true },
                { name: 'Category ID', value: category.id, inline: true }
              );

            await interaction.reply({ embeds: [categoryDeleteEmbed] });
          }
          break;

        default:
          return await interaction.reply({ content: 'Unknown subcommand.', flags: 64 });
      }
    } catch (error) {
      console.error(error);
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription(`Failed to execute channel command.`)
        .setColor(0xFF0000)
        .setTimestamp();
      await interaction.reply({ embeds: [errorEmbed], flags: 64 });
    }
  },
};