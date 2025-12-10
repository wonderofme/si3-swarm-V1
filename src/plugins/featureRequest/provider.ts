import { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';

// Exact messages for LLM to use word-for-word (like onboarding)
const FEATURE_REQUEST_PROMPT_ASK_DETAILS = `[FEATURE REQUEST PROMPT] - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

Great! I'd love to hear your feature request. What would you like me to be able to do? Please describe the feature in detail.

After sending this message, wait for the user's response with their feature request details.]`;

const FEATURE_REQUEST_PROMPT_CANT_DO = `[FEATURE REQUEST PROMPT] - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

I am not able to perform that request yet, but will be able to do a lot more soon.

I am taking feature requests! What would you like me to do?

After sending this message, wait for the user's response.]`;

const FEATURE_REQUEST_PROMPT_ACKNOWLEDGE = `[FEATURE REQUEST PROMPT] - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

Thank you for your feature request! I've sent it to our team at opereayoola@gmail.com. We'll review it and work on adding it soon. 💜

After sending this message, use action: SUBMIT_FEATURE_REQUEST to send the email.]`;

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
    
    // Check if an action was just executed (feature request was submitted)
    const hasAction = state?.actionNames && state.actionNames.length > 0;
    const isFeatureRequestAction = hasAction && state.actionNames?.includes('SUBMIT_FEATURE_REQUEST');
    
    if (isFeatureRequestAction) {
      // Action just executed - acknowledge and tell LLM to use the action
      console.log(`[Feature Request Provider] ✅ Action executed, returning acknowledgment prompt`);
      return FEATURE_REQUEST_PROMPT_ACKNOWLEDGE;
    }
    
    // Check if user explicitly wants to make a feature request (asking to make one, not providing details)
    const hasRequestPhrase = 
      userText.includes('feature request') ||
      userText.includes('request for') ||
      userText.includes('request a') ||
      userText.includes('request new') ||
      userText.includes('suggest a feature') ||
      userText.includes('feature suggestion') ||
      userText.includes('new feature') ||
      userText.includes('add a feature') ||
      userText.includes('add feature') ||
      userText.includes('suggest feature');
    
    const hasActionPhrase = 
      userText.includes('make') ||
      userText.includes('submit') ||
      userText.includes('send') ||
      userText.includes('request') ||
      userText.includes('suggest') ||
      userText.includes('add');
    
    const hasWantPhrase = 
      userText.includes('want') || 
      userText.includes('would like') || 
      userText.includes('like to') ||
      userText.includes('id like') ||
      userText.includes('i\'d like') ||
      userText.includes('need') ||
      userText.includes('wish');
    
    const wantsToMakeFeatureRequest = 
      hasRequestPhrase && (hasActionPhrase || hasWantPhrase);
    
    const directVariations = 
      userText.includes('make a feature request') ||
      userText.includes('submit a feature request') ||
      userText.includes('send a feature request') ||
      userText.includes('make feature request') ||
      userText.includes('request for new feature') ||
      userText.includes('request a feature') ||
      userText.includes('request new feature') ||
      userText.includes('suggest a feature') ||
      userText.includes('add a feature') ||
      userText.includes('add feature') ||
      (userText.includes('feature') && (userText.includes('request') || userText.includes('suggest') || userText.includes('add')));
    
    if (wantsToMakeFeatureRequest || directVariations) {
      // User wants to make a feature request - ask for details
      console.log(`[Feature Request Provider] ✅ User wants to make feature request, returning ASK_DETAILS prompt`);
      return FEATURE_REQUEST_PROMPT_ASK_DETAILS;
    }
    
    // Check if the message seems like a request the bot can't fulfill
    // (but NOT if they're explicitly asking to make a feature request - handled above)
    const isAskingToMakeFeature = 
      (userText.includes('add') && userText.includes('feature')) ||
      (userText.includes('suggest') && userText.includes('feature')) ||
      (userText.includes('make') && userText.includes('feature'));
    
    const isFeatureRequestTrigger = 
      (userText.includes('can you') ||
      userText.includes('could you') ||
      userText.includes('i need') ||
      userText.includes('i want') ||
      userText.includes('please') ||
      userText.includes('help me')) &&
      !userText.includes('feature request') &&
      !isAskingToMakeFeature;
    
    if (isFeatureRequestTrigger) {
      // Bot can't do something - suggest feature requests
      console.log(`[Feature Request Provider] ✅ Bot can't fulfill request, returning CANT_DO prompt`);
      return FEATURE_REQUEST_PROMPT_CANT_DO;
    }
    
    return null;
  },
};

