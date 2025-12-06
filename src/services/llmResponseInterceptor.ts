import { IAgentRuntime, Memory } from '@elizaos/core';
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
         lower.includes('start the onboarding') ||
         lower.includes('start onboarding all over');
}

/**
 * Checks if an LLM response contains an action
 */
function hasAction(response: any): boolean {
  if (!response) return false;
  // Check various possible formats
  if (response.action) return true;
  if (response.content?.action) return true;
  if (typeof response === 'string' && response.includes('"action"')) return true;
  return false;
}

// Store the last user message per room to check for restart commands
const lastUserMessagePerRoom = new Map<string, Memory>();

// Store pending restart commands with timestamps for timeout-based execution
const pendingRestartCommands = new Map<string, { message: Memory; timestamp: number }>();

// Track messages created by timeout callback to prevent re-processing
const timeoutCreatedMessages = new Set<string>();

// Timeout in milliseconds - if no response after this, force execute action
const RESTART_TIMEOUT_MS = 3000; // 3 seconds

/**
 * Patches the runtime to intercept LLM responses and force action execution
 * for restart commands if the LLM didn't use the action.
 * 
 * This should be called BEFORE the message interceptor so it can chain properly.
 */
export async function setupLLMResponseInterceptor(runtime: IAgentRuntime) {
  // Store reference to original createMemory (before other patches)
  const originalCreateMemory = runtime.messageManager.createMemory.bind(runtime.messageManager);
  
  // Patch messageManager.createMemory to track user messages and intercept restart commands
  runtime.messageManager.createMemory = async (memory: Memory) => {
    // Track user messages (not agent messages) per room
    if (memory.userId !== runtime.agentId && memory.roomId) {
      console.log('[LLM Response Interceptor] Tracking user message:', memory.content.text?.substring(0, 50), 'roomId:', memory.roomId);
      lastUserMessagePerRoom.set(memory.roomId, memory);
      
      // If this is a restart command, set up a timeout to force execute if no response
      const userText = memory.content.text || '';
      if (isRestartCommand(userText)) {
        console.log('[LLM Response Interceptor] Restart command detected, setting up timeout fallback');
        pendingRestartCommands.set(memory.roomId, {
          message: memory,
          timestamp: Date.now()
        });
        
        // Set timeout to force execute action if no response
        setTimeout(async () => {
          const pending = pendingRestartCommands.get(memory.roomId);
          if (pending) {
            console.log('[LLM Response Interceptor] Timeout reached, no response received, forcing action execution');
            pendingRestartCommands.delete(memory.roomId);
            
            // Force execute the action - send directly via Telegram API to ensure delivery
            const callback = async (response: { text: string }): Promise<any[]> => {
              console.log('[LLM Response Interceptor] Timeout callback called with text:', response.text.substring(0, 50));
              
              // Send directly via Telegram API first to ensure delivery
              if (process.env.TELEGRAM_BOT_TOKEN && memory.roomId) {
                try {
                  const Telegraf = (await import('telegraf')).Telegraf;
                  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
                  await bot.telegram.sendMessage(memory.roomId, response.text);
                  console.log('[LLM Response Interceptor] Sent greeting message directly via Telegram API');
                } catch (error) {
                  console.error('[LLM Response Interceptor] Error sending Telegram message:', error);
                }
              }
              
              // Create memory with a marker to prevent re-processing
              const memoryId = `${memory.roomId}_${Date.now()}`;
              timeoutCreatedMessages.add(memoryId);
              
              // Use originalCreateMemory to bypass interceptors (we already sent via Telegram)
              const greetingMemory = await originalCreateMemory({
                id: undefined,
                userId: runtime.agentId,
                agentId: runtime.agentId,
                roomId: memory.roomId,
                content: {
                  text: response.text,
                  source: 'telegram',
                  // Add marker to prevent re-processing
                  metadata: { timeoutCreated: true, memoryId }
                }
              });
              console.log('[LLM Response Interceptor] Greeting memory created');
              
              // Clean up marker after a delay
              setTimeout(() => timeoutCreatedMessages.delete(memoryId), 5000);
              
              return Array.isArray(greetingMemory) ? greetingMemory : [greetingMemory];
            };
            
            try {
              await continueOnboardingAction.handler(
                runtime,
                memory,
                undefined,
                undefined,
                callback
              );
              console.log('[LLM Response Interceptor] Timeout-based action execution completed');
            } catch (error) {
              console.error('[LLM Response Interceptor] Error in timeout-based action execution:', error);
            }
          }
        }, RESTART_TIMEOUT_MS);
      }
    }
    
    // For agent messages, check if this is after a restart command
    if (memory.userId === runtime.agentId && memory.roomId) {
      console.log('[LLM Response Interceptor] Agent message detected, roomId:', memory.roomId, 'text:', memory.content.text?.substring(0, 50));
      
      // Skip processing if this message was created by timeout callback
      const isTimeoutCreated = (memory.content.metadata as any)?.timeoutCreated === true;
      if (isTimeoutCreated) {
        console.log('[LLM Response Interceptor] Skipping - message created by timeout callback');
        return await originalCreateMemory(memory);
      }
      
      // Clear pending restart command since we got a response
      if (pendingRestartCommands.has(memory.roomId)) {
        console.log('[LLM Response Interceptor] Response received, clearing pending restart timeout');
        pendingRestartCommands.delete(memory.roomId);
      }
      
      const lastUserMessage = lastUserMessagePerRoom.get(memory.roomId);
      
      if (lastUserMessage) {
        const userText = lastUserMessage.content.text || '';
        console.log('[LLM Response Interceptor] Last user message text:', userText.substring(0, 50));
        
        if (isRestartCommand(userText)) {
          console.log('[LLM Response Interceptor] Restart command detected in user message');
          // Check if this memory has an action or if we need to force it
          const hasActionInMemory = memory.content.action || 
                                    (memory.content.text && memory.content.text.includes('CONTINUE_ONBOARDING'));
          
          console.log('[LLM Response Interceptor] Has action in memory:', hasActionInMemory, 'Memory text:', memory.content.text?.substring(0, 50));
          
          if (!hasActionInMemory && memory.content.text && memory.content.text.trim()) {
            console.log('[LLM Response Interceptor] Restart detected but LLM didn\'t use action, forcing action execution');
            console.log('[LLM Response Interceptor] LLM response was:', memory.content.text.substring(0, 100));
            
            // Create callback that will send the greeting directly via Telegram
            const callback = async (response: { text: string }): Promise<any[]> => {
              // Send directly via Telegram API first
              if (process.env.TELEGRAM_BOT_TOKEN && lastUserMessage.roomId) {
                try {
                  const Telegraf = (await import('telegraf')).Telegraf;
                  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
                  await bot.telegram.sendMessage(lastUserMessage.roomId, response.text);
                  console.log('[LLM Response Interceptor] Sent greeting via Telegram API');
                } catch (error) {
                  console.error('[LLM Response Interceptor] Error sending Telegram message:', error);
                }
              }
              
              // Create memory for the greeting message (bypass interceptors)
              const greetingMemory = await originalCreateMemory({
                id: undefined,
                userId: runtime.agentId,
                agentId: runtime.agentId,
                roomId: lastUserMessage.roomId,
                content: {
                  text: response.text,
                  source: 'telegram',
                  metadata: { timeoutCreated: true }
                }
              });
              return Array.isArray(greetingMemory) ? greetingMemory : [greetingMemory];
            };
            
            // Force execute the action handler
            try {
              await continueOnboardingAction.handler(
                runtime,
                lastUserMessage,
                undefined,
                undefined,
                callback
              );
              console.log('[LLM Response Interceptor] Forced action execution completed');
              
              // Clear the tracked message
              lastUserMessagePerRoom.delete(memory.roomId);
              
              // Return empty memory to prevent LLM response from being sent
              return await originalCreateMemory({
                ...memory,
                content: {
                  ...memory.content,
                  text: '' // Empty text prevents sending
                }
              });
            } catch (error) {
              console.error('[LLM Response Interceptor] Error forcing action:', error);
              // Fall through to normal processing
            }
          } else {
            if (hasActionInMemory) {
              console.log('[LLM Response Interceptor] Restart detected and action found in response, allowing normal flow');
            } else if (!memory.content.text || !memory.content.text.trim()) {
              console.log('[LLM Response Interceptor] Restart detected but LLM response is empty, forcing action execution anyway');
              // Even if LLM response is empty, we should still execute the action
              const callback = async (response: { text: string }): Promise<any[]> => {
                // Send directly via Telegram API
                if (process.env.TELEGRAM_BOT_TOKEN && lastUserMessage.roomId) {
                  try {
                    const Telegraf = (await import('telegraf')).Telegraf;
                    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
                    await bot.telegram.sendMessage(lastUserMessage.roomId, response.text);
                    console.log('[LLM Response Interceptor] Sent greeting via Telegram API (empty LLM response)');
                  } catch (error) {
                    console.error('[LLM Response Interceptor] Error sending Telegram message:', error);
                  }
                }
                
                const greetingMemory = await originalCreateMemory({
                  id: undefined,
                  userId: runtime.agentId,
                  agentId: runtime.agentId,
                  roomId: lastUserMessage.roomId,
                  content: {
                    text: response.text,
                    source: 'telegram',
                    metadata: { timeoutCreated: true }
                  }
                });
                return Array.isArray(greetingMemory) ? greetingMemory : [greetingMemory];
              };
              
              try {
                await continueOnboardingAction.handler(
                  runtime,
                  lastUserMessage,
                  undefined,
                  undefined,
                  callback
                );
                console.log('[LLM Response Interceptor] Forced action execution completed (empty LLM response)');
                lastUserMessagePerRoom.delete(memory.roomId);
                return await originalCreateMemory(memory); // Return the empty memory as-is
              } catch (error) {
                console.error('[LLM Response Interceptor] Error forcing action (empty response):', error);
              }
            }
            lastUserMessagePerRoom.delete(memory.roomId); // Clear tracked message
          }
        } else {
          console.log('[LLM Response Interceptor] No restart command in user message');
        }
      } else {
        console.log('[LLM Response Interceptor] No last user message found for roomId:', memory.roomId);
      }
    }
    
    return await originalCreateMemory(memory);
  };
  
  console.log('[LLM Response Interceptor] Patched messageManager.createMemory for restart command interception');
}

