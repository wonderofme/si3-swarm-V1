import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { findMatches } from './utils.js';
import { getUserProfile } from '../onboarding/utils.js';
import { recordMatch, scheduleFollowUps } from '../../services/matchTracker.js';

export const findMatchAction: Action = {
  name: 'FIND_MATCH',
  description: 'ONLY use this action when the user explicitly asks to find matches, connect with people, or meet someone. Do NOT use for general questions.',
  similes: ['SEARCH_PEOPLE', 'NETWORKING'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    // Check if evaluator set state (preferred method)
    const matchRequest = state?.matchRequest as string;
    if (matchRequest === 'MATCH_REQUEST') {
      return true;
    }
    
    // Fallback: Check message text directly for explicit match keywords
    const text = (message.content.text || '').toLowerCase();
    const hasMatchKeywords = text.includes('match') || 
                            text.includes('who should i') || 
                            text.includes('connect me') || 
                            text.includes('find someone') ||
                            text.includes('find me') ||
                            text.includes('introduce me');
    
    return hasMatchKeywords;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    // Double-check: Only proceed if this is actually a match request
    const matchRequest = state?.matchRequest as string;
    const text = (message.content.text || '').toLowerCase();
    const hasMatchKeywords = text.includes('match') || 
                            text.includes('who should i') || 
                            text.includes('connect me') || 
                            text.includes('find someone') ||
                            text.includes('find me') ||
                            text.includes('introduce me');
    
    if (matchRequest !== 'MATCH_REQUEST' && !hasMatchKeywords) {
      // Not a match request - silently return without executing
      return false;
    }
    
    // 1. Get my profile to know my interests
    const myProfile = await getUserProfile(runtime, message.userId);
    const myInterests = myProfile.interests || [];
    
    // If user typed "Find someone for AI", add AI to search
    const messageText = message.content.text || '';
    const explicitInterests = messageText.split(' ').filter(w => w.length > 3 && !['find', 'someone', 'match', 'people'].includes(w.toLowerCase()));
    
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

    // 3. Format Response (New Match Copy Format)
    const topMatch = matches[0]; // Get the best match
    const myName = myProfile.name || 'there';
    
    // Build match summary
    const matchSummary = [
      `Name: ${topMatch.name}`,
      `Roles: ${topMatch.role.join(', ')}`,
      `Interests: ${topMatch.interests.join(', ')}`
    ].join('\n');
    
    // Record the match in the database (include roomId for Telegram chat ID)
    try {
      const matchRecord = await recordMatch(message.userId, topMatch.userId, message.roomId);
      // Schedule follow-ups (3-day and 7-day)
      await scheduleFollowUps(matchRecord.id, message.userId);
      console.log(`[Matching] Recorded match ${matchRecord.id} and scheduled follow-ups`);
    } catch (error) {
      console.error('[Matching] Failed to record match:', error);
      // Continue even if recording fails
    }
    
    // Include Telegram handle if available
    const telegramHandleText = topMatch.telegramHandle 
      ? `Say hello on Telegram - @${topMatch.telegramHandle}`
      : `Say hello to your match on Telegram! Don't be shy, reach out and set up a meeting!`;
    
    const matchMessage = `Hola, ${myName}! 💜\n\nBased on both of your interests, I have matched you with ${topMatch.name}.\n\n${topMatch.name} - ${matchSummary}\n\n${telegramHandleText} 🤝\n\nIf you have any questions, please ask me here. Happy connecting! ✨`;
    
    if (callback) {
        callback({ text: matchMessage });
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


