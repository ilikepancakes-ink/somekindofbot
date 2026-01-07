import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import axios from 'axios';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roblox')
    .setDescription('Roblox related commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('avatar')
        .setDescription('Get the avatar of a Roblox user')
        .addStringOption(option =>
          option.setName('user')
            .setDescription('The Roblox username')
            .setRequired(true)))
    .setDMPermission(true),

  async execute(interaction: any) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'avatar') {
      const username = interaction.options.getString('user');

      try {
        // First, get user ID from username
        const userResponse = await axios.post('https://users.roblox.com/v1/usernames/users', {
          usernames: [username]
        });

        if (!userResponse.data.data || userResponse.data.data.length === 0) {
          await interaction.reply({ content: `No Roblox user found with the username "${username}".`, flags: 64 });
          return;
        }

        const userId = userResponse.data.data[0].id;
        const displayName = userResponse.data.data[0].displayName;

        // Get avatar thumbnail
        const avatarResponse = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`);

        if (!avatarResponse.data.data || avatarResponse.data.data.length === 0) {
          await interaction.reply({ content: 'Failed to fetch avatar image.', flags: 64 });
          return;
        }

        const avatarUrl = avatarResponse.data.data[0].imageUrl;

        // Create embed
        const embed = new EmbedBuilder()
          .setTitle(`${displayName}'s Roblox Avatar`)
          .setImage(avatarUrl)
          .setColor(0x00AAFF)
          .setFooter({ text: `Username: ${username}` });

        // Create button to visit profile
        const button = new ButtonBuilder()
          .setLabel('Visit Profile')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://www.roblox.com/users/${userId}/profile`);

        const row = new ActionRowBuilder()
          .addComponents(button);

        await interaction.reply({ embeds: [embed], components: [row] });
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Failed to fetch Roblox avatar. Please try again later.', flags: 64 });
      }
    }
  },
};