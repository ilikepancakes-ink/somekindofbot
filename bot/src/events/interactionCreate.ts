import { Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits, OverwriteType, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { rule34Data } from '../commands/nsfw/rule34';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();
const { getTicketSettings, createTicket, getRoleEmbedByMessage } = require(path.join(__dirname, '../database'));
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

      // Check if user is bot admin
      const isAdmin = process.env.BOT_ADMIN_USER_ID && interaction.user.id === process.env.BOT_ADMIN_USER_ID;

      try {
        await command.execute(interaction, isAdmin);
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
      // Handle confessions button interactions
      if (interaction.customId === 'confess_button') {
        const { handleButtonInteraction } = require(path.join(__dirname, '../commands/confessions/confessions'));
        await handleButtonInteraction(interaction);
      } else if (interaction.customId === 'reply_to_confession') {
        const { handleButtonInteraction } = require(path.join(__dirname, '../commands/confessions/confessions'));
        await handleButtonInteraction(interaction);
      } else if (interaction.customId.startsWith('rule34_')) {
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
          .setLabel('Type "CONFIRM" to delete ALL XP data')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Type CONFIRM here')
          .setRequired(true)
          .setMinLength(7)
          .setMaxLength(7);

        const firstActionRow = new ActionRowBuilder<TextInputBuilder>()
          .addComponents(confirmInput);

        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('user_permissions_')) {
        const userId = interaction.customId.split('_')[2];

        if (!interaction.guild) {
          return await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        }

        const member = interaction.guild.members.cache.get(userId);
        if (!member) {
          return await interaction.reply({ content: 'Could not find that member in this server.', ephemeral: true });
        }

        const permissions = member.permissions.toArray();
        const sortedPerms = permissions.sort();

        const embed = new EmbedBuilder()
          .setTitle(`Permissions for ${member.displayName}`)
          .setColor(member.displayHexColor)
          .setDescription('✅ = Granted, ❌ = Denied');

        const columns: string[][] = [[], [], []];
        const colCharLimits = [0, 0, 0];
        const maxColChars = 900;

        for (const perm of sortedPerms) {
          const permStr = `${member.permissions.has(perm as any) ? '✅' : '❌'} ${perm.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}\n`;

          let bestCol = -1;
          let minLen = Infinity;
          for (let i = 0; i < 3; i++) {
            if (colCharLimits[i] + permStr.length < maxColChars) {
              if (colCharLimits[i] < minLen) {
                minLen = colCharLimits[i];
                bestCol = i;
              }
            }
          }

          if (bestCol !== -1) {
            columns[bestCol].push(permStr);
            colCharLimits[bestCol] += permStr.length;
          } else {
            const shortestCol = colCharLimits.indexOf(Math.min(...colCharLimits));
            columns[shortestCol].push(permStr);
            colCharLimits[shortestCol] += permStr.length;
          }
        }

        for (let i = 0; i < 3; i++) {
          if (columns[i].length > 0) {
            embed.addFields({ name: `Permissions ${i + 1}`, value: columns[i].join(''), inline: true });
          }
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else if (interaction.customId.startsWith('role_select_')) {
        const roleId = interaction.customId.split('_')[2];

        try {
          // Get the role embed data
          const roleEmbed = await getRoleEmbedByMessage(interaction.message.id);
          if (!roleEmbed) {
            return await interaction.reply({ content: 'This role selection embed is no longer valid.', flags: 64 });
          }

          const allowedRoles = JSON.parse(roleEmbed.roles);
          if (!allowedRoles.includes(roleId)) {
            return await interaction.reply({ content: 'This role is not available for selection.', flags: 64 });
          }

          // Get the role
          const role = interaction.guild.roles.cache.get(roleId);
          if (!role) {
            return await interaction.reply({ content: 'Role not found.', flags: 64 });
          }

          // Get the member
          const member = await interaction.guild.members.fetch(interaction.user.id);

          // Check if user already has the role
          if (member.roles.cache.has(roleId)) {
            // Remove the role
            await member.roles.remove(role);
            await interaction.reply({ content: `Removed the ${role.name} role from you!`, flags: 64 });
          } else {
            // Add the role
            await member.roles.add(role);
            await interaction.reply({ content: `Added the ${role.name} role to you!`, flags: 64 });
          }
        } catch (error) {
          console.error('Error handling role selection:', error);
          await interaction.reply({ content: 'Failed to process role selection.', flags: 64 });
        }
      } else {
        // Handle button interactions (for help command pagination)
        // The help command handles its own button interactions
      }
    } else if (interaction.isModalSubmit()) {
      // Handle confessions modal submissions
      if (interaction.customId === 'confession_modal' || interaction.customId === 'anonymous_reply_modal') {
        const { handleModalSubmit } = require(path.join(__dirname, '../commands/confessions/confessions'));
        await handleModalSubmit(interaction);
      } else if (interaction.customId === 'xp_nuke_modal') {
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
