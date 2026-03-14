import * as sqlite3 from 'sqlite3';
import * as path from 'path';

const db = new sqlite3.Database(path.join(__dirname, '../../stats.db'));

// Create table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS guilds (
    guild_id TEXT PRIMARY KEY,
    member_channel_id TEXT,
    days_channel_id TEXT,
    roles_channel_id TEXT,
    channels_channel_id TEXT
  )
`);

// Create sessions table for persistent auth tokens per device
db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT,
    device_id TEXT,
    created_at INTEGER
  )
`);

// Add new columns if they don't exist (for existing databases)
db.run(`ALTER TABLE guilds ADD COLUMN welcome_channel_id TEXT`, (err: any) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('Error adding welcome_channel_id column:', err);
  }
});
db.run(`ALTER TABLE guilds ADD COLUMN welcome_title TEXT`, (err: any) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('Error adding welcome_title column:', err);
  }
});
db.run(`ALTER TABLE guilds ADD COLUMN goodbye_channel_id TEXT`, (err: any) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('Error adding goodbye_channel_id column:', err);
  }
});
db.run(`ALTER TABLE guilds ADD COLUMN goodbye_title TEXT`, (err: any) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('Error adding goodbye_title column:', err);
  }
});
db.run(`ALTER TABLE guilds ADD COLUMN log_webhook_url TEXT`, (err: any) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('Error adding log_webhook_url column:', err);
  }
});

// Ticket settings
db.run(`CREATE TABLE IF NOT EXISTS ticket_settings (
  guild_id TEXT PRIMARY KEY,
  ping_role_id TEXT,
  access_role_ids TEXT
)`);

// Tickets
db.run(`CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  channel_id TEXT,
  user_id TEXT,
  created_at INTEGER
)`);

// Ticket messages
db.run(`CREATE TABLE IF NOT EXISTS ticket_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER,
  message_id TEXT,
  author_id TEXT,
  author_username TEXT,
  content TEXT,
  created_at INTEGER,
  edited_at INTEGER,
  FOREIGN KEY (ticket_id) REFERENCES tickets (id)
)`);

// FM users
db.run(`CREATE TABLE IF NOT EXISTS fm_users (
  discord_user_id TEXT PRIMARY KEY,
  lastfm_username TEXT,
  session_key TEXT
)`);

// FM request tokens
db.run(`CREATE TABLE IF NOT EXISTS fm_request_tokens (
  discord_user_id TEXT PRIMARY KEY,
  request_token TEXT,
  request_token_secret TEXT
)`);

// Role embeds for persistent role selection
db.run(`CREATE TABLE IF NOT EXISTS role_embeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  channel_id TEXT,
  message_id TEXT,
  title TEXT,
  description TEXT,
  roles TEXT
)`);

// Better embeds settings
db.run(`CREATE TABLE IF NOT EXISTS better_embeds_settings (
  guild_id TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT 0
)`);

// Better embeds messages
db.run(`CREATE TABLE IF NOT EXISTS better_embeds_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  channel_id TEXT,
  message_id TEXT,
  original_message_id TEXT,
  platform TEXT,
  url TEXT,
  created_at INTEGER
)`);

// Moderation logs
db.run(`CREATE TABLE IF NOT EXISTS moderation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  user_id TEXT,
  moderator_id TEXT,
  action_type TEXT,
  reason TEXT,
  duration INTEGER,
  timestamp INTEGER
)`);

// Downloads
db.run(`CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  video_url TEXT,
  filename TEXT,
  original_filename TEXT,
  file_path TEXT,
  created_at INTEGER,
  expires_at INTEGER
)`);

// User summaries for Gork AI
db.run(`CREATE TABLE IF NOT EXISTS user_summaries (
  user_id TEXT PRIMARY KEY,
  summary_text TEXT,
  message_count INTEGER,
  last_updated INTEGER
)`);

// Conversation context for Gork AI
db.run(`CREATE TABLE IF NOT EXISTS conversation_context (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  role TEXT,
  content TEXT,
  has_attachments BOOLEAN DEFAULT 0,
  timestamp INTEGER
)`);

