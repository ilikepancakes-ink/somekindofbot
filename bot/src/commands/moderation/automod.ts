import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import { AutoModerationManager, AutoModerationRule } from '../../cogs/utils/autoModeration';

export const data = new SlashCommandBuilder()
  .setName('automod')
  .setDescription('Manage auto moderation rules for this server')
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all auto moderation rules'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Create a new auto moderation rule')
      .addStringOption(option =>
        option.setName('name')
          .setDescription('The name of the rule')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('type')
          .setDescription('The type of rule to create')
          .setRequired(true)
          .addChoices(
            { name: 'Keyword Filter', value: 'keyword' },
            { name: 'Spam Detection', value: 'spam' },
            { name: 'Mention Spam', value: 'mention' }
          ))
      .addStringOption(option =>
        option.setName('keywords')
          .setDescription('Keywords to filter (comma-separated for keyword rules)'))
      .addIntegerOption(option =>
        option.setName('mention-limit')
          .setDescription('Maximum number of mentions (for mention spam rules)')))
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Delete an auto moderation rule')
      .addStringOption(option =>
        option.setName('rule-id')
          .setDescription('The ID of the rule to delete')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('enable')
      .setDescription('Enable an auto moderation rule')
      .addStringOption(option =>
        option.setName('rule-id')
          .setDescription('The ID of the rule to enable')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('disable')
      .setDescription('Disable an auto moderation rule')
      .addStringOption(option =>
        option.setName('rule-id')
          .setDescription('The ID of the rule to disable')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View details of a specific auto moderation rule')
      .addStringOption(option =>
        option.setName('rule-id')
          .setDescription('The ID of the rule to view')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('keywords')
      .setDescription('Update keywords for a keyword filter rule')
      .addStringOption(option =>
        option.setName('rule-id')
          .setDescription('The ID of the rule to update')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('keywords')
          .setDescription('New keywords to filter (comma-separated)')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('exempt')
      .setDescription('Manage exemptions for a rule')
      .addStringOption(option =>
        option.setName('rule-id')
          .setDescription('The ID of the rule to modify')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('type')
          .setDescription('Type of exemption to manage')
          .setRequired(true)
          .addChoices(
            { name: 'Add Role Exemption', value: 'add_role' },
            { name: 'Remove Role Exemption', value: 'remove_role' },
            { name: 'Add Channel Exemption', value: 'add_channel' },
            { name: 'Remove Channel Exemption', value: 'remove_channel' }
          ))
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('The role to exempt/unexempt'))
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('The channel to exempt/unexempt')))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: any) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const automodManager = new AutoModerationManager();
  
  try {
    await automodManager.init();

    switch (subcommand) {
      case 'list':
        await handleList(interaction, automodManager, guildId);
        break;
      case 'create':
        await handleCreate(interaction, automodManager, guildId);
        break;
      case 'delete':
        await handleDelete(interaction, automodManager, guildId);
        break;
      case 'enable':
        await handleEnable(interaction, automodManager, guildId);
        break;
      case 'disable':
        await handleDisable(interaction, automodManager, guildId);
        break;
      case 'view':
        await handleView(interaction, automodManager, guildId);
        break;
      case 'keywords':
        await handleKeywords(interaction, automodManager, guildId);
        break;
      case 'exempt':
        await handleExempt(interaction, automodManager, guildId);
        break;
    }
  } catch (error) {
    console.error('Error executing automod command:', error);
    await interaction.reply({
      content: 'An error occurred while processing your request. Please try again later.',
      ephemeral: true
    });
  }
}

