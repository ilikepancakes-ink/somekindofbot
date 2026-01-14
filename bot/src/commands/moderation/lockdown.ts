import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Lockdown or lift lockdown on a channel')
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable lockdown on this channel'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('lift')
        .setDescription('Lift lockdown on this channel'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),

  async execute(interaction: any) {
    if (!interaction.guild) {
      return await interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
    }

    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.channel;

    try {
      if (subcommand === 'enable') {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          SendMessages: false
        });
        await interaction.reply(`Lockdown enabled on ${channel}.`);
      } else if (subcommand === 'lift') {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          SendMessages: null
        });
        await interaction.reply(`Lockdown lifted on ${channel}.`);
      }
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Failed to modify channel permissions.', flags: 64 });
    }
  },
};
