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
    const userId = message.userId;
    const step = await getOnboardingStep(runtime, userId);
    const text = (message.content.text || '').trim();
    
    // Check for restart commands - if detected, force onboarding step to NONE
    if (isRestartCommand(text)) {
      console.log('[Onboarding Evaluator] Restart command detected:', text);
      if (state) {
        state.onboardingStep = 'NONE';
        state.forceOnboardingAction = true; // Flag to force action
        state.restartDetected = true; // Additional flag
        state.skipLLMResponse = false; // Allow LLM for restart
      }
      return 'NONE';
    }
    
    if (step === 'NONE' || step === 'COMPLETED') {
      if (state) {
        state.skipLLMResponse = false; // Allow LLM for completed/none
      }
      return null;
    }

    // CRITICAL: During active onboarding steps, set flag to prevent LLM generation
    // The action handler will send all messages, so LLM should not respond
    // Exception: CONFIRMATION step allows LLM to generate summary
    if (state) {
      state.onboardingStep = step;
      if (step === 'CONFIRMATION') {
        state.skipLLMResponse = false; // Allow LLM for confirmation summary
        console.log('[Onboarding Evaluator] CONFIRMATION step - allowing LLM for summary');
      } else {
        state.skipLLMResponse = true; // Block LLM during all other onboarding steps
        console.log(`[Onboarding Evaluator] Step ${step} - setting skipLLMResponse=true to prevent LLM generation`);
      }
    }
    
    return step;
  },

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    return true;
  }
};

