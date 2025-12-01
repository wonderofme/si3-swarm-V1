import { Evaluator, IAgentRuntime, Memory, State } from '@elizaos/core';
import { getOnboardingStep } from './utils.js';
import { OnboardingStep } from './types.js';

export const onboardingEvaluator: Evaluator = {
  name: 'onboarding_evaluator',
  description: 'Tracks onboarding progress and extracts user info based on the current step.',
  similes: ['track onboarding', 'extract profile data'],
  examples: [],
  
  handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<any> => {
    const userId = message.userId;
    const step = await getOnboardingStep(runtime, userId);
    
    if (step === 'NONE' || step === 'COMPLETED') {
      return null;
    }

    const text = message.content.text;
    let extractedData: any = null;

    // Basic extraction logic (this can be enhanced with LLM calls later)
    switch (step) {
      case 'ASK_NAME':
        extractedData = { name: text };
        break;
      case 'ASK_LOCATION':
        extractedData = { location: text };
        break;
      case 'ASK_ROLE':
        // Logic to parse "1, 4" or text
        extractedData = { rolesRaw: text }; 
        break;
      case 'ASK_INTERESTS':
        extractedData = { interestsRaw: text };
        break;
      case 'ASK_CONNECTION_GOALS':
        extractedData = { connectionGoalsRaw: text };
        break;
      case 'ASK_EVENTS':
        extractedData = { events: text };
        break;
      case 'ASK_SOCIALS':
        extractedData = { socials: text };
        break;
      case 'ASK_GENDER':
        extractedData = { gender: text };
        break;
      case 'CONFIRMATION':
        if (text.toLowerCase().includes('yes') || text.toLowerCase().includes('confirm')) {
          extractedData = { confirmed: true };
        }
        break;
    }

    // Inject into state so actions can use it
    if (state) {
      state.onboardingStep = step;
      state.extractedOnboardingData = extractedData;
    }

    return extractedData;
  },

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const step = await getOnboardingStep(runtime, message.userId);
    return step !== 'NONE' && step !== 'COMPLETED';
  }
};



