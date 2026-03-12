import { Interaction, GuildMember, PermissionFlagsBits, EmbedBuilder, CommandInteraction, AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import * as crypto from 'crypto';

// Rate limiting for Discord interactions
const interactionAttempts = new Map();
const commandUsage = new Map();

export class SecurityManager {
  private static instance: SecurityManager;

  private constructor() {}

  public static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  // Enhanced permission validation for Discord bot commands
  public async validateCommandPermissions(interaction: Interaction, commandName: string): Promise<boolean> {
    if (!interaction.guild) {
      return false;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isAdmin = process.env.BOT_ADMIN_USER_ID ? interaction.user.id === process.env.BOT_ADMIN_USER_ID : false;

    // Rate limiting
    const ip = interaction.user.id; // Use user ID as identifier
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxAttempts = 20;

    if (!interactionAttempts.has(ip)) {
      interactionAttempts.set(ip, []);
    }

    const attempts = interactionAttempts.get(ip);
    const validAttempts = attempts.filter((time: number) => now - time < windowMs);

    if (validAttempts.length >= maxAttempts) {
      await this.sendSecurityAlert(interaction, 'Rate limit exceeded for command usage');
      return false;
    }

    validAttempts.push(now);
    interactionAttempts.set(ip, validAttempts);

    // Command-specific permission validation
    switch (commandName) {
      case 'xp':
        if (interaction.isChatInputCommand()) {
          const subcommand = interaction.options.getSubcommand();
          if (subcommand === 'edit' || subcommand === 'nuke') {
            return member.permissions.has(PermissionFlagsBits.Administrator) || isAdmin;
          }
        }
        return true;

      case 'mod':
        if (interaction.isChatInputCommand()) {
          const modSubcommand = interaction.options.getSubcommand();
          switch (modSubcommand) {
            case 'ban':
              return member.permissions.has(PermissionFlagsBits.BanMembers) || isAdmin;
            case 'kick':
              return member.permissions.has(PermissionFlagsBits.KickMembers) || isAdmin;
            case 'timeout':
              return member.permissions.has(PermissionFlagsBits.ModerateMembers) || isAdmin;
            default:
              return member.permissions.has(PermissionFlagsBits.ManageGuild) || isAdmin;
          }
        }
        return member.permissions.has(PermissionFlagsBits.ManageGuild) || isAdmin;

      case 'role':
        if (interaction.isChatInputCommand()) {
          const roleSubcommand = interaction.options.getSubcommand();
          if (roleSubcommand === 'create' || roleSubcommand === 'delete' || roleSubcommand === 'edit') {
            return member.permissions.has(PermissionFlagsBits.ManageRoles) || isAdmin;
          }
        }
        return true;

      case 'channel':
      case 'lockdown':
        return member.permissions.has(PermissionFlagsBits.ManageChannels) || isAdmin;

      case 'ticket':
        return member.permissions.has(PermissionFlagsBits.ManageGuild) || isAdmin;

      case 'log':
        return member.permissions.has(PermissionFlagsBits.ManageGuild) || isAdmin;

      default:
        return true;
    }
  }

  // Input validation for Discord bot commands
  public validateInput(input: string, type: 'username' | 'reason' | 'channel' | 'role'): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }

    switch (type) {
      case 'username':
        // Discord username validation
        return /^[a-zA-Z0-9_.-]{2,32}$/.test(input);
      
      case 'reason':
        // Moderation reason validation
        return input.length <= 500 && !/[<>\"'&]/.test(input);
      
      case 'channel':
        // Channel name validation
        return /^[a-z0-9-]{2,100}$/.test(input);
      
      case 'role':
        // Role name validation
        return /^[a-zA-Z0-9_\-\s]{1,100}$/.test(input);
      
      default:
        return true;
    }
  }

  // Discord ID validation
  public validateDiscordId(id: string): boolean {
    return /^\d{17,19}$/.test(id);
  }

  // Color validation for Discord embeds
  public validateColor(color: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  }

  // Security alert system
  private async sendSecurityAlert(interaction: Interaction, message: string): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setTitle('🚨 Security Alert')
        .setDescription(message)
        .setColor(0xFF0000)
        .setTimestamp();

      // Check if interaction is a command interaction before accessing replied/deferred
      if (interaction.isChatInputCommand()) {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [embed], flags: 64 });
        } else {
          await interaction.reply({ embeds: [embed], flags: 64 });
        }
      } else if (interaction.isAutocomplete()) {
        // For autocomplete interactions, just try to reply
        await (interaction as AutocompleteInteraction).respond([]);
      }
    } catch (error) {
      console.error('Failed to send security alert:', error);
    }
  }

  // Command usage logging
  public logCommandUsage(interaction: Interaction, commandName: string): void {
    const key = `${interaction.user.id}_${commandName}`;
    const now = Date.now();
    
    if (!commandUsage.has(key)) {
      commandUsage.set(key, []);
    }

    const usage = commandUsage.get(key);
    usage.push(now);
    
    // Keep only last 100 usages
    if (usage.length > 100) {
      usage.shift();
    }
  }

  // Check for suspicious activity patterns
  public checkSuspiciousActivity(userId: string, commandName: string): boolean {
    const key = `${userId}_${commandName}`;
    const usage = commandUsage.get(key);
    
    if (!usage || usage.length < 10) {
      return false;
    }

    const now = Date.now();
    const recentUsage = usage.filter((time: number) => now - time < 300000); // Last 5 minutes
    
    // More than 10 uses in 5 minutes might be suspicious
    return recentUsage.length > 10;
  }

  // Sanitize Discord mentions to prevent abuse
  public sanitizeMentions(text: string): string {
    return text
      .replace(/<@!?(\d+)>/g, '@[USER]') // User mentions
      .replace(/<@&(\d+)>/g, '@[ROLE]') // Role mentions
      .replace(/<#(\d+)>/g, '#[CHANNEL]') // Channel mentions
      .replace(/<a?:\w+:\d+>/g, '[EMOJI]'); // Custom emojis
  }

  // Validate file uploads for security
  public validateFileUpload(filename: string, size: number): boolean {
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.mov'];
    const maxSize = 8 * 1024 * 1024; // 8MB

    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    return allowedExtensions.includes(extension) && size <= maxSize;
  }

  // Generate secure session tokens
  public generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Validate session tokens
  public validateSessionToken(token: string): boolean {
    return /^[a-f0-9]{64}$/.test(token);
  }
}

// Export singleton instance
export const securityManager = SecurityManager.getInstance();