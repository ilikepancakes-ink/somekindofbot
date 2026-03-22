import * as sqlite3 from 'sqlite3';

export class MessageDatabase {
  private db: sqlite3.Database | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database('./data/bot.db', (err) => {
        if (err) {
          reject(err);
        } else {
          this.db!.run(`
            CREATE TABLE IF NOT EXISTS messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT NOT NULL,
              channel_id TEXT NOT NULL,
              content TEXT NOT NULL,
              timestamp INTEGER NOT NULL,
              role TEXT NOT NULL,
              has_attachments BOOLEAN DEFAULT 0
            )
          `, (err) => {
            if (err) {
              reject(err);
            } else {
              this.db!.run(`
                CREATE TABLE IF NOT EXISTS conversation_context (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id TEXT NOT NULL,
                  content TEXT NOT NULL,
                  role TEXT NOT NULL,
                  has_attachments BOOLEAN DEFAULT 0,
                  timestamp INTEGER NOT NULL
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
        }
      });
    });
  }

  async log_user_message(message: any): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.run(
        'INSERT INTO messages (user_id, channel_id, content, timestamp, role, has_attachments) VALUES (?, ?, ?, ?, ?, ?)',
        [message.author.id, message.channel.id, message.content, Date.now(), 'user', message.attachments.size > 0 ? 1 : 0],
        (err) => {
          if (err) {
            reject(err);
          } else {
            this.db!.run(
              'INSERT INTO conversation_context (user_id, content, role, has_attachments, timestamp) VALUES (?, ?, ?, ?, ?)',
              [message.author.id, message.content, 'user', message.attachments.size > 0 ? 1 : 0, Date.now()],
              (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              }
            );
          }
        }
      );
    });
  }

  async log_bot_response(message: any, sent_message: any, content: string, processing_time_ms: number, model: string, chunk_info?: [number, number]): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.run(
        'INSERT INTO messages (user_id, channel_id, content, timestamp, role, has_attachments) VALUES (?, ?, ?, ?, ?, ?)',
        [sent_message.author.id, message.channel.id, content, Date.now(), 'assistant', 0],
        (err) => {
          if (err) {
            reject(err);
          } else {
            this.db!.run(
              'INSERT INTO conversation_context (user_id, content, role, has_attachments, timestamp) VALUES (?, ?, ?, ?, ?)',
              [sent_message.author.id, content, 'assistant', 0, Date.now()],
              (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              }
            );
          }
        }
      );
    });
  }

  async log_user_message_from_interaction(interaction: any, message: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.run(
        'INSERT INTO messages (user_id, channel_id, content, timestamp, role, has_attachments) VALUES (?, ?, ?, ?, ?, ?)',
        [interaction.user.id, interaction.channel.id, message, Date.now(), 'user', 0],
        (err) => {
          if (err) {
            reject(err);
          } else {
            this.db!.run(
              'INSERT INTO conversation_context (user_id, content, role, has_attachments, timestamp) VALUES (?, ?, ?, ?, ?)',
              [interaction.user.id, message, 'user', 0, Date.now()],
              (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              }
            );
          }
        }
      );
    });
  }

  async log_bot_response_from_interaction(interaction: any, sent_message: any, content: string, processing_time_ms: number, model: string, chunk_info?: [number, number]): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.run(
        'INSERT INTO messages (user_id, channel_id, content, timestamp, role, has_attachments) VALUES (?, ?, ?, ?, ?, ?)',
        [sent_message.author.id, interaction.channel.id, content, Date.now(), 'assistant', 0],
        (err) => {
          if (err) {
            reject(err);
          } else {
            this.db!.run(
              'INSERT INTO conversation_context (user_id, content, role, has_attachments, timestamp) VALUES (?, ?, ?, ?, ?)',
              [sent_message.author.id, content, 'assistant', 0, Date.now()],
              (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              }
            );
          }
        }
      );
    });
  }

  async get_conversation_context(user_id: string, limit: number = 10): Promise<Array<{ role: string; content: string; has_attachments: boolean }>> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT role, content, has_attachments FROM conversation_context WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
        [user_id, limit],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => ({
              role: row.role,
              content: row.content,
              has_attachments: Boolean(row.has_attachments)
            })));
          }
        }
      );
    });
  }

  async get_channel_messages(channel_id: string, limit: number = 30): Promise<string[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT content FROM messages WHERE channel_id = ? ORDER BY timestamp DESC LIMIT ?',
        [channel_id, limit],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => row.content));
          }
        }
      );
    });
  }
}