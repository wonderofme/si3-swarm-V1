import { Evaluator, IAgentRuntime, Memory, State } from '@elizaos/core';
import { getOnboardingStep } from './utils.js';

export const onboardingEvaluator: Evaluator = {
  name: 'onboarding_evaluator',
  description: 'Tracks onboarding progress and extracts user info based on the current step.',
  similes: ['track onboarding', 'extract profile data'],
  examples: [],
  
  handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<any> => {
    const userId = message.userId;
    const step = await getOnboardingStep(runtime, userId);
    const text = message.content.text?.toLowerCase() || '';
    
    // Check for restart commands - if detected, force onboarding step to NONE
    if (text.includes('restart') || 
        text.includes('pretend this is my first') ||
        text.includes('start over') ||
        text.includes('begin again') ||
        text.includes('can we start') ||
        text.includes('start the onboarding')) {
      if (state) {
        state.onboardingStep = 'NONE';
        state.forceOnboardingAction = true; // Flag to force action
      }
      return 'NONE';
    }
    
    if (step === 'NONE' || step === 'COMPLETED') {
      return null;
    }

    // Inject into state so actions can use it
    if (state) {
      state.onboardingStep = step;
    }
    
    return step;
  },

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    return true;
  }
};

