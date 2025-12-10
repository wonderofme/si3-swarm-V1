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
    
    // Don't trigger if user is just saying they want to make a feature request
    // Only trigger when they actually provide the feature request details
    
    // Phrases indicating they want to make/request a feature
    const hasRequestPhrase = 
      text.includes('feature request') ||
      text.includes('request for') ||
      text.includes('request a') ||
      text.includes('request new') ||
      text.includes('suggest a feature') ||
      text.includes('feature suggestion') ||
      text.includes('new feature') ||
      text.includes('add a feature') ||
      text.includes('add feature') ||
      text.includes('suggest feature');
    
    // Action words indicating they want to do something
    const hasActionPhrase = 
      text.includes('make') ||
      text.includes('submit') ||
      text.includes('send') ||
      text.includes('request') ||
      text.includes('suggest') ||
      text.includes('add');
    
    // Desire/intent words
    const hasWantPhrase = 
      text.includes('want') || 
      text.includes('would like') || 
      text.includes('like to') ||
      text.includes('id like') ||
      text.includes('i\'d like') ||
      text.includes('need') ||
      text.includes('wish');
    
    // If they mention feature-related terms AND have action/want phrases, they're asking to make one
    // Remove the length restriction - if they're asking to make a feature request, block it regardless of length
    const isJustRequestingToMake = 
      hasRequestPhrase && (hasActionPhrase || hasWantPhrase);
    
    // Also check for direct combinations (messages that are just requests, regardless of length)
    const simpleRequestVariations = 
      text.includes('make a feature request') ||
      text.includes('submit a feature request') ||
      text.includes('send a feature request') ||
      text.includes('request for new feature') ||
      text.includes('request a feature') ||
      text.includes('request new feature') ||
      text.includes('suggest a feature') ||
      text.includes('add a feature') ||
      text.includes('add feature') ||
      (text.includes('feature request') && (text.includes('make') || text.includes('submit') || text.includes('send'))) ||
      (text.includes('feature') && (text.includes('request') || text.includes('suggest') || text.includes('add')) && (text.includes('like') || text.includes('want') || text.includes('need')));
    
    console.log(`[Feature Request Action] isJustRequestingToMake: ${isJustRequestingToMake}, simpleRequestVariations: ${simpleRequestVariations}`);
    
    if (isJustRequestingToMake || simpleRequestVariations) {
      console.log(`[Feature Request Action] ❌ BLOCKING - user is just asking to make a feature request, not providing details`);
      return false; // Don't trigger - they're just asking to make one, not providing details
    }
    
    // Trigger when user provides actual feature request content:
    // - They've provided substantial details (not just "I want feature request")
    // - They're responding to the feature request prompt with actual content
    // - Must NOT be asking to make a feature request
    // - Must NOT contain any of the "requesting to make" phrases
    const hasSubstantialContent = text.length > 20; // Substantial message with details
    
    // Check if this is still a request to make a feature request (even if longer)
    const stillRequestingToMake = 
      (text.includes('feature request') && (text.includes('make') || text.includes('submit') || text.includes('send'))) ||
      (text.includes('add') && text.includes('feature') && (text.includes('like') || text.includes('want'))) ||
      (text.includes('suggest') && text.includes('feature') && (text.includes('like') || text.includes('want')));
    
    if (stillRequestingToMake) {
      console.log(`[Feature Request Action] ❌ BLOCKING - still requesting to make, not providing details`);
      return false;
    }
    
    const isFeatureRequestResponse = 
      (text.includes('i would like') && !text.includes('feature request') && !text.includes('feature')) ||
      (text.includes('i want') && !text.includes('feature request') && !text.includes('feature')) ||
      text.includes('can you') ||
      text.includes('could you') ||
      text.includes('it should') ||
      text.includes('it would be') ||
      text.includes('i need') ||
      (text.length > 30 && !text.includes('feature request') && !text.includes('feature')); // Long message that's not about making a request
    
    console.log(`[Feature Request Action] hasSubstantialContent: ${hasSubstantialContent}, isFeatureRequestResponse: ${isFeatureRequestResponse}`);
    
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
    
    const userText = (message.content.text || '').toLowerCase().trim();
    const userId = message.userId;
    
    // Safety check: Don't execute if user is just asking to make a feature request
    // This is a backup in case validation didn't catch it
    console.log(`[Feature Request Action] Safety check - userText: "${userText}", length: ${userText.length}`);
    
    const hasFeaturePhrase = userText.includes('feature request') || userText.includes('add feature') || userText.includes('suggest feature') || userText.includes('add a feature');
    const hasActionWord = userText.includes('make') || userText.includes('add') || userText.includes('suggest') || userText.includes('request');
    const hasWantWord = userText.includes('like') || userText.includes('want') || userText.includes('need') || userText.includes('wish');
    const isShort = userText.length < 100;
    
    console.log(`[Feature Request Action] Safety check - hasFeaturePhrase: ${hasFeaturePhrase}, hasActionWord: ${hasActionWord}, hasWantWord: ${hasWantWord}, isShort: ${isShort}`);
    
    const isJustRequesting = hasFeaturePhrase && hasActionWord && hasWantWord && isShort;
    
    if (isJustRequesting) {
      console.log('[Feature Request Action] 🚫 SAFETY BLOCK - Handler blocked: user is just asking to make a feature request');
      if (callback) {
        await callback({
          text: `Great! I'd love to hear your feature request. What would you like me to be able to do? Please describe the feature in detail.`
        });
      }
      return;
    }
    
    console.log(`[Feature Request Action] ✅ Safety check passed, proceeding with feature request submission`);
    
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

