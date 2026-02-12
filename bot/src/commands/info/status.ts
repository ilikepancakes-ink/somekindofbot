import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';
import axios from 'axios';

const WEBHOOK_SERVER_URL = 'http://localhost:5642';

const getStatusColor = (status: string): number => {
  switch (status) {
    case 'operational':
      return 0x00ff00; // Green
    case 'degraded_performance':
      return 0xffff00; // Yellow
    case 'partial_outage':
      return 0xff8800; // Orange
    case 'major_outage':
      return 0xff0000; // Red
    default:
      return 0x808080; // Gray for unknown
  }
};

const getStatusEmoji = (status: string): string => {
  switch (status) {
    case 'operational':
      return '✅';
    case 'degraded_performance':
      return '⚠️';
    case 'partial_outage':
      return '❌';
    case 'major_outage':
      return '🚨';
    default:
      return '❓';
  }
};

const formatStatus = (status: string): string => {
  switch (status) {
    case 'operational':
      return 'Good Status';
    case 'degraded_performance':
      return 'Degraded Performance';
    case 'partial_outage':
      return 'Partial Outage';
    case 'major_outage':
      return 'Major Outage';
    default:
      return status;
  }
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check the status of various platforms')
    .addStringOption(option =>
      option.setName('platform')
        .setDescription('The platform to check status for (optional)')
        .addChoices(
          { name: 'Discord', value: 'discord' },
          { name: 'GitHub', value: 'github' },
          { name: 'Cloudflare', value: 'cloudflare' },
          { name: 'AWS', value: 'aws' }
        )
        .setRequired(false))
    .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM]),

  async execute(interaction: any) {
    const platformOption = interaction.options.getString('platform');
    
    try {
      let apiUrl = `${WEBHOOK_SERVER_URL}/status/int/pull`;
      if (platformOption) {
        apiUrl += `?platform=${platformOption}`;
      }

      const response = await axios.get(apiUrl);
      const data = response.data;

      if (!data || Object.keys(data).length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('Status Check')
          .setDescription('No status data available at this time.')
          .setColor(0x808080)
          .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
          });

        return await interaction.reply({ embeds: [embed] });
      }

      // Handle single platform status
      if (platformOption && data.platform) {
        const embed = new EmbedBuilder()
          .setTitle(`${getStatusEmoji(data.status)} ${data.platform.toUpperCase()} Status`)
          .setDescription(`**Status:** ${getStatusEmoji(data.status)} ${formatStatus(data.status)}`)
          .setColor(getStatusColor(data.status))
          .addFields(
            { name: 'Platform', value: data.platform.toUpperCase(), inline: true },
            { name: 'Last Updated', value: formatTimestamp(data.timestamp), inline: true }
          );

        if (data.message) {
          embed.addFields({ name: 'Message', value: data.message, inline: false });
        }

        if (data.components && data.components.length > 0) {
          const componentsText = data.components
            .map((comp: any) => `${getStatusEmoji(comp.status)} **${comp.name}**: ${formatStatus(comp.status)}`)
            .join('\n');
          embed.addFields({ name: 'Components', value: componentsText, inline: false });
        }

        embed.setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        });

        return await interaction.reply({ embeds: [embed] });
      }

      // Handle all platforms status
      const platforms = platformOption ? [data] : Object.values(data);
      const embed = new EmbedBuilder()
        .setTitle('Service Status Overview')
        .setColor(0x0099ff)
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        });

      let overallStatus = 'operational';
      let statusFields: { name: string; value: string; inline: boolean }[] = [];

      platforms.forEach((platformData: any) => {
        const platformName = platformData.platform.toUpperCase();
        const statusText = `${getStatusEmoji(platformData.status)} ${formatStatus(platformData.status)}`;
        const lastUpdated = formatTimestamp(platformData.timestamp);
        
        let fieldValue = `**Status:** ${statusText}\n**Last Updated:** ${lastUpdated}`;
        
        if (platformData.message) {
          fieldValue += `\n**Message:** ${platformData.message}`;
        }

        if (platformData.components && platformData.components.length > 0) {
          const componentStatuses = platformData.components.map((comp: any) => 
            `${getStatusEmoji(comp.status)} ${comp.name}: ${formatStatus(comp.status)}`
          ).join('\n');
          fieldValue += `\n**Components:**\n${componentStatuses}`;
        }

        statusFields.push({
          name: platformName,
          value: fieldValue,
          inline: false
        });

        // Determine overall status (worst status takes precedence)
        if (platformData.status === 'major_outage' && overallStatus !== 'major_outage') {
          overallStatus = 'major_outage';
        } else if (platformData.status === 'partial_outage' && overallStatus !== 'major_outage' && overallStatus !== 'partial_outage') {
          overallStatus = 'partial_outage';
        } else if (platformData.status === 'degraded_performance' && overallStatus === 'operational') {
          overallStatus = 'degraded_performance';
        }
      });

      embed.setColor(getStatusColor(overallStatus));
      embed.setDescription(`**Overall Status:** ${getStatusEmoji(overallStatus)} ${formatStatus(overallStatus)}`);
      embed.addFields(...statusFields);

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error fetching status:', error);
      
      const embed = new EmbedBuilder()
        .setTitle('Status Check Error')
        .setDescription('Unable to fetch status information. Please try again later.')
        .setColor(0xff0000)
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        });

      await interaction.reply({ embeds: [embed] });
    }
  },
};