import { SlashCommandBuilder, ChannelType, GuildChannel } from 'discord.js';
import * as path from 'path';
const { getGuildStats, setGuildStats } = require(path.join(__dirname, '../../database'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('statlist')
    .setDescription('creates a statist that shows at the top of the channel list')
    .setDMPermission(true),

  async execute(interaction: any) {
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      await interaction.deferReply();
    } catch (error) {
      // Ignore if interaction is expired
    }

    // Get existing stats from DB (for future use)
    let stats = await getGuildStats(guild.id);
    if (!stats) {
      stats = { guild_id: guild.id };
    }

    // Find or create the "Server Stats" category at the top
    let category = guild.channels.cache.find((c: GuildChannel) => c.name === 'Server Stats' && c.type === ChannelType.GuildCategory);
    if (!category) {
      const allChannels = await guild.channels.fetch();
      category = allChannels.find((c: GuildChannel) => c.name === 'Server Stats' && c.type === ChannelType.GuildCategory);
      if (!category) {
        category = await guild.channels.create({
          name: 'Server Stats',
          type: ChannelType.GuildCategory,
          position: 0
        });
      } else {
        // Ensure the category is at the top position
        await category.setPosition(0);
      }
    } else {
      // Ensure the category is at the top position
      await category.setPosition(0);
    }

    // Remove any duplicate categories
    const duplicateCategories = guild.channels.cache.filter((c: GuildChannel) => c.name === 'Server Stats' && c.type === ChannelType.GuildCategory && c.id !== category.id);
    for (const dup of duplicateCategories.values()) {
      await dup.delete();
    }

    // Calculate stats
    const memberCount = guild.memberCount;
    const daysSince = Math.floor((Date.now() - guild.createdTimestamp) / (1000 * 60 * 60 * 24));
    const roleCount = guild.roles.cache.size;
    const channelCount = guild.channels.cache.size;

    // Create or update Members channel
    const existingMembers = category.children.cache.find((c: GuildChannel) => c.name.startsWith('Members: '));
    if (existingMembers) {
      await existingMembers.setName(`Members: ${memberCount}`);
      await existingMembers.permissionOverwrites.set([{ id: guild.id, deny: ['Connect'] }]);
      stats.member_channel_id = existingMembers.id;
    } else {
      const channel = await guild.channels.create({
        name: `Members: ${memberCount}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [{ id: guild.id, deny: ['Connect'] }]
      });
      stats.member_channel_id = channel.id;
    }

    // Create or update Days channel
    const existingDays = category.children.cache.find((c: GuildChannel) => c.name.startsWith('Days: '));
    if (existingDays) {
      await existingDays.setName(`Days: ${daysSince}`);
      await existingDays.permissionOverwrites.set([{ id: guild.id, deny: ['Connect'] }]);
      stats.days_channel_id = existingDays.id;
    } else {
      const channel = await guild.channels.create({
        name: `Days: ${daysSince}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [{ id: guild.id, deny: ['Connect'] }]
      });
      stats.days_channel_id = channel.id;
    }

    // Create or update Roles channel
    const existingRoles = category.children.cache.find((c: GuildChannel) => c.name.startsWith('Roles: '));
    if (existingRoles) {
      await existingRoles.setName(`Roles: ${roleCount}`);
      await existingRoles.permissionOverwrites.set([{ id: guild.id, deny: ['Connect'] }]);
      stats.roles_channel_id = existingRoles.id;
    } else {
      const channel = await guild.channels.create({
        name: `Roles: ${roleCount}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [{ id: guild.id, deny: ['Connect'] }]
      });
      stats.roles_channel_id = channel.id;
    }

    // Create or update Channels channel
    const existingChannels = category.children.cache.find((c: GuildChannel) => c.name.startsWith('Channels: '));
    if (existingChannels) {
      await existingChannels.setName(`Channels: ${channelCount}`);
      await existingChannels.permissionOverwrites.set([{ id: guild.id, deny: ['Connect'] }]);
      stats.channels_channel_id = existingChannels.id;
    } else {
      const channel = await guild.channels.create({
        name: `Channels: ${channelCount}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [{ id: guild.id, deny: ['Connect'] }]
      });
      stats.channels_channel_id = channel.id;
    }

    // Save to DB
    await setGuildStats(stats);

    try {
      await interaction.editReply({ content: 'Server stats channels created/updated successfully!' });
    } catch (error) {
      // Ignore if interaction is expired
    }
  },
};
