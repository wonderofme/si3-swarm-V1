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

// Export roomIdToTelegramChatId map so it can be accessed from other modules
export function getRoomIdForChatId(chatId: string | number): string | undefined {
  for (const [roomId, mappedChatId] of roomIdToTelegramChatId.entries()) {
    if (String(mappedChatId) === String(chatId)) {
      return roomId;
    }
  }
  return undefined;
}

// Export function to check if action was executed recently (for use in sendMessage patch)
export function checkActionExecutedRecently(roomId: string | undefined): boolean {
  if (!roomId) return false;
  return wasActionExecutedRecently(roomId);
}

// Track when action handlers execute to prevent duplicate LLM responses
// Maps roomId to timestamp when action last executed
const actionExecutionTimestamps = new Map<string, number>();

// Track when agent messages are sent to prevent rapid consecutive messages
// Maps roomId to timestamp when agent message was last sent
const lastAgentMessageTimestamps = new Map<string, number>();

// Time window in milliseconds - block agent messages if action executed within this window
const ACTION_EXECUTION_BLOCK_WINDOW_MS = 3000; // 3 seconds

// Time window in milliseconds - block agent messages if another agent message was sent recently
// This catches duplicates from "No action found" follow-up responses
const AGENT_MESSAGE_BLOCK_WINDOW_MS = 2000; // 2 seconds

/**
 * Records that an action handler has executed for a given room
 * This is used to prevent duplicate LLM responses after action execution
 */
export function recordActionExecution(roomId: string): void {
  if (roomId) {
    actionExecutionTimestamps.set(roomId, Date.now());
    console.log('[LLM Response Interceptor] Recorded action execution for roomId:', roomId);
  }
}

/**
 * Checks if an action was recently executed for a given room
 * Returns true if action executed within the block window
 */
