import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows available commands'),

  async execute(interaction: any) {
    const commands = interaction.client.commands;
    const commandList: Array<{ name: string; description: string; group: string }> = [];

    // Fetch all commands and their groups
    commands.forEach((command: any) => {
      commandList.push({
        name: command.data.name,
        description: command.data.description,
        group: command.group.charAt(0).toUpperCase() + command.group.slice(1) // Capitalize first letter
      });
    });

    // Sort commands alphabetically
    commandList.sort((a, b) => a.name.localeCompare(b.name));

    const totalPages = Math.ceil(commandList.length / 10);
    let currentPage = 0;

    const generateEmbed = (page: number) => {
      const start = page * 10;
      const end = start + 10;
      const pageCommands = commandList.slice(start, end);

      const embed = new EmbedBuilder()
        .setTitle('Bot Commands')
        .setDescription(`Page ${page + 1} of ${totalPages}`)
        .setColor(0x0099FF);

      pageCommands.forEach(cmd => {
        embed.addFields({
          name: `/${cmd.name}`,
          value: `${cmd.description}\n**Group:** ${cmd.group}`,
          inline: false
        });
      });

      return embed;
    };

    const generateButtons = (page: number) => {
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('help_prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId('help_next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === totalPages - 1)
        );

      return row;
    };

    const embed = generateEmbed(currentPage);
    const buttons = generateButtons(currentPage);

    const response = await interaction.reply({
      embeds: [embed],
      components: [buttons]
    });

    // Create a collector for button interactions
    const collector = response.createMessageComponentCollector({
      time: 60000 // 60 seconds
    });

    collector.on('collect', async (i: any) => {
      if (i.customId === 'help_prev' && currentPage > 0) {
        currentPage--;
      } else if (i.customId === 'help_next' && currentPage < totalPages - 1) {
        currentPage++;
      }

      const newEmbed = generateEmbed(currentPage);
      const newButtons = generateButtons(currentPage);

      await i.update({
        embeds: [newEmbed],
        components: [newButtons]
      });
    });

    collector.on('end', async () => {
      // Disable buttons after timeout
      const disabledButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('help_prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('help_next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
        );

      await interaction.editReply({
        components: [disabledButtons]
      });
    });
  },
};
