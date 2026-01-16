import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import * as path from 'path';
const { getXPSettings, setXPSettings, getTopXPUsers, setXPLevel, getAllXPLevels, getXPUser, addXP, removeXP, clearUserXP, nukeGuildXP } = require(path.join(__dirname, '../../xpDatabase'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Manage XP system')
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable XP tracking for this server'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable XP tracking for this server'))
    .addSubcommandGroup(group =>
      group
        .setName('level')
        .setDescription('Manage level roles')
        .addSubcommand(subcommand =>
          subcommand
            .setName('set')
            .setDescription('Set a role to be given at a specific level')
            .addIntegerOption(option =>
              option.setName('level')
                .setDescription('The level number')
                .setRequired(true)
                .setMinValue(1))
            .addRoleOption(option =>
              option.setName('role')
                .setDescription('The role to give at this level')
                .setRequired(true))))
    .addSubcommandGroup(group =>
      group
        .setName('edit')
        .setDescription('Edit user XP values')
        .addSubcommand(subcommand =>
          subcommand
            .setName('modify')
            .setDescription('Add or remove XP from a user')
            .addUserOption(option =>
              option.setName('user')
                .setDescription('The user to modify XP for')
                .setRequired(true))
            .addStringOption(option =>
              option.setName('operation')
                .setDescription('Add or remove XP')
                .setRequired(true)
                .addChoices(
                  { name: 'Add', value: 'add' },
                  { name: 'Remove', value: 'remove' }
                ))
            .addIntegerOption(option =>
              option.setName('amount')
                .setDescription('Amount of XP to add/remove')
                .setRequired(true)
                .setMinValue(1)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('clear')
            .setDescription('Clear all XP from a user')
            .addUserOption(option =>
              option.setName('user')
                .setDescription('The user to clear XP for')
                .setRequired(true)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('nuke')
            .setDescription('NUKE ALL XP DATA FOR THIS GUILD (ADMIN ONLY)')))
    .addSubcommand(subcommand =>
      subcommand
        .setName('leaderboard')
        .setDescription('Show the XP leaderboard'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('progress')
        .setDescription('Show XP progress for a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to check progress for (defaults to yourself)')
            .setRequired(false)))
    .setContexts([InteractionContextType.Guild]),

  async execute(interaction: any) {
    if (!interaction.guild) {
      return await interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
    }

    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'enable') {
        const settings = await getXPSettings(interaction.guild.id) || { guild_id: interaction.guild.id, enabled: 0 };
        settings.enabled = 1;
        await setXPSettings(settings);
        await interaction.reply('XP tracking has been enabled for this server!');
      } else if (subcommand === 'disable') {
        const settings = await getXPSettings(interaction.guild.id) || { guild_id: interaction.guild.id, enabled: 0 };
        settings.enabled = 0;
        await setXPSettings(settings);
        await interaction.reply('XP tracking has been disabled for this server!');
      } else if (subcommandGroup === 'level' && subcommand === 'set') {
        const level = interaction.options.getInteger('level');
        const role = interaction.options.getRole('role');

        await setXPLevel({
          guild_id: interaction.guild.id,
          level: level,
          role_id: role.id
        });

        await interaction.reply(`Level ${level} will now give the ${role.name} role!`);
      } else if (subcommand === 'leaderboard') {
        const topUsers = await getTopXPUsers(interaction.guild.id, 10);

        if (topUsers.length === 0) {
          return await interaction.reply('No users have earned XP yet!');
        }

        const embed = new EmbedBuilder()
          .setTitle('XP Leaderboard')
          .setColor(0x0099FF)
          .setTimestamp();

        let description = '';
        for (let i = 0; i < topUsers.length; i++) {
          const user = topUsers[i];
          const level = Math.floor(user.xp / 100);
          try {
            const member = await interaction.guild.members.fetch(user.user_id);
            description += `${i + 1}. ${member.user.username} - ${user.xp} XP (Level ${level})\n`;
          } catch (error) {
            // User might have left the server
            description += `${i + 1}. Unknown User - ${user.xp} XP (Level ${level})\n`;
          }
        }

        embed.setDescription(description);

        await interaction.reply({ embeds: [embed] });
      } else if (subcommand === 'progress') {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userXP = await getXPUser(interaction.guild.id, targetUser.id);

        const currentXP = userXP ? userXP.xp : 0;
        const currentLevel = Math.floor(currentXP / 100);
        const nextLevel = currentLevel + 1;
        const xpNeededForNext = nextLevel * 100;

        // Create progress bar (20 characters wide)
        const progressPercent = currentXP / xpNeededForNext;
        const filledBlocks = Math.floor(progressPercent * 20);
        const emptyBlocks = 20 - filledBlocks;
        const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

        const embed = new EmbedBuilder()
          .setTitle(`${targetUser.username}'s XP Progress`)
          .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 128 }))
          .setColor(0x00FF00)
          .setDescription(`**${progressBar}**\n\nXP: ${currentXP}/${xpNeededForNext} - Level ${currentLevel} Next Level ${nextLevel}`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else if (subcommandGroup === 'edit' && subcommand === 'modify') {
        const targetUser = interaction.options.getUser('user');
        const operation = interaction.options.getString('operation');
        const amount = interaction.options.getInteger('amount');

        if (operation === 'add') {
          await addXP(interaction.guild.id, targetUser.id, amount);
          await interaction.reply(`Added ${amount} XP to ${targetUser.username}!`);
        } else if (operation === 'remove') {
          await removeXP(interaction.guild.id, targetUser.id, amount);
          await interaction.reply(`Removed ${amount} XP from ${targetUser.username}!`);
        }
      } else if (subcommandGroup === 'edit' && subcommand === 'clear') {
        const targetUser = interaction.options.getUser('user');

        await clearUserXP(interaction.guild.id, targetUser.id);
        await interaction.reply(`Cleared all XP from ${targetUser.username}!`);
      } else if (subcommandGroup === 'edit' && subcommand === 'nuke') {
        // Check if user has admin permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return await interaction.reply({ content: 'You need Administrator permissions to use this command!', flags: 64 });
        }

        const embed = new EmbedBuilder()
          .setTitle('⚠️ DANGER ZONE ⚠️')
          .setDescription('**WARNING:** This will permanently delete ALL XP data for this server, including:\n• All user XP\n• All level roles\n• All XP settings\n\nThis action cannot be undone!')
          .setColor(0xFF0000)
          .setFooter({ text: 'Click the button below to proceed with confirmation' });

        const button = new ButtonBuilder()
          .setCustomId('xp_nuke_confirm')
          .setLabel('I Understand - Proceed')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(button);

        await interaction.reply({
          embeds: [embed],
          components: [row],
          flags: 64 // Ephemeral
        });
      }
    } catch (error) {
      console.error('XP command error:', error);
      await interaction.reply({ content: 'An error occurred while executing this command.', flags: 64 });
    }
  },
};
