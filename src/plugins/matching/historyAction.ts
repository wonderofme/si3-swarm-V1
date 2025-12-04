import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { getUserMatches } from '../../services/matchTracker.js';
import { getUserProfile, getOnboardingState } from '../onboarding/utils.js';

export const showHistoryAction: Action = {
  name: 'SHOW_HISTORY',
  description: 'Shows user their match history, events, and onboarding information.',
  similes: ['VIEW_HISTORY', 'SHOW_MATCHES', 'MY_PROFILE'],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const historyRequest = state?.historyRequest as string;
    if (historyRequest === 'HISTORY_REQUEST') return true;
    
    const text = (message.content.text || '').toLowerCase();
    return text.includes('history') ||
           text.includes('my matches') ||
           text.includes('my profile');
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    const userId = message.userId;

    try {
      const profile = await getUserProfile(runtime, userId);
      const matches = await getUserMatches(userId, 20);
      const { step } = await getOnboardingState(runtime, userId);
      
      let historyMessage = `Hola ${profile.name || 'there'}! 💜\n\nYour Grow3dge Profile:\n\n`;

      // Match History
      historyMessage += `**Your Matches (${matches.length}):**\n`;
      if (matches.length === 0) {
        historyMessage += `No matches yet. Ask me to find you a match! 🤝\n\n`;
      } else {
        for (let i = 0; i < Math.min(matches.length, 10); i++) {
          const match = matches[i];
          // In a real app we'd fetch the matched user's name here
          const statusEmoji = match.status === 'connected' ? '✅' : match.status === 'not_interested' ? '❌' : '⏳';
          historyMessage += `${i + 1}. Match on ${new Date(match.matchDate).toLocaleDateString()} ${statusEmoji} (${match.status})\n`;
        }
        historyMessage += `\n`;
      }

      // Profile Summary
      historyMessage += `**Your Profile:**\n`;
      historyMessage += `Name: ${profile.name || 'Not set'}\n`;
      historyMessage += `Role: ${profile.roles?.join(', ') || 'Not set'}\n`;
      historyMessage += `Interests: ${profile.interests?.join(', ') || 'Not set'}\n`;
      
      // Onboarding
      historyMessage += `Onboarding Status: ${step === 'COMPLETED' ? 'Completed ✅' : 'In Progress ⏳'}\n`;

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
  examples: []
};

