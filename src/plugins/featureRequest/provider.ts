import { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';

const FEATURE_REQUEST_PROMPT = `I am not able to perform that request yet, but will be able to do a lot more soon.

I am taking feature requests! What would you like me to do?`;

export const featureRequestProvider: Provider = {
  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string | null> => {
    // Only provide feature request prompt if:
    // 1. User is not in onboarding
    // 2. No specific action was triggered
    // 3. The LLM response indicates it can't fulfill the request
    
    // Check if user is in onboarding
    try {
      const { getOnboardingStep } = await import('../onboarding/utils.js');
      const step = await getOnboardingStep(runtime, message.userId);
      if (step && step !== 'COMPLETED' && step !== 'NONE') {
        return null; // Don't show feature request during onboarding
      }
    } catch (error) {
      // If we can't check onboarding, continue
    }
    
    // Check if any action was triggered
    const hasAction = state?.actionNames && state.actionNames.length > 0;
    if (hasAction) {
      return null; // Don't show feature request if an action was triggered
    }
    
    // Check if the message seems like a request the bot can't fulfill
    const userText = (message.content.text || '').toLowerCase();
    const isFeatureRequestTrigger = 
      userText.includes('can you') ||
      userText.includes('could you') ||
      userText.includes('i need') ||
      userText.includes('i want') ||
      userText.includes('please') ||
      userText.includes('help me') ||
      userText.length > 20; // Substantial message
    
    if (isFeatureRequestTrigger) {
      // Return the feature request prompt
      // The LLM will use this when it can't fulfill a request
      return FEATURE_REQUEST_PROMPT;
    }
    
    return null;
  },
};

