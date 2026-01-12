import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Get information about the server')
    .setDMPermission(true),

  async execute(interaction: any) {
    if (!interaction.guild) {
      return await interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
    }
    const guild = interaction.guild;

    const embed = new EmbedBuilder()
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'Members', value: guild.memberCount.toString(), inline: true },
        { name: 'Channels', value: guild.channels.cache.size.toString(), inline: true },
        { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
        { name: 'Boost Level', value: guild.premiumTier.toString(), inline: true },
        { name: 'Boosts', value: guild.premiumSubscriptionCount?.toString() || '0', inline: true }
      )
      .setColor(0x0099ff)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
