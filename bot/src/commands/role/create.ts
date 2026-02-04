import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import * as path from 'path';
const { createRoleEmbed } = require(path.join(__dirname, '../../database'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Manage roles')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new role')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('The name of the role')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('color')
            .setDescription('The color of the role (hex code, e.g. #FF0000)')
            .setRequired(false))
        .addBooleanOption(option =>
          option.setName('mentionable')
            .setDescription('Whether the role can be mentioned')
            .setRequired(false))
        .addBooleanOption(option =>
          option.setName('hoist')
            .setDescription('Whether the role should be displayed separately')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a role')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The role to delete')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit a role')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The role to edit')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('name')
            .setDescription('New name for the role')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('color')
            .setDescription('New color for the role (hex code, e.g. #FF0000)')
            .setRequired(false))
        .addBooleanOption(option =>
          option.setName('mentionable')
            .setDescription('Whether the role can be mentioned')
            .setRequired(false))
        .addBooleanOption(option =>
          option.setName('hoist')
            .setDescription('Whether the role should be displayed separately')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('assign')
        .setDescription('Assign a role to a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to assign the role to')
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The role to assign')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('revoke')
        .setDescription('Revoke a role from a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to revoke the role from')
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The role to revoke')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Get information about a role')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The role to get info about')
            .setRequired(true)))
    .addSubcommandGroup(group =>
      group
        .setName('embed')
        .setDescription('Manage role selection embeds')
        .addSubcommand(subcommand =>
          subcommand
            .setName('create')
            .setDescription('Create a role selection embed')
            .addStringOption(option =>
              option.setName('title')
                .setDescription('The title of the embed')
                .setRequired(true))
            .addStringOption(option =>
              option.setName('text')
                .setDescription('The description text of the embed')
                .setRequired(true))
            .addRoleOption(option =>
              option.setName('role1')
                .setDescription('First role to select')
                .setRequired(true))
            .addRoleOption(option =>
              option.setName('role2')
                .setDescription('Second role to select (optional)')
                .setRequired(false))
            .addRoleOption(option =>
              option.setName('role3')
                .setDescription('Third role to select (optional)')
                .setRequired(false))
            .addRoleOption(option =>
              option.setName('role4')
                .setDescription('Fourth role to select (optional)')
                .setRequired(false))
            .addRoleOption(option =>
              option.setName('role5')
                .setDescription('Fifth role to select (optional)')
                .setRequired(false))
            .addRoleOption(option =>
              option.setName('role6')
                .setDescription('Sixth role to select (optional)')
                .setRequired(false))
            .addRoleOption(option =>
              option.setName('role7')
                .setDescription('Seventh role to select (optional)')
                .setRequired(false))
            .addRoleOption(option =>
              option.setName('role8')
                .setDescription('Eighth role to select (optional)')
                .setRequired(false))
            .addRoleOption(option =>
              option.setName('role9')
                .setDescription('Ninth role to select (optional)')
                .setRequired(false))
            .addRoleOption(option =>
              option.setName('role10')
                .setDescription('Tenth role to select (optional)')
                .setRequired(false))))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(true),

  async execute(interaction: any) {
    if (!interaction.guild) {
      return await interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
    }
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'create') {
      const name = interaction.options.getString('name');
      const color = interaction.options.getString('color');
      const mentionable = interaction.options.getBoolean('mentionable') ?? false;
      const hoist = interaction.options.getBoolean('hoist') ?? false;

      try {
        const roleData: any = {
          name,
          mentionable,
          hoist,
        };

        if (color) {
          if (!/^#[0-9A-F]{6}$/i.test(color)) {
            await interaction.reply({ content: 'Invalid color format. Please use hex format like #FF0000.', flags: 64 });
            return;
          }
          roleData.color = parseInt(color.slice(1), 16);
        }

        const role = await interaction.guild.roles.create(roleData);
        await interaction.reply(`Role "${role.name}" has been created successfully!`);
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Failed to create the role.', flags: 64 });
      }
    } else if (subcommand === 'delete') {
      const role = interaction.options.getRole('role');

      try {
        await role.delete();
        await interaction.reply(`Role "${role.name}" has been deleted successfully!`);
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Failed to delete the role.', flags: 64 });
      }
    } else if (subcommand === 'edit') {
      const role = interaction.options.getRole('role');
      const name = interaction.options.getString('name');
      const color = interaction.options.getString('color');
      const mentionable = interaction.options.getBoolean('mentionable');
      const hoist = interaction.options.getBoolean('hoist');

      try {
        const updateData: any = {};

        if (name !== null) updateData.name = name;
        if (color !== null) {
          if (!/^#[0-9A-F]{6}$/i.test(color)) {
            await interaction.reply({ content: 'Invalid color format. Please use hex format like #FF0000.', flags: 64 });
            return;
          }
          updateData.color = parseInt(color.slice(1), 16);
        }
        if (mentionable !== null) updateData.mentionable = mentionable;
        if (hoist !== null) updateData.hoist = hoist;

        await role.edit(updateData);
        await interaction.reply(`Role "${role.name}" has been updated successfully!`);
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Failed to edit the role.', flags: 64 });
      }
    } else if (subcommand === 'assign') {
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');
      const member = await interaction.guild.members.fetch(user.id);

      try {
        await member.roles.add(role);
        await interaction.reply(`Role "${role.name}" has been assigned to ${user.username} successfully!`);
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Failed to assign the role.', flags: 64 });
      }
    } else if (subcommand === 'revoke') {
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');
      const member = await interaction.guild.members.fetch(user.id);

      try {
        await member.roles.remove(role);
        await interaction.reply(`Role "${role.name}" has been revoked from ${user.username} successfully!`);
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Failed to revoke the role.', flags: 64 });
      }
    } else if (subcommand === 'info') {
      const role = interaction.options.getRole('role');

      const embed = {
        title: `Role Information: ${role.name}`,
        color: role.color,
        fields: [
          { name: 'ID', value: role.id, inline: true },
          { name: 'Color', value: role.hexColor, inline: true },
          { name: 'Position', value: role.position.toString(), inline: true },
          { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
          { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
          { name: 'Managed', value: role.managed ? 'Yes' : 'No', inline: true },
          { name: 'Members', value: role.members.size.toString(), inline: true },
          { name: 'Created', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:F>`, inline: false },
        ],
        timestamp: new Date(),
      };

      await interaction.reply({ embeds: [embed] });
    } else if (subcommandGroup === 'embed' && subcommand === 'create') {
      const title = interaction.options.getString('title');
      const text = interaction.options.getString('text');

      // Collect all provided roles
      const roles = [];
      for (let i = 1; i <= 10; i++) {
        const role = interaction.options.getRole(`role${i}`);
        if (role) roles.push(role);
      }

      if (roles.length === 0) {
        return await interaction.reply({ content: 'At least one role must be provided.', flags: 64 });
      }

      try {
        // Create the embed
        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(text)
          .setColor(0x0099FF)
          .setTimestamp();

        // Create buttons for each role
        const components = [];
        let currentRow = new ActionRowBuilder<ButtonBuilder>();

        for (let i = 0; i < roles.length; i++) {
          const role = roles[i];
          const button = new ButtonBuilder()
            .setCustomId(`role_select_${role.id}`)
            .setLabel(role.name)
            .setStyle(ButtonStyle.Primary);

          currentRow.addComponents(button);

          // Discord allows max 5 buttons per row
          if (currentRow.components.length === 5 || i === roles.length - 1) {
            components.push(currentRow);
            currentRow = new ActionRowBuilder<ButtonBuilder>();
          }
        }

        // Send the message
        const message = await interaction.reply({
          embeds: [embed],
          components: components,
          fetchReply: true
        });

        // Save to database
        await createRoleEmbed({
          guild_id: interaction.guild.id,
          channel_id: interaction.channel.id,
          message_id: message.id,
          title: title,
          description: text,
          roles: JSON.stringify(roles.map(r => r.id))
        });

      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Failed to create the role selection embed.', flags: 64 });
      }
    }
  },
};
