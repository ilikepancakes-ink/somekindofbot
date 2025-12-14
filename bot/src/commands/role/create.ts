import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Manage server roles')
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction: any) {
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
    }
  },
};
