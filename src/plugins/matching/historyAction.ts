import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { getUserMatches, getMatch, getOnboardingCompletionDate } from '../../services/matchTracker.js';
import { getUserProfile, getOnboardingState } from '../onboarding/utils.js';
import { OnboardingStep } from '../onboarding/types.js';

/**
 * Get matched user's name from their profile
 */
async function getMatchedUserName(runtime: IAgentRuntime, matchedUserId: string): Promise<string> {
  try {
    const profile = await getUserProfile(runtime, matchedUserId as any);
    return profile.name || 'Anonymous';
  } catch (error) {
    return 'Unknown';
  }
}


export const showHistoryAction: Action = {
  name: 'SHOW_HISTORY',
  description: 'Shows user their match history, events, and onboarding information.',
  similes: ['VIEW_HISTORY', 'SHOW_MATCHES', 'MY_PROFILE'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const historyRequest = state?.historyRequest as string;
    if (historyRequest === 'HISTORY_REQUEST') {
      return true;
    }
    
    // Fallback: Check message text directly
    const text = (message.content.text || '').toLowerCase();
    return text.includes('history') || 
           text.includes('my matches') || 
           text.includes('show my') ||
           text.includes('who have i matched') ||
           text.includes('my profile');
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    const userId = message.userId;
    
    try {
      // 1. Get user profile
      const profile = await getUserProfile(runtime, userId);
      const userName = profile.name || 'there';
      
      // 2. Get match history
      const matches = await getUserMatches(userId, 20);
      
      // 3. Get onboarding completion date
      const completionDateObj = await getOnboardingCompletionDate(userId);
      const completionDate = completionDateObj ? completionDateObj.toLocaleDateString() : null;
      
      // 4. Build history message
      let historyMessage = `Hola ${userName}! 💜\n\nHere's your history:\n\n`;
      
      // Match History
      historyMessage += `**Your Matches (${matches.length}):**\n`;
      if (matches.length === 0) {
        historyMessage += `No matches yet. Ask me to find you a match! 🤝\n\n`;
      } else {
        for (let i = 0; i < Math.min(matches.length, 10); i++) {
          const match = matches[i];
          const matchedName = await getMatchedUserName(runtime, match.matchedUserId);
          const matchDate = new Date(match.matchDate).toLocaleDateString();
          const statusEmoji = match.status === 'connected' ? '✅' : 
                             match.status === 'not_interested' ? '❌' : '⏳';
          
          historyMessage += `${i + 1}. ${matchedName} - ${matchDate} ${statusEmoji} (${match.status})\n`;
        }
        if (matches.length > 10) {
          historyMessage += `... and ${matches.length - 10} more matches\n`;
        }
        historyMessage += `\n`;
      }
      
      // Events
      if (profile.events && profile.events.length > 0) {
        historyMessage += `**Events You're Attending:**\n`;
        profile.events.forEach((event, idx) => {
          historyMessage += `${idx + 1}. ${event}\n`;
        });
        historyMessage += `\n`;
      }
      
      // Onboarding Info
      historyMessage += `**Onboarding:**\n`;
      if (completionDate) {
        historyMessage += `Completed on ${completionDate} ✅\n`;
      } else {
        historyMessage += `Status: ${profile.isConfirmed ? 'Completed' : 'In Progress'}\n`;
      }
      
      // Profile Summary
      historyMessage += `\n**Your Profile:**\n`;
      historyMessage += `Name: ${profile.name || 'Not set'}\n`;
      historyMessage += `Location: ${profile.location || 'Not set'}\n`;
      historyMessage += `Roles: ${profile.roles?.join(', ') || 'Not set'}\n`;
      historyMessage += `Interests: ${profile.interests?.join(', ') || 'Not set'}\n`;
      if (profile.telegramHandle) {
        historyMessage += `Telegram: @${profile.telegramHandle}\n`;
      }
      
      if (callback) {
        callback({ text: historyMessage });
      }
      
      return true;
    } catch (error) {
      console.error('[History] Error showing history:', error);
      if (callback) {
        callback({ text: "I had trouble retrieving your history. Please try again later! 💜" });
      }
      return false;
    }
  },

  examples: [
    [
      { user: "user", content: { text: "Show my history" } },
      { user: "kaia", content: { text: "Here's your history...", action: "SHOW_HISTORY" } }
    ],
    [
      { user: "user", content: { text: "Who have I matched with?" } },
      { user: "kaia", content: { text: "Here are your matches...", action: "SHOW_HISTORY" } }
    ]
  ]
};

