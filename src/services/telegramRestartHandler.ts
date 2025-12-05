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
    // Fallback: We can't patch processMessage, so we'll need to intercept at the Telegram client level
    // For now, just log that we're using fallback mode
    // The restart will be handled by the action's validate function and the LLM should call it
    console.log('[Telegram Restart Handler] processMessage not available, using LLM-based restart handling');
    console.log('[Telegram Restart Handler] Restart commands will be handled via action validation');
  }
  
  console.log('[Telegram Restart Handler] Restart interceptor installed');
}

