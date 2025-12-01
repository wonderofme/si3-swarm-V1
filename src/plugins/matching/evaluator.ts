import { Evaluator, IAgentRuntime, Memory, State } from '@elizaos/core';

export const matchEvaluator: Evaluator = {
  name: 'match_evaluator',
  description: 'Detects if user is asking for matching/networking.',
  similes: ['find people', 'networking', 'matchmaking', 'who should i meet'],
  examples: [
    {
        context: "User asks for connections",
        messages: [{ user: "user", content: { text: "Who should I talk to about DeFi?" } }],
        outcome: "MATCH_REQUEST"
    }
  ],
  
  handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string | null> => {
    const text = message.content.text.toLowerCase();
    if (text.includes('match') || text.includes('who should i') || text.includes('connect me') || text.includes('find someone')) {
        // Store in state so action can check it
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



