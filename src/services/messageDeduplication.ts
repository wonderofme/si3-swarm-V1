import { IAgentRuntime } from '@elizaos/core';

// In-memory cache to track recently sent messages
// Key: `${roomId}:${messageHash}`, Value: timestamp (for exact duplicates)
const sentMessagesCache = new Map<string, number>();

// Track last message sent time per roomId (for blocking ALL messages after action)
// Key: `roomId`, Value: timestamp
const lastMessagePerRoom = new Map<string, number>();

const DEDUP_WINDOW_MS = 5000; // 5 seconds for exact duplicates
const BLOCK_WINDOW_MS = 2000; // 2 seconds to block ANY message after action callback (reduced to allow faster responses)

/**
 * Creates a simple hash of the message text for deduplication
 */
function hashMessage(text: string): string {
  // Simple hash - just use first 50 chars + length
  // For exact duplicates, this is sufficient
  return `${text.length}:${text.substring(0, 50)}`;
}

/**
 * Records that a message was sent via action callback
 * This blocks ALL subsequent messages to the same room for a short period
 */
export function recordActionMessageSent(roomId: string | undefined): void {
  if (!roomId) return;
  const now = Date.now();
  lastMessagePerRoom.set(roomId, now);
  console.log('[Message Dedup] Recorded action message sent for roomId:', roomId);
  
  // Clean up old entries
  const cleanupThreshold = now - (BLOCK_WINDOW_MS * 2);
  for (const [key, timestamp] of lastMessagePerRoom.entries()) {
    if (timestamp < cleanupThreshold) {
      lastMessagePerRoom.delete(key);
    }
  }
}

/**
 * Checks if a message should be blocked (either exact duplicate or too soon after action)
 * Returns true if message should be skipped
 */
export function isDuplicateMessage(
  runtime: IAgentRuntime,
  roomId: string | undefined,
  text: string
): boolean {
  if (!roomId) return false;
  
  const now = Date.now();
  
  // First check: Block ANY message if action callback was used recently
  const lastActionTime = lastMessagePerRoom.get(roomId);
  if (lastActionTime && (now - lastActionTime) < BLOCK_WINDOW_MS) {
    console.log('[Message Dedup] Blocking message - too soon after action callback:', text.substring(0, 50));
    return true; // Block this message
  }
  
  // Second check: Exact duplicate detection
  const messageHash = hashMessage(text);
  const cacheKey = `${roomId}:${messageHash}`;
  
  const lastSent = sentMessagesCache.get(cacheKey);
  if (lastSent && (now - lastSent) < DEDUP_WINDOW_MS) {
    console.log('[Message Dedup] Exact duplicate detected, skipping:', text.substring(0, 50));
    return true; // Duplicate detected
  }
  
  // Record this message as sent (for exact duplicate detection)
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

