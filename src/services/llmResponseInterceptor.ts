import { IAgentRuntime, Memory } from '@elizaos/core';
import { continueOnboardingAction } from '../plugins/onboarding/actions.js';
import { getMessages } from '../plugins/onboarding/translations.js';
import { getOnboardingStep } from '../plugins/onboarding/utils.js';
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

// Export function to get userId from roomId (for onboarding step check in sendMessage patcher)
export function getUserIdForRoomId(roomId: string | undefined): string | undefined {
  if (!roomId) return undefined;
  const lastUserMessage = lastUserMessagePerRoom.get(roomId);
  return lastUserMessage?.userId;
}

// Store pending restart commands with timestamps for timeout-based execution
const pendingRestartCommands = new Map<string, { message: Memory; timestamp: number }>();

// Track messages created by timeout callback to prevent re-processing
const timeoutCreatedMessages = new Set<string>();

// Store mapping of roomId (UUID) to Telegram chat ID
// When we receive a Telegram message, we store the chat ID from the message metadata
const roomIdToTelegramChatId = new Map<string, string>();

// Cache onboarding steps per userId for synchronous checking
// Updated when user messages are processed
const onboardingStepCache = new Map<string, string>();

// Export function to get onboarding step from cache (synchronous)
export function getOnboardingStepFromCache(userId: string): string | undefined {
  return onboardingStepCache.get(userId);
}

// Export function to update onboarding step cache (for immediate updates during restart)
export function updateOnboardingStepCache(userId: string, step: string): void {
  onboardingStepCache.set(userId, step);
  console.log(`[LLM Response Interceptor] Updated onboarding step cache for user ${userId}: ${step}`);
}

// Export roomIdToTelegramChatId map so it can be accessed from other modules
export function getRoomIdForChatId(chatId: string | number): string | undefined {
  for (const [roomId, mappedChatId] of roomIdToTelegramChatId.entries()) {
    if (String(mappedChatId) === String(chatId)) {
      return roomId;
    }
  }
  return undefined;
}

// Export function to get Telegram chat ID from roomId (reverse lookup)
export function getChatIdForRoomId(roomId: string | undefined): string | undefined {
  if (!roomId) return undefined;
  
  // Check if roomId itself is a numeric Telegram chat ID
  if (/^\d+$/.test(roomId)) {
    return roomId;
  }
  
  // Look up in mapping
  return roomIdToTelegramChatId.get(roomId);
}

// Export function to check if action was executed recently (for use in sendMessage patch)
export function checkActionExecutedRecently(roomId: string | undefined): boolean {
  if (!roomId) return false;
  return wasActionExecutedRecently(roomId);
}

// Export function to get last agent message timestamp (for use in sendMessage patch)
export function getLastAgentMessageTime(roomId: string | undefined): number | undefined {
  if (!roomId) return undefined;
  return lastAgentMessageTimestamps.get(roomId);
}

/**
 * Gets the timestamp when an action was last executed for a given room
 * Returns undefined if no action was executed
 */
export function getActionExecutionTime(roomId: string | undefined): number | undefined {
  if (!roomId) return undefined;
  return actionExecutionTimestamps.get(roomId);
}

// Track when action handlers execute to prevent duplicate LLM responses
// Maps roomId to timestamp when action last executed
const actionExecutionTimestamps = new Map<string, number>();

// Track when agent messages are sent to prevent rapid consecutive messages
// Maps roomId to timestamp when agent message was last sent
const lastAgentMessageTimestamps = new Map<string, number>();

// Global message lock: prevents any message from being sent while action handler is executing
// Maps roomId to lock state (true = locked, false = unlocked)
const messageLocks = new Map<string, boolean>();

/**
 * Acquire a message lock for a room (prevents all messages from being sent)
 */
export function acquireMessageLock(roomId: string): void {
  if (roomId) {
    messageLocks.set(roomId, true);
    console.log('[LLM Response Interceptor] 🔒 Acquired message lock for roomId:', roomId);
  }
}

/**
 * Release a message lock for a room (allows messages to be sent again)
 */
