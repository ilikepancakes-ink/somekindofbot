import { Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits, OverwriteType, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { rule34Data } from '../commands/nsfw/rule34';
import * as path from 'path';
const { getTicketSettings, createTicket } = require(path.join(__dirname, '../database'));
const { nukeGuildXP } = require(path.join(__dirname, '../xpDatabase'));

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
      } else if (interaction.customId === 'create_ticket') {
        await interaction.deferReply({ flags: 64 });

        try {
          const settings = await getTicketSettings(interaction.guild.id);
          if (!settings) {
            return await interaction.editReply({ content: 'Ticket settings not configured.' });
          }

          // Find or create Tickets category
          let category = interaction.guild.channels.cache.find((c: any) => c.name === 'Tickets' && c.type === ChannelType.GuildCategory);
          if (!category) {
            category = await interaction.guild.channels.create({
              name: 'Tickets',
              type: ChannelType.GuildCategory,
            });
          }

          // Generate random 6 digit number
          const ticketNumber = Math.floor(100000 + Math.random() * 900000);
          const channelName = `ticket-${ticketNumber}`;

          // Get access roles
          const accessRoles = settings.access_role_ids ? settings.access_role_ids.split(',') : [];

          // Create permission overwrites
          const permissionOverwrites = [
            {
              id: interaction.guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
              type: OverwriteType.Role,
            },
            {
              id: interaction.user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
              type: OverwriteType.Member,
            },
          ];

          // Add access for staff roles
          for (const roleId of accessRoles) {
            permissionOverwrites.push({
              id: roleId,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
              type: OverwriteType.Role,
            });
          }

          // Create the channel
          const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites,
          });

          // Save to database
          await createTicket({
            guild_id: interaction.guild.id,
            channel_id: ticketChannel.id,
            user_id: interaction.user.id,
            created_at: Date.now(),
          });

          // Send initial message and ping
          let pingMessage = '';
          if (settings.ping_role_id) {
            pingMessage = `<@&${settings.ping_role_id}> `;
          }

          await ticketChannel.send(`${pingMessage}${interaction.user} has opened a ticket! Remember to use \`/ticket close\` to close the ticket.`);

          await interaction.editReply({ content: `Ticket created: ${ticketChannel}` });
        } catch (error) {
          console.error(error);
          await interaction.editReply({ content: 'Failed to create ticket.' });
        }
      } else if (interaction.customId === 'xp_nuke_confirm') {
        // Check admin permissions again
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return await interaction.reply({ content: 'You need Administrator permissions to use this command!', flags: 64 });
        }

        const modal = new ModalBuilder()
          .setCustomId('xp_nuke_modal')
          .setTitle('FINAL CONFIRMATION REQUIRED');

        const confirmInput = new TextInputBuilder()
          .setCustomId('confirm_text')
          .setLabel('Type "CONFIRM" to permanently delete all XP data')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Type CONFIRM here')
          .setRequired(true)
          .setMinLength(7)
          .setMaxLength(7);

        const firstActionRow = new ActionRowBuilder<TextInputBuilder>()
          .addComponents(confirmInput);

        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
      } else {
        // Handle button interactions (for help command pagination)
        // The help command handles its own button interactions
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId === 'xp_nuke_modal') {
        const confirmText = interaction.fields.getTextInputValue('confirm_text');

        if (confirmText.toUpperCase() !== 'CONFIRM') {
          return await interaction.reply({ content: 'Confirmation failed. XP data was NOT deleted.', flags: 64 });
        }

        // Check admin permissions one final time
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return await interaction.reply({ content: 'You need Administrator permissions to use this command!', flags: 64 });
        }

        try {
          await nukeGuildXP(interaction.guild.id);

          const embed = new EmbedBuilder()
            .setTitle('💥 NUKE COMPLETE 💥')
            .setDescription('All XP data for this server has been permanently deleted:\n• All user XP\n• All level roles\n• All XP settings')
            .setColor(0x00FF00)
            .setTimestamp();

          await interaction.reply({ embeds: [embed], flags: 64 });
        } catch (error) {
          console.error('Error nuking XP data:', error);
          await interaction.reply({ content: 'Failed to delete XP data. Please try again.', flags: 64 });
        }
      }
    }
  },
};
