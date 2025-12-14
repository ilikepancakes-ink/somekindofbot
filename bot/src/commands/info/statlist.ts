import { SlashCommandBuilder, ChannelType, GuildChannel } from 'discord.js';
const { getGuildStats, setGuildStats } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('statlist')
    .setDescription('creates a statist that shows at the top of the channel list'),

  async execute(interaction: any) {
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    // Get existing stats from DB
    let stats = await getGuildStats(guild.id);
    if (!stats) {
      stats = { guild_id: guild.id };
    }

    // Find or create the "Server Stats" category at the top
    let category = guild.channels.cache.find((c: GuildChannel) => c.name === 'Server Stats' && c.type === ChannelType.GuildCategory);
    if (!category) {
      category = await guild.channels.create({
        name: 'Server Stats',
        type: ChannelType.GuildCategory,
        position: 0
      });
    }

    // Calculate stats
    const memberCount = guild.memberCount;
    const daysSince = Math.floor((Date.now() - guild.createdTimestamp) / (1000 * 60 * 60 * 24));
    const roleCount = guild.roles.cache.size;
    const channelCount = guild.channels.cache.size;

    // Create or update Members channel
    if (!stats.member_channel_id) {
      const channel = await guild.channels.create({
        name: `Members: ${memberCount}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [{ id: guild.id, deny: ['Connect'] }]
      });
      stats.member_channel_id = channel.id;
    } else {
      const channel = guild.channels.cache.get(stats.member_channel_id);
      if (channel) await channel.setName(`Members: ${memberCount}`);
    }

    // Create or update Days channel
    if (!stats.days_channel_id) {
      const channel = await guild.channels.create({
        name: `Days: ${daysSince}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [{ id: guild.id, deny: ['Connect'] }]
      });
      stats.days_channel_id = channel.id;
    } else {
      const channel = guild.channels.cache.get(stats.days_channel_id);
      if (channel) await channel.setName(`Days: ${daysSince}`);
    }

    // Create or update Roles channel
    if (!stats.roles_channel_id) {
      const channel = await guild.channels.create({
        name: `Roles: ${roleCount}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [{ id: guild.id, deny: ['Connect'] }]
      });
      stats.roles_channel_id = channel.id;
    } else {
      const channel = guild.channels.cache.get(stats.roles_channel_id);
      if (channel) await channel.setName(`Roles: ${roleCount}`);
    }

    // Create or update Channels channel
    if (!stats.channels_channel_id) {
      const channel = await guild.channels.create({
        name: `Channels: ${channelCount}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [{ id: guild.id, deny: ['Connect'] }]
      });
      stats.channels_channel_id = channel.id;
    } else {
      const channel = guild.channels.cache.get(stats.channels_channel_id);
      if (channel) await channel.setName(`Channels: ${channelCount}`);
    }

    // Save to DB
    await setGuildStats(stats);

    await interaction.editReply({ content: 'Server stats channels created/updated successfully!' });
  },
};
