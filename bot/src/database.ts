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

interface GuildStats {
  guild_id: string;
  member_channel_id?: string;
  days_channel_id?: string;
  roles_channel_id?: string;
  channels_channel_id?: string;
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
      'INSERT OR REPLACE INTO guilds (guild_id, member_channel_id, days_channel_id, roles_channel_id, channels_channel_id) VALUES (?, ?, ?, ?, ?)',
      [stats.guild_id, stats.member_channel_id, stats.days_channel_id, stats.roles_channel_id, stats.channels_channel_id],
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

module.exports = {
  getGuildStats,
  setGuildStats,
  getAllGuildStats,
};
