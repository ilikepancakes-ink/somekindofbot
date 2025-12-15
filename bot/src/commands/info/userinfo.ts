import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Get information about a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to get info about (leave empty for yourself)')
        .setRequired(false))
    .setDMPermission(true),

  async execute(interaction: any) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild.members.cache.get(user.id);

    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s Information`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Username', value: user.username, inline: true },
        { name: 'Discriminator', value: `#${user.discriminator}`, inline: true },
        { name: 'ID', value: user.id, inline: true },
        { name: 'Joined Discord', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: true },
        { name: 'Joined Server', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : 'Not in server', inline: true },
        { name: 'Roles', value: member ? member.roles.cache.map((role: any) => role.name).join(', ') || 'None' : 'Not in server', inline: false }
      )
      .setColor(member ? member.displayHexColor : 0x0099ff)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
