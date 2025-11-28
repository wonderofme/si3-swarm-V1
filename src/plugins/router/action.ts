import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';

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
      console.log(`[Router] Querying sub-agent: ${intent}`);
      
      // 1. Retrieve Static Knowledge (from character.json)
      const staticKnowledge = subAgentRuntime.character.knowledge || [];
      
      // 2. (Future) Retrieve Vector Knowledge via RAG
      // const embedding = await runtime.embed(message.content.text);
      // const vectorKnowledge = await subAgentRuntime.databaseAdapter.searchKnowledge(...)
      
      // Combine findings
      const knowledgeText = staticKnowledge.join('\n- ');
      
      context = `\n[Expert Context from ${intent} Agent]:\n` +
                `- ${knowledgeText}\n` +
                `[End Context]\n`;
                
    } else {
      console.warn(`[Router] Sub-agent ${intent} not found in runtime links.`);
      context = `[System: Could not reach ${intent} agent. Please answer based on general knowledge.]`;
    }

    // Inject into state so the LLM generation uses it to answer
    if (state) {
      // We append to 'knowledge' or 'recentMessages' depending on how the template uses it.
      // Usually 'knowledge' is a dedicated field in the prompt template.
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
