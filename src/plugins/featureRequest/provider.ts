import { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';

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
    
    // Don't provide context if an action was just executed - let LLM handle acknowledgment naturally
    const hasAction = state?.actionNames && state.actionNames.length > 0;
    if (hasAction) {
      return null;
    }
    
    // Provide context to LLM about feature requests
    // The LLM will decide when to ask for feature requests and when to use the action
    const userText = (message.content.text || '').toLowerCase().trim();
    
    // Check if user is saying they want to suggest/make a feature request (not asking bot to do something)
    const wantsToSuggestFeature = 
      userText.includes('add a feature') ||
      userText.includes('add feature') ||
      userText.includes('suggest a feature') ||
      userText.includes('make a feature request') ||
      userText.includes('i\'d like to add') ||
      userText.includes('id like to add') ||
      userText.includes('want to suggest') ||
      userText.includes('want to make a feature');
    
    if (wantsToSuggestFeature) {
      return `[FEATURE REQUEST CONTEXT]
      
The user wants to suggest or make a feature request. They are NOT asking you to do something you can't do.

**You MUST:**
- Respond with: "Great! I'd love to hear your feature request. What would you like me to be able to do? Please describe the feature in detail."
- DO NOT respond with "I am not able to perform that request yet..." - that's only for when they ask you to do something you can't do
- Wait for their response with feature details
   - When they provide actual feature details, use action: SUBMIT_FEATURE_REQUEST to send it to tech@si3.space
   - After sending, acknowledge: "Thank you for your feature request! I've sent it to our team at tech@si3.space. We'll review it and work on adding it soon. 💜"

**DO NOT use action: SUBMIT_FEATURE_REQUEST now** - they haven't provided details yet, just said they want to suggest a feature.`;
    }
    
    return `[FEATURE REQUEST CONTEXT]
    
You can help users submit feature requests. Here's how to handle different scenarios:

1. **When a user asks for something you cannot do (e.g., "can you send emails?", "can you do X?"):**
   - Respond with: "I am not able to perform that request yet, but will be able to do a lot more soon. I am taking feature requests! What would you like me to do?"
   - Wait for their response with feature details
   - When they provide feature details, use action: SUBMIT_FEATURE_REQUEST to send it to opereayoola@gmail.com
   - After sending, acknowledge: "Thank you for your feature request! I've sent it to our team at opereayoola@gmail.com. We'll review it and work on adding it soon. 💜"

2. **When a user directly suggests a feature in one message with actual details:**
   - If they provide actual feature details (e.g., "I would like you to be able to send emails" or "It would be great if you could track my tasks"), use action: SUBMIT_FEATURE_REQUEST immediately
   - Acknowledge after sending

**Important:** Only use action: SUBMIT_FEATURE_REQUEST when the user has provided actual feature details, not when they're just saying they want to make a feature request. The action will send their message to tech@si3.space.`;
  },
};

