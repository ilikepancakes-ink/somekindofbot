import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getBetterEmbedsSettings, setBetterEmbedsSettings } from '../../database';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('betterembeds')
    .setDescription('Manage better embeds feature')
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable better embeds for this server'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable better embeds for this server'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction: any) {
    if (!interaction.guild) {
      return await interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    try {
      if (subcommand === 'enable') {
        await setBetterEmbedsSettings({ guild_id: guildId, enabled: true });
        await interaction.reply({ content: 'Better embeds have been enabled for this server!', flags: 64 });
      } else if (subcommand === 'disable') {
        await setBetterEmbedsSettings({ guild_id: guildId, enabled: false });
        await interaction.reply({ content: 'Better embeds have been disabled for this server.', flags: 64 });
      }
    } catch (error) {
      console.error('Error managing better embeds settings:', error);
      await interaction.reply({ content: 'Failed to update better embeds settings.', flags: 64 });
    }
  },
};
