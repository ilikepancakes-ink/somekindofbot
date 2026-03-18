import { Client, Events, GuildMember } from 'discord.js';
import { AutoModerationEvent } from './autoModeration';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
    console.log(`Ready! Logged in as ${client.user?.tag}`);

    // Initialize auto moderation event handler
    const autoModerationEvent = new AutoModerationEvent();
    await autoModerationEvent.init();

    // Set up message create event listener
    client.on(Events.MessageCreate, async (message) => {
      await autoModerationEvent.handleMessageCreate(message);
    });

    // Set up member update event listener
    client.on(Events.GuildMemberUpdate, async (oldMember: GuildMember | any, newMember: GuildMember) => {
      await autoModerationEvent.handleMemberUpdate(oldMember, newMember);
    });
  },
};