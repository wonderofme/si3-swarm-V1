import { Evaluator, IAgentRuntime, Memory, State } from '@elizaos/core';
import { getOnboardingStep } from './utils.js';

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

export const onboardingEvaluator: Evaluator = {
  name: 'onboarding_evaluator',
  description: 'Tracks onboarding progress and extracts user info based on the current step.',
  similes: ['track onboarding', 'extract profile data'],
  examples: [],
  
  handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<any> => {
    console.log(`[Onboarding Evaluator] 🔍 Evaluator called - userId: ${message.userId}, roomId: ${message.roomId}, text: ${message.content.text?.substring(0, 50) || '(empty)'}`);
    console.log(`[Onboarding Evaluator] State available: ${!!state}, state keys: ${state ? Object.keys(state).join(', ') : 'none'}`);
    
    const userId = message.userId;
    const step = await getOnboardingStep(runtime, userId);
    const text = (message.content.text || '').trim();
    
    console.log(`[Onboarding Evaluator] Current step: ${step}`);
    
    // Check for restart commands - if detected, force onboarding step to NONE
    if (isRestartCommand(text)) {
      console.log('[Onboarding Evaluator] Restart command detected:', text);
      if (state) {
        state.onboardingStep = 'NONE';
        state.forceOnboardingAction = true; // Flag to force action
        state.restartDetected = true; // Additional flag
        state.skipLLMResponse = false; // Allow LLM for restart
        console.log('[Onboarding Evaluator] Set skipLLMResponse=false for restart');
      }
      return 'NONE';
    }
    
    if (step === 'NONE' || step === 'COMPLETED') {
      if (state) {
        state.skipLLMResponse = false; // Allow LLM for completed/none
        console.log('[Onboarding Evaluator] Set skipLLMResponse=false for NONE/COMPLETED');
      }
      return null;
    }

    // NEW APPROACH: Allow LLM to generate onboarding messages
    // The provider now gives exact messages for LLM to use word-for-word
    // BUT: Block LLM if we're in ASK_NAME and user has provided text that looks like a name
    // This prevents the greeting from being sent again when user responds with their name
    if (state) {
      state.onboardingStep = step;
      
      // CRITICAL: If we're in ASK_NAME step and user has provided text that looks like a name,
      // block LLM response - the action handler will update state and trigger the next message
      if (step === 'ASK_NAME') {
        const userText = (message.content.text || '').trim();
        const looksLikeName = userText.length > 0 && 
                              !isRestartCommand(userText) && 
                              userText.length < 100 &&
                              userText.length >= 1;
        
        if (looksLikeName) {
          state.skipLLMResponse = true; // Block LLM - action handler will handle this
          console.log(`[Onboarding Evaluator] ASK_NAME step with name-like input - blocking LLM to prevent duplicate greeting`);
        } else {
          state.skipLLMResponse = false; // Allow LLM for initial greeting
          console.log(`[Onboarding Evaluator] ASK_NAME step (initial greeting) - allowing LLM`);
        }
      } else {
        state.skipLLMResponse = false; // Allow LLM for all other steps
        console.log(`[Onboarding Evaluator] Step ${step} - allowing LLM to generate (will use exact messages from provider)`);
      }
    }
    
    return step;
  },

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    return true;
  }
};

