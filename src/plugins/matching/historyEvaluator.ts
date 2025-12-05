import { Evaluator, IAgentRuntime, Memory, State } from '@elizaos/core';

export const historyEvaluator: Evaluator = {
  name: 'history_evaluator',
  description: 'Detects if user is asking to view their history, matches, or profile.',
  similes: ['view history', 'show matches', 'my profile', 'my history'],
  examples: [],

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string | null> => {
    const text = message.content.text.toLowerCase();
    if (text.includes('history') ||
        text.includes('my matches') ||
        text.includes('show my') ||
        text.includes('who have i matched') ||
        text.includes('my profile') ||
        text.includes('view my')) {
      if (state) {
        state.historyRequest = 'HISTORY_REQUEST';
      }
      return 'HISTORY_REQUEST';
    }
    return null;
  },

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    return true;
  }
};


