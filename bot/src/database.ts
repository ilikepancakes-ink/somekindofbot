const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('stats.db');

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

function getGuildStats(guildId: string): Promise<GuildStats | undefined> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM guilds WHERE guild_id = ?', [guildId], (err: any, row: any) => {
      if (err) reject(err);
      else resolve(row as GuildStats | undefined);
    });
  });
}

function setGuildStats(stats: GuildStats): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO guilds (guild_id, member_channel_id, days_channel_id, roles_channel_id, channels_channel_id, welcome_channel_id, welcome_title, goodbye_channel_id, goodbye_title) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [stats.guild_id, stats.member_channel_id, stats.days_channel_id, stats.roles_channel_id, stats.channels_channel_id, stats.welcome_channel_id, stats.welcome_title, stats.goodbye_channel_id, stats.goodbye_title],
      (err: any) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function getAllGuildStats(): Promise<GuildStats[]> {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM guilds', [], (err: any, rows: any) => {
      if (err) reject(err);
      else resolve(rows as GuildStats[]);
    });
  });
}

interface Session {
  token: string;
  user_id: string;
  device_id: string;
  created_at: number;
}

function getSession(token: string): Promise<Session | undefined> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM sessions WHERE token = ?', [token], (err: any, row: any) => {
      if (err) reject(err);
      else resolve(row as Session | undefined);
    });
  });
}

function setSession(session: Session): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO sessions (token, user_id, device_id, created_at) VALUES (?, ?, ?, ?)',
      [session.token, session.user_id, session.device_id, session.created_at],
      (err: any) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function deleteExpiredSessions(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Delete sessions older than 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    db.run('DELETE FROM sessions WHERE created_at < ?', [thirtyDaysAgo], (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getTicketSettings(guildId: string): Promise<TicketSettings | undefined> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM ticket_settings WHERE guild_id = ?', [guildId], (err: any, row: any) => {
      if (err) reject(err);
      else resolve(row as TicketSettings | undefined);
    });
  });
}

function setTicketSettings(settings: TicketSettings): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO ticket_settings (guild_id, ping_role_id, access_role_ids) VALUES (?, ?, ?)',
      [settings.guild_id, settings.ping_role_id, settings.access_role_ids],
      (err: any) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function createTicket(ticket: Ticket): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO tickets (guild_id, channel_id, user_id, created_at) VALUES (?, ?, ?, ?)',
      [ticket.guild_id, ticket.channel_id, ticket.user_id, ticket.created_at],
      function(this: any, err: any) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function getTicketByChannel(channelId: string): Promise<Ticket | undefined> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM tickets WHERE channel_id = ?', [channelId], (err: any, row: any) => {
      if (err) reject(err);
      else resolve(row as Ticket | undefined);
    });
  });
}

function deleteTicket(channelId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM tickets WHERE channel_id = ?', [channelId], (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getTicketsByGuild(guildId: string): Promise<Ticket[]> {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM tickets WHERE guild_id = ? ORDER BY created_at DESC', [guildId], (err: any, rows: any) => {
      if (err) reject(err);
      else resolve(rows as Ticket[]);
    });
  });
}

function createTicketMessage(message: TicketMessage): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO ticket_messages (ticket_id, message_id, author_id, author_username, content, created_at, edited_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [message.ticket_id, message.message_id, message.author_id, message.author_username, message.content, message.created_at, message.edited_at],
      function(this: any, err: any) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function getTicketMessages(ticketId: number): Promise<TicketMessage[]> {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC', [ticketId], (err: any, rows: any) => {
      if (err) reject(err);
      else resolve(rows as TicketMessage[]);
    });
  });
}

function updateTicketMessage(messageId: string, content: string, editedAt: number): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE ticket_messages SET content = ?, edited_at = ? WHERE message_id = ?',
      [content, editedAt, messageId],
      (err: any) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function deleteTicketMessage(messageId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM ticket_messages WHERE message_id = ?', [messageId], (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getFMUser(discordUserId: string): Promise<FMUser | undefined> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM fm_users WHERE discord_user_id = ?', [discordUserId], (err: any, row: any) => {
      if (err) reject(err);
      else resolve(row as FMUser | undefined);
    });
  });
}

function setFMUser(user: FMUser): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO fm_users (discord_user_id, lastfm_username, session_key) VALUES (?, ?, ?)',
      [user.discord_user_id, user.lastfm_username, user.session_key],
      (err: any) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

export {
  getGuildStats,
  setGuildStats,
  getAllGuildStats,
  getSession,
  setSession,
  deleteExpiredSessions,
  getTicketSettings,
  setTicketSettings,
  createTicket,
  getTicketByChannel,
  deleteTicket,
  getTicketsByGuild,
  createTicketMessage,
  getTicketMessages,
  updateTicketMessage,
  deleteTicketMessage,
  getFMUser,
  setFMUser,
};
