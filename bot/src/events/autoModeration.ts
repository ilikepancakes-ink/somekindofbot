import { Message, GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import { AutoModerationManager, AutoModerationRule } from '../cogs/utils/autoModeration';
import { MessageDatabase } from '../cogs/utils/database';

export class AutoModerationEvent {
  private automodManager: AutoModerationManager;
  private messageDB: MessageDatabase;

  constructor() {
    this.automodManager = new AutoModerationManager();
    this.messageDB = new MessageDatabase();
  }

  async init(): Promise<void> {
    await this.automodManager.init();
    await this.messageDB.init();
  }

  async handleMessageCreate(message: Message): Promise<void> {
    // Ignore bot messages
    if (message.author.bot) return;

    // Ignore DMs
    if (!message.guild) return;

    try {
      const guildId = message.guild.id;
      const rules = await this.automodManager.listRules(guildId);

      for (const rule of rules) {
        if (!rule.enabled) continue;

        // Check if message is exempt from this rule
        if (this.isMessageExempt(message, rule)) continue;

        const shouldTrigger = await this.checkRuleTrigger(message, rule);
        
        if (shouldTrigger) {
          await this.executeRuleActions(message, rule);
          
          // Log the rule trigger
          await this.logRuleTrigger(message, rule);
        }
      }
    } catch (error) {
      console.error('Error in auto moderation:', error);
    }
  }

  async handleMemberUpdate(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    // Ignore bot updates
    if (newMember.user.bot) return;

    // Ignore if nickname didn't change
    if (oldMember.displayName === newMember.displayName) return;

    try {
      const guildId = newMember.guild.id;
      const rules = await this.automodManager.listRules(guildId);

      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (rule.event_type !== 2) continue; // Only check MEMBER_UPDATE events

        // Check if member is exempt from this rule
        if (rule.exempt_roles.some(roleId => newMember.roles.cache.has(roleId))) continue;

        const shouldTrigger = await this.checkMemberProfileTrigger(newMember, rule);
        
        if (shouldTrigger) {
          await this.executeRuleActionsForMember(newMember, rule);
          
          // Log the rule trigger
          await this.logMemberRuleTrigger(newMember, rule);
        }
      }
    } catch (error) {
      console.error('Error in member auto moderation:', error);
    }
  }

  private isMessageExempt(message: Message, rule: AutoModerationRule): boolean {
    // Check role exemptions
    for (const roleId of rule.exempt_roles) {
      if (message.member?.roles.cache.has(roleId)) {
        return true;
      }
    }

    // Check channel exemptions
    if (rule.exempt_channels.includes(message.channel.id)) {
      return true;
    }

    return false;
  }

  private async checkRuleTrigger(message: Message, rule: AutoModerationRule): Promise<boolean> {
    const content = message.content.toLowerCase();

    switch (rule.trigger_type) {
      case 1: // KEYWORD
        return this.checkKeywordTrigger(content, rule.trigger_metadata);
      
      case 3: // SPAM
        return await this.checkSpamTrigger(message, rule);
      
      case 4: // KEYWORD_PRESET
        return this.checkKeywordPresetTrigger(content, rule.trigger_metadata);
      
      case 5: // MENTION_SPAM
        return this.checkMentionSpamTrigger(message, rule.trigger_metadata);
      
      default:
        return false;
    }
  }

  private async checkMemberProfileTrigger(member: GuildMember, rule: AutoModerationRule): Promise<boolean> {
    if (rule.trigger_type !== 6) return false; // Only check MEMBER_PROFILE triggers

    const displayName = member.displayName.toLowerCase();
    const username = member.user.username.toLowerCase();

    return this.checkKeywordTrigger(displayName, rule.trigger_metadata) ||
           this.checkKeywordTrigger(username, rule.trigger_metadata);
  }

  private checkKeywordTrigger(content: string, metadata: any): boolean {
    if (!metadata.keyword_filter) return false;

    // Check allow list first
    if (metadata.allow_list) {
      for (const allowWord of metadata.allow_list) {
        if (this.matchesPattern(content, allowWord.toLowerCase())) {
          return false; // Allow list match means no trigger
        }
      }
    }

    // Check keyword filter
    for (const keyword of metadata.keyword_filter) {
      if (this.matchesPattern(content, keyword.toLowerCase())) {
        return true;
      }
    }

    // Check regex patterns
    if (metadata.regex_patterns) {
      for (const pattern of metadata.regex_patterns) {
        try {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(content)) {
            return true;
          }
        } catch (error) {
          console.error('Invalid regex pattern:', pattern, error);
        }
      }
    }

    return false;
  }

  private async checkSpamTrigger(message: Message, rule: AutoModerationRule): Promise<boolean> {
    // Check for message spam (same content repeated)
    const recentMessages = await this.messageDB.get_channel_messages(message.channel.id, 10);
    
    const sameContentCount = recentMessages.filter((msg: string) => 
      msg.toLowerCase() === message.content.toLowerCase()
    ).length;

    // If same content appears 3+ times recently, consider it spam
    return sameContentCount >= 3;
  }

  private checkKeywordPresetTrigger(content: string, metadata: any): boolean {
    if (!metadata.presets) return false;

    const presets = AutoModerationManager.getKeywordPresets();
    
    for (const presetType of metadata.presets) {
      const preset = presets.find(p => p.type === presetType);
      if (!preset) continue;

      // For now, we'll use a simple keyword list for each preset
      // In a real implementation, these would be more comprehensive
      const presetKeywords = this.getPresetKeywords(presetType);
      
      for (const keyword of presetKeywords) {
        if (this.matchesPattern(content, keyword)) {
          return true;
        }
      }
    }

    return false;
  }

  private checkMentionSpamTrigger(message: Message, metadata: any): boolean {
    const mentionLimit = metadata.mention_total_limit || 5;
    const uniqueMentions = new Set([
      ...message.mentions.users.keys(),
      ...message.mentions.roles.keys()
    ]).size;

    return uniqueMentions > mentionLimit;
  }

  private getPresetKeywords(presetType: number): string[] {
    switch (presetType) {
      case 1: // PROFANITY
        return ['fuck', 'shit', 'damn', 'hell', 'bitch', 'bastard', 'asshole'];
      case 2: // SEXUAL_CONTENT
        return ['sex', 'porn', 'nude', 'naked', 'fuck', 'dick', 'pussy', 'cock'];
      case 3: // SLURS
        return ['nigger', 'faggot', 'tranny', 'dyke', 'retard', 'spic', 'kike'];
      default:
        return [];
    }
  }

  private matchesPattern(content: string, pattern: string): boolean {
    // Handle wildcard patterns
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\*/g, '.*')
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&');
      
      try {
        const regex = new RegExp(regexPattern, 'i');
        return regex.test(content);
      } catch (error) {
        console.error('Invalid pattern:', pattern, error);
        return false;
      }
    }

    // Handle whole word matching (no wildcards)
    const words = content.split(/\s+/);
    return words.some(word => word === pattern);
  }

  private async executeRuleActions(message: Message, rule: AutoModerationRule): Promise<void> {
    for (const action of rule.actions) {
      try {
        switch (action.type) {
          case 1: // BLOCK_MESSAGE
            await this.executeBlockMessage(message, action.metadata);
            break;
          case 2: // SEND_ALERT_MESSAGE
            await this.executeAlertMessage(message, rule, action.metadata);
            break;
          case 3: // TIMEOUT
            await this.executeTimeout(message.member!, action.metadata);
            break;
          case 4: // BLOCK_MEMBER_INTERACTION
            await this.executeBlockInteraction(message.member!, action.metadata);
            break;
        }
      } catch (error) {
        console.error('Error executing action:', error);
      }
    }
  }

  private async executeRuleActionsForMember(member: GuildMember, rule: AutoModerationRule): Promise<void> {
    for (const action of rule.actions) {
      try {
        switch (action.type) {
          case 1: // BLOCK_MESSAGE (not applicable for member updates)
            break;
          case 2: // SEND_ALERT_MESSAGE
            await this.executeAlertMessageForMember(member, rule, action.metadata);
            break;
          case 3: // TIMEOUT
            await this.executeTimeout(member, action.metadata);
            break;
          case 4: // BLOCK_MEMBER_INTERACTION
            await this.executeBlockInteraction(member, action.metadata);
            break;
        }
      } catch (error) {
        console.error('Error executing member action:', error);
      }
    }
  }

  private async executeBlockMessage(message: Message, metadata?: any): Promise<void> {
    try {
      await message.delete();
      
      if (metadata?.custom_message) {
        await (message.channel as TextChannel).send({
          content: `${message.author}, ${metadata.custom_message}`,
          allowedMentions: { users: [message.author.id] }
        });
      }
    } catch (error) {
      console.error('Error blocking message:', error);
    }
  }

  private async executeAlertMessage(message: Message, rule: AutoModerationRule, metadata?: any): Promise<void> {
    try {
      const alertChannelId = metadata?.channel_id || message.channel.id;
      const alertChannel = message.guild?.channels.cache.get(alertChannelId) as TextChannel;
      
      if (!alertChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('Auto Moderation Alert')
        .setDescription(`Rule triggered: **${rule.name}**`)
        .addFields(
          { name: 'User', value: `${message.author} (${message.author.id})`, inline: true },
          { name: 'Channel', value: message.channel.toString(), inline: true },
          { name: 'Message', value: message.content.substring(0, 1000) || '(No content)', inline: false }
        )
        .setColor('#ff0000')
        .setTimestamp();

      await alertChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error sending alert message:', error);
    }
  }

  private async executeAlertMessageForMember(member: GuildMember, rule: AutoModerationRule, metadata?: any): Promise<void> {
    try {
      const alertChannelId = metadata?.channel_id || member.guild.systemChannelId;
      const alertChannel = member.guild.channels.cache.get(alertChannelId) as TextChannel;
      
      if (!alertChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('Auto Moderation Alert - Member Profile')
        .setDescription(`Rule triggered: **${rule.name}**`)
        .addFields(
          { name: 'User', value: `${member.user} (${member.user.id})`, inline: true },
          { name: 'New Display Name', value: member.displayName, inline: true },
          { name: 'New Username', value: member.user.username, inline: true }
        )
        .setColor('#ff0000')
        .setTimestamp();

      await alertChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error sending member alert message:', error);
    }
  }

  private async executeTimeout(member: GuildMember, metadata?: any): Promise<void> {
    try {
      const duration = metadata?.duration_seconds || 60;
      await member.timeout(duration * 1000, 'Auto moderation rule triggered');
    } catch (error) {
      console.error('Error applying timeout:', error);
    }
  }

  private async executeBlockInteraction(member: GuildMember, metadata?: any): Promise<void> {
    // This would require more complex implementation
    // For now, we'll just timeout the member
    await this.executeTimeout(member, { duration_seconds: 300 }); // 5 minute timeout
  }

  private async logRuleTrigger(message: Message, rule: AutoModerationRule): Promise<void> {
    try {
      // Log to database or external logging service
      console.log(`Auto moderation rule triggered: ${rule.name} for user ${message.author.id} in channel ${message.channel.id}`);
    } catch (error) {
      console.error('Error logging rule trigger:', error);
    }
  }

  private async logMemberRuleTrigger(member: GuildMember, rule: AutoModerationRule): Promise<void> {
    try {
      // Log to database or external logging service
      console.log(`Auto moderation rule triggered: ${rule.name} for member ${member.user.id} profile update`);
    } catch (error) {
      console.error('Error logging member rule trigger:', error);
    }
  }
}