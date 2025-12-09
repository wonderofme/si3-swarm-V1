/**
 * Message ID Tracker
 * Tracks Telegram message IDs and ensures we only reply once per user message
 * This is more reliable than content-based deduplication
 */

// Map: userMessageId -> { replied: boolean, timestamp: number, roomId: string }
// Key format: `${chatId}:${messageId}` (Telegram message ID)
const userMessageReplies = new Map<string, { replied: boolean; timestamp: number; roomId: string }>();

// Cleanup old entries after 1 hour
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Records a user message ID that we should reply to
 * Call this when we receive a user message from Telegram
 */
export function recordUserMessage(chatId: string | number, messageId: number, roomId: string): void {
  const key = `${chatId}:${messageId}`;
  userMessageReplies.set(key, {
    replied: false,
    timestamp: Date.now(),
    roomId
  });
  console.log(`[Message ID Tracker] 📥 Recorded user message: ${key} (roomId: ${roomId})`);
}

/**
 * Checks if we've already replied to this user message
 * Returns true if we should NOT reply (already replied)
 */
export function hasRepliedToMessage(chatId: string | number, messageId: number): boolean {
  const key = `${chatId}:${messageId}`;
  const record = userMessageReplies.get(key);
  
  if (!record) {
    // Message not tracked yet - allow reply
    return false;
  }
  
  if (record.replied) {
    console.log(`[Message ID Tracker] 🚫 Already replied to message ${key}`);
    return true;
  }
  
  return false;
}

/**
 * Marks a user message as replied to
 * Call this when we send a response to a user message
 */
export function markMessageAsReplied(chatId: string | number, messageId: number): void {
  const key = `${chatId}:${messageId}`;
  const record = userMessageReplies.get(key);
  
  if (record) {
    record.replied = true;
    console.log(`[Message ID Tracker] ✅ Marked message ${key} as replied`);
  } else {
    console.log(`[Message ID Tracker] ⚠️ Tried to mark ${key} as replied but message not found in tracker`);
  }
}

/**
 * Gets the roomId for a user message (if tracked)
 */
export function getRoomIdForMessage(chatId: string | number, messageId: number): string | undefined {
  const key = `${chatId}:${messageId}`;
  const record = userMessageReplies.get(key);
  return record?.roomId;
}

/**
 * Gets all unreplied messages for a chat (for debugging)
 */
export function getUnrepliedMessages(chatId: string | number): Array<{ messageId: number; timestamp: number }> {
  const prefix = `${chatId}:`;
  const unreplied: Array<{ messageId: number; timestamp: number }> = [];
  
  for (const [key, record] of userMessageReplies.entries()) {
    if (key.startsWith(prefix) && !record.replied) {
      const messageId = parseInt(key.split(':')[1]);
      unreplied.push({ messageId, timestamp: record.timestamp });
    }
  }
  
  return unreplied.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Cleanup old entries to prevent memory leaks
 */
function cleanupOldEntries(): void {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, record] of userMessageReplies.entries()) {
    if (now - record.timestamp > MAX_AGE_MS) {
      userMessageReplies.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[Message ID Tracker] 🧹 Cleaned up ${cleaned} old message records`);
  }
}

// Start cleanup interval
setInterval(cleanupOldEntries, CLEANUP_INTERVAL_MS);

