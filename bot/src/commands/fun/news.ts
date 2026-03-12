import { CommandInteraction, EmbedBuilder, Message, ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { RESTPostAPIApplicationCommandsJSONBody } from 'discord-api-types/v10';
import axios from 'axios';
import { config } from 'dotenv';

config();

const command: RESTPostAPIApplicationCommandsJSONBody = new SlashCommandBuilder()
  .setName('news')
  .setDescription('Get the latest news headlines')
  .toJSON();

export default {
  data: command,
  async execute(interaction: CommandInteraction) {
    try {
      const response = await axios.get('https://newsapi.org/v2/top-headlines', {
        params: {
          country: 'us',
          apiKey: process.env.NEWS_API_KEY,
        },
      });

      if (response.data.status !== 'ok') {
        await interaction.reply({ content: 'Failed to fetch news. Please try again later.', ephemeral: true });
        return;
      }

      const articles = response.data.articles.slice(0, 10); // Get top 10 articles
      let currentPage = 0;

      const createEmbed = (page: number) => {
        const article = articles[page];
        const sourceName = article.source?.name || 'Unknown source';
        const description = article.description || 'No description available.';
        const url = article.url || 'https://newsapi.org/';
        const imageUrl = article.urlToImage || 'https://newsapi.org/images/news-placeholder.jpg';

        return new EmbedBuilder()
          .setColor('#777777')
          .setTitle(article.title)
          .setURL(url)
          .setDescription(description)
          .setImage(imageUrl)
          .setAuthor({
            name: sourceName,
            url: 'https://newsapi.org/',
          })
          .setFooter({
            text: `Page ${page + 1}/${articles.length} | Total results: ${response.data.totalResults}`,
          })
          .setTimestamp(new Date(article.publishedAt));
      };

      const initialEmbed = createEmbed(0);
      
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('Prev')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(articles.length <= 1)
        );

      const message = await interaction.reply({
        embeds: [initialEmbed],
        components: [row],
      });

      const filter = (i: any) => i.user.id === interaction.user.id;
      const collector = message.createMessageComponentCollector({ filter, time: 60000 }) as any;

      collector.on('collect', async (i: ButtonInteraction) => {
        if (i.customId === 'prev') {
          currentPage--;
        } else if (i.customId === 'next') {
          currentPage++;
        }

        const embed = createEmbed(currentPage);
        
        const newRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('prev')
              .setLabel('Prev')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(currentPage === 0),
            new ButtonBuilder()
              .setCustomId('next')
              .setLabel('Next')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(currentPage === articles.length - 1)
          );

        await i.update({ embeds: [embed], components: [newRow] });
      });

      collector.on('end', async () => {
        const disabledRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('prev')
              .setLabel('Prev')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('next')
              .setLabel('Next')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true)
          );
        await message.edit({ components: [disabledRow] });
      });

    } catch (error) {
      console.error('Error fetching news:', error);
      await interaction.reply({ content: 'An error occurred while fetching news. Please try again later.', ephemeral: true });
    }
  },
};
