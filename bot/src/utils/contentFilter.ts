import { MessageDatabase } from './database';

export interface ContentSettings {
  nsfw_mode: boolean;
  nsfw_warning: string;
}

export class ContentFilter {
  private db: MessageDatabase;

  constructor(db: MessageDatabase) {
    this.db = db;
  }

  async get_user_content_settings(user_id: string): Promise<ContentSettings> {
    try {
      const settings = await this.db.get_user_content_settings(user_id);
      return settings || {
        nsfw_mode: false,
        nsfw_warning: ""
      };
    } catch (e) {
      console.log(`Error getting content settings for user ${user_id}: ${e}`);
      return {
        nsfw_mode: false,
        nsfw_warning: ""
      };
    }
  }

  get_system_prompt_addition(settings: ContentSettings): string {
    if (settings.nsfw_mode) {
      return "\n\nIMPORTANT: This user has NSFW mode enabled. You may generate NSFW content when requested.";
    }
    return "";
  }

  get_content_warning_message(settings: ContentSettings): string {
    if (settings.nsfw_mode && settings.nsfw_warning) {
      return `${settings.nsfw_warning}\n\n`;
    }
    return "";
  }
}