import { IAgentRuntime, Memory } from '@elizaos/core';
import { isDuplicateMessage, recordMessageSent } from './messageDeduplication.js';

/**
 * Patches the runtime's messageManager.createMemory to intercept all message creation
 * and apply deduplication. This catches both action callback messages and LLM-generated messages.
 */
export async function setupTelegramMessageInterceptor(runtime: IAgentRuntime) {
  // Get the current createMemory (which may already be patched by LLM interceptor)
  const originalCreateMemory = runtime.messageManager.createMemory.bind(runtime.messageManager);
  
  runtime.messageManager.createMemory = async (memory: Memory) => {
    // CRITICAL: Check if this message was blocked by LLM interceptor
    // The LLM interceptor returns a memory with metadata.blocked = true
    // If blocked, don't call originalCreateMemory to prevent Telegram client from sending
    const isBlocked = (memory.content.metadata as any)?.blocked === true;
    if (isBlocked) {
      console.log('[Message Interceptor] 🚫 Message was blocked by LLM interceptor, not calling originalCreateMemory to prevent Telegram send');
      console.log('[Message Interceptor] Blocked reason:', (memory.content.metadata as any)?.reason);
      // Call originalCreateMemory with empty text to prevent Telegram client from sending
      // But the LLM interceptor already returned early, so this shouldn't be called
      // This is a safety check in case the LLM interceptor didn't block properly
      await originalCreateMemory({
        ...memory,
        content: {
          ...memory.content,
          text: '' // Ensure empty text
        }
      });
      return;
    }
    
    // Only intercept agent messages (messages from the bot) with text
    if (memory.userId === runtime.agentId && memory.content.text && memory.content.text.trim()) {
      const text = memory.content.text;
      const roomId = memory.roomId;
      
      console.log('[Message Interceptor] Checking message:', text.substring(0, 50), 'roomId:', roomId);
      
      // Check for duplicates BEFORE creating memory
      // Now only checks exact duplicates (same text), no timing checks
      // This allows action handler callbacks to go through immediately after state updates
      if (isDuplicateMessage(runtime, roomId, text)) {
        console.log('[Message Interceptor] Blocking duplicate message (exact duplicate detected):', text.substring(0, 50));
        // Create memory with empty text so Telegram client doesn't send it
        return await originalCreateMemory({
          ...memory,
          content: {
            ...memory.content,
            text: '' // Empty text prevents Telegram from sending
          }
        });
      }
      
      console.log('[Message Interceptor] Allowing message, creating memory:', text.substring(0, 50));
      
      // Not a duplicate - create memory normally
      // We'll record it AFTER the memory is created (in a then() callback)
      // This ensures we only record messages that are actually created
      const createdMemory = await originalCreateMemory(memory);
      
      console.log('[Message Interceptor] Memory created, recording:', text.substring(0, 50));
      
      // Record AFTER memory is created (but message might not be sent yet by Telegram)
      // This is the best we can do without hooking into Telegram client
      recordMessageSent(roomId, text);
      
      return createdMemory;
    }
    
    // Normal memory creation (not an agent message or no text)
    if (memory.userId === runtime.agentId) {
      console.log('[Message Interceptor] Agent message but no text or empty text');
    }
    return await originalCreateMemory(memory);
  };
  
  console.log('[Message Interceptor] Patched messageManager.createMemory for deduplication');
}

