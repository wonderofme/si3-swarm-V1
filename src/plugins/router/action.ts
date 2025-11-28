import { Action, IAgentRuntime, Memory, State, HandlerCallback, elizaLogger } from '@elizaos/core';

export const querySubAgentAction: Action = {
  name: 'QUERY_SUB_AGENT',
  description: 'Query a sub-agent (MoonDAO or SI3) for knowledge when intent matches',
  similes: ['ASK_EXPERT', 'ROUTE_QUERY'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const intent = state?.routerIntent as string;
    return intent === 'MOONDAO' || intent === 'SI3';
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    const intent = state?.routerIntent as string;
    const subAgentKey = intent === 'MOONDAO' ? 'moondao' : 'si3';
    
    // Access the sub-agent runtime linked in index.ts
    const subAgentRuntime = (runtime as any).subAgents?.[subAgentKey];

    let context = '';

    if (subAgentRuntime) {
      elizaLogger.log(`[Router] Querying sub-agent: ${intent}`);
      
      // 1. Retrieve Static Knowledge (from character.json)
      const staticKnowledge = subAgentRuntime.character.knowledge || [];
      const staticText = staticKnowledge.join('\n- ');

      // 2. Retrieve Vector Knowledge (RAG) from Database
      let vectorText = '';
      try {
        // Use the main runtime's embedder, but search using the SUB-AGENT'S ID
        const embedding = await runtime.embed(message.content.text);
        
        const results = await subAgentRuntime.databaseAdapter.searchKnowledge({
          agentId: subAgentRuntime.agentId,
          embedding: embedding,
          match_threshold: 0.7, // Only good matches
          match_count: 3
        });

        if (results && results.length > 0) {
          elizaLogger.log(`[Router] Found ${results.length} RAG matches for ${intent}`);
          vectorText = results.map((r: any) => r.content.text).join('\n\n');
        }
      } catch (err) {
        elizaLogger.error(`[Router] Failed to search knowledge for ${intent}`, err);
      }
      
      // Combine Findings
      context = `\n[Expert Context from ${intent} Agent]:\n` +
                `**Static Knowledge:**\n- ${staticText}\n\n` +
                `**Database Knowledge:**\n${vectorText}\n` +
                `[End Context]\n`;
                
    } else {
      console.warn(`[Router] Sub-agent ${intent} not found in runtime links.`);
      context = `[System: Could not reach ${intent} agent. Please answer based on general knowledge.]`;
    }

    // Inject into state
    if (state) {
      state.knowledge = (state.knowledge || '') + context;
    }

    return true;
  },

  examples: [
    [
      { user: "user", content: { text: "Tell me about MoonDAO governance", action: "QUERY_SUB_AGENT" } },
      { user: "kaia", content: { text: "According to MoonDAO's constitution, governance is handled by $MOONEY token holders..." } }
    ]
  ]
};