interface GuildStats {
  guild_id: string;
  member_channel_id?: string;
  days_channel_id?: string;
  roles_channel_id?: string;
  channels_channel_id?: string;
  welcome_channel_id?: string;
  welcome_title?: string;
  goodbye_channel_id?: string;
  goodbye_title?: string;
  log_webhook_url?: string;
}

interface TicketSettings {
  guild_id: string;
  ping_role_id?: string;
  access_role_ids?: string;
}

interface Ticket {
  id?: number;
  guild_id: string;
  channel_id: string;
  user_id: string;
  created_at: number;
}

interface TicketMessage {
  id?: number;
  ticket_id: number;
  message_id: string;
  author_id: string;
  author_username: string;
  content: string;
  created_at: number;
  edited_at?: number;
}

interface FMUser {
  discord_user_id: string;
  lastfm_username?: string;
  session_key?: string;
}

interface FMRequestToken {
  discord_user_id: string;
  request_token: string;
  request_token_secret: string;
}

interface RoleEmbed {
  id?: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  title: string;
  description: string;
  roles: string; // JSON string of role IDs
}

interface BetterEmbedsSettings {
  guild_id: string;
  enabled: boolean;
}

interface BetterEmbedsMessage {
  id?: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  original_message_id: string;
  platform: string;
  url: string;
  created_at: number;
}

interface ModerationLog {
  id?: number;
  guild_id: string;
  user_id: string;
  moderator_id: string;
  action_type: string;
  reason: string;
  duration?: number;
  timestamp: number;
}

interface UserSummary {
  user_id: string;
  summary_text: string;
  message_count: number;
  last_updated: number;
}

interface ConversationContext {
  id?: number;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  has_attachments: boolean;
  timestamp: number;
}

export class MessageDatabase {
  private db: sqlite3.Database;

  constructor() {
    this.db = db;
  }

