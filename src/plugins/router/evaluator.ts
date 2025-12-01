import { Evaluator, IAgentRuntime, Memory, State } from '@elizaos/core';

export const routerEvaluator: Evaluator = {
  name: 'ROUTER_INTENT',
  description: 'Classify if the user message is about Space (MoonDAO) or Web3 (SI3)',
  similes: ['CLASSIFY_INTENT', 'ROUTE_MESSAGE'],
  alwaysRun: true,
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    // Only run for user messages
    return message.userId !== runtime.agentId;
  },
  handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const content = (message.content.text || '').toLowerCase();
    
    // Simple keyword heuristic for now (can be replaced with LLM classification)
    const spaceKeywords = ['space', 'rocket', 'moon', 'launch', 'orbit', 'planet', 'mars'];
    const web3Keywords = ['web3', 'crypto', 'blockchain', 'token', 'wallet', 'dao', 'nft'];

    let intent = 'GENERAL';
    if (spaceKeywords.some(k => content.includes(k))) intent = 'MOONDAO';
    if (web3Keywords.some(k => content.includes(k))) intent = 'SI3';

    // We store the intent in the state/memory for the Action to pick up
    // (In ElizaOS v0.1.x, evaluators usually just return result, but we can tag the state)
    if (state) {
      state.routerIntent = intent;
    }
    
    console.log(`[Router] Classified intent: ${intent}`);
    return intent; // Result is accessible in subsequent actions
  },
  examples: [
    {
      context: "User asks about rockets",
      messages: [{ user: "user", content: { text: "How do rockets land?" } }],
      outcome: "MOONDAO"
    }
  ]
};



