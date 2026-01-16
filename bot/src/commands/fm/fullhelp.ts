import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fullhelp')
    .setDescription('Shows a complete list of all FM commands'),

  async execute(interaction: any) {
    const embed = new EmbedBuilder()
      .setTitle('FM Commands Help')
      .setDescription('List of all available FM commands')
      .setColor(0xff0000)
      .addFields(
        { name: '🎵 Plays Commands', value: '`/fm` - Shows your last 1–2 scrobbles\n`/recent` - Shows your latest plays', inline: false },
        { name: '🎧 Track Commands', value: '`/track` - Gets info about the track you\'re listening to or searching for\n`/trackplays` - Shows playcount for the current or searched track\n`/trackdetails` - Shows metadata for the current or searched track', inline: false },
        { name: '💿 Album Commands', value: '`/album` - Gets info about the current or searched album\n`/albumplays` - Shows playcount for the current or searched album\n`/chart` - Creates a chart of your top albums', inline: false },
        { name: '👤 Miscellaneous Commands', value: '`/login` - Connect your Last.fm account\n`/fullhelp` - Shows this help', inline: false }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