  async get_guild_stats(guildId: string): Promise<GuildStats | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM guilds WHERE guild_id = ?', [guildId], (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row as GuildStats | undefined);
      });
    });
  }

  async set_guild_stats(stats: GuildStats): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO guilds (guild_id, member_channel_id, days_channel_id, roles_channel_id, channels_channel_id, welcome_channel_id, welcome_title, goodbye_channel_id, goodbye_title, log_webhook_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [stats.guild_id, stats.member_channel_id, stats.days_channel_id, stats.roles_channel_id, stats.channels_channel_id, stats.welcome_channel_id, stats.welcome_title, stats.goodbye_channel_id, stats.goodbye_title, stats.log_webhook_url],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async get_all_guild_stats(): Promise<GuildStats[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM guilds', [], (err: any, rows: any) => {
        if (err) reject(err);
        else resolve(rows as GuildStats[]);
      });
    });
  }

  async get_session(token: string): Promise<any | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM sessions WHERE token = ?', [token], (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async set_session(session: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO sessions (token, user_id, device_id, created_at) VALUES (?, ?, ?, ?)',
        [session.token, session.user_id, session.device_id, session.created_at],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async delete_expired_sessions(): Promise<void> {
    return new Promise((resolve, reject) => {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      this.db.run('DELETE FROM sessions WHERE created_at < ?', [thirtyDaysAgo], (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async get_ticket_settings(guildId: string): Promise<TicketSettings | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM ticket_settings WHERE guild_id = ?', [guildId], (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row as TicketSettings | undefined);
      });
    });
  }

  async set_ticket_settings(settings: TicketSettings): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO ticket_settings (guild_id, ping_role_id, access_role_ids) VALUES (?, ?, ?)',
        [settings.guild_id, settings.ping_role_id, settings.access_role_ids],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async create_ticket(ticket: Ticket): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO tickets (guild_id, channel_id, user_id, created_at) VALUES (?, ?, ?, ?)',
        [ticket.guild_id, ticket.channel_id, ticket.user_id, ticket.created_at],
        function(this: any, err: any) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async get_ticket_by_channel(channelId: string): Promise<Ticket | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM tickets WHERE channel_id = ?', [channelId], (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row as Ticket | undefined);
      });
    });
  }

  async delete_ticket(channelId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM tickets WHERE channel_id = ?', [channelId], (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async get_tickets_by_guild(guildId: string): Promise<Ticket[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM tickets WHERE guild_id = ? ORDER BY created_at DESC', [guildId], (err: any, rows: any) => {
        if (err) reject(err);
        else resolve(rows as Ticket[]);
      });
    });
  }

  async create_ticket_message(message: TicketMessage): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO ticket_messages (ticket_id, message_id, author_id, author_username, content, created_at, edited_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [message.ticket_id, message.message_id, message.author_id, message.author_username, message.content, message.created_at, message.edited_at],
        function(this: any, err: any) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async get_ticket_messages(ticketId: number): Promise<TicketMessage[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC', [ticketId], (err: any, rows: any) => {
        if (err) reject(err);
        else resolve(rows as TicketMessage[]);
      });
    });
  }

  async update_ticket_message(messageId: string, content: string, editedAt: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE ticket_messages SET content = ?, edited_at = ? WHERE message_id = ?',
        [content, editedAt, messageId],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async delete_ticket_message(messageId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM ticket_messages WHERE message_id = ?', [messageId], (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async get_fm_user(discordUserId: string): Promise<FMUser | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM fm_users WHERE discord_user_id = ?', [discordUserId], (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row as FMUser | undefined);
      });
    });
  }

  async set_fm_user(user: FMUser): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO fm_users (discord_user_id, lastfm_username, session_key) VALUES (?, ?, ?)',
        [user.discord_user_id, user.lastfm_username, user.session_key],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async get_fm_request_token(discordUserId: string): Promise<FMRequestToken | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM fm_request_tokens WHERE discord_user_id = ?', [discordUserId], (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row as FMRequestToken | undefined);
      });
    });
  }

  async set_fm_request_token(token: FMRequestToken): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO fm_request_tokens (discord_user_id, request_token, request_token_secret) VALUES (?, ?, ?)',
        [token.discord_user_id, token.request_token, token.request_token_secret],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async create_role_embed(roleEmbed: RoleEmbed): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO role_embeds (guild_id, channel_id, message_id, title, description, roles) VALUES (?, ?, ?, ?, ?, ?)',
        [roleEmbed.guild_id, roleEmbed.channel_id, roleEmbed.message_id, roleEmbed.title, roleEmbed.description, roleEmbed.roles],
        function(this: any, err: any) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async get_role_embed_by_message(messageId: string): Promise<RoleEmbed | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM role_embeds WHERE message_id = ?', [messageId], (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row as RoleEmbed | undefined);
      });
    });
  }

  async delete_role_embed(messageId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM role_embeds WHERE message_id = ?', [messageId], (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async get_better_embeds_settings(guildId: string): Promise<BetterEmbedsSettings | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM better_embeds_settings WHERE guild_id = ?', [guildId], (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row as BetterEmbedsSettings | undefined);
      });
    });
  }

  async set_better_embeds_settings(settings: BetterEmbedsSettings): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO better_embeds_settings (guild_id, enabled) VALUES (?, ?)',
        [settings.guild_id, settings.enabled ? 1 : 0],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async create_better_embeds_message(message: BetterEmbedsMessage): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO better_embeds_messages (guild_id, channel_id, message_id, original_message_id, platform, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [message.guild_id, message.channel_id, message.message_id, message.original_message_id, message.platform, message.url, message.created_at],
        function(this: any, err: any) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async get_better_embeds_message_by_original(originalMessageId: string): Promise<BetterEmbedsMessage | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM better_embeds_messages WHERE original_message_id = ?', [originalMessageId], (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row as BetterEmbedsMessage | undefined);
      });
    });
  }

  async delete_better_embeds_message(originalMessageId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM better_embeds_messages WHERE original_message_id = ?', [originalMessageId], (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async create_moderation_log(log: ModerationLog): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO moderation_logs (guild_id, user_id, moderator_id, action_type, reason, duration, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [log.guild_id, log.user_id, log.moderator_id, log.action_type, log.reason, log.duration, log.timestamp],
        function(this: any, err: any) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async get_moderation_logs_by_user(userId: string, guildId: string): Promise<ModerationLog[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM moderation_logs WHERE user_id = ? AND guild_id = ? ORDER BY timestamp DESC', [userId, guildId], (err: any, rows: any) => {
        if (err) reject(err);
        else resolve(rows as ModerationLog[]);
      });
    });
  }

  async get_moderation_logs_by_guild(guildId: string): Promise<ModerationLog[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM moderation_logs WHERE guild_id = ? ORDER BY timestamp DESC', [guildId], (err: any, rows: any) => {
        if (err) reject(err);
        else resolve(rows as ModerationLog[]);
      });
    });
  }

  async get_moderation_summary_by_user(userId: string, guildId: string): Promise<{ warns: number, timeouts: number, kicks: number, bans: number }> {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT action_type, COUNT(*) as count 
        FROM moderation_logs 
        WHERE user_id = ? AND guild_id = ? 
        GROUP BY action_type
      `, [userId, guildId], (err: any, rows: any) => {
        if (err) reject(err);
        else {
          const summary = { warns: 0, timeouts: 0, kicks: 0, bans: 0 };
          rows.forEach((row: any) => {
            switch (row.action_type) {
              case 'warn': summary.warns = row.count; break;
              case 'timeout': summary.timeouts = row.count; break;
              case 'kick': summary.kicks = row.count; break;
              case 'ban': summary.bans = row.count; break;
            }
          });
          resolve(summary);
        }
      });
    });
  }

  async create_download_record(record: any): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO downloads (user_id, video_url, filename, original_filename, file_path, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [record.user_id, record.video_url, record.filename, record.original_filename, record.file_path, record.created_at, record.expires_at],
        function(this: any, err: any) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async get_download_record(filename: string): Promise<any | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM downloads WHERE filename = ?', [filename], (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async cleanup_expired_downloads(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM downloads WHERE expires_at < ?', [Date.now()], (err: any, rows: any) => {
        if (err) reject(err);
        else {
          rows.forEach((row: any) => {
            try {
              if (require('fs').existsSync(row.file_path)) {
                require('fs').unlinkSync(row.file_path);
              }
            } catch (e) {
              console.error('Error deleting expired file:', e);
            }
          });
          this.db.run('DELETE FROM downloads WHERE expires_at < ?', [Date.now()], (err: any) => {
            if (err) reject(err);
            else resolve();
          });
        }
      });
    });
  }

  // Gork AI specific methods
  async get_user_summary(user_id: string): Promise<UserSummary | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM user_summaries WHERE user_id = ?', [user_id], (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row as UserSummary | undefined);
      });
    });
  }

  async update_user_summary(user_id: string, summary_text: string, message_count: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO user_summaries (user_id, summary_text, message_count, last_updated) VALUES (?, ?, ?, ?)',
        [user_id, summary_text, message_count, Date.now()],
        function(this: any, err: any) {
          if (err) {
            reject(err);
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    });
  }

  async get_conversation_context(user_id: string, limit: number = 10): Promise<ConversationContext[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM conversation_context WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
        [user_id, limit],
        (err: any, rows: any) => {
          if (err) reject(err);
          else resolve(rows as ConversationContext[]);
        }
      );
    });
  }

  async add_conversation_context(context: ConversationContext): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO conversation_context (user_id, role, content, has_attachments, timestamp) VALUES (?, ?, ?, ?, ?)',
        [context.user_id, context.role, context.content, context.has_attachments ? 1 : 0, context.timestamp],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async get_channel_messages(channel_id: string, limit: number = 30): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT content FROM conversation_context WHERE content IS NOT NULL AND content != "" ORDER BY timestamp DESC LIMIT ?',
        [limit],
        (err: any, rows: any) => {
          if (err) reject(err);
          else resolve(rows.map((row: any) => row.content));
        }
      );
    });
  }

  async get_recent_user_messages_for_summary(user_id: string, limit: number = 10): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT content FROM conversation_context WHERE user_id = ? AND role = "user" AND content IS NOT NULL AND content != "" ORDER BY timestamp DESC LIMIT ?',
        [user_id, limit],
        (err: any, rows: any) => {
          if (err) reject(err);
          else resolve(rows.map((row: any) => row.content));
        }
      );
    });
  }

  async get_message_count_for_user(user_id: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as count FROM conversation_context WHERE user_id = ? AND role = "user"',
        [user_id],
        (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row ? row.count : 0);
        }
      );
    });
  }

  async get_user_content_settings(user_id: string): Promise<any | undefined> {
    // This would need to be implemented based on your content filtering system
    return undefined;
  }
}