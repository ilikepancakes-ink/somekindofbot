import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import * as path from 'path';

const messageDelete = require(path.join(__dirname, '../../events/messageDelete'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Shows the last deleted message in this channel'),

  async execute(interaction: any) {
    const deletedMessage = messageDelete.deletedMessages.get(interaction.channel.id);

    if (!deletedMessage) {
      return await interaction.reply({ content: 'No deleted message found in this channel.', flags: 64 });
    }

    const embed = new EmbedBuilder()
      .setTitle('Sniped Message')
      .setDescription(deletedMessage.content || 'No content')
      .setAuthor({ name: deletedMessage.author.username, iconURL: deletedMessage.author.displayAvatarURL() })
      .setTimestamp(deletedMessage.timestamp)
      .setColor(0xFFA500);

    await interaction.reply({ embeds: [embed] });
  },
};