export function releaseMessageLock(roomId: string): void {
  if (roomId) {
    messageLocks.set(roomId, false);
    console.log('[LLM Response Interceptor] 🔓 Released message lock for roomId:', roomId);
  }
}

/**
 * Check if a message lock is active for a room
 */
export function isMessageLocked(roomId: string | undefined): boolean {
  if (!roomId) return false;
  return messageLocks.get(roomId) === true;
}

// Time window in milliseconds - block agent messages if action executed within this window
// Increased to 10 seconds to catch the "No action found" follow-up responses that happen after action execution
const ACTION_EXECUTION_BLOCK_WINDOW_MS = 10000; // 10 seconds

// Time window in milliseconds - block agent messages if another agent message was sent recently
// This catches duplicates from "No action found" follow-up responses
// Increased to 10 seconds to catch the "No action found" follow-up that happens immediately after first response
const AGENT_MESSAGE_BLOCK_WINDOW_MS = 10000; // 10 seconds - increased to catch "No action found" follow-ups

/**
 * Records that an action handler has executed for a given room
 * This is used to prevent duplicate LLM responses after action execution
 */
export function recordActionExecution(roomId: string): void {
  if (roomId) {
    const timestamp = Date.now();
    actionExecutionTimestamps.set(roomId, timestamp);
    console.log('[LLM Response Interceptor] ✅ Recorded action execution for roomId:', roomId, 'timestamp:', timestamp);
    console.log('[LLM Response Interceptor] Map size after recording:', actionExecutionTimestamps.size);
    console.log('[LLM Response Interceptor] All roomIds in map:', Array.from(actionExecutionTimestamps.keys()));
  } else {
    console.log('[LLM Response Interceptor] ⚠️ WARNING: recordActionExecution called with empty roomId!');
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
  
  // CRITICAL FIX: Patch LLM generation method to block evaluate step hallucinations AND onboarding LLM responses
  // The research identifies that the second message comes from the evaluate step
  // which uses a small model that hallucinates conversational responses
  // By patching the completion/generation method, we can block these at the source
  // Note: runtime.completion may not exist on IAgentRuntime type, so we use type assertion
  const runtimeAny = runtime as any;
  
  // DEBUG: Log all runtime properties to find the actual LLM method
  console.log('[LLM Response Interceptor] 🔍 Searching for LLM generation method...');
  console.log('[LLM Response Interceptor] Runtime keys:', Object.keys(runtimeAny).slice(0, 20).join(', '));
  if (runtimeAny.completion) {
    console.log('[LLM Response Interceptor] Found runtime.completion, keys:', Object.keys(runtimeAny.completion).join(', '));
  }
  if (runtimeAny.generateText) {
    console.log('[LLM Response Interceptor] Found runtime.generateText');
  }
  if (runtimeAny.generate) {
    console.log('[LLM Response Interceptor] Found runtime.generate');
  }
  if (runtimeAny.completionService) {
    console.log('[LLM Response Interceptor] Found runtime.completionService, keys:', Object.keys(runtimeAny.completionService).join(', '));
  }
  
  if (runtimeAny.completion && typeof runtimeAny.completion.generateText === 'function') {
    const originalGenerateText = runtimeAny.completion.generateText.bind(runtimeAny.completion);
    runtimeAny.completion.generateText = async function(...args: any[]) {
      // NEW APPROACH: Allow LLM to generate onboarding messages
      // The provider now gives exact messages for LLM to use word-for-word
      // No blocking needed - LLM will use the exact messages from provider context
      
      // Still check if an action was recently executed to prevent evaluate step hallucinations
      // (but allow onboarding messages since they're now controlled by provider)
      const actionWasRecent = Array.from(actionExecutionTimestamps.entries()).some(([roomId, timestamp]) => {
        const elapsed = Date.now() - timestamp;
        return elapsed < ACTION_EXECUTION_BLOCK_WINDOW_MS;
      });
      
      if (actionWasRecent) {
        console.log('[LLM Response Interceptor] 🚫 BLOCKING generateText - action was executed recently, preventing evaluate step hallucination');
        // Return empty response to prevent the evaluate step from generating text
        return { text: '', action: null, reasoning: null };
      }
      
      // Call original method
      return originalGenerateText.apply(this, args);
    };
    console.log('[LLM Response Interceptor] ✅ Patched runtime.completion.generateText (onboarding messages now handled by provider)');
  } else {
    console.log('[LLM Response Interceptor] ⚠️ runtime.completion.generateText not found, skipping LLM generation patch');
  }
  
  // Patch messageManager.createMemory to track user messages and intercept restart commands
  runtime.messageManager.createMemory = async (memory: Memory) => {
    // Log ALL memory creation to debug why agent messages aren't being created
    const isAgent = memory.userId === runtime.agentId;
    const textPreview = memory.content.text?.substring(0, 50) || '(empty)';
    console.log(`[LLM Response Interceptor] Memory created - userId: ${memory.userId}, agentId: ${runtime.agentId}, isAgent: ${isAgent}, text: ${textPreview}, roomId: ${memory.roomId}`);
    
    // CRITICAL: Check for OnboardingInProgressError in memory metadata
    // This error is thrown by the provider during onboarding to prevent LLM generation
    // If we see this error, we should block the message creation
    const metadata = memory.content.metadata as any;
    if (metadata?.onboardingInProgress === true || metadata?.error?.includes('ONBOARDING_IN_PROGRESS')) {
      console.log('[LLM Response Interceptor] 🚫 Blocking memory creation - OnboardingInProgressError detected');
      // Return minimal memory object without calling originalCreateMemory
      return {
        id: undefined,
        userId: memory.userId,
        agentId: memory.agentId,
        roomId: memory.roomId,
        content: {
          text: '',
          metadata: {
            blocked: true,
            reason: 'onboarding_in_progress'
          }
        },
        createdAt: Date.now()
      } as any;
    }
    
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
      
      // Update onboarding step cache for this user (async, but we'll use cached value for blocking)
      getOnboardingStep(runtime, memory.userId).then(step => {
        onboardingStepCache.set(memory.userId, step);
        console.log(`[LLM Response Interceptor] Cached onboarding step for user ${memory.userId}: ${step}`);
      }).catch(() => {
        // Silently fail - cache will be updated on next check
      });
      
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
        // CRITICAL: The timeout callback should NOT send messages directly
        // It should just call the action handler, which will send messages via its callback
        // This prevents duplicate messages (timeout sends + action handler sends)
        setTimeout(async () => {
          const pending = pendingRestartCommands.get(memory.roomId);
          if (pending) {
            console.log('[LLM Response Interceptor] Timeout reached, no response received, forcing action execution');
            pendingRestartCommands.delete(memory.roomId);
            
            // Create a simple callback that just creates memory with EMPTY TEXT - don't send
            // The action handler will send the message via its callback
            // This prevents the timeout callback from sending a duplicate message
            const callback = async (response: { text: string }): Promise<any[]> => {
              console.log('[LLM Response Interceptor] Timeout callback - action handler will send message, creating memory with empty text to prevent sending');
              
              // Create memory with EMPTY TEXT so it doesn't get sent
              // The action handler's callback will actually send the message
              // Mark it to prevent re-processing by our interceptor
              const greetingMemory = await runtime.messageManager.createMemory({
                id: undefined,
                userId: runtime.agentId,
                agentId: runtime.agentId,
                roomId: memory.roomId,
                content: {
                  text: '', // EMPTY TEXT - prevents sending, action handler will send it
                  source: 'telegram',
                  // Add marker to prevent re-processing
                  metadata: { timeoutCreated: true }
                }
              });
              console.log('[LLM Response Interceptor] Greeting memory created with empty text (action handler will send message)');
              
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
      const currentTime = Date.now();
      console.log(`[LLM Response Interceptor] ========== AGENT MESSAGE INTERCEPTED ==========`);
      console.log(`[LLM Response Interceptor] Timestamp: ${currentTime}`);
      console.log(`[LLM Response Interceptor] Agent message detected, roomId: ${memory.roomId}, text: ${messageText}`);
      console.log(`[LLM Response Interceptor] Checking if action was executed recently for this agent message...`);
      
      // Skip processing if this message was created by timeout callback
      const isTimeoutCreated = (memory.content.metadata as any)?.timeoutCreated === true;
      if (isTimeoutCreated) {
        console.log('[LLM Response Interceptor] Skipping - message created by timeout callback');
        return await originalCreateMemory(memory);
      }
      
      // CRITICAL FIX: Block agent messages if an action was executed recently
      // BUT: Allow action handler callbacks - they are the ones that should send messages
      // Action handler callbacks have metadata.fromActionHandler: true
      const isFromActionHandler = (memory.content.metadata as any)?.fromActionHandler === true;
      
      if (isFromActionHandler) {
        console.log('[LLM Response Interceptor] ✅ ALLOWING agent message - from action handler callback (should send message)');
      } else {
        // NEW APPROACH: Allow LLM to generate onboarding messages
        // The provider now gives exact messages for LLM to use word-for-word
        // No blocking needed - LLM will use the exact messages from provider context
        console.log('[LLM Response Interceptor] ✅ Allowing LLM message generation (onboarding messages now handled by provider)');
      }
      
      // CRITICAL: Check if message lock is active (action handler is executing)
      if (isMessageLocked(memory.roomId)) {
        console.log('[LLM Response Interceptor] 🚫 BLOCKING agent message - message lock is active (action handler executing)');
        console.log('[LLM Response Interceptor] Blocked message text:', messageText);
        // Return empty memory with action removed to prevent both sending AND action execution
        return await originalCreateMemory({
          ...memory,
          content: {
            ...memory.content,
            text: '', // Empty text prevents sending
            action: undefined // Remove action to prevent duplicate execution
          }
        });
      }
      
      // CRITICAL FIX: Block agent messages if an action was executed recently
      // This prevents ElizaOS from generating a duplicate response after action execution
      // Even if the provider wasn't called (which seems to be the case for follow-up responses)
      console.log('[LLM Response Interceptor] 🔍 Checking action execution status before blocking check...');
      console.log('[LLM Response Interceptor] Current map size:', actionExecutionTimestamps.size);
      console.log('[LLM Response Interceptor] All roomIds in map:', Array.from(actionExecutionTimestamps.keys()));
      const actionWasRecent = wasActionExecutedRecently(memory.roomId);
      if (actionWasRecent) {
        console.log('[LLM Response Interceptor] 🚫 BLOCKING agent message - action was executed recently, preventing duplicate response');
        console.log('[LLM Response Interceptor] Blocked message text:', messageText);
        // Return empty memory with action removed to prevent both sending AND action execution
        return await originalCreateMemory({
          ...memory,
          content: {
            ...memory.content,
            text: '', // Empty text prevents sending
            action: undefined // Remove action to prevent duplicate execution
          }
        });
      } else {
        console.log('[LLM Response Interceptor] ✅ Action was NOT recent, allowing agent message');
      }
      
      // CRITICAL FIX: Block agent messages if another agent message was sent very recently
      // BUT: Allow action handler callbacks - they are the ones that should send messages
      
      if (!isFromActionHandler) {
        // Only check rapid consecutive messages for LLM-generated messages, not action handler callbacks
        const lastAgentMessageTime = lastAgentMessageTimestamps.get(memory.roomId);
        if (lastAgentMessageTime && memory.content.text && memory.content.text.trim()) {
          const elapsed = Date.now() - lastAgentMessageTime;
          console.log(`[LLM Response Interceptor] 🔍 Checking rapid consecutive message - elapsed: ${elapsed}ms, window: ${AGENT_MESSAGE_BLOCK_WINDOW_MS}ms`);
          if (elapsed < AGENT_MESSAGE_BLOCK_WINDOW_MS) {
            console.log(`[LLM Response Interceptor] 🚫 BLOCKING agent message - another agent message was sent ${elapsed}ms ago (window: ${AGENT_MESSAGE_BLOCK_WINDOW_MS}ms), preventing duplicate`);
            console.log(`[LLM Response Interceptor] Blocked message text: ${messageText}`);
            console.log(`[LLM Response Interceptor] This is likely the "No action found" follow-up response - blocking to prevent duplicate`);
            // Return empty memory with action removed to prevent both sending AND action execution
            return await originalCreateMemory({
              ...memory,
              content: {
                ...memory.content,
                text: '', // Empty text prevents sending
                action: undefined // Remove action to prevent duplicate execution
              }
            });
          } else {
            console.log(`[LLM Response Interceptor] ✅ Allowing agent message - elapsed time (${elapsed}ms) is outside block window (${AGENT_MESSAGE_BLOCK_WINDOW_MS}ms)`);
          }
        } else if (!lastAgentMessageTime) {
          console.log(`[LLM Response Interceptor] ⚠️ No previous agent message timestamp found for roomId: ${memory.roomId}`);
        }
      } else {
        console.log(`[LLM Response Interceptor] ✅ ALLOWING agent message - from action handler callback (bypassing rapid consecutive check)`);
      }
      
      // CRITICAL: Record timestamp BEFORE checking for rapid consecutive messages
      // This ensures the timestamp is available for the second message check
      // We record it here (before sending) so the second message sees it immediately
      if (memory.content.text && memory.content.text.trim()) {
        const now = Date.now();
        lastAgentMessageTimestamps.set(memory.roomId, now);
        console.log(`[LLM Response Interceptor] ✅ Allowing agent message - recorded timestamp: ${now} for roomId: ${memory.roomId}`);
        console.log(`[LLM Response Interceptor] 📊 Timestamp map size: ${lastAgentMessageTimestamps.size}, roomIds: [${Array.from(lastAgentMessageTimestamps.keys()).join(', ')}]`);
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
        
        // CRITICAL: Check if action was executed recently BEFORE sending
        // BUT: Allow action handler callbacks - they are the ones that should send messages
        const isFromActionHandler = (memory.content.metadata as any)?.fromActionHandler === true;
        
        if (!isFromActionHandler) {
          // Only block LLM-generated messages, not action handler callbacks
          const actionWasRecent = wasActionExecutedRecently(memory.roomId);
          if (actionWasRecent) {
            console.log('[LLM Response Interceptor] 🚫 BLOCKING agent message - action was executed recently, preventing duplicate');
            console.log('[LLM Response Interceptor] Blocked message text:', memory.content.text?.substring(0, 50));
            // Return empty memory to prevent sending
            return await originalCreateMemory({
              ...memory,
              content: {
                ...memory.content,
                text: '' // Empty text prevents sending
              }
            });
          }
        } else {
          console.log('[LLM Response Interceptor] ✅ ALLOWING agent message - from action handler callback (should send via Telegram)');
        }
        
        if (telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
          try {
            console.log('[LLM Response Interceptor] Sending agent message directly via Telegram API to chat:', telegramChatId);
            console.log('[LLM Response Interceptor] Creating new Telegraf instance...');
            const Telegraf = (await import('telegraf')).Telegraf;
            const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
            
            // Apply instance patcher if available
            const { telegrafInstancePatcher } = await import('../index.js');
            if (telegrafInstancePatcher) {
              console.log('[LLM Response Interceptor] Applying instance patcher to new Telegraf instance...');
              telegrafInstancePatcher(bot);
            }
            
            console.log('[LLM Response Interceptor] Calling bot.telegram.sendMessage - this should be intercepted by instance patcher');
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
              // Check if this empty message came from an action handler that already sent the message
              const metadata = memory.content.metadata as any || {};
              const fromActionHandler = metadata?.fromActionHandler || metadata?.sentViaDirectAPI;
              
              if (fromActionHandler) {
                console.log('[LLM Response Interceptor] Empty message came from action handler (already sent), skipping force-execution to prevent infinite loop');
                lastUserMessagePerRoom.delete(memory.roomId);
                return await originalCreateMemory(memory);
              }
              
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

