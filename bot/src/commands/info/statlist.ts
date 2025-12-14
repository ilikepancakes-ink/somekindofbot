import { SlashCommandBuilder, EmbedBuilder, ChannelType, GuildChannel } from 'discord.js';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('statlist')
    .setDescription('Show server stats with a locked voice channel displaying member count'),

  async execute(interaction: any) {
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
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

    // Find or create the locked voice channel showing member count
    let voiceChannel = category.children.cache.find((c: GuildChannel) => c.name.startsWith('Members:') && c.type === ChannelType.GuildVoice);
    if (!voiceChannel) {
      voiceChannel = await guild.channels.create({
        name: `Members: ${guild.memberCount}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: ['Connect']
          }
        ]
      });
    } else {
      // Update the name if it exists
      await voiceChannel.setName(`Members: ${guild.memberCount}`);
    }

    // Calculate days since server creation
    const daysSince = Math.floor((Date.now() - guild.createdTimestamp) / (1000 * 60 * 60 * 24));

    // Create the embed with stats
    const embed = new EmbedBuilder()
      .setTitle('Server Stats')
      .addFields(
        { name: 'Days Since Creation', value: daysSince.toString(), inline: true },
        { name: 'Role Count', value: guild.roles.cache.size.toString(), inline: true },
        { name: 'Channel Count', value: guild.channels.cache.size.toString(), inline: true }
      )
      .setColor(0x0099ff)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
