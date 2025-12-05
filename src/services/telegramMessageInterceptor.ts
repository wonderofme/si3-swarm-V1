import { IAgentRuntime, Memory } from '@elizaos/core';
import { isDuplicateMessage, recordActionMessageSent } from './messageDeduplication.js';

/**
 * Patches the runtime's messageManager.createMemory to intercept all message creation
 * and apply deduplication. This catches both action callback messages and LLM-generated messages.
 */
export async function setupTelegramMessageInterceptor(runtime: IAgentRuntime) {
  const originalCreateMemory = runtime.messageManager.createMemory.bind(runtime.messageManager);
  
  runtime.messageManager.createMemory = async (memory: Memory) => {
    // Only intercept agent messages (messages from the bot)
    if (memory.userId === runtime.agentId && memory.content.text) {
      const text = memory.content.text;
      const roomId = memory.roomId;
      
      // Check for duplicates
      if (isDuplicateMessage(runtime, roomId, text)) {
        console.log('[Message Interceptor] Blocking duplicate message:', text.substring(0, 50));
        // Still create the memory (for logging), but mark it so Telegram client doesn't send it
        // We'll create it with a flag or modify the content
        const blockedMemory = {
          ...memory,
          content: {
            ...memory.content,
            text: text, // Keep original text for logging
            _blocked: true // Custom flag to prevent sending
          }
        };
        // Actually, let's just not create it at all if it's a duplicate
        // Return a memory with empty text so Telegram client doesn't send it
        return await originalCreateMemory({
          ...memory,
          content: {
            ...memory.content,
            text: '' // Empty text prevents Telegram from sending
          }
        });
      }
    }
    
    // Normal memory creation
    return await originalCreateMemory(memory);
  };
  
  console.log('[Message Interceptor] Patched messageManager.createMemory for deduplication');
}

