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
    // Trust the LLM to call this action appropriately
    // The LLM has been instructed when to use this action
    // No validation needed - just send the email when LLM decides to call it
    const text = (message.content.text || '').trim();
    console.log(`[Feature Request Action] Validate called with: "${text.substring(0, 50)}..." - trusting LLM decision`);
    return text.length > 0; // Only require non-empty text
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

