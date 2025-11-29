import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { getOnboardingStep, updateOnboardingStep, getUserProfile } from './utils.js';
import { OnboardingStep } from './types.js';

export const continueOnboardingAction: Action = {
  name: 'CONTINUE_ONBOARDING',
  description: 'Advances the onboarding flow by saving user input and asking the next question.',
  similes: ['NEXT_STEP', 'SAVE_PROFILE', 'ANSWER_ONBOARDING'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const step = await getOnboardingStep(runtime, message.userId);
    return step !== 'COMPLETED';
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    let currentStep = await getOnboardingStep(runtime, message.userId);
    const text = message.content.text;
    const roomId = message.roomId;

    // 1. START -> ASK_NAME
    if (currentStep === 'NONE') {
      // Start the flow
      await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_NAME');
      // For the first step, we can use callback to ensure the greeting is perfect
      if (callback) {
        callback({
          text: "Hola! I’m Agent Kaia, created by SI<3>. I'm excited to help you navigate Web3! To get started, can you tell me your name? 🌟",
          action: 'CONTINUE_ONBOARDING'
        });
      }
      return true;
    }

    // 2. Handle Answers & Advance
    
    let nextStep: OnboardingStep = currentStep;
    // responseText is NO LONGER USED for callbacks in intermediate steps.
    // We rely on the LLM to generate the text.
    // However, we update the state/script flow in the database.

    switch (currentStep) {
      case 'ASK_NAME':
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LOCATION', { name: text });
        break;

      case 'ASK_LOCATION':
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_ROLE', { location: text });
        break;

      case 'ASK_ROLE':
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_INTERESTS', { roles: [text] }); 
        break;

      case 'ASK_INTERESTS':
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_CONNECTION_GOALS', { interests: [text] });
        break;

      case 'ASK_CONNECTION_GOALS':
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_EVENTS', { connectionGoals: [text] });
        break;

      case 'ASK_EVENTS':
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_SOCIALS', { events: [text] });
        break;

      case 'ASK_SOCIALS':
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_GENDER', { socials: [text] });
        break;

      case 'ASK_GENDER':
        await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { gender: text });
        break;

      case 'CONFIRMATION':
        if (text.toLowerCase().includes('confirm') || text.toLowerCase().includes('yes')) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'COMPLETED', { isConfirmed: true });
        }
        break;
    }

    // NO CALLBACK calls for intermediate steps.
    // We return true, which signals the action was successful.
    // The LLM will generate its own text response based on the updated state (conceptually).
    // WAIT: If we return true and NO callback, does the LLM generate text?
    // In standard Eliza, the loop generates text + action.
    // If we remove the "empty string" constraint, the LLM *will* generate text.
    // We just need to ensure it generates the CORRECT text (the next question).

    return true;
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Start onboarding" }
      },
      {
        user: "Kaia",
        content: { text: "Hola! I'm Kaia...", action: "CONTINUE_ONBOARDING" }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "My name is Alice" }
      },
      {
        user: "Kaia",
        content: { text: "What's your location?", action: "CONTINUE_ONBOARDING" }
      }
    ]
  ]
};
