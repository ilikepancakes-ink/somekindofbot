import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { getFMUser } from '../../database';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('login')
    .setDescription('Connect your Last.fm account'),

  async execute(interaction: any) {
    const fmUser = await getFMUser(interaction.user.id);

    if (fmUser && fmUser.lastfm_username) {
      return interaction.reply({ content: `You are already connected as ${fmUser.lastfm_username}.`, ephemeral: true });
    }

    const authUrl = `https://www.last.fm/api/auth/?api_key=${process.env.LASTFM_API_KEY}&cb=http://localhost:8594/callback?user_id=${interaction.user.id}`;

    const embed = new EmbedBuilder()
      .setTitle('Connect Last.fm Account')
      .setDescription('Click the button below to authorize your Last.fm account.')
      .setColor(0xff0000);

    const button = new ButtonBuilder()
      .setLabel('Authorize')
      .setURL(authUrl)
      .setStyle(ButtonStyle.Link);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(button);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },
};
