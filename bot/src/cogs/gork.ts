import { Client, CommandInteraction, Message, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, AttachmentBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { MessageDatabase } from './utils/database';
import { ContentFilter } from './utils/contentFilter';
import * as util from 'util';
import * as stackTrace from 'stack-trace';

// Mock MessageLogger interface for now
interface MessageLogger {
  db: MessageDatabase;
  log_user_message(message: Message): Promise<void>;
  log_bot_response(message: Message, sent_message: Message, content: string, processing_time_ms: number, model: string, chunk_info?: [number, number]): Promise<void>;
  log_user_message_from_interaction(interaction: any, message: string): Promise<void>;
  log_bot_response_from_interaction(interaction: any, sent_message: Message, content: string, processing_time_ms: number, model: string, chunk_info?: [number, number]): Promise<void>;
}

dotenv.config();

export class Gork {
  private client: Client;
  private openrouter_api_key: string;
  private openrouter_url: string;
  private model: string;
  private processing_messages: Set<string>;
  private recent_bot_messages: Map<string, Array<any>>;
  private last_cleanup: number;
  private message_logger: MessageLogger | null;
  private content_filter: ContentFilter | null;
  private safe_commands: Record<string, string>;
  private searchapi_key: string;
  private searchapi_url: string;
  private spotify_client: any;
  private spotify_client_id: string;
  private spotify_client_secret: string;
  private spotify_url_pattern: RegExp;
  private youtube_url_pattern: RegExp;
  private tool_patterns: Record<string, RegExp>;

  constructor(client: Client) {
    this.client = client;
    this.openrouter_api_key = process.env.OPENROUTER_API_KEY || '';
    this.openrouter_url = "https://openrouter.ai/api/v1/chat/completions";
    this.model = "google/gemini-2.5-flash";

    this.processing_messages = new Set();
    this.recent_bot_messages = new Map();
    this.last_cleanup = Date.now();

    this.message_logger = null;
    this.content_filter = null;

    this.safe_commands = {
      'fastfetch': 'fastfetch --stdout',
      'whoami': 'whoami',
      'pwd': 'pwd',
      'date': 'date',
      'uptime': 'uptime',
      'uname': 'uname -a',
      'df': 'df -h',
      'free': 'free -h',
      'lscpu': 'lscpu',
      'lsb_release': 'lsb_release -a',
      'hostnamectl': 'hostnamectl',
      'systemctl_status': 'systemctl --no-pager status',
      'ps': 'ps aux',
      'top': 'top -b -n1',
      'sensors': 'sensors',
      'lsblk': 'lsblk',
      'lsusb': 'lsusb',
      'lspci': 'lspci',
      'ip_addr': 'ip addr show',
      'netstat': 'netstat -tuln',
      'ss': 'ss -tuln'
    };

    this.searchapi_key = process.env.SEARCHAPI_KEY || '';
    this.searchapi_url = "https://www.searchapi.io/api/v1/search";

    this.spotify_client_id = process.env.SPOTIFY_CLIENT_ID || '';
    this.spotify_client_secret = process.env.SPOTIFY_CLIENT_SECRET || '';
    this.spotify_client = null;
    this.spotify_url_pattern = /https:\/\/open\.spotify\.com\/(track|album|artist|playlist)\/([a-zA-Z0-9]+)/;
    this.youtube_url_pattern = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

    this.tool_patterns = {
      'EXECUTE_COMMAND': /\*\*?EXECUTE_COMMAND:\*\*?(.+?)(?:\n|$)/gim,
      'GET_WEATHER': /\*\*?GET_WEATHER:\*\*?(.+?)(?:\n|$)/gim,
      'WEB_SEARCH': /\*\*?WEB_SEARCH:\*\*?(.+?)(?:\n|$)/gim,
      'VISIT_WEBSITE': /\*\*?VISIT_WEBSITE:\*\*?(.+?)(?:\n|$)/gim,
      'STEAM_SEARCH': /STEAM_SEARCH:?(.+?)(?:\n|$)/gim,
      'SPOTIFY_SEARCH': /\*\*?SPOTIFY_SEARCH:\*\*?(.+?)(?:\n|$)/gim,
      'STEAM_USER': /\*\*?STEAM_USER:\*\*?(.+?)(?:\n|$)/gim,
    };

    this.initialize();
  }

  private async initialize() {
    // Initialize Spotify client if credentials are available
    if (this.spotify_client_id && this.spotify_client_secret) {
      console.log("Spotify credentials found but client initialization skipped for compatibility");
    }

    // Initialize message logger and content filter
    // Note: These will be set when the client is ready and has the required properties
    
    // Set up process exit handler for logging dump
    process.on('exit', (code) => {
      this.dump_logs_on_exit(code);
    });

    process.on('uncaughtException', (error) => {
      this.dump_logs_on_exit(1, error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.dump_logs_on_exit(1, new Error(`Unhandled Rejection at: ${promise}, reason: ${reason}`));
      process.exit(1);
    });
  }

  private dump_logs_on_exit(exit_code: number, error?: Error): void {
    try {
      const timestamp = new Date().toISOString();
      const log_dir = path.join(__dirname, '../../logs');
      const log_file = path.join(log_dir, 'exit_logs.log');
      
      if (!fs.existsSync(log_dir)) {
        fs.mkdirSync(log_dir, { recursive: true });
      }

      const log_data = {
        timestamp,
        exit_code,
        error: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : null,
        processing_messages_count: this.processing_messages.size,
        recent_bot_messages_count: this.recent_bot_messages.size,
        memory_usage: process.memoryUsage(),
        uptime: process.uptime()
      };

      const log_line = `${timestamp} [EXIT] Exit code: ${exit_code}, Error: ${error ? error.message : 'None'}\n`;
      fs.appendFileSync(log_file, log_line);
      
      // Also write detailed JSON log
      const detailed_log_file = path.join(log_dir, 'exit_logs_detailed.json');
      fs.appendFileSync(detailed_log_file, JSON.stringify(log_data, null, 2) + '\n');
      
      console.log(`[GORK] Exit logs dumped to ${log_file}`);
      
    } catch (e) {
      console.error(`Failed to dump exit logs: ${e}`);
    }
  }

  private async extract_and_execute_tools(ai_response: string, channel_or_interaction: any, context: string): Promise<[Record<string, string>, string, boolean]> {
    const processed_response = ai_response;
    const tool_outputs: Record<string, string> = {};
    let current_response = processed_response;

    const tool_order = ['SPOTIFY_SEARCH', 'WEB_SEARCH', 'VISIT_WEBSITE', 'GET_WEATHER', 'EXECUTE_COMMAND'];

    for (const tool_name of tool_order) {
      const pattern = this.tool_patterns[tool_name];
      let match;

      while ((match = pattern.exec(current_response)) !== null) {
        const tool_call_text = match[0].trim();
        const arg_text = match[1].trim();

        try {
          let result = '';

          if (tool_name === 'EXECUTE_COMMAND') {
            result = await this.execute_safe_command(arg_text);
          } else if (tool_name === 'GET_WEATHER') {
            result = await this.get_weather(arg_text);
          } else if (tool_name === 'WEB_SEARCH') {
            result = await this.web_search(arg_text);
          } else if (tool_name === 'VISIT_WEBSITE') {
            result = await this.visit_website(arg_text);
          } else if (tool_name === 'SPOTIFY_SEARCH') {
            const embed = await this.search_spotify_song(arg_text);
            if (context === "channel") {
              await channel_or_interaction.reply({ embeds: [embed] });
            } else {
              await channel_or_interaction.followup({ embeds: [embed] });
            }
            result = `Spotify song search embed sent for '${arg_text}'`;
          }

          tool_outputs[tool_name] = result;
          current_response = current_response.replace(tool_call_text, "");

        } catch (e) {
          const traceback = this.format_python_traceback(e);
          console.log(`Error processing tool ${tool_name} with arg '${arg_text}': ${e}\n${traceback}`);
          
          // Trigger breakpoint for tool execution failures
          this.check_breakpoints('tool failed', {
            tool_name,
            arg_text,
            error: String(e),
            traceback
          });
          
          tool_outputs[tool_name] = `❌ Error executing ${tool_name}: ${String(e)}\n\`\`\`python\n${traceback}\n\`\`\``;
          current_response = current_response.replace(tool_call_text, "");
        }
      }
    }

    const tools_used = Object.keys(tool_outputs).length > 0;
    return [tool_outputs, current_response, tools_used];
  }

  private get_message_logger(): MessageLogger | null {
    // Try to get message logger from client if available
    if (this.client && (this.client as any).messageLogger) {
      this.message_logger = (this.client as any).messageLogger as MessageLogger;
    }
    return this.message_logger;
  }

  private get_content_filter(): ContentFilter | null {
    if (!this.content_filter) {
      const message_logger = this.get_message_logger();
      if (message_logger && message_logger.db) {
        this.content_filter = new ContentFilter();
      }
    }
    return this.content_filter;
  }

  private async check_and_delete_duplicate(message: Message, content: string): Promise<boolean> {
    const channel_id = message.channel.id;
    const content_hash = require('crypto').createHash('md5').update(content).digest('hex');
    const current_time = Date.now();

    if (this.recent_bot_messages.has(channel_id)) {
      const messages = this.recent_bot_messages.get(channel_id)!;
      this.recent_bot_messages.set(channel_id, messages.filter(([_, __, ___, ts]) => current_time - ts < 30000));
    }

    if (this.recent_bot_messages.has(channel_id)) {
      const messages = this.recent_bot_messages.get(channel_id)!;
      for (const [msg_obj, msg_content, msg_hash, ts] of messages) {
        if (msg_hash === content_hash && current_time - ts < 10000 && msg_obj.id !== message.id) {
          try {
            await message.delete();
            console.log(`Deleted duplicate message in channel ${channel_id}`);
            return true;
          } catch (e) {
            console.log(`Failed to delete duplicate message: ${e}`);
            return false;
          }
        }
      }
    }

    return false;
  }

  private async track_sent_message(message: Message, content: string): Promise<void> {
    const channel_id = message.channel.id;
    const content_hash = require('crypto').createHash('md5').update(content).digest('hex');
    const current_time = Date.now();

    if (!this.recent_bot_messages.has(channel_id)) {
      this.recent_bot_messages.set(channel_id, []);
    }

    const messages = this.recent_bot_messages.get(channel_id)!;
    messages.push([message, content, content_hash, current_time]);

    // Keep only last 10 messages and clean old ones
    if (messages.length > 10) {
      messages.splice(0, messages.length - 10);
    }

    this.recent_bot_messages.set(channel_id, messages.filter(([_, __, ___, ts]) => current_time - ts < 30000));
  }

  private async process_files(message: Message): Promise<any[]> {
    const content_parts: any[] = [];
    const text_extensions = new Set(['.txt', '.py', '.js', '.html', '.css', '.json', '.xml', '.md', '.yml', '.yaml', '.csv', '.sql', '.php', '.java', '.cpp', '.c', '.h', '.cs', '.rb', '.go', '.rs', '.ts', '.jsx', '.tsx', '.vue', '.svelte', '.sh', '.bat', '.ps1', '.dockerfile', '.gitignore', '.env', '.ini', '.cfg', '.conf', '.log']);
    const binary_extensions = new Set(['.bin']);
    const audio_video_extensions = new Set(['.mp3', '.wav', '.mp4']);
    const image_extensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg']);

    for (const attachment of message.attachments.values()) {
      try {
        const is_image_by_content_type = attachment.contentType?.startsWith('image/');
        const is_image_by_extension = image_extensions.has(path.extname(attachment.name).toLowerCase());

        if (is_image_by_content_type || is_image_by_extension) {
          if (attachment.size > 25 * 1024 * 1024) {
            content_parts.push({
              type: 'text',
              text: `🖼️ Image/GIF File: ${attachment.name}\nSize: ${(attachment.size / (1024*1024)).toFixed(1)} MB\n❌ File too large for processing (max 25MB)`
            });
            continue;
          }

          const response = await fetch(attachment.url);
          const image_data = await response.arrayBuffer();
          const base64_image = Buffer.from(image_data).toString('base64');
          const content_type = attachment.contentType || 'image/png';

          content_parts.push({
            type: 'image_url',
            image_url: {
              url: `data:${content_type};base64,${base64_image}`
            }
          });

          if (content_type === 'image/gif' || attachment.name.toLowerCase().endsWith('.gif')) {
            content_parts.push({
              type: 'text',
              text: `🎬 GIF file detected: ${attachment.name} (${(attachment.size / 1024).toFixed(1)} KB)\nNote: This is an animated GIF. I can analyze its visual content and frames.`
            });
          }
        } else if (text_extensions.has(path.extname(attachment.name).toLowerCase())) {
          const response = await fetch(attachment.url);
          let file_content = await response.text();

          if (file_content.length > 10000) {
            file_content = file_content.substring(0, 10000) + "\n... (file truncated due to size)";
          }

          content_parts.push({
            type: 'text',
            text: `File: ${attachment.name}\n\`\`\`\n${file_content}\n\`\`\``
          });
        } else if (binary_extensions.has(path.extname(attachment.name).toLowerCase())) {
          const response = await fetch(attachment.url);
          const binary_data = await response.arrayBuffer();
          const file_size = binary_data.byteLength;

          const hex_preview = Array.from(new Uint8Array(binary_data.slice(0, 256)))
            .map(b => b.toString(16).padStart(2, '0')).join(' ');
          const truncated = file_size > 256 ? ' ... (truncated)' : '';

          content_parts.push({
            type: 'text',
            text: `Binary File: ${attachment.name}\nSize: ${file_size} bytes\nHex Preview (first 256 bytes):\n\`\`\`\n${hex_preview}${truncated}\n\`\`\`\nNote: This is a binary file. I can analyze its structure, size, and hex data.`
          });
        } else if (audio_video_extensions.has(path.extname(attachment.name).toLowerCase())) {
          if (attachment.size > 50 * 1024 * 1024) {
            content_parts.push({
              type: 'text',
              text: `🎵 Audio/Video File: ${attachment.name}\nSize: ${(attachment.size / (1024*1024)).toFixed(1)} MB\n❌ File too large for transcription (max 50MB)`
            });
          } else {
            const transcription = await this.transcribe_audio(attachment.url, attachment.name);
            content_parts.push({
              type: 'text',
              text: transcription
            });
          }
        }
      } catch (e) {
        console.log(`Error processing attachment ${attachment.name}: ${e}`);
      }
    }

    return content_parts;
  }

  private async execute_safe_command(command_name: string): Promise<string> {
    if (!this.safe_commands[command_name]) {
      return `❌ Command '${command_name}' is not in the safe commands list. Available commands: ${Object.keys(this.safe_commands).join(', ')}`;
    }

    const command = this.safe_commands[command_name];

    try {
      const { spawn } = require('child_process');
      const process = spawn('cmd.exe', ['/c', command], { stdio: 'pipe' });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      await new Promise((resolve, reject) => {
        process.on('close', (code: number) => {
          if (code === 0) resolve(code);
          else reject(code);
        });
        process.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 30000);
      });

      if (!stdout && stderr) {
        stdout = stderr;
      }

      if (!stdout) {
        return `✅ Command '${command_name}' executed successfully but produced no output`;
      }

      if (stdout.length > 1800) {
        stdout = stdout.substring(0, 1800) + "\n... (output truncated)";
      }

      return `✅ Command '${command_name}' output:\n\`\`\`\n${stdout}\n\`\`\``;

    } catch (e) {
      return `❌ Error executing command '${command_name}': ${String(e)}`;
    }
  }

  private async web_search(query: string, num_results: number = 5): Promise<string> {
    if (!this.searchapi_key) {
      return "❌ Web Search is not configured. Please set SEARCHAPI_KEY environment variable.";
    }

    try {
      const params = new URLSearchParams({
        api_key: this.searchapi_key,
        q: query,
        engine: 'google',
        num: String(Math.min(num_results, 10))
      });

      const response = await fetch(`${this.searchapi_url}?${params}`);
      const data: any = await response.json();

      if (!data.organic_results || data.organic_results.length === 0) {
        return `🔍 No search results found for: ${query}`;
      }

      const results = data.organic_results.slice(0, num_results).map((item: any, i: number) => {
        const title = item.title || 'No title';
        const snippet = item.snippet || 'No description available';
        const truncated_snippet = snippet.length > 150 ? snippet.substring(0, 150) + "..." : snippet;
        return `**${i + 1}. ${title}**\n${truncated_snippet}`;
      });

      const total_results = data.search_information?.total_results || 'Unknown';
      const search_time = data.search_information?.time_taken_displayed || 'Unknown';

      return `🔍 **Web Search Results for:** ${query}\n📊 Found ${total_results} results in ${search_time}\n\n${results.join('\n\n')}`;

    } catch (e) {
      return `❌ Error performing web search: ${String(e)}`;
    }
  }

  private async search_spotify_song(query: string): Promise<EmbedBuilder> {
    if (!this.spotify_client) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Spotify Search Error")
        .setDescription("Spotify search is not configured. Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.")
        .setColor(0xff0000);
      return embed;
    }

    try {
      const results = await this.spotify_client.search({ q: query, type: 'track', limit: 1 });

      if (!results.tracks.items.length) {
        const embed = new EmbedBuilder()
          .setTitle("🎵 Spotify Song Search")
          .setDescription(`No songs found for: **${query}**`)
          .setColor(0xff0000);
        return embed;
      }

      const track = results.tracks.items[0];
      const track_name = track.name;
      const artists = track.artists.map((artist: any) => artist.name).join(', ');
      const album_name = track.album.name;
      const release_date = track.album.release_date;
      const duration_ms = track.duration_ms;
      const popularity = track.popularity;
      const explicit = track.explicit;

      const duration_seconds = Math.floor(duration_ms / 1000);
      const duration_minutes = Math.floor(duration_seconds / 60);
      const duration_formatted = `${duration_minutes}:${String(duration_seconds % 60).padStart(2, '0')}`;

      const album_image_url = track.album.images[0]?.url || '';
      const spotify_url = track.external_urls.spotify;
      const preview_url = track.preview_url || '';

      const embed = new EmbedBuilder()
        .setTitle(`🎵 ${track_name}`)
        .setDescription(`by **${artists}**`)
        .setColor(0x1db954)
        .setURL(spotify_url)
        .addFields(
          { name: "💿 Album", value: album_name, inline: true },
          { name: "📅 Release Date", value: release_date, inline: true },
          { name: "⏱️ Duration", value: duration_formatted, inline: true },
          { name: "📊 Popularity", value: `${popularity}/100`, inline: true },
          { name: "🔞 Explicit", value: explicit ? "Yes" : "No", inline: true }
        );

      if (preview_url) {
        embed.addFields({ name: "🎧 Preview", value: `[Listen Preview](${preview_url})`, inline: true });
      } else {
        embed.addFields({ name: "🎧 Preview", value: "Not available", inline: true });
      }

      if (album_image_url) {
        embed.setThumbnail(album_image_url);
      }

      embed.setFooter({ text: "Spotify", iconURL: "https://developer.spotify.com/assets/branding-guidelines/icon1@2x.png" });

      return embed;

    } catch (e) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Spotify Search Error")
        .setDescription(`Error searching Spotify: ${String(e)}`)
        .setColor(0xff0000);
      return embed;
    }
  }

  private async get_weather(location: string): Promise<string> {
    // Weather functionality would be implemented here
    // For now, return a placeholder
    return `🌤️ Weather data for ${location} is not currently available.`;
  }

  private async visit_website(url: string): Promise<string> {
    try {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        return `🌐 **Website:** ${url}\n❌ HTTP Error ${response.status}: ${response.statusText}`;
      }

      const content_type = response.headers.get('content-type') || '';
      const text_content = await response.text();

      if (content_type.includes('text/html')) {
        // Simple HTML parsing without jsdom dependency
        const titleMatch = text_content.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : "No title";
        
        // Remove common HTML tags and get text content
        const cleaned_text = text_content
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        const lines = cleaned_text.split('\n').map(line => line.trim()).filter(line => line.length > 3);
        const final_text = lines.join('\n').substring(0, 4000);

        return `🌐 **Website Content from:** ${url}\n📄 **Title:** ${title}\n\n**Content:**\n${final_text}`;
      } else if (content_type.includes('application/json')) {
        const json_content = JSON.parse(text_content);
        const json_str = JSON.stringify(json_content, null, 2);
        const truncated = json_str.length > 3000 ? json_str.substring(0, 3000) + "\n... (JSON truncated due to length)" : json_str;
        return `🌐 **JSON Content from:** ${url}\n\`\`\`json\n${truncated}\n\`\`\``;
      } else if (content_type.includes('text/plain')) {
        const truncated = text_content.length > 4000 ? text_content.substring(0, 4000) + "\n... (content truncated due to length)" : text_content;
        return `🌐 **Text Content from:** ${url}\n\`\`\`\n${truncated}\n\`\`\``;
      } else {
        return `🌐 **Website:** ${url}\n❌ Unsupported content type: ${content_type}\nThis appears to be a binary file or unsupported format.`;
      }

    } catch (e) {
      return `🌐 **Website:** ${url}\n❌ Error visiting website: ${String(e)}`;
    }
  }

  private async transcribe_audio(url: string, filename: string): Promise<string> {
    return `🎵 Audio file ${filename} processed but transcription is not available in this version.`;
  }

  private async call_ai(messages: any[], max_tokens: number = 1000): Promise<string> {
    if (!this.openrouter_api_key) {
      return "Error: OpenRouter API key not configured";
    }

    try {
      const response = await fetch(this.openrouter_url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openrouter_api_key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://discordbot.learnhelp.cc',
          'X-Title': 'Gork'
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          max_tokens: max_tokens,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const error_text = await response.text();
        return `Error: API request failed with status ${response.status}: ${error_text}`;
      }

      const data: any = await response.json();
      return data.choices[0].message.content;

    } catch (e) {
      return `Error: Failed to call AI API: ${String(e)}`;
    }
  }

  private async generate_random_message(channel_id: string): Promise<string | null> {
    try {
      const message_logger = this.get_message_logger();
      if (!message_logger || !message_logger.db) {
        return null;
      }

      const recent_messages = await message_logger.db.get_channel_messages(channel_id, 30);
      if (recent_messages.length < 5) {
        return null;
      }

      const messages_context = recent_messages.slice(-20).join('\n');
      const summary_prompt = `Analyze the following messages from a Discord user and create a concise personality/behavior summary. Focus on communication style, interests, languages used, personality traits, and how they interact with others. Keep the summary brief (2-3 sentences max) and objective.\n\nRecent messages:\n${messages_context}\n\nSummary:`;

      const summary_messages = [
        { role: "system", content: "You are an expert at analyzing communication patterns and creating brief, accurate personality summaries. Be concise and factual." },
        { role: "user", content: summary_prompt }
      ];

      const summary_text = await this.call_ai(summary_messages, 200);
      return summary_text && summary_text.trim().length > 10 ? summary_text.trim() : null;

    } catch (e) {
      console.log(`Error generating random message: ${e}`);
      return null;
    }
  }

  private async get_youtube_transcript(video_id: string): Promise<string> {
    try {
      const response = await fetch(`https://yt.lemnoslife.com/videos?part=transcript&id=${video_id}`);
      const data: any = await response.json();
      
      if (data.items[0]?.transcript?.tracks?.length > 0) {
        const transcript = data.items[0].transcript.tracks[0].segments;
        const formatted_transcript = transcript.map((segment: any) => {
          const start_seconds = Math.floor(segment.offsetMs / 1000);
          const hours = Math.floor(start_seconds / 3600);
          const minutes = Math.floor((start_seconds % 3600) / 60);
          const seconds = start_seconds % 60;
          const timestamp = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          return `[${timestamp}] ${segment.snippet}`;
        }).join('\n');
        
        return formatted_transcript;
      } else {
        return "No transcript found for this video.";
      }
    } catch (e) {
      return `Error fetching transcript: ${String(e)}`;
    }
  }

  public async on_message(message: Message): Promise<void> {
    console.log(`[Gork] Processing message from ${message.author.username} in ${message.channel.type === ChannelType.DM ? 'DM' : 'channel'}`);
    
    if (message.author.bot) {
      console.log(`[Gork] Message is from bot, checking duplicate`);
      await this.check_and_delete_duplicate(message, message.content);
      return;
    }

    const is_dm = message.channel.type === ChannelType.DM;
    const is_mentioned = this.client.user && message.mentions.users.has(this.client.user.id);
    const contains_at_gork = message.content.toLowerCase().includes('@gork');

    console.log(`[Gork] is_dm: ${is_dm}, is_mentioned: ${is_mentioned}, contains_at_gork: ${contains_at_gork}`);

    if (!is_mentioned && !is_dm && !contains_at_gork) {
      console.log(`[Gork] Message doesn't meet criteria, ignoring`);
      return;
    }

    const message_id = `${message.channel.id}_${message.id}`;
    if (this.processing_messages.has(message_id)) {
      console.log(`[Gork] Message already being processed, ignoring`);
      return;
    }

    this.processing_messages.add(message_id);
    console.log(`[Gork] Added message to processing queue: ${message_id}`);

    try {
      const processing_start_time = Date.now();
      const context_type = is_dm ? "DM" : "Discord server";

      const safe_commands_list = Object.keys(this.safe_commands).join(', ');
      const web_search_status = this.searchapi_key ? "enabled" : "disabled";
      const weather_status = "disabled";
      const spotify_search_status = this.spotify_client ? "enabled" : "disabled";

      let system_content = `You are C₁₈H₂₄O₂, a helpful AI assistant on Discord. You are currently chatting in a ${context_type}. You are friendly, knowledgeable, and concise in your responses. You can see and analyze images (including static images and animated GIFs), read and analyze text files (including .txt, .py, .js, .html, .css, .json, .md, and many other file types), and listen to and transcribe audio/video files (.mp3, .wav, .mp4) that users send. \n\nYou can also execute safe system commands to gather server information. When a user asks for system information, you can use the following format to execute commands:\n\n**EXECUTE_COMMAND:** command_name\n\nAvailable safe commands: ${safe_commands_list}\n\nFor example, if someone asks about system info, you can respond with:\n**EXECUTE_COMMAND:** fastfetch\n\nWhen you execute any command, analyze and summarize the output in a user-friendly way, highlighting key details. Don't just show the raw output - provide a nice summary.`;


      if (web_search_status === "enabled") {
        system_content += `\n\nYou can also perform web searches when users ask for information that requires current/real-time data or information you don't have. Use this format:\n\n**WEB_SEARCH:** search query\n\nFor example, if someone asks about current events, news, stock prices, or recent information, use web search to find up-to-date information.`;

        system_content += `\n\nYou can also visit specific websites to read their content. Use this format:\n\n**VISIT_WEBSITE:** url\n\nFor example, if someone asks 'What does this website say?' or provides a URL, you can respond with:\n**VISIT_WEBSITE:** https://example.com\n\nWhen you visit a website, analyze and summarize the content in a user-friendly way, highlighting key information. Don't just show the raw content - provide a nice summary.`;
      }

      if (spotify_search_status === "enabled") {
        system_content += `\n\nYou can search for songs on Spotify when users ask about music, songs, artists, or want to find specific tracks. ALWAYS use this format when users mention song titles, artists, or ask about music:\n\n**SPOTIFY_SEARCH:** song or artist name\n\nFor example:\n- User: 'Find Bohemian Rhapsody by Queen' → You respond: **SPOTIFY_SEARCH:** Bohemian Rhapsody Queen\n- User: 'Search for Blinding Lights' → You respond: **SPOTIFY_SEARCH:** Blinding Lights\n- User: 'Show me songs by Taylor Swift' → You respond: **SPOTIFY_SEARCH:** Taylor Swift\n- User: 'What about that song Shape of You?' → You respond: **SPOTIFY_SEARCH:** Shape of You\n\nThis will return detailed song information including artist, album, duration, popularity, release date, album cover, and a link to listen on Spotify.`;
      }

      system_content += "\n\nKeep responses under 2000 characters to fit Discord's message limit.";

      const messages = [{ role: "system", content: system_content }];

      // Add conversation context
      const message_logger = this.get_message_logger();
      if (message_logger && message_logger.db) {
        try {
          const conversation_context = await message_logger.db.get_conversation_context(message.author.id, 10);
          for (const ctx_msg of conversation_context) {
            if (ctx_msg.role === "user") {
              let content = ctx_msg.content;
              if (ctx_msg.has_attachments) {
                content += " [user sent files/images]";
              }
              messages.push({ role: "user", content });
            } else if (ctx_msg.role === "assistant") {
              messages.push({ role: "assistant", content: ctx_msg.content });
            }
          }
        } catch (e) {
          console.log(`Warning: Could not load conversation context: ${e}`);
        }
      }

      // Handle replied messages
      let replied_content = "";
      if (message.reference && message.reference.messageId) {
        try {
          const replied_message = await message.channel.messages.fetch(message.reference.messageId);
          replied_content = `\n\nContext (message being replied to):\nFrom ${replied_message.author.username}: ${replied_message.content}`;
        } catch {
          replied_content = "";
        }
      }

      // Process user content
      let user_content = message.content.replace(this.client.user ? `<@${this.client.user.id}>` : '', '').trim();
      if (contains_at_gork) {
        user_content = user_content.replace('@gork', '').trim();
      }
      if (is_dm && !user_content) {
        user_content = message.content.trim();
      }
      if (replied_content) {
        user_content += replied_content;
      }

      // Process files
      const file_contents = await this.process_files(message);

      if (file_contents.length > 0) {
        const content_parts = [{ type: "text", text: user_content || "Please analyze the attached files/images." }];
        content_parts.push(...file_contents);
        messages.push({ role: "user", content: content_parts.join('\n') });
      } else {
        messages.push({ role: "user", content: user_content });
      }

      // Send typing indicator if available
      if ('sendTyping' in message.channel && typeof message.channel.sendTyping === 'function') {
        await message.channel.sendTyping();
      }

      const ai_response = await this.call_ai(messages);
      const [tool_outputs, initial_response, tools_used] = await this.extract_and_execute_tools(ai_response, message, "channel");

      let final_response = initial_response;
      if (tool_outputs && Object.keys(tool_outputs).length > 0) {
        const tool_outputs_text = Object.entries(tool_outputs).map(([tool, output]) => `${tool}: ${output}`).join('\n');
        
        const second_messages = [
          { role: "system", content: "You are an AI assistant processing tool outputs. Analyze and summarize the tool results in the context of the user's original request." },
          { role: "user", content: `Original user message: ${user_content}\n\nTool outputs:\n${tool_outputs_text}\n\nPlease summarize what these tool results mean in the context of the user's request.` }
        ];

        const processed_tool_summary = await this.call_ai(second_messages, 1000);

        const third_messages = [
          { role: "system", content: "You are an AI assistant combining initial analysis with tool results. Create a coherent final response." },
          { role: "user", content: `Initial AI response: ${initial_response}\n\nProcessed tool summary: ${processed_tool_summary}\n\nCombine these into a final, coherent response to the user.` }
        ];

        final_response = await this.call_ai(third_messages, 1500);
      }

      const processing_time_ms = Date.now() - processing_start_time;

      if (!final_response || !final_response.trim()) {
        final_response = "❌ I received an empty response from the AI. Please try again.";
      }

      // Handle content filtering
      const content_filter = this.get_content_filter();
      if (content_filter) {
        try {
          const user_content_settings = await content_filter.get_user_content_settings(message.author.id);
          const content_warning = content_filter.get_content_warning_message(user_content_settings);
          if (content_warning) {
            final_response = content_warning + final_response;
          }
        } catch (e) {
          console.log(`Error adding content warning: ${e}`);
        }
      }

      if (final_response.trim()) {
        if (final_response.length > 2000) {
          const chunks = [];
          for (let i = 0; i < final_response.length; i += 2000) {
            chunks.push(final_response.substring(i, i + 2000));
          }
          
          for (let i = 0; i < chunks.length; i++) {
            const sent_message = await message.reply(chunks[i]);
            await this.track_sent_message(sent_message, chunks[i]);
            
            if (message_logger) {
              message_logger.log_bot_response(message, sent_message, chunks[i], processing_time_ms, this.model, [chunks.length, i + 1]);
            }
          }
          
          if (tools_used) {
            await this.cleanup_tool_messages(message.channel.id);
          }
        } else {
          const sent_message = await message.reply(final_response);
          await this.track_sent_message(sent_message, final_response);
          
          if (message_logger) {
            message_logger.log_bot_response(message, sent_message, final_response, processing_time_ms, this.model);
          }
          
          if (tools_used) {
            await this.cleanup_tool_messages(message.channel.id);
          }
        }
      }

    } catch (e) {
      // Trigger breakpoint for major errors
      this.check_breakpoints('error', {
        error: String(e),
        stack: (e as Error).stack,
        message_id,
        user_id: message.author.id,
        channel_id: message.channel.id
      });
      
      console.error(`Error in on_message handler: ${e}`);
      try {
        await message.reply(`❌ Sorry, I encountered an error while processing your message: ${String(e)}`);
      } catch (reply_error) {
        console.log(`Failed to send error message: ${reply_error}`);
      }
    } finally {
      this.processing_messages.delete(message_id);
      
      const current_time = Date.now();
      if (current_time - this.last_cleanup > 300000) {
        this.processing_messages.clear();
        this.last_cleanup = current_time;
      }
    }
  }

  private format_python_traceback(error: any): string {
    try {
      const stack = stackTrace.parse(error);
      const lines: string[] = [];
      
      lines.push(`Traceback (most recent call last):`);
      
      // Add stack frames in reverse order (oldest first)
      for (let i = stack.length - 1; i >= 0; i--) {
        const frame = stack[i];
        const filename = frame.getFileName() || '<unknown>';
        const lineno = frame.getLineNumber() || 0;
        const function_name = frame.getFunctionName() || '<module>';
        
        lines.push(`  File "${filename}", line ${lineno}, in ${function_name}`);
        
        // Try to get source code context
        try {
          const source_line = frame.getLineNumber() ? 
            this.get_source_line(filename, frame.getLineNumber()) : 
            '    <source unavailable>';
          if (source_line && source_line.trim()) {
            lines.push(`    ${source_line}`);
          }
        } catch (e) {
          // Ignore source reading errors
        }
      }
      
      // Add the actual error message
      lines.push(`${error.constructor.name}: ${error.message || String(error)}`);
      
      return lines.join('\n');
    } catch (e) {
      // Fallback to simple error formatting
      return `Traceback (most recent call last):\n${error.stack || String(error)}`;
    }
  }

  private get_source_line(filename: string, line_number: number): string | null {
    try {
      if (!filename || !fs.existsSync(filename)) {
        return null;
      }
      
      const content = fs.readFileSync(filename, 'utf8');
      const lines = content.split('\n');
      
      if (line_number > 0 && line_number <= lines.length) {
        return lines[line_number - 1].trim();
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }

  private async cleanup_tool_messages(channel_id: string): Promise<void> {
    // Clean up previous messages that contain tool calls
    const current_time = Date.now();
    
    if (this.recent_bot_messages.has(channel_id)) {
      const messages = this.recent_bot_messages.get(channel_id)!;
      
      for (const [msg_obj, msg_content, msg_hash, ts] of messages) {
        if (current_time - ts > 60000) {
          continue;
        }

        for (const tool_name of Object.keys(this.tool_patterns)) {
          if (this.tool_patterns[tool_name].test(msg_content)) {
            try {
              await msg_obj.delete();
              console.log(`Deleted tool call message: ${msg_content.substring(0, 50)}...`);
            } catch (e) {
              console.log(`Failed to delete tool message: ${e}`);
            }
            break;
          }
        }
      }
    }
  }

  // Breakpoint functionality for debugging
  private debug_breakpoint(label: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const log_entry = {
      timestamp,
      label,
      data: data ? JSON.stringify(data, null, 2) : undefined,
      stack: new Error().stack
    };

    // Write to debug log file
    const log_file = path.join(__dirname, '../../logs', 'debug_breakpoints.log');
    const log_dir = path.dirname(log_file);
    
    try {
      if (!fs.existsSync(log_dir)) {
        fs.mkdirSync(log_dir, { recursive: true });
      }
      
      const log_line = `${timestamp} [BREAKPOINT] ${label}${data ? `: ${JSON.stringify(data)}` : ''}\n`;
      fs.appendFileSync(log_file, log_line);
    } catch (e) {
      console.error(`Failed to write breakpoint log: ${e}`);
    }

    // Also log to console for immediate visibility
    console.log(`[BREAKPOINT] ${label}${data ? `: ${JSON.stringify(data)}` : ''}`);
  }

  // Method to trigger breakpoints based on conditions
  private check_breakpoints(condition: string, data?: any): void {
    // Check for specific error conditions that should trigger breakpoints
    if (condition.includes('error') || condition.includes('fail') || condition.includes('exception')) {
      this.debug_breakpoint(`Error condition detected: ${condition}`, data);
    }
    
    // Check for specific tool execution failures
    if (condition.includes('tool') && condition.includes('failed')) {
      this.debug_breakpoint(`Tool execution failed: ${condition}`, data);
    }
    
    // Check for API failures
    if (condition.includes('api') && condition.includes('fail')) {
      this.debug_breakpoint(`API failure: ${condition}`, data);
    }
  }
}
