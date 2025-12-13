import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kicks a user from the server')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The user to kick')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('The reason for the kick')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction: any) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await interaction.guild.members.kick(target, reason);
      await interaction.reply(`${target.username} has been kicked for: ${reason}`);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Failed to kick the user.', flags: 64 });
    }
  },
};
