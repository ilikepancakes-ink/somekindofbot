import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import axios from 'axios';

export const rule34Data = new Map<string, { posts: any[], currentIndex: number }>();

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
        .addBooleanOption(option =>
          option.setName('ai_content').setDescription('Include AI-generated content (default: false)').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('random')
        .setDescription('Get a random Rule 34 post')
        .addStringOption(option =>
          option.setName('tags').setDescription('Tags to search for (optional)').setRequired(false)
        )
        .addBooleanOption(option =>
          option.setName('ai_content').setDescription('Include AI-generated content (default: false)').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('top100')
        .setDescription('Get top 100 Rule 34 posts')
        .addStringOption(option =>
          option.setName('tags').setDescription('Tags to search for (optional)').setRequired(false)
        )
        .addBooleanOption(option =>
          option.setName('ai_content').setDescription('Include AI-generated content (default: false)').setRequired(false)
        )
    )
    .setDMPermission(true),

  async execute(interaction: any) {
    // Check if channel is NSFW or if it's a DM
    if (interaction.channel && !interaction.channel.nsfw && interaction.channel.type !== 1) { // 1 is DM
      return await interaction.reply({
        content: 'This command can only be used in NSFW channels or DMs!',
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

      const aiContent = interaction.options.getBoolean('ai_content') || false;

      if (subcommand === 'browse') {
        const tags = interaction.options.getString('tags');

        url += `&tags=${encodeURIComponent(tags)}&limit=150`;
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

      // Filter out AI-generated content unless ai_content is true
      const filteredPosts = posts.filter((post: any) => {
        if (aiContent) return true;
        const tags = post.tags ? post.tags.split(' ') : [];
        return !tags.includes('ai_generated');
      });

      if (filteredPosts.length === 0) {
        return await interaction.reply({
          content: 'No posts found (filtered out AI-generated content).',
          flags: 64
        });
      }

      if (subcommand === 'random') {
        const post = filteredPosts[0];
        const tags = post.tags ? post.tags.split(' ').slice(0, 10).join(' ') : 'N/A';
        const embed = new EmbedBuilder()
          .setTitle(`Rule 34 - Random Post`)
          .setDescription(`Tags: ${tags}`)
          .setImage(post.file_url)
          .setFooter({ text: `Post ID: ${post.id}` });

        await interaction.reply({ embeds: [embed] });
      } else if (subcommand === 'browse') {
        const randomIndex = Math.floor(Math.random() * filteredPosts.length);
        rule34Data.set(interaction.id, { posts: filteredPosts, currentIndex: randomIndex });
        const post = filteredPosts[randomIndex];
        const tagsStr = post.tags ? post.tags.split(' ').slice(0, 10).join(' ') : 'N/A';
        const embed = new EmbedBuilder()
          .setTitle(`Rule 34 - Browse (${randomIndex + 1}/${filteredPosts.length})`)
          .setDescription(`Tags: ${tagsStr}`)
          .setImage(post.file_url)
          .setFooter({ text: `Post ID: ${post.id}` });

        const prevButton = new ButtonBuilder()
          .setCustomId(`rule34_prev_${interaction.id}`)
          .setLabel('Prev')
          .setStyle(ButtonStyle.Secondary);

        const nextButton = new ButtonBuilder()
          .setCustomId(`rule34_next_${interaction.id}`)
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary);

        const refreshButton = new ButtonBuilder()
          .setCustomId(`rule34_refresh_${interaction.id}`)
          .setLabel('Refresh')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(prevButton, nextButton, refreshButton);

        await interaction.reply({ embeds: [embed], components: [row] });
      } else if (subcommand === 'top100') {
        // For top100, just send the first 10 as embeds, and mention there are more
        const embeds = filteredPosts.slice(0, 10).map((post: any, index: number) => {
          const tags = post.tags ? post.tags.split(' ').slice(0, 10).join(' ') : 'N/A';
          return new EmbedBuilder()
            .setTitle(`Top ${index + 1} - Post ${post.id}`)
            .setDescription(`Tags: ${tags}`)
            .setImage(post.file_url)
            .setURL(`https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`);
        });

        await interaction.reply({
          content: `Showing first 10 of ${filteredPosts.length} posts. Visit https://rule34.xxx for more.`,
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
