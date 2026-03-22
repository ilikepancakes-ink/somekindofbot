import { REST, Routes } from 'discord.js';
import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';

export interface AutoModerationRule {
  id: string;
  guild_id: string;
  name: string;
  creator_id: string;
  event_type: number;
  trigger_type: number;
  trigger_metadata: {
    keyword_filter?: string[];
    regex_patterns?: string[];
    presets?: number[];
    allow_list?: string[];
    mention_total_limit?: number;
    mention_raid_protection_enabled?: boolean;
  };
  actions: Array<{
    type: number;
    metadata?: {
      channel_id?: string;
      duration_seconds?: number;
      custom_message?: string;
    };
  }>;
  enabled: boolean;
  exempt_roles: string[];
  exempt_channels: string[];
}

export interface KeywordPreset {
  type: number;
  name: string;
  description: string;
}

export class AutoModerationManager {
  private db: sqlite3.Database | null = null;
  private rest: REST;

  constructor() {
    this.rest = new REST({ version: '10' });
    if (process.env.DISCORD_TOKEN) {
      this.rest.setToken(process.env.DISCORD_TOKEN);
    }
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Ensure data directory exists
      const dataDir = './data';
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new sqlite3.Database('./data/bot.db', (err) => {
        if (err) {
          reject(err);
        } else {
          this.db!.run(`
            CREATE TABLE IF NOT EXISTS auto_moderation_rules (
              id TEXT PRIMARY KEY,
              guild_id TEXT NOT NULL,
              name TEXT NOT NULL,
              creator_id TEXT NOT NULL,
              event_type INTEGER NOT NULL,
              trigger_type INTEGER NOT NULL,
              trigger_metadata TEXT NOT NULL,
              actions TEXT NOT NULL,
              enabled BOOLEAN NOT NULL,
              exempt_roles TEXT NOT NULL,
              exempt_channels TEXT NOT NULL,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            )
          `, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        }
      });
    });
  }

  // Discord API Integration
  async listRules(guildId: string): Promise<AutoModerationRule[]> {
    try {
      const rules = await this.rest.get(Routes.guildAutoModerationRules(guildId)) as AutoModerationRule[];
      return rules;
    } catch (error) {
      console.error('Error fetching auto moderation rules:', error);
      throw error;
    }
  }

  async getRule(guildId: string, ruleId: string): Promise<AutoModerationRule> {
    try {
      const rule = await this.rest.get(Routes.guildAutoModerationRule(guildId, ruleId)) as AutoModerationRule;
      return rule;
    } catch (error) {
      console.error('Error fetching auto moderation rule:', error);
      throw error;
    }
  }

  async createRule(guildId: string, ruleData: Partial<AutoModerationRule>): Promise<AutoModerationRule> {
    try {
      const rule = await this.rest.post(Routes.guildAutoModerationRules(guildId), {
        body: ruleData
      }) as AutoModerationRule;
      
      // Store in local database
      await this.saveRuleToLocal(rule);
      
      return rule;
    } catch (error) {
      console.error('Error creating auto moderation rule:', error);
      throw error;
    }
  }

  async modifyRule(guildId: string, ruleId: string, updates: Partial<AutoModerationRule>): Promise<AutoModerationRule> {
    try {
      const rule = await this.rest.patch(Routes.guildAutoModerationRule(guildId, ruleId), {
        body: updates
      }) as AutoModerationRule;
      
      // Update local database
      await this.updateRuleInLocal(rule);
      
      return rule;
    } catch (error) {
      console.error('Error modifying auto moderation rule:', error);
      throw error;
    }
  }

  async deleteRule(guildId: string, ruleId: string): Promise<void> {
    try {
      await this.rest.delete(Routes.guildAutoModerationRule(guildId, ruleId));
      
      // Remove from local database
      await this.deleteRuleFromLocal(ruleId);
    } catch (error) {
      console.error('Error deleting auto moderation rule:', error);
      throw error;
    }
  }

  // Local Database Management
  private async saveRuleToLocal(rule: AutoModerationRule): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT OR REPLACE INTO auto_moderation_rules 
         (id, guild_id, name, creator_id, event_type, trigger_type, trigger_metadata, actions, 
          enabled, exempt_roles, exempt_channels, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rule.id,
          rule.guild_id,
          rule.name,
          rule.creator_id,
          rule.event_type,
          rule.trigger_type,
          JSON.stringify(rule.trigger_metadata),
          JSON.stringify(rule.actions),
          rule.enabled ? 1 : 0,
          JSON.stringify(rule.exempt_roles),
          JSON.stringify(rule.exempt_channels),
          Date.now(),
          Date.now()
        ],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  private async updateRuleInLocal(rule: AutoModerationRule): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.run(
        `UPDATE auto_moderation_rules 
         SET name = ?, trigger_metadata = ?, actions = ?, enabled = ?, 
             exempt_roles = ?, exempt_channels = ?, updated_at = ?
         WHERE id = ?`,
        [
          rule.name,
          JSON.stringify(rule.trigger_metadata),
          JSON.stringify(rule.actions),
          rule.enabled ? 1 : 0,
          JSON.stringify(rule.exempt_roles),
          JSON.stringify(rule.exempt_channels),
          Date.now(),
          rule.id
        ],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  private async deleteRuleFromLocal(ruleId: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.run(
        'DELETE FROM auto_moderation_rules WHERE id = ?',
        [ruleId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async getLocalRules(guildId: string): Promise<AutoModerationRule[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM auto_moderation_rules WHERE guild_id = ?',
        [guildId],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => ({
              id: row.id,
              guild_id: row.guild_id,
              name: row.name,
              creator_id: row.creator_id,
              event_type: row.event_type,
              trigger_type: row.trigger_type,
              trigger_metadata: JSON.parse(row.trigger_metadata),
              actions: JSON.parse(row.actions),
              enabled: Boolean(row.enabled),
              exempt_roles: JSON.parse(row.exempt_roles),
              exempt_channels: JSON.parse(row.exempt_channels)
            })));
          }
        }
      );
    });
  }

  async getRuleById(ruleId: string): Promise<AutoModerationRule | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM auto_moderation_rules WHERE id = ?',
        [ruleId],
        (err, row: any) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            resolve({
              id: row.id,
              guild_id: row.guild_id,
              name: row.name,
              creator_id: row.creator_id,
              event_type: row.event_type,
              trigger_type: row.trigger_type,
              trigger_metadata: JSON.parse(row.trigger_metadata),
              actions: JSON.parse(row.actions),
              enabled: Boolean(row.enabled),
              exempt_roles: JSON.parse(row.exempt_roles),
              exempt_channels: JSON.parse(row.exempt_channels)
            });
          }
        }
      );
    });
  }

  // Rule Management Methods
  async createKeywordRule(
    guildId: string,
    name: string,
    keywords: string[],
    actions: Array<{ type: number; metadata?: any }>,
    exemptRoles: string[] = [],
    exemptChannels: string[] = []
  ): Promise<AutoModerationRule> {
    const ruleData: Partial<AutoModerationRule> = {
      name,
      event_type: 1, // MESSAGE_SEND
      trigger_type: 1, // KEYWORD
      trigger_metadata: {
        keyword_filter: keywords,
        allow_list: []
      },
      actions,
      enabled: true,
      exempt_roles: exemptRoles,
      exempt_channels: exemptChannels
    };

    return this.createRule(guildId, ruleData);
  }

  async createSpamRule(
    guildId: string,
    name: string,
    actions: Array<{ type: number; metadata?: any }>,
    exemptRoles: string[] = [],
    exemptChannels: string[] = []
  ): Promise<AutoModerationRule> {
    const ruleData: Partial<AutoModerationRule> = {
      name,
      event_type: 1, // MESSAGE_SEND
      trigger_type: 3, // SPAM
      actions,
      enabled: true,
      exempt_roles: exemptRoles,
      exempt_channels: exemptChannels
    };

    return this.createRule(guildId, ruleData);
  }

  async createMentionSpamRule(
    guildId: string,
    name: string,
    mentionLimit: number,
    actions: Array<{ type: number; metadata?: any }>,
    exemptRoles: string[] = [],
    exemptChannels: string[] = []
  ): Promise<AutoModerationRule> {
    const ruleData: Partial<AutoModerationRule> = {
      name,
      event_type: 1, // MESSAGE_SEND
      trigger_type: 5, // MENTION_SPAM
      trigger_metadata: {
        mention_total_limit: mentionLimit
      },
      actions,
      enabled: true,
      exempt_roles: exemptRoles,
      exempt_channels: exemptChannels
    };

    return this.createRule(guildId, ruleData);
  }

  async enableRule(guildId: string, ruleId: string): Promise<AutoModerationRule> {
    return this.modifyRule(guildId, ruleId, { enabled: true });
  }

  async disableRule(guildId: string, ruleId: string): Promise<AutoModerationRule> {
    return this.modifyRule(guildId, ruleId, { enabled: false });
  }

  async updateRuleKeywords(
    guildId: string,
    ruleId: string,
    keywords: string[],
    allowList: string[] = []
  ): Promise<AutoModerationRule> {
    return this.modifyRule(guildId, ruleId, {
      trigger_metadata: {
        keyword_filter: keywords,
        allow_list: allowList
      }
    });
  }

  async updateRuleActions(
    guildId: string,
    ruleId: string,
    actions: Array<{ type: number; metadata?: any }>
  ): Promise<AutoModerationRule> {
    return this.modifyRule(guildId, ruleId, { actions });
  }

  async addExemptRole(guildId: string, ruleId: string, roleId: string): Promise<AutoModerationRule> {
    const rule = await this.getRule(guildId, ruleId);
    const exemptRoles = [...new Set([...rule.exempt_roles, roleId])];
    return this.modifyRule(guildId, ruleId, { exempt_roles: exemptRoles });
  }

  async removeExemptRole(guildId: string, ruleId: string, roleId: string): Promise<AutoModerationRule> {
    const rule = await this.getRule(guildId, ruleId);
    const exemptRoles = rule.exempt_roles.filter(id => id !== roleId);
    return this.modifyRule(guildId, ruleId, { exempt_roles: exemptRoles });
  }

  async addExemptChannel(guildId: string, ruleId: string, channelId: string): Promise<AutoModerationRule> {
    const rule = await this.getRule(guildId, ruleId);
    const exemptChannels = [...new Set([...rule.exempt_channels, channelId])];
    return this.modifyRule(guildId, ruleId, { exempt_channels: exemptChannels });
  }

  async removeExemptChannel(guildId: string, ruleId: string, channelId: string): Promise<AutoModerationRule> {
    const rule = await this.getRule(guildId, ruleId);
    const exemptChannels = rule.exempt_channels.filter(id => id !== channelId);
    return this.modifyRule(guildId, ruleId, { exempt_channels: exemptChannels });
  }

  // Utility Methods
  static getTriggerTypeString(triggerType: number): string {
    const types = {
      1: 'KEYWORD',
      3: 'SPAM',
      4: 'KEYWORD_PRESET',
      5: 'MENTION_SPAM',
      6: 'MEMBER_PROFILE'
    };
    return types[triggerType as keyof typeof types] || 'UNKNOWN';
  }

  static getEventTypeString(eventType: number): string {
    const types = {
      1: 'MESSAGE_SEND',
      2: 'MEMBER_UPDATE'
    };
    return types[eventType as keyof typeof types] || 'UNKNOWN';
  }

  static getActionTypeString(actionType: number): string {
    const types = {
      1: 'BLOCK_MESSAGE',
      2: 'SEND_ALERT_MESSAGE',
      3: 'TIMEOUT',
      4: 'BLOCK_MEMBER_INTERACTION'
    };
    return types[actionType as keyof typeof types] || 'UNKNOWN';
  }

  static getKeywordPresets(): KeywordPreset[] {
    return [
      {
        type: 1,
        name: 'Profanity',
        description: 'Words that may be considered forms of swearing or cursing'
      },
      {
        type: 2,
        name: 'Sexual Content',
        description: 'Words that refer to sexually explicit behavior or activity'
      },
      {
        type: 3,
        name: 'Slurs',
        description: 'Personal insults or words that may be considered hate speech'
      }
    ];
  }
}