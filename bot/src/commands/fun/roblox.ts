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
    .addSubcommand(subcommand =>
      subcommand
        .setName('user')
        .setDescription('Get profile information of a Roblox user')
        .addStringOption(option =>
          option.setName('username')
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
          await interaction.reply({ content: 'Failed to fetch avatar!', flags: 64 });
          return;
        }

        const avatarUrl = avatarResponse.data.data[0].imageUrl;

        // Create embed
        const embed = new EmbedBuilder()
          .setTitle(`${displayName}'s Roblox Avatar`)
          .setImage(avatarUrl)
          .setColor(0x00AAFF)
          .setFooter({ text: `UserID: ${userId}` });

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
    } else if (subcommand === 'user') {
      const username = interaction.options.getString('username');

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

        // Get detailed user info
        const userDetailsResponse = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
        const userDetails = userDetailsResponse.data;

        // Get friends count
        const friendsResponse = await axios.get(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
        const friendsCount = friendsResponse.data.count;

        // Get badges
        const badgesResponse = await axios.get(`https://badges.roblox.com/v1/users/${userId}/badges`);
        const badgesCount = badgesResponse.data.data ? badgesResponse.data.data.length : 0;

        // Get avatar thumbnail
        const avatarResponse = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`);
        const avatarUrl = avatarResponse.data.data && avatarResponse.data.data.length > 0 ? avatarResponse.data.data[0].imageUrl : null;

        // Format created date
        const createdDate = new Date(userDetails.created).toLocaleDateString();

        // Create embed
        const embed = new EmbedBuilder()
          .setTitle(`${displayName}'s Roblox Profile`)
          .setColor(0x00AAFF)
          .setThumbnail(avatarUrl)
          .addFields(
            { name: 'Username', value: userDetails.name, inline: true },
            { name: 'User ID', value: userDetails.id.toString(), inline: true },
            { name: 'Created', value: createdDate, inline: true },
            { name: 'Friends', value: friendsCount.toString(), inline: true },
            { name: 'Badges', value: badgesCount.toString(), inline: true },
            { name: 'Verified', value: userDetails.hasVerifiedBadge ? 'Yes' : 'No', inline: true }
          )
          .setFooter({ text: `Roblox User Profile` });

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
        await interaction.reply({ content: 'Failed to fetch Roblox profile information. Please try again later.', flags: 64 });
      }
    }
  },
};
