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
      lastUserMessagePerRoom.set(memory.roomId, memory);
    }
    
    // For agent messages, check if this is after a restart command
    if (memory.userId === runtime.agentId && memory.roomId) {
      const lastUserMessage = lastUserMessagePerRoom.get(memory.roomId);
      
      if (lastUserMessage) {
        const userText = lastUserMessage.content.text || '';
        
        if (isRestartCommand(userText)) {
          // Check if this memory has an action or if we need to force it
          const hasActionInMemory = memory.content.action || 
                                    (memory.content.text && memory.content.text.includes('CONTINUE_ONBOARDING'));
          
          if (!hasActionInMemory && memory.content.text && memory.content.text.trim()) {
            console.log('[LLM Response Interceptor] Restart detected but LLM didn\'t use action, forcing action execution');
            console.log('[LLM Response Interceptor] LLM response was:', memory.content.text.substring(0, 100));
            
            // Create callback that will send the greeting
            const callback = async (response: { text: string }): Promise<any[]> => {
              // Create memory for the greeting message
              const greetingMemory = await originalCreateMemory({
                id: undefined,
                userId: runtime.agentId,
                agentId: runtime.agentId,
                roomId: lastUserMessage.roomId,
                content: {
                  text: response.text,
                  source: 'telegram'
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
            }
            lastUserMessagePerRoom.delete(memory.roomId); // Clear tracked message
          }
        }
      }
    }
    
    return await originalCreateMemory(memory);
  };
  
  console.log('[LLM Response Interceptor] Patched messageManager.createMemory for restart command interception');
}

