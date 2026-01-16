import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { getUserProfile } from '../onboarding/utils.js';
import { findMatches } from '../../services/matchingEngine.js';

export const findMatchAction: Action = {
  name: 'FIND_MATCH',
  description: 'Finds and shows top 5 matches for a user to request connections.',
  similes: ['MAKE_CONNECTION', 'INTRODUCE_USER', 'FIND_PEOPLE', 'TOP_MATCHES', 'SHOW_MATCHES'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const matchRequest = state?.matchRequest;
    const text = (message.content.text || '').toLowerCase();
    return matchRequest === 'MATCH_REQUEST' || 
           text.includes('match') || 
           text.includes('connect') || 
           text.includes('find someone') ||
           text.includes('top matches') ||
           text.includes('show matches');
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    // 1. Get User Profile
    const myProfile = await getUserProfile(runtime, message.userId);
    const myInterests = myProfile.interests || [];
    
    if (!myProfile.isConfirmed) {
        if (callback) callback({ text: "I need to get to know you first! Let's finish onboarding. What is your name?" });
        return true;
    }

    if (myInterests.length === 0) {
        if (callback) callback({ text: "I don't have enough info about your interests yet to match you. Update your profile?" });
        return true;
    }

    // 2. Find Top 5 Matches using advanced matching engine (includes platform filtering)
    const matches = await findMatches(runtime, message.userId, myProfile);
    
    if (matches.length === 0) {
        if (callback) callback({ text: "I couldn't find any new matches right now. Check back later! 🕵️‍♀️" });
        return true;
    }

    // 3. Present Top 5 Matches
    let responseText = `Here are your top ${matches.length} matches! 🎯\n\n`;
    
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const matchProfile = match.profile;
      
      // Determine platform for matched user
      const matchRoles = matchProfile.roles || [];
      const matchIsGrow3dge = matchRoles.includes('partner');
      const matchIsSiHer = matchRoles.includes('team');
      const matchHasBoth = matchIsGrow3dge && matchIsSiHer;
      
      let platformText = '';
      if (matchHasBoth) {
        platformText = 'Platform: SI Her & Grow3dge Member\n';
      } else if (matchIsGrow3dge) {
        platformText = 'Platform: Grow3dge Member\n';
      } else if (matchIsSiHer) {
        platformText = 'Platform: SI Her Member\n';
      }
      
      const requestStatus = match.hasPendingRequest 
        ? '⏳ Request Pending' 
        : '✅ Available to Request';
      
      responseText += `${i + 1}. **${matchProfile.name || 'Anonymous'}** (Score: ${match.score})\n` +
          (platformText ? `${platformText}` : '') +
          `Roles: ${matchProfile.roles?.join(', ') || 'Not specified'}\n` +
          `Interests: ${matchProfile.interests?.slice(0, 3).join(', ') || 'Not specified'}\n` +
          (matchProfile.telegramHandle ? `Telegram: @${matchProfile.telegramHandle}\n` : '') +
          `\n💡 ${match.icebreaker || match.reason}\n` +
          `${requestStatus}\n\n`;
    }
    
    responseText += `To request a match, reply with:\n` +
        `"Request match with [name]" or "Request 1, 3, 5" (for multiple)\n\n` +
        `You can also say "Show my requests" to see pending requests.`;

    if (callback) callback({ text: responseText });

    return true;
  },
  examples: []
};


