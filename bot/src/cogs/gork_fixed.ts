import { Client, Message, EmbedBuilder, ChannelType } from 'discord.js';
import * as dotenv from 'dotenv';

dotenv.config();

export class Gork {
  private client: Client;
  private openrouter_api_key: string;
  private openrouter_url: string;
  private model: string;
  private processing_messages: Set<string>;
  private recent_bot_messages: Map<string, Array<any>>;
  private last_cleanup: number;
  private safe_commands: Record<string, string>;
  private searchapi_key: string;
  private searchapi_url: string;
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
    this.spotify_url_pattern = /https:\/\/open\.spotify\.com\/(track|album|artist|playlist)\/([a-zA-Z0-9]+)/;
    this.youtube_url_pattern = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

    this.tool_patterns = {
      'EXECUTE_COMMAND': /\*\*?EXECUTE_COMMAND:\*\*?(.+?)(?:\n|$)/gim,
      'GET_WEATHER': /\*\*?GET_WEATHER:\*\*?(.+?)(?:\n|$)/gim,
      'WEB_SEARCH': /\*\*?WEB_SEARCH:\*\*?(.+?)(?:\n|$)/gim,
      'VISIT_WEBSITE': /\*\*?VISIT_WEBSITE:\*\*?(.+?)(?:\n|$)/gim,
      'SPOTIFY_SEARCH': /\*\*?SPOTIFY_SEARCH:\*\*?(.+?)(?:\n|$)/gim,
    };

    this.initialize();
  }

  private async initialize() {
    console.log("Gork AI assistant initialized");
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
          console.log(`Error processing tool ${tool_name} with arg '${arg_text}': ${e}`);
          tool_outputs[tool_name] = `❌ Error executing ${tool_name}: ${String(e)}`;
          current_response = current_response.replace(tool_call_text, "");
        }
      }
    }

    const tools_used = Object.keys(tool_outputs).length > 0;
    return [tool_outputs, current_response, tools_used];
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

    for (const attachment of message.attachments.values()) {
      try {
        const is_image_by_content_type = attachment.contentType?.startsWith('image/');
        const is_image_by_extension = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg'].includes(attachment.name.toLowerCase().substring(attachment.name.lastIndexOf('.')));

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
        } else {
          content_parts.push({
            type: 'text',
            text: `📁 File: ${attachment.name}\nSize: ${(attachment.size / 1024).toFixed(1)} KB\nNote: File analysis is limited in this version.`
          });
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
    const embed = new EmbedBuilder()
      .setTitle("❌ Spotify Search Error")
      .setDescription("Spotify search is not configured. Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.")
      .setColor(0xff0000);
    return embed;
  }

  private async get_weather(location: string): Promise<string> {
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
        const titleMatch = text_content.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : "No title";
        
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

  public async on_message(message: Message): Promise<void> {
    if (message.author.bot) {
      await this.check_and_delete_duplicate(message, message.content);
      return;
    }

    const is_dm = message.channel.type === ChannelType.DM;
    const is_mentioned = this.client.user && message.mentions.users.has(this.client.user.id);
    const contains_at_gork = message.content.toLowerCase().includes('@gork');

    if (!is_mentioned && !is_dm && !contains_at_gork) {
      return;
    }

    const message_id = `${message.channel.id}_${message.id}`;
    if (this.processing_messages.has(message_id)) {
      return;
    }

    this.processing_messages.add(message_id);

    try {
      const processing_start_time = Date.now();
      const context_type = is_dm ? "DM" : "Discord server";

      const safe_commands_list = Object.keys(this.safe_commands).join(', ');
      const web_search_status = this.searchapi_key ? "enabled" : "disabled";

      let system_content = `You are Gork, a helpful AI assistant on Discord. You are currently chatting in a ${context_type}. You are friendly, knowledgeable, and concise in your responses. You can see and analyze images (including static images and animated GIFs), read and analyze text files, and listen to and transcribe audio/video files that users send. \n\nYou can also execute safe system commands to gather server information. When a user asks for system information, you can use the following format to execute commands:\n\n**EXECUTE_COMMAND:** command_name\n\nAvailable safe commands: ${safe_commands_list}\n\nFor example, if someone asks about system info, you can respond with:\n**EXECUTE_COMMAND:** fastfetch\n\nWhen you execute any command, analyze and summarize the output in a user-friendly way, highlighting key details. Don't just show the raw output - provide a nice summary.`;

      if (web_search_status === "enabled") {
        system_content += `\n\nYou can also perform web searches when users ask for information that requires current/real-time data or information you don't have. Use this format:\n\n**WEB_SEARCH:** search query\n\nFor example, if someone asks about current events, news, stock prices, or recent information, use web search to find up-to-date information.`;

        system_content += `\n\nYou can also visit specific websites to read their content. Use this format:\n\n**VISIT_WEBSITE:** url\n\nFor example, if someone asks 'What does this website say?' or provides a URL, you can respond with:\n**VISIT_WEBSITE:** https://example.com\n\nWhen you visit a website, analyze and summarize the content in a user-friendly way, highlighting key information. Don't just show the raw content - provide a nice summary.`;
      }

      system_content += "\n\nKeep responses under 2000 characters to fit Discord's message limit.";

      const messages = [{ role: "system", content: system_content }];

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

      if (final_response.trim()) {
        if (final_response.length > 2000) {
          const chunks = [];
          for (let i = 0; i < final_response.length; i += 2000) {
            chunks.push(final_response.substring(i, i + 2000));
          }
          
          for (let i = 0; i < chunks.length; i++) {
            const sent_message = await message.reply(chunks[i]);
            await this.track_sent_message(sent_message, chunks[i]);
          }
          
          if (tools_used) {
            await this.cleanup_tool_messages(message.channel.id);
          }
        } else {
          const sent_message = await message.reply(final_response);
          await this.track_sent_message(sent_message, final_response);
          
          if (tools_used) {
            await this.cleanup_tool_messages(message.channel.id);
          }
        }
      }

    } catch (e) {
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

  private async cleanup_tool_messages(channel_id: string): Promise<void> {
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
}