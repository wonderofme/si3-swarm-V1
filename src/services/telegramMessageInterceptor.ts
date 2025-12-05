import { IAgentRuntime, Memory } from '@elizaos/core';
import { isDuplicateMessage, recordMessageSent } from './messageDeduplication.js';

/**
 * Patches the runtime's messageManager.createMemory to intercept all message creation
 * and apply deduplication. This catches both action callback messages and LLM-generated messages.
 */
export async function setupTelegramMessageInterceptor(runtime: IAgentRuntime) {
  const originalCreateMemory = runtime.messageManager.createMemory.bind(runtime.messageManager);
  
  runtime.messageManager.createMemory = async (memory: Memory) => {
    // Only intercept agent messages (messages from the bot) with text
    if (memory.userId === runtime.agentId && memory.content.text && memory.content.text.trim()) {
      const text = memory.content.text;
      const roomId = memory.roomId;
      
      // Check for duplicates BEFORE creating memory
      if (isDuplicateMessage(runtime, roomId, text)) {
        console.log('[Message Interceptor] Blocking duplicate message:', text.substring(0, 50));
        // Create memory with empty text so Telegram client doesn't send it
        return await originalCreateMemory({
          ...memory,
          content: {
            ...memory.content,
            text: '' // Empty text prevents Telegram from sending
          }
        });
      }
      
      // Not a duplicate - record it and create normally
      // Record AFTER we've confirmed it's not a duplicate, but BEFORE creating memory
      // This ensures the next duplicate check will catch it
      recordMessageSent(roomId, text);
    }
    
    // Normal memory creation
    return await originalCreateMemory(memory);
  };
  
  console.log('[Message Interceptor] Patched messageManager.createMemory for deduplication');
}

