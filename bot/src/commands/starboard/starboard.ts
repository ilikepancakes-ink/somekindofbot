import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';
import { getStarboardSettings, setStarboardSettings } from '../../database';

interface StarboardSettings {
  guild_id: string;
  channel_id?: string;
  required_stars?: number;
}

interface StarboardMessage {
  id?: number;
  guild_id: string;
  original_message_id: string;
  starboard_message_id?: string;
  star_count: number;
  last_updated: number;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('starboard')
    .setDescription('Configure and manage the starboard system')
    .addSubcommand((subcommand: any) =>
      subcommand
        .setName('settings')
        .setDescription('Configure starboard settings')
        .addChannelOption((option: any) =>
          option.setName('channel')
            .setDescription('The channel to send starboard messages to')
            .setRequired(false)
        )
        .addIntegerOption((option: any) =>
          option.setName('count')
            .setDescription('The number of stars required to post to starboard')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(50)
        )
    )
    .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM]),

  async execute(interaction: any) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'settings') {
      const channel = interaction.options.getChannel('channel');
      const count = interaction.options.getInteger('count');
      
      // Check if user has permission to manage channels
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return await interaction.reply({ 
          content: 'You need the Manage Channels permission to configure starboard settings.', 
          ephemeral: true 
        });
      }

      try {
        const settings: StarboardSettings = {
          guild_id: interaction.guild.id
        };

        if (channel) {
          settings.channel_id = channel.id;
        }

        if (count) {
          settings.required_stars = count;
        }

        await setStarboardSettings(settings);

        const embed = new EmbedBuilder()
          .setTitle('Starboard Settings Updated')
          .setColor(0x0099ff)
          .setFooter({
            text: `Configured by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
          });

        if (channel && count) {
          embed.setDescription(`Starboard channel set to ${channel} and required stars set to ${count}`);
        } else if (channel) {
          embed.setDescription(`Starboard channel has been set to ${channel}`);
        } else if (count) {
          embed.setDescription(`Required stars for starboard has been set to ${count}`);
        }

        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        console.error('Error setting starboard settings:', error);
        await interaction.reply({ 
          content: 'An error occurred while setting the starboard settings.', 
          ephemeral: true 
        });
      }
    }
  },
};
