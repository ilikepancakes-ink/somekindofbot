import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChannelType, OverwriteType, InteractionContextType } from 'discord.js';
import * as path from 'path';
const { getTicketSettings, setTicketSettings, createTicket, getTicketByChannel, deleteTicket } = require(path.join(__dirname, '../../database'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage tickets')
    .addSubcommandGroup(group =>
      group
        .setName('embed')
        .setDescription('Manage ticket embeds')
        .addSubcommand(subcommand =>
          subcommand
            .setName('create')
            .setDescription('Create a ticket embed')
            .addChannelOption(option =>
              option.setName('channel')
                .setDescription('The channel to send the embed to')
                .setRequired(true))
            .addStringOption(option =>
              option.setName('title')
                .setDescription('The title of the embed')
                .setRequired(true))
            .addStringOption(option =>
              option.setName('subtitle')
                .setDescription('The subtitle of the embed')
                .setRequired(true))
            .addStringOption(option =>
              option.setName('button_text')
                .setDescription('The text on the button')
                .setRequired(true))))
    .addSubcommandGroup(group =>
      group
        .setName('settings')
        .setDescription('Configure ticket settings')
        .addSubcommand(subcommand =>
          subcommand
            .setName('create')
            .setDescription('Set the role to ping when tickets are created')
            .addRoleOption(option =>
              option.setName('role')
                .setDescription('The role to ping')
                .setRequired(true)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('access')
            .setDescription('Set the roles that can access tickets')
            .addRoleOption(option =>
              option.setName('role')
                .setDescription('The role to add access to')
                .setRequired(true))))
    .addSubcommand(subcommand =>
      subcommand
        .setName('close')
        .setDescription('Close the current ticket'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts([InteractionContextType.Guild]),

  async execute(interaction: any) {
    if (!interaction.guild) {
      return await interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
    }

    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (group === 'embed' && subcommand === 'create') {
      const channel = interaction.options.getChannel('channel');
      const title = interaction.options.getString('title');
      const subtitle = interaction.options.getString('subtitle');
      const buttonText = interaction.options.getString('button_text');

      try {
        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(subtitle)
          .setColor(0x00FF00);

        const button = new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel(buttonText)
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(button);

        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: 'Ticket embed created successfully!', flags: 64 });
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Failed to create ticket embed.', flags: 64 });
      }
    } else if (group === 'settings' && subcommand === 'create') {
      const role = interaction.options.getRole('role');

      try {
        const settings = await getTicketSettings(interaction.guild.id) || { guild_id: interaction.guild.id };
        settings.ping_role_id = role.id;
        await setTicketSettings(settings);
        await interaction.reply(`Ping role set to ${role.name}!`);
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Failed to set ping role.', flags: 64 });
      }
    } else if (group === 'settings' && subcommand === 'access') {
      const role = interaction.options.getRole('role');

      try {
        const settings = await getTicketSettings(interaction.guild.id) || { guild_id: interaction.guild.id };
        const accessRoles = settings.access_role_ids ? settings.access_role_ids.split(',') : [];
        if (!accessRoles.includes(role.id)) {
          accessRoles.push(role.id);
          settings.access_role_ids = accessRoles.join(',');
          await setTicketSettings(settings);
          await interaction.reply(`Access granted to ${role.name}!`);
        } else {
          await interaction.reply(`${role.name} already has access!`);
        }
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Failed to grant access.', flags: 64 });
      }
    } else if (subcommand === 'close') {
      const ticket = await getTicketByChannel(interaction.channel.id);
      if (!ticket) {
        return await interaction.reply({ content: 'This is not a ticket channel.', flags: 64 });
      }

      try {
        // Remove permissions for everyone except staff
        const settings = await getTicketSettings(interaction.guild.id);
        const accessRoles = settings?.access_role_ids ? settings.access_role_ids.split(',') : [];

        const permissionOverwrites: any[] = [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            type: OverwriteType.Role,
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

        await interaction.channel.edit({
          permissionOverwrites,
        });

        await deleteTicket(interaction.channel.id);
        await interaction.reply('Ticket closed!');
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Failed to close ticket.', flags: 64 });
      }
    }
  },
};
