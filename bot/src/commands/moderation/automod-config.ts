import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { AutoModerationManager } from '../../cogs/utils/autoModeration';

export const data = new SlashCommandBuilder()
  .setName('automod-config')
  .setDescription('Configure auto moderation settings for this server')
  .addSubcommand(subcommand =>
    subcommand
      .setName('presets')
      .setDescription('Configure keyword presets for auto moderation'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('allowlist')
      .setDescription('Manage allow list for keyword rules')
      .addStringOption(option =>
        option.setName('rule-id')
          .setDescription('The ID of the rule to configure')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('keywords')
          .setDescription('Keywords to add to allow list (comma-separated)')))
  .addSubcommand(subcommand =>
    subcommand
      .setName('regex')
      .setDescription('Configure regex patterns for keyword rules')
      .addStringOption(option =>
        option.setName('rule-id')
          .setDescription('The ID of the rule to configure')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('patterns')
          .setDescription('Regex patterns to add (comma-separated)')))
  .addSubcommand(subcommand =>
    subcommand
      .setName('raid-protection')
      .setDescription('Configure mention raid protection')
      .addStringOption(option =>
        option.setName('rule-id')
          .setDescription('The ID of the mention spam rule')
          .setRequired(true))
      .addBooleanOption(option =>
        option.setName('enabled')
          .setDescription('Whether to enable raid protection')
          .setRequired(true)))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: any) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const automodManager = new AutoModerationManager();
  
  try {
    await automodManager.init();

    switch (subcommand) {
      case 'presets':
        await handlePresets(interaction, automodManager, guildId);
        break;
      case 'allowlist':
        await handleAllowList(interaction, automodManager, guildId);
        break;
      case 'regex':
        await handleRegex(interaction, automodManager, guildId);
        break;
      case 'raid-protection':
        await handleRaidProtection(interaction, automodManager, guildId);
        break;
    }
  } catch (error) {
    console.error('Error executing automod-config command:', error);
    await interaction.reply({
      content: 'An error occurred while processing your request.',
      ephemeral: true
    });
  }
}

async function handlePresets(interaction: any, automodManager: AutoModerationManager, guildId: string) {
  const presets = AutoModerationManager.getKeywordPresets();
  
  const embed = new EmbedBuilder()
    .setTitle('Keyword Presets')
    .setDescription('Available keyword presets for auto moderation rules:')
    .setColor('#0099ff');

  presets.forEach(preset => {
    embed.addFields({
      name: `${preset.name} (Type: ${preset.type})`,
      value: preset.description,
      inline: false
    });
  });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAllowList(interaction: any, automodManager: AutoModerationManager, guildId: string) {
  const ruleId = interaction.options.getString('rule-id');
  const keywords = interaction.options.getString('keywords');

  try {
    const rule = await automodManager.getRule(guildId, ruleId);
    
    if (rule.trigger_type !== 1 && rule.trigger_type !== 4) {
      await interaction.reply({
        content: 'Allow list can only be configured for keyword filter and keyword preset rules.',
        ephemeral: true
      });
      return;
    }

    let currentAllowList = rule.trigger_metadata.allow_list || [];
    
    if (keywords) {
      const newKeywords = keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
      currentAllowList = [...new Set([...currentAllowList, ...newKeywords])];
      
      const updatedRule = await automodManager.updateRuleKeywords(
        guildId, 
        ruleId, 
        rule.trigger_metadata.keyword_filter || [], 
        currentAllowList
      );

      await interaction.reply({
        content: `Allow list updated for rule "${updatedRule.name}". Added ${newKeywords.length} keyword(s).`,
        ephemeral: true
      });
    } else {
      const embed = new EmbedBuilder()
        .setTitle('Allow List Configuration')
        .setDescription(`Current allow list for rule "${rule.name}":`)
        .addFields({
          name: 'Keywords',
          value: currentAllowList.length > 0 ? currentAllowList.join(', ') : 'None',
          inline: false
        })
        .setColor('#0099ff');

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (error) {
    console.error('Error managing allow list:', error);
    await interaction.reply({
      content: 'Failed to manage allow list. Make sure the rule ID is correct.',
      ephemeral: true
    });
  }
}

async function handleRegex(interaction: any, automodManager: AutoModerationManager, guildId: string) {
  const ruleId = interaction.options.getString('rule-id');
  const patterns = interaction.options.getString('patterns');

  try {
    const rule = await automodManager.getRule(guildId, ruleId);
    
    if (rule.trigger_type !== 1) {
      await interaction.reply({
        content: 'Regex patterns can only be configured for keyword filter rules.',
        ephemeral: true
      });
      return;
    }

    let currentPatterns = rule.trigger_metadata.regex_patterns || [];
    
    if (patterns) {
      const newPatterns = patterns.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
      
      // Validate regex patterns
      const validPatterns: string[] = [];
      const invalidPatterns: string[] = [];
      
      for (const pattern of newPatterns) {
        try {
          new RegExp(pattern, 'i');
          validPatterns.push(pattern);
        } catch (error) {
          invalidPatterns.push(pattern);
        }
      }

      if (invalidPatterns.length > 0) {
        await interaction.reply({
          content: `Invalid regex patterns: ${invalidPatterns.join(', ')}. Please check your regex syntax.`,
          ephemeral: true
        });
        return;
      }

      currentPatterns = [...new Set([...currentPatterns, ...validPatterns])];
      
      const updatedRule = await automodManager.modifyRule(guildId, ruleId, {
        trigger_metadata: {
          ...rule.trigger_metadata,
          regex_patterns: currentPatterns
        }
      });

      await interaction.reply({
        content: `Regex patterns updated for rule "${updatedRule.name}". Added ${validPatterns.length} pattern(s).`,
        ephemeral: true
      });
    } else {
      const embed = new EmbedBuilder()
        .setTitle('Regex Patterns Configuration')
        .setDescription(`Current regex patterns for rule "${rule.name}":`)
        .addFields({
          name: 'Patterns',
          value: currentPatterns.length > 0 ? currentPatterns.join('\n') : 'None',
          inline: false
        })
        .setColor('#0099ff');

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (error) {
    console.error('Error managing regex patterns:', error);
    await interaction.reply({
      content: 'Failed to manage regex patterns. Make sure the rule ID is correct.',
      ephemeral: true
    });
  }
}

async function handleRaidProtection(interaction: any, automodManager: AutoModerationManager, guildId: string) {
  const ruleId = interaction.options.getString('rule-id');
  const enabled = interaction.options.getBoolean('enabled');

  try {
    const rule = await automodManager.getRule(guildId, ruleId);
    
    if (rule.trigger_type !== 5) {
      await interaction.reply({
        content: 'Raid protection can only be configured for mention spam rules.',
        ephemeral: true
      });
      return;
    }

    const updatedRule = await automodManager.modifyRule(guildId, ruleId, {
      trigger_metadata: {
        ...rule.trigger_metadata,
        mention_raid_protection_enabled: enabled
      }
    });

    await interaction.reply({
      content: `Raid protection ${enabled ? 'enabled' : 'disabled'} for rule "${updatedRule.name}".`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error configuring raid protection:', error);
    await interaction.reply({
      content: 'Failed to configure raid protection. Make sure the rule ID is correct.',
      ephemeral: true
    });
  }
}