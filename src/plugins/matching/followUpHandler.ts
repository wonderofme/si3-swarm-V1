import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { recordFollowUpResponse, updateMatchStatus, getMatch } from '../../services/matchTracker.js';
import { findMatches } from './utils.js';
import { getUserProfile } from '../onboarding/utils.js';

/**
 * Handler for user responses to follow-up messages
 */
export const followUpResponseAction: Action = {
  name: 'FOLLOW_UP_RESPONSE',
  description: 'Handles user responses to follow-up messages (Yes/No/Not interested)',
  similes: ['RESPOND_TO_FOLLOWUP', 'FOLLOWUP_ANSWER'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    // Check if this is a response to a follow-up
    const text = (message.content.text || '').toLowerCase();
    const isFollowUpResponse = text.includes('yes') || 
                              text.includes('no') || 
                              text.includes('not interested') ||
                              text.includes('connected') ||
                              text.includes('haven\'t connected');
    
    // Also check if there's a pending follow-up for this user
    // (We'll check this in the handler)
    return isFollowUpResponse;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    const text = (message.content.text || '').toLowerCase();
    const userId = message.userId;
    
    // Find the most recent pending follow-up for this user
    // We'll need to query the database for this
    // For now, we'll use a simple approach: check if the message context suggests a follow-up
    
    // This is a simplified version - in production, you'd want to:
    // 1. Store the followUpId in the message context or state
    // 2. Query the database for pending follow-ups
    // 3. Match the response to the correct follow-up
    
    // For now, we'll handle the response generically
    let responseType: 'yes' | 'no' | 'not_interested' = 'no';
    
    if (text.includes('yes') || text.includes('connected')) {
      responseType = 'yes';
    } else if (text.includes('not interested')) {
      responseType = 'not_interested';
    }
    
    // TODO: Get the actual followUpId from context/state
    // For now, we'll just acknowledge the response
    const responseMessages: Record<string, string> = {
      yes: "Great! I'm so glad you connected! 💜 I'll find you another match soon. Keep an eye out for my message! ✨",
      no: "No worries! Take your time. I'll check back with you in a few days. If you'd like another match, just let me know! 🤝",
      not_interested: "Understood! I'll skip this match and find you someone else. I'll send you a new match soon! 🚀"
    };
    
    const responseMessage = responseMessages[responseType] || responseMessages.no;
    
    if (callback) {
      callback({ text: responseMessage });
    }
    
    // TODO: Actually record the response in the database once we have followUpId
    // await recordFollowUpResponse(followUpId, responseType);
    // if (responseType === 'yes' || responseType === 'not_interested') {
    //   // Update match status
    //   await updateMatchStatus(matchId, responseType === 'yes' ? 'connected' : 'not_interested');
    // }
    
    return true;
  },

  examples: [
    [
      { user: "user", content: { text: "Yes, we connected!" } },
      { user: "kaia", content: { text: "Great! I'm so glad..." } }
    ],
    [
      { user: "user", content: { text: "No, not yet" } },
      { user: "kaia", content: { text: "No worries! Take your time..." } }
    ]
  ]
};

