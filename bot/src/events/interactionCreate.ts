import { Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { rule34Data } from '../commands/nsfw/rule34';

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction: any) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error: any) {
        console.error(error);
        if (error.code === 10062) return; // Don't respond to expired interactions
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'There was an error while executing this command!', flags: 64 });
        } else {
          await interaction.reply({ content: 'There was an error while executing this command!', flags: 64 });
        }
      }
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith('rule34_')) {
        const parts = interaction.customId.split('_');
        const action = parts[1];
        const id = parts[2];
        const data = rule34Data.get(id);
        if (!data) {
          return await interaction.reply({ content: 'Data not found.', flags: 64 });
        }
        const { posts, currentIndex } = data;
        let newIndex = currentIndex;
        if (action === 'prev') {
          newIndex = (currentIndex - 1 + posts.length) % posts.length;
        } else if (action === 'next') {
          newIndex = (currentIndex + 1) % posts.length;
        } else if (action === 'refresh') {
          newIndex = Math.floor(Math.random() * posts.length);
        }
        data.currentIndex = newIndex;
        const post = posts[newIndex];
        const tagsStr = post.tags ? post.tags.split(' ').slice(0, 10).join(' ') : 'N/A';
        const embed = new EmbedBuilder()
          .setTitle(`Rule 34 - Browse (${newIndex + 1}/${posts.length})`)
          .setDescription(`Tags: ${tagsStr}`)
          .setImage(post.file_url)
          .setFooter({ text: `Post ID: ${post.id}` });

        const prevButton = new ButtonBuilder()
          .setCustomId(`rule34_prev_${id}`)
          .setLabel('Prev')
          .setStyle(ButtonStyle.Secondary);

        const nextButton = new ButtonBuilder()
          .setCustomId(`rule34_next_${id}`)
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary);

        const refreshButton = new ButtonBuilder()
          .setCustomId(`rule34_refresh_${id}`)
          .setLabel('Refresh')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(prevButton, nextButton, refreshButton);

        await interaction.update({ embeds: [embed], components: [row] });
      } else {
        // Handle button interactions (for help command pagination)
        // The help command handles its own button interactions
      }
    }
  },
};
