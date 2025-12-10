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
    // Trigger when user explicitly mentions feature request or responds to the prompt
    return text.includes('feature request') || 
           text.includes('i would like') ||
           text.includes('i want') ||
           text.includes('can you') ||
           text.length > 10; // Any substantial response after the prompt
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
    } catch (error) {
      console.error('[Feature Request Action] ❌ Error submitting feature request:', error);
      
      const errorResponse = {
        text: `I encountered an issue sending your feature request. Please try again later or contact tech@si3.space directly.`
      };
      
      if (callback) {
        await callback(errorResponse);
      }
    }
  },
};

