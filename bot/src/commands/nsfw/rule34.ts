import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rule34')
    .setDescription('Rule 34 commands (NSFW only)')
    .addSubcommand(sub =>
      sub
        .setName('browse')
        .setDescription('Browse Rule 34 posts by tags')
        .addStringOption(option =>
          option.setName('tags').setDescription('Tags to search for').setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('page').setDescription('Page number (default: 0)').setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('limit').setDescription('Number of posts (max: 100)').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('random')
        .setDescription('Get a random Rule 34 post')
        .addStringOption(option =>
          option.setName('tags').setDescription('Tags to search for (optional)').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('top100')
        .setDescription('Get top 100 Rule 34 posts')
        .addStringOption(option =>
          option.setName('tags').setDescription('Tags to search for (optional)').setRequired(false)
        )
    ),

  async execute(interaction: any) {
    // Check if channel is NSFW
    if (!interaction.channel?.nsfw) {
      return await interaction.reply({
        content: 'This command can only be used in NSFW channels!',
        flags: 64
      });
    }

    // Check for required environment variables
    const userId = process.env.RULE34_USER_ID;
    const apiKey = process.env.RULE34_API_KEY;

    if (!userId || !apiKey) {
      return await interaction.reply({
        content: 'Rule 34 API authentication not configured. Please set RULE34_USER_ID and RULE34_API_KEY in your environment variables.',
        flags: 64
      });
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      let url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&user_id=${userId}&api_key=${apiKey}`;

      if (subcommand === 'browse') {
        const tags = interaction.options.getString('tags');
        const page = interaction.options.getInteger('page') || 0;
        const limit = Math.min(interaction.options.getInteger('limit') || 10, 100);

        url += `&tags=${encodeURIComponent(tags)}&pid=${page}&limit=${limit}`;
      } else if (subcommand === 'random') {
        const tags = interaction.options.getString('tags') || '';
        // For random, get a high limit and pick one randomly, or use a random pid
        const randomPid = Math.floor(Math.random() * 1000);
        url += `&tags=${encodeURIComponent(tags)}&pid=${randomPid}&limit=1`;
      } else if (subcommand === 'top100') {
        const tags = interaction.options.getString('tags') || '';
        url += `&tags=${encodeURIComponent(tags)}&limit=100`;
      }

      const response = await axios.get(url);

      if (response.data?.length === 0) {
        return await interaction.reply({
          content: 'No posts found for the given tags.',
          flags: 64
        });
      }

      const posts = Array.isArray(response.data) ? response.data : [];

      if (posts.length === 0) {
        return await interaction.reply({
          content: 'No posts found.',
          flags: 64
        });
      }

      if (subcommand === 'random') {
        const post = posts[0];
        const embed = new EmbedBuilder()
          .setTitle(`Rule 34 - Random Post`)
          .setDescription(`Tags: ${post.tags || 'N/A'}`)
          .setImage(post.file_url)
          .setFooter({ text: `Post ID: ${post.id}` });

        await interaction.reply({ embeds: [embed] });
      } else if (subcommand === 'browse') {
        const embeds = posts.slice(0, 10).map((post: any) => {
          return new EmbedBuilder()
            .setTitle(`Post ${post.id}`)
            .setDescription(`Tags: ${post.tags?.substring(0, 100) || 'N/A'}`)
            .setImage(post.file_url)
            .setURL(`https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`);
        });

        await interaction.reply({ embeds });
      } else if (subcommand === 'top100') {
        // For top100, just send the first 10 as embeds, and mention there are more
        const embeds = posts.slice(0, 10).map((post: any, index: number) => {
          return new EmbedBuilder()
            .setTitle(`Top ${index + 1} - Post ${post.id}`)
            .setDescription(`Tags: ${post.tags?.substring(0, 100) || 'N/A'}`)
            .setImage(post.file_url)
            .setURL(`https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`);
        });

        await interaction.reply({
          content: `Showing first 10 of ${posts.length} posts. Visit https://rule34.xxx for more.`,
          embeds
        });
      }

    } catch (error: any) {
      console.error('Rule34 API Error:', error.response?.data || error.message);
      await interaction.reply({
        content: 'Failed to fetch data from Rule 34 API. Try again later!',
        flags: 64
      });
    }
  },
};
