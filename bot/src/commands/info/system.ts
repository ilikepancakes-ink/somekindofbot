import { SlashCommandBuilder, EmbedBuilder, InteractionContextType } from 'discord.js';
import * as os from 'os';
import * as si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('system')
    .setDescription('System related commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Shows detailed system and bot information'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('temps')
        .setDescription('Shows system temperature information'))
    .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM]),

  async execute(interaction: any) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'info') {
      await interaction.deferReply();

      try {
        const embed = await getSystemInfoEmbed(interaction);
        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error getting system info:', error);
        await interaction.editReply({ content: 'Failed to retrieve system information.' });
      }
    } else if (subcommand === 'temps') {
      await interaction.deferReply();

      try {
        const output = await getSensorsOutput();
        if (output.length > 1900) {
          // Create a temporary file and send as attachment
          const fs = require('fs');
          const path = require('path');
          const tempFile = path.join(__dirname, '../../../temp_temps.txt');
          fs.writeFileSync(tempFile, output);
          await interaction.editReply({
            content: 'Output was too long; see attached file:',
            files: [{ attachment: tempFile, name: 'temps.txt' }]
          });
          fs.unlinkSync(tempFile);
        } else {
          await interaction.editReply({ content: `\`\`\`\n${output}\n\`\`\`` });
        }
      } catch (error) {
        console.error('Error getting temps:', error);
        await interaction.editReply({ content: 'Failed to retrieve temperature information. Make sure the `sensors` command is available.' });
      }
    }
  },
};

async function getSystemInfoEmbed(interaction: any) {
  const bot = interaction.client;
  const botUser = bot.user;

  // Bot stats
  const guildCount = bot.guilds.cache.size;
  const userIds = new Set<string>();
  for (const guild of bot.guilds.cache.values()) {
    for (const member of guild.members.cache.values()) {
      if (!member.user.bot) {
        userIds.add(member.user.id);
      }
    }
  }
  const userCount = userIds.size;

  // System info
  const system = os.platform();
  const release = os.release();
  const hostname = os.hostname();

  let osInfo = `${system} ${release}`;
  let distroInfo = '';

  if (system === 'linux') {
    try {
      const osData = await si.osInfo();
      distroInfo = `\n**Distro:** ${osData.distro}`;
    } catch (error) {
      distroInfo = '\n**Distro:** (Unable to detect)';
    }
  } else if (system === 'win32') {
    // Windows specific handling if needed
  }

  // Uptime
  const uptimeSeconds = os.uptime();
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  let uptimeStr = '';
  if (days > 0) uptimeStr += `${days}d `;
  uptimeStr += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // CPU info
  const cpuData = await si.cpu();
  const cpuUsage = await si.currentLoad();
  const cpuName = `${cpuData.manufacturer} ${cpuData.brand} (${cpuData.physicalCores}C/${cpuData.cores}T)`;
  const cpuPercent = cpuUsage.currentLoad.toFixed(1);

  // Memory info
  const memData = await si.mem();
  const ramUsage = `${Math.round(memData.used / 1024 / 1024)} MB / ${Math.round(memData.total / 1024 / 1024)} MB (${(memData.used / memData.total * 100).toFixed(1)}%)`;

  // GPU info
  let gpuInfo = 'No GPU information available';
  try {
    const gpuData = await si.graphics();
    if (gpuData.controllers && gpuData.controllers.length > 0) {
      gpuInfo = gpuData.controllers.map(gpu => {
        const vram = gpu.vram ? `${gpu.vram} MB` : 'Unknown VRAM';
        return `${gpu.vendor} ${gpu.model} (${vram})`;
      }).join('\n');
    }
  } catch (error) {
    console.log('Could not get GPU info:', error);
  }

  // Motherboard info
  let motherboardInfo = 'Unknown';
  try {
    const systemData = await si.system();
    motherboardInfo = `${systemData.manufacturer} ${systemData.model}`;
  } catch (error) {
    console.log('Could not get motherboard info:', error);
  }

  // Create embed
  const embed = new EmbedBuilder()
    .setTitle('📊 System Status')
    .setColor(0x0099ff)
    .setTimestamp();

  if (botUser) {
    embed.setThumbnail(botUser.displayAvatarURL());
    embed.addFields({
      name: '🤖 Bot Information',
      value: `**Name:** ${botUser.username}\n` +
      `**ID:** ${botUser.id}\n` +
      `**Servers:** ${guildCount}\n` +
      `**Unique Users:** ${userCount}`,
      inline: false
    });
  }

  embed.addFields({
    name: '🖥️ System Information',
    value: `**OS:** ${osInfo}${distroInfo}\n` +
    `**Hostname:** ${hostname}\n` +
    `**Uptime:** ${uptimeStr}`,
    inline: false
  });

  embed.addFields({
    name: '⚙️ Hardware Information',
    value: `**Device Model:** ${motherboardInfo}\n` +
    `**CPU:** ${cpuName}\n` +
    `**CPU Usage:** ${cpuPercent}%\n` +
    `**RAM Usage:** ${ramUsage}\n` +
    `**GPU Info:**\n${gpuInfo}`,
    inline: false
  });

  embed.setFooter({
    text: `Requested by: ${interaction.user.displayName}`,
    iconURL: interaction.user.displayAvatarURL()
  });

  return embed;
}

async function getSensorsOutput(): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync('sensors');
    return stdout || stderr || 'No output from sensors command.';
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error('The `sensors` command is not available on this system. Please install lm-sensors.');
    }
    throw new Error(`Error executing sensors: ${error.message}`);
  }
}
