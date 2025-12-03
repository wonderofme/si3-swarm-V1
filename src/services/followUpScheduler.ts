import { IAgentRuntime } from '@elizaos/core';
import { TelegramClientInterface } from '@elizaos/client-telegram';
import { getDueFollowUps, markFollowUpSent } from './matchTracker.js';

async function process3DayCheckIn(followUp: any, runtime: IAgentRuntime) {
  // Send: "Were you able to connect yet?"
  console.log(`Processing 3-day check-in for user ${followUp.userId} (Match ${followUp.matchId})`);
  
  try {
    // We need to send a message via Telegram.
    // We use the roomId stored in the match (which is the chat ID)
    const adapter = runtime.databaseAdapter as any;
    const matchRes = await adapter.query(`SELECT room_id, matched_user_id FROM matches WHERE id = $1`, [followUp.matchId]);
    const match = matchRes.rows[0];
    
    if (!match || !match.room_id) {
      console.error('No room ID found for match');
      return;
    }

    // Get matched user name for context
    // (Optional, but nice)
    
    const message = "Hola! 👋 It's been 3 days since your match. Were you able to connect yet? (Reply with 'Yes', 'No', or 'Not interested')";
    
    await runtime.messageManager.createMemory({
        id: undefined,
        userId: runtime.agentId,
        agentId: runtime.agentId,
        roomId: match.room_id,
        content: { text: message, source: 'telegram' }
    });

    // Actually send via Telegram Client if possible
    // Since we don't have direct access to the client instance here easily unless we stored it,
    // we rely on the fact that runtime might have it or we use the API.
    // ElizaOS v0.1: The client usually listens to memories? No, we need to actively send.
    // We can use a custom event or just use the Telegram bot API directly since we have the token.
    
    if (process.env.TELEGRAM_BOT_TOKEN) {
        const Telegraf = (await import('telegraf')).Telegraf;
        const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
        await bot.telegram.sendMessage(match.room_id, message);
    }

    await markFollowUpSent(runtime, followUp.id);
  } catch (error) {
    console.error('Error sending 3-day check-in:', error);
  }
}

async function process7DayNextMatch(followUp: any, runtime: IAgentRuntime) {
  // Send: "I've found you another match!"
  console.log(`Processing 7-day next match for user ${followUp.userId}`);
  
  try {
    const adapter = runtime.databaseAdapter as any;
    const matchRes = await adapter.query(`SELECT room_id FROM matches WHERE id = $1`, [followUp.matchId]);
    const match = matchRes.rows[0];

    if (!match || !match.room_id) return;

    const message = "Hola! It's been a week. I've found you another match! 🚀 Would you like to see it? (Reply 'Yes' or 'No')";

    if (process.env.TELEGRAM_BOT_TOKEN) {
        const Telegraf = (await import('telegraf')).Telegraf;
        const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
        await bot.telegram.sendMessage(match.room_id, message);
    }

    await markFollowUpSent(runtime, followUp.id);
  } catch (error) {
    console.error('Error sending 7-day notice:', error);
  }
}

export async function processDueFollowUps(runtime: IAgentRuntime) {
  try {
    const dueFollowUps = await getDueFollowUps(runtime);
    
    for (const followUp of dueFollowUps) {
      if (followUp.type === '3_day_checkin') {
        await process3DayCheckIn(followUp, runtime);
      } else if (followUp.type === '7_day_next_match') {
        await process7DayNextMatch(followUp, runtime);
      }
    }
  } catch (error: any) {
    // Handle missing database tables gracefully
    if (error?.message?.includes('does not exist') || error?.code === '42703') {
      console.warn('[FollowUp Scheduler] Database tables not created yet. Run migration: database/migrations/001_create_matches_and_followups.sql');
      return;
    }
    console.error('[FollowUp Scheduler] Error processing follow-ups:', error);
  }
}

export function startFollowUpScheduler(runtime: IAgentRuntime) {
  // Run every hour
  setInterval(() => {
    processDueFollowUps(runtime).catch(console.error);
  }, 60 * 60 * 1000);
  
  // Initial check on startup
  processDueFollowUps(runtime).catch(console.error);
}

