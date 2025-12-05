import { IAgentRuntime, Memory, HandlerCallback } from '@elizaos/core';
import { continueOnboardingAction } from '../plugins/onboarding/actions.js';
import { getMessages } from '../plugins/onboarding/translations.js';

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
 * Intercepts messages and handles restart commands directly,
 * bypassing the LLM to ensure reliable restart functionality.
 * This should be called before normal message processing.
 */
export async function interceptRestartCommand(
  runtime: IAgentRuntime,
  message: Memory,
  callback?: HandlerCallback
): Promise<boolean> {
  const text = message.content.text || '';
  
  if (!isRestartCommand(text)) {
    return false; // Not a restart command, let normal processing continue
  }
  
  console.log('[Restart Interceptor] Detected restart command:', text);
  console.log('[Restart Interceptor] Handling directly, bypassing LLM');
  
  // Create a callback that sends the greeting message via Telegram
  const telegramCallback: HandlerCallback = async (response: { text: string }): Promise<any[]> => {
    // Send the message via Telegram if available
    if (process.env.TELEGRAM_BOT_TOKEN && message.roomId) {
      try {
        const Telegraf = (await import('telegraf')).Telegraf;
        const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
        await bot.telegram.sendMessage(message.roomId, response.text);
        console.log('[Restart Interceptor] Sent greeting message via Telegram');
      } catch (error) {
        console.error('[Restart Interceptor] Error sending Telegram message:', error);
      }
    }
    
    // Also create a memory for the response
    await runtime.messageManager.createMemory({
      id: undefined,
      userId: runtime.agentId,
      agentId: runtime.agentId,
      roomId: message.roomId,
      content: {
        text: response.text,
        source: 'telegram'
      }
    });
    
    // Call the original callback if provided
    if (callback) {
      return await callback(response);
    }
    
    return [];
  };
  
  // Directly call the CONTINUE_ONBOARDING handler
  try {
    const handled = await continueOnboardingAction.handler(
      runtime,
      message,
      undefined,
      undefined,
      telegramCallback
    );
    if (handled) {
      console.log('[Restart Interceptor] Successfully handled restart');
      return true; // Indicates we handled it, stop normal processing
    }
    return false;
  } catch (error) {
    console.error('[Restart Interceptor] Error handling restart:', error);
    return false; // Let normal processing try
  }
}

