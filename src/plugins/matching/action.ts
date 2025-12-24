import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { getUserProfile } from '../onboarding/utils.js';
import { findMatches } from '../../services/matchingEngine.js';
import { recordMatch } from '../../services/matchTracker.js';

export const findMatchAction: Action = {
  name: 'FIND_MATCH',
  description: 'Finds and introduces a user to another member based on interests.',
  similes: ['MAKE_CONNECTION', 'INTRODUCE_USER', 'FIND_PEOPLE'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const matchRequest = state?.matchRequest;
    const text = (message.content.text || '').toLowerCase();
    return matchRequest === 'MATCH_REQUEST' || 
           text.includes('match') || 
           text.includes('connect') || 
           text.includes('find someone');
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

    // 2. Find Matches using advanced matching engine (includes platform filtering)
    const matches = await findMatches(runtime, message.userId, myProfile);
    
    if (matches.length === 0) {
        if (callback) callback({ text: "I couldn't find any new matches right now. Check back later! 🕵️‍♀️" });
        return true;
    }

    // 3. Present Top Match
    const topMatch = matches[0];
    // Use profile from match candidate (already loaded) or fetch if needed
    const matchProfile = topMatch.profile || await getUserProfile(runtime, topMatch.userId as any);
    
    // Record the match
    await recordMatch(runtime, message.userId, topMatch.userId, message.roomId);

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
    
    const responseText = `I found a match for you! 🚀\n\n` +
        `Meet ${matchProfile.name || 'Anonymous'} from ${matchProfile.location || 'Earth'}.\n` +
        (platformText ? `${platformText}` : '') +
        `Roles: ${matchProfile.roles?.join(', ')}\n` +
        `Interests: ${matchProfile.interests?.join(', ')}\n` +
        (matchProfile.telegramHandle ? `Telegram: @${matchProfile.telegramHandle}\n` : '') +
        `\nWhy: ${topMatch.icebreaker || topMatch.reason}\n\n` +
        `I've saved this match. I'll check in with you in 3 days to see if you connected!`;

    if (callback) callback({ text: responseText });

    return true;
  },
  examples: []
};


