import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { findMatches } from './utils.js';
import { getUserProfile } from '../onboarding/utils.js';

export const findMatchAction: Action = {
  name: 'FIND_MATCH',
  description: 'Finds other users with similar interests.',
  similes: ['SEARCH_PEOPLE', 'NETWORKING'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    return true;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    // 1. Get my profile to know my interests
    const myProfile = await getUserProfile(runtime, message.userId);
    const myInterests = myProfile.interests || [];
    
    // If user typed "Find someone for AI", add AI to search
    const text = message.content.text;
    const explicitInterests = text.split(' ').filter(w => w.length > 3 && !['find', 'someone', 'match', 'people'].includes(w.toLowerCase()));
    
    const searchTerms = [...new Set([...myInterests, ...explicitInterests])];
    
    if (searchTerms.length === 0) {
        if (callback) callback({ text: "I don't know your interests yet! Please complete onboarding first." });
        return true;
    }

    // 2. Find Matches
    const matches = await findMatches(runtime, message.userId, searchTerms);
    
    if (matches.length === 0) {
        if (callback) callback({ text: "I couldn't find any matches right now. Check back later as more people join!" });
        return true;
    }

    // 3. Format Response
    const matchText = matches.map(m => `- ${m.name} (Score: ${m.score}): Interested in ${m.interests.join(', ')}`).join('\n');
    
    if (callback) {
        callback({ text: `Here are some people you should meet:\n${matchText}` });
    }

    return true;
  },

  examples: [
    [
      { user: "user", content: { text: "Find me a match", action: "FIND_MATCH" } },
      { user: "kaia", content: { text: "Here are 3 people..." } }
    ]
  ]
};

