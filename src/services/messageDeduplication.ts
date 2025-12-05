import { IAgentRuntime } from '@elizaos/core';

// In-memory cache to track recently sent messages
// Key: `${roomId}:${messageHash}`, Value: timestamp
const sentMessagesCache = new Map<string, number>();
const DEDUP_WINDOW_MS = 5000; // 5 seconds

/**
 * Creates a simple hash of the message text for deduplication
 */
function hashMessage(text: string): string {
  // Simple hash - just use first 50 chars + length
  // For exact duplicates, this is sufficient
  return `${text.length}:${text.substring(0, 50)}`;
}

/**
 * Checks if a message with the same content was recently sent to the same room
 * Returns true if message should be skipped (duplicate detected)
 */
export function isDuplicateMessage(
  runtime: IAgentRuntime,
  roomId: string | undefined,
  text: string
): boolean {
  if (!roomId) return false;
  
  const messageHash = hashMessage(text);
  const cacheKey = `${roomId}:${messageHash}`;
  const now = Date.now();
  
  // Check if we sent this message recently
  const lastSent = sentMessagesCache.get(cacheKey);
  if (lastSent && (now - lastSent) < DEDUP_WINDOW_MS) {
    console.log('[Message Dedup] Duplicate message detected, skipping:', text.substring(0, 50));
    return true; // Duplicate detected
  }
  
  // Record this message as sent
  sentMessagesCache.set(cacheKey, now);
  
  // Clean up old entries (older than 10 seconds)
  const cleanupThreshold = now - (DEDUP_WINDOW_MS * 2);
  for (const [key, timestamp] of sentMessagesCache.entries()) {
    if (timestamp < cleanupThreshold) {
      sentMessagesCache.delete(key);
    }
  }
  
  return false; // Not a duplicate
}

