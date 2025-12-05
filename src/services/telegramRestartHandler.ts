import { IAgentRuntime, Memory } from '@elizaos/core';
import { interceptRestartCommand } from './restartInterceptor.js';

function isRestartCommand(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  return lower.includes('restart') || 
         lower.includes('pretend this is my first') ||
         lower.includes('start over') ||
         lower.includes('begin again') ||
         lower.includes('can we start') ||
         lower.includes('start the onboarding');
}

/**
 * Wraps the Telegram client to intercept restart commands before they reach the LLM.
 * This ensures restart commands are handled reliably by patching the runtime's processMessage.
 */
export async function setupTelegramRestartHandler(runtime: IAgentRuntime) {
  // Patch the runtime's processMessage method if it exists
  const runtimeAny = runtime as any;
  
  if (runtimeAny.processMessage) {
    const originalProcessMessage = runtimeAny.processMessage.bind(runtime);
    
    runtimeAny.processMessage = async (message: Memory) => {
      // Check for restart commands BEFORE processing
      const text = message.content.text || '';
      
      if (message.userId !== runtime.agentId && isRestartCommand(text)) {
        console.log('[Telegram Restart Handler] Intercepting restart command:', text);
        
        // Handle restart directly
        const handled = await interceptRestartCommand(runtime, message);
        if (handled) {
          console.log('[Telegram Restart Handler] Restart handled, skipping LLM processing');
          return; // Don't process through LLM
        }
      }
      
      // Normal processing
      return await originalProcessMessage(message);
    };
    
    console.log('[Telegram Restart Handler] Patched processMessage');
  } else {
    // Fallback: patch createMemory to at least log restart attempts
    const originalCreateMemory = runtime.messageManager.createMemory.bind(runtime.messageManager);
    let isHandlingRestart = false; // Flag to prevent infinite loops
    
    runtime.messageManager.createMemory = async (memory: Memory) => {
      // Only intercept user messages (not agent messages) and only if not already handling a restart
      if (!isHandlingRestart && 
          memory.userId !== runtime.agentId && 
          memory.content.text && 
          isRestartCommand(memory.content.text)) {
        console.log('[Telegram Restart Handler] Restart command detected in memory creation');
        isHandlingRestart = true; // Set flag to prevent recursion
        try {
          // Try to handle it
          await interceptRestartCommand(runtime, memory);
        } finally {
          isHandlingRestart = false; // Reset flag
        }
      }
      
      return await originalCreateMemory(memory);
    };
    
    console.log('[Telegram Restart Handler] Patched createMemory (fallback)');
  }
  
  console.log('[Telegram Restart Handler] Restart interceptor installed');
}

