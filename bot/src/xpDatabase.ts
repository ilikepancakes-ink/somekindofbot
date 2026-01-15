const sqlite3 = require('sqlite3');

const xpDb = new sqlite3.Database('xp.db');

// Create tables if not exist
xpDb.run(`
  CREATE TABLE IF NOT EXISTS xp_settings (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0
  )
`);

xpDb.run(`
  CREATE TABLE IF NOT EXISTS xp_users (
    guild_id TEXT,
    user_id TEXT,
    xp INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  )
`);

xpDb.run(`
  CREATE TABLE IF NOT EXISTS xp_levels (
    guild_id TEXT,
    level INTEGER,
    role_id TEXT,
    PRIMARY KEY (guild_id, level)
  )
`);

interface XPSettings {
  guild_id: string;
  enabled: number;
}

interface XPUser {
  guild_id: string;
  user_id: string;
  xp: number;
}

interface XPLevel {
  guild_id: string;
  level: number;
  role_id: string;
}

function getXPSettings(guildId: string): Promise<XPSettings | undefined> {
  return new Promise((resolve, reject) => {
    xpDb.get('SELECT * FROM xp_settings WHERE guild_id = ?', [guildId], (err: any, row: any) => {
      if (err) reject(err);
      else resolve(row as XPSettings | undefined);
    });
  });
}

function setXPSettings(settings: XPSettings): Promise<void> {
  return new Promise((resolve, reject) => {
    xpDb.run(
      'INSERT OR REPLACE INTO xp_settings (guild_id, enabled) VALUES (?, ?)',
      [settings.guild_id, settings.enabled],
      (err: any) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function getXPUser(guildId: string, userId: string): Promise<XPUser | undefined> {
  return new Promise((resolve, reject) => {
    xpDb.get('SELECT * FROM xp_users WHERE guild_id = ? AND user_id = ?', [guildId, userId], (err: any, row: any) => {
      if (err) reject(err);
      else resolve(row as XPUser | undefined);
    });
  });
}

function setXPUser(user: XPUser): Promise<void> {
  return new Promise((resolve, reject) => {
    xpDb.run(
      'INSERT OR REPLACE INTO xp_users (guild_id, user_id, xp) VALUES (?, ?, ?)',
      [user.guild_id, user.user_id, user.xp],
      (err: any) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function addXP(guildId: string, userId: string, xpToAdd: number): Promise<void> {
  return new Promise((resolve, reject) => {
    xpDb.run(
      'INSERT INTO xp_users (guild_id, user_id, xp) VALUES (?, ?, ?) ON CONFLICT(guild_id, user_id) DO UPDATE SET xp = xp + ?',
      [guildId, userId, xpToAdd, xpToAdd],
      (err: any) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function getTopXPUsers(guildId: string, limit: number = 10): Promise<XPUser[]> {
  return new Promise((resolve, reject) => {
    xpDb.all('SELECT * FROM xp_users WHERE guild_id = ? ORDER BY xp DESC LIMIT ?', [guildId, limit], (err: any, rows: any) => {
      if (err) reject(err);
      else resolve(rows as XPUser[]);
    });
  });
}

function getXPLevel(guildId: string, level: number): Promise<XPLevel | undefined> {
  return new Promise((resolve, reject) => {
    xpDb.get('SELECT * FROM xp_levels WHERE guild_id = ? AND level = ?', [guildId, level], (err: any, row: any) => {
      if (err) reject(err);
      else resolve(row as XPLevel | undefined);
    });
  });
}

function setXPLevel(level: XPLevel): Promise<void> {
  return new Promise((resolve, reject) => {
    xpDb.run(
      'INSERT OR REPLACE INTO xp_levels (guild_id, level, role_id) VALUES (?, ?, ?)',
      [level.guild_id, level.level, level.role_id],
      (err: any) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function getAllXPLevels(guildId: string): Promise<XPLevel[]> {
  return new Promise((resolve, reject) => {
    xpDb.all('SELECT * FROM xp_levels WHERE guild_id = ? ORDER BY level ASC', [guildId], (err: any, rows: any) => {
      if (err) reject(err);
      else resolve(rows as XPLevel[]);
    });
  });
}

function deleteXPLevel(guildId: string, level: number): Promise<void> {
  return new Promise((resolve, reject) => {
    xpDb.run('DELETE FROM xp_levels WHERE guild_id = ? AND level = ?', [guildId, level], (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export {
  getXPSettings,
  setXPSettings,
  getXPUser,
  setXPUser,
  addXP,
  getTopXPUsers,
  getXPLevel,
  setXPLevel,
  getAllXPLevels,
  deleteXPLevel,
};