async function handleList(interaction: any, automodManager: AutoModerationManager, guildId: string) {
  try {
    const rules = await automodManager.listRules(guildId);
    
    if (rules.length === 0) {
      await interaction.reply({
        content: 'No auto moderation rules found for this server.',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Auto Moderation Rules')
      .setDescription(`Found ${rules.length} rule(s)`)
      .setColor('#0099ff')
      .setTimestamp();

    rules.forEach(rule => {
      const status = rule.enabled ? '✅ Enabled' : '❌ Disabled';
      const triggerType = AutoModerationManager.getTriggerTypeString(rule.trigger_type);
      const eventType = AutoModerationManager.getEventTypeString(rule.event_type);
      
      embed.addFields({
        name: `${status} - ${rule.name}`,
        value: `**Type:** ${triggerType}\n**Event:** ${eventType}\n**ID:** ${rule.id}\n**Actions:** ${rule.actions.length}`,
        inline: false
      });
    });

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error listing rules:', error);
    await interaction.reply({
      content: 'Failed to fetch auto moderation rules.',
      ephemeral: true
    });
  }
}

async function handleCreate(interaction: any, automodManager: AutoModerationManager, guildId: string) {
  const name = interaction.options.getString('name');
  const type = interaction.options.getString('type');
  const keywords = interaction.options.getString('keywords');
  const mentionLimit = interaction.options.getInteger('mention-limit');

  try {
    let actions: Array<{ type: number; metadata?: any }> = [];
    let successMessage = '';

    if (type === 'keyword') {
      if (!keywords) {
        await interaction.reply({
          content: 'Please provide keywords for the keyword filter rule.',
          ephemeral: true
        });
        return;
      }

      const keywordList = keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
      
      actions = [
        {
          type: 1, // BLOCK_MESSAGE
          metadata: {
            custom_message: 'Your message was blocked due to content filtering.'
          }
        },
        {
          type: 2, // SEND_ALERT_MESSAGE
          metadata: {
            channel_id: interaction.channel.id
          }
        }
      ];

      const rule = await automodManager.createKeywordRule(
        guildId,
        name,
        keywordList,
        actions
      );

      successMessage = `Keyword filter rule "${name}" created successfully!`;
    } else if (type === 'spam') {
      actions = [
        {
          type: 1, // BLOCK_MESSAGE
          metadata: {
            custom_message: 'Your message was blocked due to spam detection.'
          }
        }
      ];

      const rule = await automodManager.createSpamRule(
        guildId,
        name,
        actions
      );

      successMessage = `Spam detection rule "${name}" created successfully!`;
    } else if (type === 'mention') {
      if (!mentionLimit || mentionLimit <= 0) {
        await interaction.reply({
          content: 'Please provide a valid mention limit (greater than 0).',
          ephemeral: true
        });
        return;
      }

      actions = [
        {
          type: 1, // BLOCK_MESSAGE
          metadata: {
            custom_message: 'Your message was blocked due to too many mentions.'
          }
        }
      ];

      const rule = await automodManager.createMentionSpamRule(
        guildId,
        name,
        mentionLimit,
        actions
      );

      successMessage = `Mention spam rule "${name}" created successfully!`;
    }

    await interaction.reply({
      content: successMessage,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error creating rule:', error);
    await interaction.reply({
      content: 'Failed to create auto moderation rule.',
      ephemeral: true
    });
  }
}

async function handleDelete(interaction: any, automodManager: AutoModerationManager, guildId: string) {
  const ruleId = interaction.options.getString('rule-id');

  try {
    await automodManager.deleteRule(guildId, ruleId);
    
    await interaction.reply({
      content: `Auto moderation rule ${ruleId} deleted successfully.`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error deleting rule:', error);
    await interaction.reply({
      content: 'Failed to delete auto moderation rule. Make sure the ID is correct.',
      ephemeral: true
    });
  }
}

async function handleEnable(interaction: any, automodManager: AutoModerationManager, guildId: string) {
  const ruleId = interaction.options.getString('rule-id');

  try {
    const rule = await automodManager.enableRule(guildId, ruleId);
    
    await interaction.reply({
      content: `Auto moderation rule "${rule.name}" enabled successfully.`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error enabling rule:', error);
    await interaction.reply({
      content: 'Failed to enable auto moderation rule. Make sure the ID is correct.',
      ephemeral: true
    });
  }
}

async function handleDisable(interaction: any, automodManager: AutoModerationManager, guildId: string) {
  const ruleId = interaction.options.getString('rule-id');

  try {
    const rule = await automodManager.disableRule(guildId, ruleId);
    
    await interaction.reply({
      content: `Auto moderation rule "${rule.name}" disabled successfully.`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error disabling rule:', error);
    await interaction.reply({
      content: 'Failed to disable auto moderation rule. Make sure the ID is correct.',
      ephemeral: true
    });
  }
}

async function handleView(interaction: any, automodManager: AutoModerationManager, guildId: string) {
  const ruleId = interaction.options.getString('rule-id');

  try {
    const rule = await automodManager.getRule(guildId, ruleId);
    
    const embed = new EmbedBuilder()
      .setTitle(`Auto Moderation Rule: ${rule.name}`)
      .setColor(rule.enabled ? '#00ff00' : '#ff0000')
      .addFields(
        { name: 'Status', value: rule.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
        { name: 'Trigger Type', value: AutoModerationManager.getTriggerTypeString(rule.trigger_type), inline: true },
        { name: 'Event Type', value: AutoModerationManager.getEventTypeString(rule.event_type), inline: true },
        { name: 'Creator', value: `<@${rule.creator_id}>`, inline: true },
        { name: 'Rule ID', value: rule.id, inline: true }
      );

    // Add trigger metadata
    if (rule.trigger_metadata.keyword_filter) {
      embed.addFields({
        name: 'Keywords',
        value: rule.trigger_metadata.keyword_filter.join(', ') || 'None',
        inline: false
      });
    }

    if (rule.trigger_metadata.mention_total_limit) {
      embed.addFields({
        name: 'Mention Limit',
        value: rule.trigger_metadata.mention_total_limit.toString(),
        inline: false
      });
    }

    // Add actions
    const actionsText = rule.actions.map(action => {
      const type = AutoModerationManager.getActionTypeString(action.type);
      let details = type;
      
      if (action.metadata) {
        if (action.metadata.channel_id) {
          details += ` (Channel: <#${action.metadata.channel_id}>)`;
        }
        if (action.metadata.duration_seconds) {
          details += ` (${action.metadata.duration_seconds}s timeout)`;
        }
        if (action.metadata.custom_message) {
          details += ` (Message: "${action.metadata.custom_message}")`;
        }
      }
      
      return `• ${details}`;
    }).join('\n');

    embed.addFields({
      name: 'Actions',
      value: actionsText || 'None',
      inline: false
    });

    // Add exemptions
    const exemptRoles = rule.exempt_roles.length > 0 
      ? rule.exempt_roles.map(id => `<@&${id}>`).join(', ')
      : 'None';
    
    const exemptChannels = rule.exempt_channels.length > 0
      ? rule.exempt_channels.map(id => `<#${id}>`).join(', ')
      : 'None';

    embed.addFields(
      { name: 'Exempt Roles', value: exemptRoles, inline: true },
      { name: 'Exempt Channels', value: exemptChannels, inline: true }
    );

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error viewing rule:', error);
    await interaction.reply({
      content: 'Failed to view auto moderation rule. Make sure the ID is correct.',
      ephemeral: true
    });
  }
}

async function handleKeywords(interaction: any, automodManager: AutoModerationManager, guildId: string) {
  const ruleId = interaction.options.getString('rule-id');
  const keywords = interaction.options.getString('keywords');

  try {
    const keywordList = keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
    
    const rule = await automodManager.updateRuleKeywords(guildId, ruleId, keywordList);
    
    await interaction.reply({
      content: `Keywords updated for rule "${rule.name}".`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error updating keywords:', error);
    await interaction.reply({
      content: 'Failed to update keywords. Make sure the rule ID is correct and it\'s a keyword filter rule.',
      ephemeral: true
    });
  }
}

async function handleExempt(interaction: any, automodManager: AutoModerationManager, guildId: string) {
  const ruleId = interaction.options.getString('rule-id');
  const type = interaction.options.getString('type');
  const role = interaction.options.getRole('role');
  const channel = interaction.options.getChannel('channel');

  try {
    let resultMessage = '';

    if (type === 'add_role' && role) {
      const rule = await automodManager.addExemptRole(guildId, ruleId, role.id);
      resultMessage = `Role ${role.name} added to exemptions for rule "${rule.name}".`;
    } else if (type === 'remove_role' && role) {
      const rule = await automodManager.removeExemptRole(guildId, ruleId, role.id);
      resultMessage = `Role ${role.name} removed from exemptions for rule "${rule.name}".`;
    } else if (type === 'add_channel' && channel) {
      const rule = await automodManager.addExemptChannel(guildId, ruleId, channel.id);
      resultMessage = `Channel ${channel.name} added to exemptions for rule "${rule.name}".`;
    } else if (type === 'remove_channel' && channel) {
      const rule = await automodManager.removeExemptChannel(guildId, ruleId, channel.id);
      resultMessage = `Channel ${channel.name} removed from exemptions for rule "${rule.name}".`;
    } else {
      await interaction.reply({
        content: 'Please provide a valid role or channel for the exemption operation.',
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: resultMessage,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error managing exemptions:', error);
    await interaction.reply({
      content: 'Failed to manage exemptions. Make sure the rule ID is correct.',
      ephemeral: true
    });
  }
}