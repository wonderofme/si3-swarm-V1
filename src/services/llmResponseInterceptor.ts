import { IAgentRuntime, Memory } from '@elizaos/core';
import { continueOnboardingAction } from '../plugins/onboarding/actions.js';
import { getMessages } from '../plugins/onboarding/translations.js';
import { TelegramClientInterface } from '@elizaos/client-telegram';

/**
 * Gets the Telegram chat ID from the room ID
 * First checks the in-memory mapping, then tries database lookup
 */
async function getTelegramChatIdFromUserMessage(runtime: IAgentRuntime, userMessage: Memory): Promise<string | null> {
  try {
    // First, check if we have it in our in-memory mapping
    if (roomIdToTelegramChatId.has(userMessage.roomId)) {
      const chatId = roomIdToTelegramChatId.get(userMessage.roomId);
      console.log('[LLM Response Interceptor] Found Telegram chat ID in cache:', chatId);
      return chatId || null;
    }
    
    // The userMessage.roomId might already be the Telegram chat ID if it came from Telegram
    // But if it's a UUID, we need to find the actual chat ID
    
    // Check if roomId looks like a Telegram chat ID (numeric string, no hyphens)
    if (userMessage.roomId && !userMessage.roomId.includes('-') && /^\d+$/.test(userMessage.roomId)) {
      // Store it for future use
      roomIdToTelegramChatId.set(userMessage.roomId, userMessage.roomId);
      return userMessage.roomId;
    }
    
    // If it's a UUID, try to find the Telegram chat ID from the database
    // Look for the most recent user message from this room that has a numeric roomId
    const adapter = runtime.databaseAdapter as any;
    
    // Try camelCase first (roomId), fallback to snake_case (room_id)
    // We're looking for a different roomId (numeric) that corresponds to this UUID room
    // Actually, this is tricky - we need to find messages where the user sent from the same Telegram chat
    // But the roomId in the database is the UUID. We need a different approach.
    
    // Instead, let's look for the user's most recent message and see if we can get the chat ID from there
    // Actually, the best approach is to look for agent messages in this room that were sent to Telegram
    // and see if we can find the chat ID from the message metadata or from the Telegram client
    
    return null;
  } catch (error) {
    console.error('[LLM Response Interceptor] Error getting Telegram chat ID:', error);
    return null;
  }
}

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

// Store mapping of roomId (UUID) to Telegram chat ID
// When we receive a Telegram message, we store the chat ID from the message metadata
const roomIdToTelegramChatId = new Map<string, string>();

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
      
      // Try to get Telegram chat ID from global map (set by Telegram client interceptor)
      const messageText = memory.content.text || '';
      if (messageText && (global as any).__telegramChatIdMap) {
        const chatId = (global as any).__telegramChatIdMap.get(messageText);
        if (chatId) {
          roomIdToTelegramChatId.set(memory.roomId, String(chatId));
          console.log('[LLM Response Interceptor] Captured Telegram chat ID from global map:', chatId);
          // Clean up the map entry after a delay
          setTimeout(() => {
            (global as any).__telegramChatIdMap?.delete(messageText);
          }, 5000);
        }
      }
      
      // If this is a Telegram message, try to extract the Telegram chat ID
      // The roomId might be the chat ID if it's numeric, or we might need to get it from metadata
      if (memory.content.source === 'telegram') {
        // Check if roomId is numeric (Telegram chat ID)
        if (memory.roomId && /^\d+$/.test(memory.roomId)) {
          // roomId is already the Telegram chat ID
          roomIdToTelegramChatId.set(memory.roomId, memory.roomId);
          console.log('[LLM Response Interceptor] Stored Telegram chat ID:', memory.roomId);
        } else {
          // roomId is a UUID, check if we can get chat ID from metadata or other sources
          // Try various places where the chat ID might be stored
          const chatId = (memory.content.metadata as any)?.chatId || 
                        (memory.content.metadata as any)?.telegramChatId ||
                        (memory.content.metadata as any)?.chat_id ||
                        (memory as any).chatId ||
                        (memory as any).chat_id ||
                        (memory as any).telegramChatId;
          
          if (chatId) {
            roomIdToTelegramChatId.set(memory.roomId, String(chatId));
            console.log('[LLM Response Interceptor] Stored Telegram chat ID from metadata:', chatId);
          } else {
            // If we can't find it, try to query the database for the most recent message
            // from this user that has a numeric roomId (which would be the Telegram chat ID)
            try {
              const adapter = runtime.databaseAdapter as any;
              const result = await adapter.query(
                `SELECT "roomId" FROM memories 
                 WHERE "userId" = $1 
                 AND content->>'source' = 'telegram'
                 AND "roomId"::text ~ '^[0-9]+$'
                 ORDER BY "createdAt" DESC 
                 LIMIT 1`,
                [memory.userId]
              );
              
              if (result.rows && result.rows.length > 0) {
                const foundChatId = result.rows[0].roomId;
                if (foundChatId && /^\d+$/.test(foundChatId)) {
                  roomIdToTelegramChatId.set(memory.roomId, foundChatId);
                  console.log('[LLM Response Interceptor] Found and stored Telegram chat ID from database:', foundChatId);
                }
              }
            } catch (error) {
              // Silently fail - we'll try again later
              console.log('[LLM Response Interceptor] Could not query database for chat ID:', (error as Error).message);
            }
          }
        }
      }
      
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
            
            // Force execute the action - try to send via Telegram API if we can get the chat ID
            const callback = async (response: { text: string }): Promise<any[]> => {
              console.log('[LLM Response Interceptor] Timeout callback called with text:', response.text.substring(0, 50));
              
              // Try to get the actual Telegram chat ID from the user's message
              const telegramChatId = await getTelegramChatIdFromUserMessage(runtime, memory);
              
              // If we have a Telegram chat ID, try sending directly
              if (telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
                try {
                  const Telegraf = (await import('telegraf')).Telegraf;
                  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
                  await bot.telegram.sendMessage(telegramChatId, response.text);
                  console.log('[LLM Response Interceptor] Sent greeting message directly via Telegram API to chat:', telegramChatId);
                } catch (error: any) {
                  console.error('[LLM Response Interceptor] Error sending via Telegram API:', error.message);
                  // Fall through to memory creation
                }
              } else {
                console.log('[LLM Response Interceptor] Could not get Telegram chat ID, will rely on memory creation');
              }
              
              // Also create memory normally - this will go through all interceptors
              // The Telegram client might send it, or we already sent it above
              // Mark it to prevent re-processing by our interceptor
              const greetingMemory = await runtime.messageManager.createMemory({
                id: undefined,
                userId: runtime.agentId,
                agentId: runtime.agentId,
                roomId: memory.roomId,
                content: {
                  text: response.text,
                  source: 'telegram',
                  // Add marker to prevent re-processing
                  metadata: { timeoutCreated: true }
                }
              });
              console.log('[LLM Response Interceptor] Greeting memory created');
              
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
            
            // Create callback that will create memory normally (Telegram client will send it)
            const callback = async (response: { text: string }): Promise<any[]> => {
              // Create memory normally - Telegram client will automatically send it
              const greetingMemory = await runtime.messageManager.createMemory({
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
              console.log('[LLM Response Interceptor] Greeting memory created, Telegram client will send it');
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
                // Create memory normally - Telegram client will automatically send it
                const greetingMemory = await runtime.messageManager.createMemory({
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
                console.log('[LLM Response Interceptor] Greeting memory created (empty LLM response), Telegram client will send it');
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

