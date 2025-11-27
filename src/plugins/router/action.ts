import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';

export const querySubAgentAction: Action = {
  name: 'QUERY_SUB_AGENT',
  description: 'Query a sub-agent (MoonDAO or SI3) for knowledge when intent matches',
  similes: ['ASK_EXPERT', 'ROUTE_QUERY'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    // Only execute if the evaluator tagged it as non-GENERAL
    const intent = state?.routerIntent as string;
    return intent === 'MOONDAO' || intent === 'SI3';
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    const intent = state?.routerIntent as string;
    const targetAgentId = intent === 'MOONDAO' 
      ? 'd24d3f40-0000-0000-0000-000000000001' // MoonDAO UUID
      : 'd24d3f40-0000-0000-0000-000000000002'; // SI3 UUID

    console.log(`[Router] Querying sub-agent: ${intent} (${targetAgentId})`);

    // Use the RAG / Knowledge manager to search the *other* agent's knowledge
    // Note: In a real shared-DB setup, we query the knowledge table filtering by the target agent ID.
    // ElizaOS's default knowledge manager searches the current agent's knowledge.
    // We might need to use the database adapter directly if exposed, or just simulate it for now.
    
    // Mocking the RAG response for this step (since we haven't uploaded docs yet)
    const context = `[System: Relevant context from ${intent} agent]\n` +
                    `This user is asking about ${message.content.text}.\n` +
                    `(Simulated knowledge retrieval would happen here).`;

    // Inject into state so the LLM generation uses it
    if (state) {
      state.knowledge = (state.knowledge || '') + '\n' + context;
    }

    return true;
  },

  examples: [
    [
      { user: "user", content: { text: "Tell me about MoonDAO governance", action: "QUERY_SUB_AGENT" } },
      { user: "kaia", content: { text: "Sure! MoonDAO governance is..." } }
    ]
  ]
};