function wasActionExecutedRecently(roomId: string): boolean {
  if (!roomId) {
    console.log('[LLM Response Interceptor] wasActionExecutedRecently: No roomId provided');
    return false;
  }
  const timestamp = actionExecutionTimestamps.get(roomId);
  if (!timestamp) {
    console.log(`[LLM Response Interceptor] wasActionExecutedRecently: No timestamp found for roomId: ${roomId}`);
    console.log(`[LLM Response Interceptor] Available roomIds in map:`, Array.from(actionExecutionTimestamps.keys()));
    return false;
  }
  const elapsed = Date.now() - timestamp;
  const wasRecent = elapsed < ACTION_EXECUTION_BLOCK_WINDOW_MS;
  console.log(`[LLM Response Interceptor] wasActionExecutedRecently: roomId=${roomId}, elapsed=${elapsed}ms, window=${ACTION_EXECUTION_BLOCK_WINDOW_MS}ms, wasRecent=${wasRecent}`);
  return wasRecent;
}

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
    // Log ALL memory creation to debug why agent messages aren't being created
    const isAgent = memory.userId === runtime.agentId;
    const textPreview = memory.content.text?.substring(0, 50) || '(empty)';
    console.log(`[LLM Response Interceptor] Memory created - userId: ${memory.userId}, agentId: ${runtime.agentId}, isAgent: ${isAgent}, text: ${textPreview}, roomId: ${memory.roomId}`);
    
    // Only generate stack trace for agent messages to reduce overhead
    if (isAgent) {
      try {
        const stackTrace = new Error().stack?.split('\n').slice(1, 4).join(' -> ') || 'no stack';
        console.log(`[LLM Response Interceptor] 🔍 Agent message creation stack trace: ${stackTrace}`);
      } catch (error) {
        // Silently fail if stack trace generation fails
        console.log(`[LLM Response Interceptor] 🔍 Agent message creation (stack trace unavailable)`);
      }
    }
    
    // If this is an agent message, immediately check action execution status
    if (isAgent && memory.roomId) {
      const hasTimestamp = actionExecutionTimestamps.has(memory.roomId);
      const timestamp = actionExecutionTimestamps.get(memory.roomId);
      const elapsed = timestamp ? Date.now() - timestamp : null;
      console.log(`[LLM Response Interceptor] Agent message - hasTimestamp: ${hasTimestamp}, elapsed: ${elapsed}ms, will check blocking...`);
    }
    
    // Skip processing internal onboarding update messages - they shouldn't trigger LLM responses
    if (memory.content.text?.startsWith('Onboarding Update:') || (memory.content.metadata as any)?.isInternalUpdate === true) {
      console.log('[LLM Response Interceptor] Skipping internal onboarding update message');
      return await originalCreateMemory(memory);
    }
    
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
          console.log('[LLM Response Interceptor] Captured Telegram chat ID from global map:', chatId, 'for roomId:', memory.roomId);
          // Store it with a longer timeout since we'll need it for sending messages
          // Clean up the map entry after a longer delay (30 seconds) to allow time for response
          setTimeout(() => {
            (global as any).__telegramChatIdMap?.delete(messageText);
          }, 30000);
        } else {
          console.log('[LLM Response Interceptor] Chat ID not found in global map for message:', messageText.substring(0, 50));
          console.log('[LLM Response Interceptor] Global map size:', (global as any).__telegramChatIdMap?.size || 0);
          console.log('[LLM Response Interceptor] Global map keys:', Array.from((global as any).__telegramChatIdMap?.keys() || []));
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
            
            // Record in deduplication system immediately to prevent duplicates
            const { recordMessageSent } = await import('./messageDeduplication.js');
            recordMessageSent(memory.roomId, response.text);
            console.log('[LLM Response Interceptor] Recorded timeout callback message in deduplication system');
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
              // Record action execution to prevent duplicate responses
              recordActionExecution(memory.roomId);
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
      const messageText = memory.content.text?.substring(0, 50) || '(empty)';
      console.log('[LLM Response Interceptor] Agent message detected, roomId:', memory.roomId, 'text:', messageText);
      console.log('[LLM Response Interceptor] Checking if action was executed recently for this agent message...');
      
      // Skip processing if this message was created by timeout callback
      const isTimeoutCreated = (memory.content.metadata as any)?.timeoutCreated === true;
      if (isTimeoutCreated) {
        console.log('[LLM Response Interceptor] Skipping - message created by timeout callback');
        return await originalCreateMemory(memory);
      }
      
      // CRITICAL FIX: Block agent messages if an action was executed recently
      // This prevents ElizaOS from generating a duplicate response after action execution
      // Even if the provider wasn't called (which seems to be the case for follow-up responses)
      const actionWasRecent = wasActionExecutedRecently(memory.roomId);
      if (actionWasRecent) {
        console.log('[LLM Response Interceptor] 🚫 BLOCKING agent message - action was executed recently, preventing duplicate response');
        console.log('[LLM Response Interceptor] Blocked message text:', messageText);
        // Return empty memory to prevent sending
        return await originalCreateMemory({
          ...memory,
          content: {
            ...memory.content,
            text: '' // Empty text prevents sending
          }
        });
      }
      
      // ADDITIONAL FIX: Block agent messages if another agent message was sent very recently
      // This catches duplicates from "No action found" follow-up responses
      const lastAgentMessageTime = lastAgentMessageTimestamps.get(memory.roomId);
      if (lastAgentMessageTime && memory.content.text && memory.content.text.trim()) {
        const elapsed = Date.now() - lastAgentMessageTime;
        console.log(`[LLM Response Interceptor] Checking rapid consecutive message - elapsed: ${elapsed}ms, window: ${AGENT_MESSAGE_BLOCK_WINDOW_MS}ms`);
        if (elapsed < AGENT_MESSAGE_BLOCK_WINDOW_MS) {
          console.log(`[LLM Response Interceptor] 🚫 BLOCKING agent message - another agent message was sent ${elapsed}ms ago (window: ${AGENT_MESSAGE_BLOCK_WINDOW_MS}ms), preventing duplicate`);
          console.log('[LLM Response Interceptor] Blocked message text:', messageText);
          // Return empty memory to prevent sending
          return await originalCreateMemory({
            ...memory,
            content: {
              ...memory.content,
              text: '' // Empty text prevents sending
            }
          });
        } else {
          console.log(`[LLM Response Interceptor] ✅ Allowing agent message - elapsed time (${elapsed}ms) is outside block window (${AGENT_MESSAGE_BLOCK_WINDOW_MS}ms)`);
        }
      } else if (!lastAgentMessageTime) {
        console.log(`[LLM Response Interceptor] No previous agent message timestamp found for roomId: ${memory.roomId}`);
      }
      
      // If we get here, the message is allowed - record the timestamp IMMEDIATELY for future blocking
      // This must happen BEFORE we send the message, so the second message is blocked
      if (memory.content.text && memory.content.text.trim()) {
        const now = Date.now();
        lastAgentMessageTimestamps.set(memory.roomId, now);
        console.log(`[LLM Response Interceptor] ✅ Allowing agent message - recorded timestamp: ${now} for roomId: ${memory.roomId}`);
      }
      
      // For all agent messages, try to send directly via Telegram API if we have the chat ID
      // This ensures messages are actually sent, not just stored in memory
      if (memory.content.text && memory.content.text.trim()) {
        // Try to get chat ID from our mapping first
        let telegramChatId = roomIdToTelegramChatId.get(memory.roomId);
        
        // If not found, try to get it from the global map using the last user message
        if (!telegramChatId) {
          const lastUserMessage = lastUserMessagePerRoom.get(memory.roomId);
          if (lastUserMessage && lastUserMessage.content.text && (global as any).__telegramChatIdMap) {
            const chatIdFromMap = (global as any).__telegramChatIdMap.get(lastUserMessage.content.text);
            if (chatIdFromMap) {
              telegramChatId = String(chatIdFromMap);
              // Store it for future use
              roomIdToTelegramChatId.set(memory.roomId, telegramChatId);
              console.log('[LLM Response Interceptor] Retrieved chat ID from global map for agent message:', telegramChatId);
            }
          }
        }
        
        if (telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
          try {
            console.log('[LLM Response Interceptor] Sending agent message directly via Telegram API to chat:', telegramChatId);
            const Telegraf = (await import('telegraf')).Telegraf;
            const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
            await bot.telegram.sendMessage(telegramChatId, memory.content.text);
            console.log('[LLM Response Interceptor] ✅ Successfully sent agent message via Telegram API');
            
            // Record in deduplication system immediately to prevent duplicates
            const { recordMessageSent } = await import('./messageDeduplication.js');
            recordMessageSent(memory.roomId, memory.content.text);
            console.log('[LLM Response Interceptor] Recorded message in deduplication system');
            
            // After sending directly, create memory with empty text to prevent duplicate sending by ElizaOS client
            // But keep the original text in metadata for logging/debugging
            return await originalCreateMemory({
              ...memory,
              content: {
                ...memory.content,
                text: '', // Empty text prevents Telegram client from sending again
                metadata: {
                  ...(memory.content.metadata || {}),
                  sentViaDirectAPI: true,
                  originalText: memory.content.text
                }
              }
            });
          } catch (error: any) {
            console.error('[LLM Response Interceptor] ❌ Error sending agent message via Telegram API:', error.message);
            console.error('[LLM Response Interceptor] Error details:', error);
            // Continue with normal memory creation as fallback
          }
        } else {
          console.log('[LLM Response Interceptor] ⚠️ No Telegram chat ID found for roomId:', memory.roomId);
          console.log('[LLM Response Interceptor] Available chat IDs in mapping:', Array.from(roomIdToTelegramChatId.keys()));
          console.log('[LLM Response Interceptor] Has bot token:', !!process.env.TELEGRAM_BOT_TOKEN);
        }
      } else {
        console.log('[LLM Response Interceptor] Agent message has no text or empty text');
      }
      
      // Clear pending restart command since we got a response
      if (pendingRestartCommands.has(memory.roomId)) {
        console.log('[LLM Response Interceptor] Response received, clearing pending restart timeout');
        pendingRestartCommands.delete(memory.roomId);
      }
      
      // Continue with normal memory creation if we didn't already return
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
              // Record action execution to prevent duplicate responses
              recordActionExecution(memory.roomId);
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
                // Record action execution to prevent duplicate responses
                recordActionExecution(memory.roomId);
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

