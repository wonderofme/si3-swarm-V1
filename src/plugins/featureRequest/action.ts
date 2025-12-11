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
    
    // Block if user is just saying they want to make/suggest a feature request (not providing details)
    const isJustAskingToMake = 
      text.includes('add a feature') ||
      text.includes('add feature') ||
      text.includes('suggest a feature') ||
      text.includes('make a feature request') ||
      text.includes('i\'d like to add') ||
      text.includes('id like to add') ||
      (text.includes('feature') && (text.includes('want') || text.includes('like') || text.includes('suggest')) && text.length < 50);
    
    if (isJustAskingToMake) {
      console.log(`[Feature Request Action] ❌ BLOCKING - user is just asking to make a feature request, not providing details`);
      return false; // Don't trigger - they need to provide details first
    }
    
    // Only trigger when user provides actual feature details
    const hasActualDetails = 
      text.length > 30 || // Substantial message
      text.includes('can you') ||
      text.includes('could you') ||
      text.includes('i would like') ||
      text.includes('i want') ||
      text.includes('it should') ||
      text.includes('it would be');
    
    console.log(`[Feature Request Action] hasActualDetails: ${hasActualDetails}, shouldTrigger: ${hasActualDetails && !isJustAskingToMake}`);
    
    return hasActualDetails && !isJustAskingToMake;
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
        errorMessage += `The email service is not configured yet. Your request has been logged. Please contact tech@si3.space directly for now.`;
      } else if (error.message?.includes('authentication failed')) {
        errorMessage += `There's an issue with the email configuration. Your request has been logged. Please contact tech@si3.space directly.`;
      } else {
        errorMessage += `Please try again later or contact tech@si3.space directly.`;
      }
      
      if (callback) {
        await callback({ text: errorMessage });
      }
    }
  },
};

