import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { getRecentSentFollowUp, recordFollowUpResponse, updateMatchStatus } from '../../services/matchTracker.js';
import { findMatchAction } from './action.js';

export const followUpResponseAction: Action = {
  name: 'FOLLOW_UP_RESPONSE',
  description: 'Handles user responses to follow-up check-ins.',
  similes: ['ANSWER_CHECKIN'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const text = (message.content.text || '').toLowerCase();
    // Very basic validation: needs to look like a yes/no response and have a recent sent follow-up
    return ['yes', 'no', 'not interested'].some(k => text.includes(k));
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    const userId = message.userId;
    const recentFollowUp = await getRecentSentFollowUp(runtime, userId);
    
    if (!recentFollowUp) return false; // Not responding to a follow-up
    
    const text = message.content.text.toLowerCase();
    
    // Handle 3-day check-in
    if (recentFollowUp.type === '3_day_checkin') {
        if (text.includes('yes')) {
            await recordFollowUpResponse(runtime, recentFollowUp.id, 'yes');
            await updateMatchStatus(runtime, recentFollowUp.matchId, 'connected');
            if (callback) callback({ text: "That's awesome! 🎉 I'm glad you connected. Keep building those bridges!" });
            
            // Optionally offer another match
            if (callback) callback({ text: "Would you like to find another match?" });
            
        } else if (text.includes('not interested')) {
            await recordFollowUpResponse(runtime, recentFollowUp.id, 'not_interested');
            await updateMatchStatus(runtime, recentFollowUp.matchId, 'not_interested');
            if (callback) callback({ text: "Got it. I'll keep that in mind for future matches. 💜" });
            // Trigger new match immediately
             await findMatchAction.handler(runtime, message, state, _options, callback);

        } else if (text.includes('no')) {
             await recordFollowUpResponse(runtime, recentFollowUp.id, 'no');
             // Status remains pending
             if (callback) callback({ text: "No worries! Sometimes it takes time. I'll check back later." });
        }
    }
    
    // Handle 7-day next match
    if (recentFollowUp.type === '7_day_next_match') {
        if (text.includes('yes')) {
            await recordFollowUpResponse(runtime, recentFollowUp.id, 'yes');
            // Trigger finding a new match
            await findMatchAction.handler(runtime, message, state, _options, callback);
        } else {
             await recordFollowUpResponse(runtime, recentFollowUp.id, 'no');
             if (callback) callback({ text: "Okay! Let me know when you're ready for more connections. 🤝" });
        }
    }

    return true;
  },
  examples: []
};

