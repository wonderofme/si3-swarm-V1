import { Action, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { sendFeatureRequest } from '../../services/featureRequest.js';

export const featureRequestAction: Action = {
  name: 'SUBMIT_FEATURE_REQUEST',
  description: 'Submit a feature request from a user',
  similes: ['feature request', 'suggestion', 'idea', 'request feature'],
  examples: [
    [
      {
        user: '{{user1}}',
        content: { text: 'I would like you to be able to send emails' }
      },
      {
        user: 'Kaia',
        content: { text: '', action: 'SUBMIT_FEATURE_REQUEST' }
      }
    ]
  ],
  
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content.text || '').toLowerCase().trim();
    
    console.log(`[Feature Request Action] Validate called with: "${text}"`);
    
    // Only trigger when user provides actual feature request DETAILS
    // Don't trigger if they're just asking to make a feature request
    
    // Block if they're asking to make/submit/send a feature request
    const isAskingToMake = 
      (text.includes('feature request') && (text.includes('make') || text.includes('submit') || text.includes('send'))) ||
      (text.includes('add') && text.includes('feature') && (text.includes('like') || text.includes('want') || text.includes('need'))) ||
      (text.includes('suggest') && text.includes('feature') && (text.includes('like') || text.includes('want'))) ||
      text.includes('make a feature request') ||
      text.includes('submit a feature request') ||
      text.includes('send a feature request');
    
    if (isAskingToMake) {
      console.log(`[Feature Request Action] ❌ BLOCKING - user is asking to make a feature request, not providing details`);
      return false;
    }
    
    // Trigger when user provides actual feature request details:
    // - Substantial content (more than just "I want feature request")
    // - Contains actual request content (not meta-requests about making requests)
    const hasSubstantialContent = text.length > 20;
    const hasActualRequestContent = 
      text.includes('can you') ||
      text.includes('could you') ||
      text.includes('i would like') ||
      text.includes('i want') ||
      text.includes('i need') ||
      text.includes('it should') ||
      text.includes('it would be') ||
      (text.length > 30 && !text.includes('feature request')); // Long message that's not about making a request
    
    const shouldTrigger = hasSubstantialContent && hasActualRequestContent && !isAskingToMake;
    
    console.log(`[Feature Request Action] hasSubstantialContent: ${hasSubstantialContent}, hasActualRequestContent: ${hasActualRequestContent}, shouldTrigger: ${shouldTrigger}`);
    
    return shouldTrigger;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: any,
    callback?: HandlerCallback
  ): Promise<void> => {
    console.log('[Feature Request Action] Handler started - sending feature request email');
    
    const userText = message.content.text || '';
    const userId = message.userId;
    
    // Get user profile for name
    let userName = 'Unknown User';
    try {
      const { getUserProfile } = await import('../onboarding/utils.js');
      const profile = await getUserProfile(runtime, userId);
      userName = profile.name || userName;
    } catch (error) {
      console.error('[Feature Request Action] Error getting user profile:', error);
    }
    
    try {
      // Send the feature request via email
      await sendFeatureRequest(userId, userName, userText, userText);
      
      console.log('[Feature Request Action] ✅ Feature request email sent successfully');
      // Don't send response via callback - let the provider/LLM handle the acknowledgment message
    } catch (error: any) {
      console.error('[Feature Request Action] ❌ Error submitting feature request:', error);
      
      // Provide error message via callback if email fails
      let errorMessage = `I encountered an issue sending your feature request. `;
      
      if (error.message?.includes('not configured')) {
        errorMessage += `The email service is not configured yet. Your request has been logged. Please contact opereayoola@gmail.com directly for now.`;
      } else if (error.message?.includes('authentication failed')) {
        errorMessage += `There's an issue with the email configuration. Your request has been logged. Please contact opereayoola@gmail.com directly.`;
      } else {
        errorMessage += `Please try again later or contact opereayoola@gmail.com directly.`;
      }
      
      if (callback) {
        await callback({ text: errorMessage });
      }
    }
  },
};

