import { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';

/**
 * Provider that searches Kaia's knowledge base for SI<3> related questions
 * and injects relevant context into the LLM prompt
 */
export const knowledgeProvider: Provider = {
  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string | null> => {
    const userText = (message.content.text || '').toLowerCase().trim();
    console.log(`[Knowledge Provider] Provider called - text: "${userText.substring(0, 50)}"`);
    
    // Skip if user is in onboarding
    try {
      const { getOnboardingStep } = await import('../onboarding/utils.js');
      const step = await getOnboardingStep(runtime, message.userId);
      if (step && step !== 'COMPLETED' && step !== 'NONE') {
        console.log(`[Knowledge Provider] Skipping - user in onboarding step: ${step}`);
        return null; // Don't search knowledge during onboarding
      }
    } catch (error) {
      // If we can't check onboarding, continue
      console.log('[Knowledge Provider] Could not check onboarding step, continuing...');
    }

    // Skip if an action was just executed
    const hasAction = state?.actionNames && Array.isArray(state.actionNames) && state.actionNames.length > 0;
    if (hasAction) {
      const actionNames = Array.isArray(state.actionNames) ? state.actionNames.join(', ') : String(state.actionNames);
      console.log(`[Knowledge Provider] Skipping - action was just executed: ${actionNames}`);
      return null;
    }
    
    // Detect SI<3> related questions
    const si3Keywords = [
      'grow3dge',
      'si<3>',
      'si3',
      'si her dao',
      'si u',
      'social impact university',
      'kara howard',
      'si3 ecosystem',
      'si3 mission',
      'si3 program',
      'si3 accelerator',
      'grow3dge accelerator',
      'si3 community',
      'si3 space'
    ];

    const isSI3Question = si3Keywords.some(keyword => userText.includes(keyword));
    const matchedKeywords = si3Keywords.filter(k => userText.includes(k));
    
    console.log(`[Knowledge Provider] Keyword check - isSI3Question: ${isSI3Question}, matched keywords: ${matchedKeywords.join(', ')}`);
    
    if (!isSI3Question) {
      console.log('[Knowledge Provider] Not an SI<3> question, skipping knowledge search');
      return null; // Not an SI<3> question, don't search knowledge base
    }

    console.log('[Knowledge Provider] Detected SI<3> question, searching knowledge base...');

    try {
      // Generate embedding for the user's question
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.warn('[Knowledge Provider] OPENAI_API_KEY not set, cannot search knowledge base');
        return null;
      }

      // Generate embedding
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: message.content.text || ''
        })
      });

      if (!embeddingResponse.ok) {
        console.error('[Knowledge Provider] Failed to generate embedding:', embeddingResponse.status);
        return null;
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      // Search knowledge base using direct SQL query with vector similarity
      const db = runtime.databaseAdapter as any;
      if (!db || !db.query) {
        console.warn('[Knowledge Provider] Database adapter does not support query');
        return null;
      }

      // Convert embedding array to PostgreSQL vector format
      const embeddingVector = `[${embedding.join(',')}]`;

      // Query knowledge table using cosine similarity
      // Using 1 - cosine_distance for similarity (higher = more similar)
      // match_threshold of 0.7 means cosine_distance < 0.3
      const query = `
        SELECT 
          id,
          content,
          embedding,
          1 - (embedding <=> $1::vector) as similarity
        FROM knowledge
        WHERE agent_id = $2
          AND embedding IS NOT NULL
          AND (1 - (embedding <=> $1::vector)) >= $3
        ORDER BY embedding <=> $1::vector
        LIMIT $4
      `;

      const results = await db.query(query, [
        embeddingVector,
        runtime.agentId,
        0.7, // match_threshold (similarity >= 0.7)
        3    // match_count (top 3 results)
      ]);

      if (!results || !results.rows || results.rows.length === 0) {
        console.log('[Knowledge Provider] No relevant knowledge found');
        return null;
      }

      console.log(`[Knowledge Provider] Found ${results.rows.length} relevant knowledge chunks`);

      // Extract text from knowledge chunks
      const knowledgeTexts = results.rows.map((r: any) => {
        try {
          const content = typeof r.content === 'string' ? JSON.parse(r.content) : r.content;
          return content.text || content;
        } catch (e) {
          console.warn('[Knowledge Provider] Error parsing content:', e);
          return null;
        }
      }).filter(Boolean);

      if (knowledgeTexts.length === 0) {
        return null;
      }

      // Combine knowledge chunks into context
      const knowledgeContext = knowledgeTexts.join('\n\n---\n\n');

      return `[SI<3> KNOWLEDGE BASE CONTEXT]

The user is asking about SI<3> related topics. Here is relevant information from the SI<3> knowledge base:

${knowledgeContext}

**Instructions:**
- Use this information to provide detailed, accurate answers about SI<3> programs, ecosystem, and offerings
- Synthesize the information in your own friendly, educational voice
- If the knowledge base doesn't contain the specific information requested, use your general knowledge but mention that you're providing general information
- Always maintain your warm, helpful personality (💜, 🚀, 🤝)
- Respond in the user's preferred language`;

    } catch (error: any) {
      console.error('[Knowledge Provider] Error searching knowledge base:', error);
      return null; // Fail silently - don't break the conversation
    }
  },
};

