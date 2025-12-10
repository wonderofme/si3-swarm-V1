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
    const isJustRequestingToMake = 
      text.includes('i\'d like to make a feature request') ||
      text.includes('i would like to make a feature request') ||
      text.includes('i want to make a feature request') ||
      text.includes('id like to make a feature request') ||
      (text.includes('feature request') && (text.includes('make') || text.includes('submit') || text.includes('send')) && text.length < 50);
    
    if (isJustRequestingToMake) {
      return false; // Don't trigger - they're just asking to make one, not providing details
    }
    
    // Trigger when user provides actual feature request content:
    // - They've provided substantial details (not just "I want feature request")
    // - They're responding to the feature request prompt with actual content
    const hasSubstantialContent = text.length > 20; // Substantial message with details
    const isFeatureRequestResponse = 
      text.includes('i would like') ||
      text.includes('i want') ||
      text.includes('can you') ||
      text.includes('could you') ||
      text.includes('it should') ||
      text.includes('it would be') ||
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
        text: `Thank you for your feature request! I've sent it to our team at tech@si3.space. We'll review it and work on adding it soon. 💜`
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
        errorMessage += `The email service is not configured yet. Your request has been logged. Please contact tech@si3.space directly for now.`;
      } else if (error.message?.includes('authentication failed')) {
        errorMessage += `There's an issue with the email configuration. Your request has been logged. Please contact tech@si3.space directly.`;
      } else {
        errorMessage += `Please try again later or contact tech@si3.space directly.`;
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

