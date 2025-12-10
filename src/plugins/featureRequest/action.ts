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
    
    // Don't trigger if user is just saying they want to make a feature request
    // Only trigger when they actually provide the feature request details
    // Check for combinations: (want/would like/i'd like/id like/like) + (make/submit/send) + "feature request"
    const hasWantPhrase = 
      text.includes('want') || 
      text.includes('would like') || 
      text.includes('like to') ||
      text.includes('id like') ||
      text.includes('i\'d like') ||
      (text.includes('like') && (text.includes('make') || text.includes('submit') || text.includes('send')));
    const hasMakePhrase = text.includes('make') || text.includes('submit') || text.includes('send');
    const hasFeatureRequest = text.includes('feature request');
    
    // If they have all three components, they're asking to make one, not providing details
    const isJustRequestingToMake = hasFeatureRequest && hasMakePhrase && hasWantPhrase;
    
    // Also check for simpler variations
    const simpleRequestVariations = 
      text.includes('make a feature request') ||
      text.includes('submit a feature request') ||
      text.includes('send a feature request') ||
      (text.includes('feature request') && (text.includes('make') || text.includes('submit') || text.includes('send')) && text.length < 60);
    
    if (isJustRequestingToMake || simpleRequestVariations) {
      return false; // Don't trigger - they're just asking to make one, not providing details
    }
    
    // Trigger when user provides actual feature request content:
    // - They've provided substantial details (not just "I want feature request")
    // - They're responding to the feature request prompt with actual content
    // - Must NOT be asking to make a feature request
    const hasSubstantialContent = text.length > 20; // Substantial message with details
    const isFeatureRequestResponse = 
      (text.includes('i would like') && !text.includes('feature request')) ||
      (text.includes('i want') && !text.includes('feature request')) ||
      text.includes('can you') ||
      text.includes('could you') ||
      text.includes('it should') ||
      text.includes('it would be') ||
      text.includes('i need') ||
      (text.length > 30 && !text.includes('feature request')); // Long message that's not about making a request
    
    return hasSubstantialContent && isFeatureRequestResponse;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: any,
    callback?: HandlerCallback
  ): Promise<void> => {
    console.log('[Feature Request Action] Handler started');
    
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
      
      const response = {
        text: `Thank you for your feature request! I've sent it to our team at opereayoola@gmail.com. We'll review it and work on adding it soon. 💜`
      };
      
      if (callback) {
        await callback(response);
      }
      
      console.log('[Feature Request Action] ✅ Feature request submitted successfully');
    } catch (error: any) {
      console.error('[Feature Request Action] ❌ Error submitting feature request:', error);
      
      // Provide more helpful error message based on error type
      let errorMessage = `I encountered an issue sending your feature request. `;
      
      if (error.message?.includes('not configured')) {
        errorMessage += `The email service is not configured yet. Your request has been logged. Please contact opereayoola@gmail.com directly for now.`;
      } else if (error.message?.includes('authentication failed')) {
        errorMessage += `There's an issue with the email configuration. Your request has been logged. Please contact opereayoola@gmail.com directly.`;
      } else {
        errorMessage += `Please try again later or contact opereayoola@gmail.com directly.`;
      }
      
      const errorResponse = {
        text: errorMessage
      };
      
      if (callback) {
        await callback(errorResponse);
      }
    }
  },
};

