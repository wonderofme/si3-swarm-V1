import { getDueFollowUps, markFollowUpSent, getMatch, getUserProfile } from './matchTracker.js';
import { IAgentRuntime, UUID } from '@elizaos/core';

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

/**
 * Send a Telegram message
 */
async function sendTelegramMessage(
  chatId: string,
  text: string,
  botToken: string
): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[FollowUpScheduler] Failed to send Telegram message:`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`[FollowUpScheduler] Error sending Telegram message:`, error);
    return false;
  }
}

/**
 * Process 3-day check-in follow-up
 */
async function process3DayCheckIn(
  followUp: any,
  runtime: IAgentRuntime
): Promise<void> {
  const match = await getMatch(followUp.matchId);
  if (!match) {
    console.error(`[FollowUpScheduler] Match not found: ${followUp.matchId}`);
    return;
  }
  
  const userProfile = await getUserProfile(runtime, followUp.userId as UUID);
  const userName = userProfile.name || 'there';
  
  const message = `Hola ${userName}! 💜\n\nWere you able to connect with your match yet?\n\nPlease reply with:\n- **Yes** - if you connected\n- **No** - if you haven't connected yet\n- **Not interested** - if you'd like to skip this match`;
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('[FollowUpScheduler] TELEGRAM_BOT_TOKEN not set');
    return;
  }
  
  // Get Telegram chat ID from the match record (roomId)
  // In Telegram, the roomId is the chat ID
  const chatId = followUp.roomId || followUp.userId; // Use roomId if available, fallback to userId
  const sent = await sendTelegramMessage(chatId, message, botToken);
  
  if (sent) {
    await markFollowUpSent(followUp.id);
    console.log(`[FollowUpScheduler] Sent 3-day check-in to user ${followUp.userId}`);
  }
}

/**
 * Process 7-day next match follow-up
 */
async function process7DayNextMatch(
  followUp: any,
  runtime: IAgentRuntime
): Promise<void> {
  const match = await getMatch(followUp.matchId);
  if (!match) {
    console.error(`[FollowUpScheduler] Match not found: ${followUp.matchId}`);
    return;
  }
  
  const userProfile = await getUserProfile(runtime, followUp.userId as UUID);
  const userName = userProfile.name || 'there';
  
  const message = `Hola ${userName}! ✨\n\nI've found you another match! Would you like me to share the details?\n\nReply with **Yes** to see your new match, or **No** if you'd like to wait.`;
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('[FollowUpScheduler] TELEGRAM_BOT_TOKEN not set');
    return;
  }
  
  const chatId = followUp.userId;
  const sent = await sendTelegramMessage(chatId, message, botToken);
  
  if (sent) {
    await markFollowUpSent(followUp.id);
    console.log(`[FollowUpScheduler] Sent 7-day next match to user ${followUp.userId}`);
  }
}

/**
 * Process all due follow-ups
 */
export async function processDueFollowUps(runtime: IAgentRuntime): Promise<void> {
  try {
    const dueFollowUps = await getDueFollowUps();
    console.log(`[FollowUpScheduler] Found ${dueFollowUps.length} due follow-ups`);
    
    for (const followUp of dueFollowUps) {
      try {
        if (followUp.type === '3_day_checkin') {
          await process3DayCheckIn(followUp, runtime);
        } else if (followUp.type === '7_day_next_match') {
          await process7DayNextMatch(followUp, runtime);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[FollowUpScheduler] Error processing follow-up ${followUp.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[FollowUpScheduler] Error processing due follow-ups:', error);
  }
}

/**
 * Start the scheduler (runs every hour)
 */
export function startFollowUpScheduler(runtime: IAgentRuntime): void {
  console.log('[FollowUpScheduler] Starting follow-up scheduler (checking every hour)...');
  
  // Process immediately on start
  processDueFollowUps(runtime).catch(console.error);
  
  // Then run every hour
  setInterval(() => {
    processDueFollowUps(runtime).catch(console.error);
  }, 60 * 60 * 1000); // 1 hour in milliseconds
}

