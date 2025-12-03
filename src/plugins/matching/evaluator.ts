import { Evaluator, IAgentRuntime, Memory, State } from '@elizaos/core';

export const matchEvaluator: Evaluator = {
  name: 'match_evaluator',
  description: 'Detects if the user is explicitly asking for a match or introduction.',
  similes: ['find match', 'connect me', 'introduce me'],
  examples: [],
  
  handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<any> => {
    const text = (message.content.text || '').toLowerCase();
    if (text.includes('match') || text.includes('connect') || text.includes('introduce') || text.includes('find someone')) {
      if (state) {
        state.matchRequest = 'MATCH_REQUEST';
      }
      return 'MATCH_REQUEST';
    }
    return null;
  },

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    return true;
  }
};

