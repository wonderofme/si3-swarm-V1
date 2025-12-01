import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { recordFollowUpResponse, updateMatchStatus, getMatch, getRecentSentFollowUp, recordMatch, scheduleFollowUps } from '../../services/matchTracker.js';
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
    
    // Find the most recent sent follow-up for this user (within last 24 hours)
    const recentFollowUp = await getRecentSentFollowUp(userId);
    
    if (!recentFollowUp) {
      // No recent follow-up found - might be a general response, not a follow-up
      if (callback) {
        callback({ text: "I'm not sure which follow-up you're responding to. Could you clarify?" });
      }
      return false;
    }
    
    // Determine response type
    let responseType: 'yes' | 'no' | 'not_interested' = 'no';
    
    if (text.includes('yes') || text.includes('connected')) {
      responseType = 'yes';
    } else if (text.includes('not interested') || text.includes('skip')) {
      responseType = 'not_interested';
    }
    
    // Record the response in the database
    await recordFollowUpResponse(recentFollowUp.id, responseType);
    
    // Get the match to update its status
    const match = await getMatch(recentFollowUp.matchId);
    
    if (match) {
      // Update match status based on response
      if (responseType === 'yes') {
        await updateMatchStatus(match.id, 'connected');
      } else if (responseType === 'not_interested') {
        await updateMatchStatus(match.id, 'not_interested');
      }
    }
    
    // Generate appropriate response message
    let responseMessage = '';
    
    if (recentFollowUp.type === '3_day_checkin') {
      // Response to 3-day check-in
      if (responseType === 'yes') {
        responseMessage = "Great! I'm so glad you connected! 💜 I'll find you another match soon. Keep an eye out for my message! ✨";
        // Schedule a new match for them
        try {
          const userProfile = await getUserProfile(runtime, userId);
          const userInterests = userProfile.interests || [];
          if (userInterests.length > 0) {
            const newMatches = await findMatches(runtime, userId, userInterests);
            if (newMatches.length > 0) {
              const newMatch = newMatches[0];
              const matchRecord = await recordMatch(userId, newMatch.userId, message.roomId);
              await scheduleFollowUps(matchRecord.id, userId);
              
              const myName = userProfile.name || 'there';
              const matchSummary = [
                `Name: ${newMatch.name}`,
                `Roles: ${newMatch.role.join(', ')}`,
                `Interests: ${newMatch.interests.join(', ')}`
              ].join('\n');
              
              const telegramHandleText = newMatch.telegramHandle 
                ? `Say hello on Telegram - @${newMatch.telegramHandle}`
                : `Say hello to your match on Telegram!`;
              
              responseMessage += `\n\nHere's your next match:\n\n${newMatch.name} - ${matchSummary}\n\n${telegramHandleText} 🤝`;
            }
          }
        } catch (error) {
          console.error('[FollowUpHandler] Error finding new match:', error);
        }
      } else if (responseType === 'not_interested') {
        responseMessage = "Understood! I'll skip this match and find you someone else. I'll send you a new match soon! 🚀";
        // Schedule a new match for them
        try {
          const userProfile = await getUserProfile(runtime, userId);
          const userInterests = userProfile.interests || [];
          if (userInterests.length > 0) {
            const newMatches = await findMatches(runtime, userId, userInterests);
            if (newMatches.length > 0) {
              const newMatch = newMatches[0];
              const matchRecord = await recordMatch(userId, newMatch.userId, message.roomId);
              await scheduleFollowUps(matchRecord.id, userId);
              
              const myName = userProfile.name || 'there';
              const matchSummary = [
                `Name: ${newMatch.name}`,
                `Roles: ${newMatch.role.join(', ')}`,
                `Interests: ${newMatch.interests.join(', ')}`
              ].join('\n');
              
              const telegramHandleText = newMatch.telegramHandle 
                ? `Say hello on Telegram - @${newMatch.telegramHandle}`
                : `Say hello to your match on Telegram!`;
              
              responseMessage += `\n\nHere's your next match:\n\n${newMatch.name} - ${matchSummary}\n\n${telegramHandleText} 🤝`;
            }
          }
        } catch (error) {
          console.error('[FollowUpHandler] Error finding new match:', error);
        }
      } else {
        responseMessage = "No worries! Take your time. I'll check back with you in a few days. If you'd like another match, just let me know! 🤝";
      }
    } else if (recentFollowUp.type === '7_day_next_match') {
      // Response to 7-day next match offer
      if (responseType === 'yes') {
        // Find and send them a new match
        try {
          const userProfile = await getUserProfile(runtime, userId);
          const userInterests = userProfile.interests || [];
          if (userInterests.length > 0) {
            const newMatches = await findMatches(runtime, userId, userInterests);
            if (newMatches.length > 0) {
              const newMatch = newMatches[0];
              const matchRecord = await recordMatch(userId, newMatch.userId, message.roomId);
              await scheduleFollowUps(matchRecord.id, userId);
              
              const myName = userProfile.name || 'there';
              const matchSummary = [
                `Name: ${newMatch.name}`,
                `Roles: ${newMatch.role.join(', ')}`,
                `Interests: ${newMatch.interests.join(', ')}`
              ].join('\n');
              
              responseMessage = `Hola ${myName}! 💜\n\nBased on both of your interests, I have matched you with ${newMatch.name}.\n\n${newMatch.name} - ${matchSummary}\n\nSay hello to your match on Telegram! Don't be shy, reach out and set up a meeting! 🤝\n\nIf you have any questions, please ask me here. Happy connecting! ✨`;
            } else {
              responseMessage = "I couldn't find any new matches right now, but I'll keep looking! Check back later as more people join! 💜";
            }
          } else {
            responseMessage = "I don't have your interests on file. Please complete onboarding first!";
          }
        } catch (error) {
          console.error('[FollowUpHandler] Error finding new match:', error);
          responseMessage = "I had trouble finding a match right now. I'll try again soon! 💜";
        }
      } else {
        responseMessage = "No problem! I'll wait. Just let me know when you're ready for another match! 🤝";
      }
    }
    
    if (callback && responseMessage) {
      callback({ text: responseMessage });
    }
    
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

