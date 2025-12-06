import { IAgentRuntime } from '@elizaos/core';

// In-memory cache to track recently sent messages
// Key: `${roomId}:${messageHash}`, Value: timestamp (for exact duplicates)
const sentMessagesCache = new Map<string, number>();

// Track last message sent time per roomId (for blocking ALL messages after action)
// Key: `roomId`, Value: timestamp
const lastMessagePerRoom = new Map<string, number>();

const DEDUP_WINDOW_MS = 5000; // 5 seconds for exact duplicates
const BLOCK_WINDOW_MS = 1500; // 1.5 seconds to block ANY message after a message was sent (prevents LLM duplicates)

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
 * Records that a message was actually sent (called AFTER message is sent)
 */
export function recordMessageSent(roomId: string | undefined, text: string): void {
  if (!roomId) return;
  const now = Date.now();
  
  // Record exact duplicate
  const messageHash = hashMessage(text);
  const cacheKey = `${roomId}:${messageHash}`;
  sentMessagesCache.set(cacheKey, now);
  
  // Record action message time
  lastMessagePerRoom.set(roomId, now);
  
  // Clean up old entries
  const cleanupThreshold = now - (DEDUP_WINDOW_MS * 2);
  for (const [key, timestamp] of sentMessagesCache.entries()) {
    if (timestamp < cleanupThreshold) {
      sentMessagesCache.delete(key);
    }
  }
  for (const [key, timestamp] of lastMessagePerRoom.entries()) {
    if (timestamp < cleanupThreshold) {
      lastMessagePerRoom.delete(key);
    }
  }
}

/**
 * Checks if a message should be blocked (either exact duplicate or too soon after action)
 * Returns true if message should be skipped
 * NOTE: This does NOT record the message - call recordMessageSent() AFTER sending
 */
export function isDuplicateMessage(
  runtime: IAgentRuntime,
  roomId: string | undefined,
  text: string
): boolean {
  if (!roomId) return false;
  
  const now = Date.now();
  
  // First check: Block ANY message if a message was sent recently (prevents LLM from sending duplicate after action callback)
  const lastMessageTime = lastMessagePerRoom.get(roomId);
  if (lastMessageTime) {
    const timeSinceLastMessage = now - lastMessageTime;
    if (timeSinceLastMessage < BLOCK_WINDOW_MS) {
      console.log('[Message Dedup] Blocking message - too soon after previous message:', text.substring(0, 50), `(${timeSinceLastMessage}ms ago, window: ${BLOCK_WINDOW_MS}ms)`);
      return true; // Block this message
    } else {
      console.log('[Message Dedup] Message OK - enough time passed:', text.substring(0, 50), `(${timeSinceLastMessage}ms ago, window: ${BLOCK_WINDOW_MS}ms)`);
    }
  } else {
    console.log('[Message Dedup] No previous message for room, allowing:', text.substring(0, 50));
  }
  
  // Second check: Exact duplicate detection
  const messageHash = hashMessage(text);
  const cacheKey = `${roomId}:${messageHash}`;
  
  const lastSent = sentMessagesCache.get(cacheKey);
  if (lastSent && (now - lastSent) < DEDUP_WINDOW_MS) {
    console.log('[Message Dedup] Exact duplicate detected, skipping:', text.substring(0, 50));
    return true; // Duplicate detected
  }
  
  return false; // Not a duplicate
}

