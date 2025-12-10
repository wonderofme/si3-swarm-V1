import { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';

const FEATURE_REQUEST_PROMPT_CANT_DO = `I am not able to perform that request yet, but will be able to do a lot more soon.

I am taking feature requests! What would you like me to do?`;

const FEATURE_REQUEST_PROMPT_ASK_DETAILS = `Great! I'd love to hear your feature request. What would you like me to be able to do? Please describe the feature in detail.`;

export const featureRequestProvider: Provider = {
  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string | null> => {
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
    
    const userText = (message.content.text || '').toLowerCase().trim();
    
    // Check if user explicitly wants to make a feature request
    // Look for combinations of: (want/would like/i'd like/id like/like) + (make/submit/send) + "feature request"
    // This handles variations like "I want to make a new feature request" or "id like to make a feature request"
    const hasWantPhrase = 
      userText.includes('want') || 
      userText.includes('would like') || 
      userText.includes('like to') ||
      userText.includes('id like') ||
      userText.includes('i\'d like') ||
      (userText.includes('like') && (userText.includes('make') || userText.includes('submit') || userText.includes('send')));
    const hasMakePhrase = userText.includes('make') || userText.includes('submit') || userText.includes('send');
    const hasFeatureRequest = userText.includes('feature request');
    
    // If they have all three components, they're asking to make a feature request
    const wantsToMakeFeatureRequest = hasFeatureRequest && hasMakePhrase && hasWantPhrase;
    
    // Also check for simpler variations
    const simpleVariations = 
      userText.includes('make a feature request') ||
      userText.includes('submit a feature request') ||
      userText.includes('send a feature request') ||
      userText.includes('make feature request') ||
      (userText.includes('feature request') && (userText.includes('make') || userText.includes('submit') || userText.includes('send')));
    
    if (wantsToMakeFeatureRequest || simpleVariations) {
      // User wants to make a feature request - ask for details
      return FEATURE_REQUEST_PROMPT_ASK_DETAILS;
    }
    
    // Check if any action was triggered
    const hasAction = state?.actionNames && state.actionNames.length > 0;
    if (hasAction) {
      return null; // Don't show feature request if an action was triggered
    }
    
    // Check if the message seems like a request the bot can't fulfill
    // (but NOT if they're explicitly asking to make a feature request - handled above)
    const isFeatureRequestTrigger = 
      (userText.includes('can you') ||
      userText.includes('could you') ||
      userText.includes('i need') ||
      userText.includes('i want') ||
      userText.includes('please') ||
      userText.includes('help me')) &&
      !userText.includes('feature request'); // Don't trigger if they're asking about feature requests
    
    if (isFeatureRequestTrigger) {
      // Return the feature request prompt for when bot can't do something
      return FEATURE_REQUEST_PROMPT_CANT_DO;
    }
    
    return null;
  },
};

