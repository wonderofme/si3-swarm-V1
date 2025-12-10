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
    return `[FEATURE REQUEST CONTEXT]
    
You can help users submit feature requests. Here's how to handle different scenarios:

1. **When a user asks for something you cannot do:**
   - Respond with: "I am not able to perform that request yet, but will be able to do a lot more soon. I am taking feature requests! What would you like me to do?"
   - Wait for their response with feature details
   - When they provide feature details, use action: SUBMIT_FEATURE_REQUEST to send it to opereayoola@gmail.com
   - After sending, acknowledge: "Thank you for your feature request! I've sent it to our team at opereayoola@gmail.com. We'll review it and work on adding it soon. 💜"

2. **When a user says they want to suggest/make a feature request:**
   - Ask them for details: "Great! I'd love to hear your feature request. What would you like me to be able to do? Please describe the feature in detail."
   - Wait for their response with feature details
   - When they provide details, use action: SUBMIT_FEATURE_REQUEST to send it
   - Acknowledge after sending

3. **When a user directly suggests a feature in one message:**
   - If they provide actual feature details (not just "I want to make a feature request"), use action: SUBMIT_FEATURE_REQUEST immediately
   - Acknowledge after sending

**Important:** Only use action: SUBMIT_FEATURE_REQUEST when the user has provided actual feature details, not when they're just asking to make a feature request. The action will send their message to opereayoola@gmail.com.`;
  },
};

