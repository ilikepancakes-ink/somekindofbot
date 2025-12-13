import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bans a user from the server')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The user to ban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('The reason for the ban')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction: any) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await interaction.guild.members.ban(target, { reason });
      await interaction.reply(`${target.username} has been banned for: ${reason}`);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Failed to ban the user.', flags: 64 });
    }
  },
};
