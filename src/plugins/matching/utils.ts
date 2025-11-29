import { IAgentRuntime, Memory, UUID } from '@elizaos/core';

const ONBOARDING_MEMORY_TYPE = 'onboarding_state';

export interface MatchCandidate {
  userId: UUID;
  name: string;
  role: string[];
  interests: string[];
  score: number;
}

async function getRemoteEmbedding(text: string, apiKey: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            input: text,
            model: process.env.SMALL_OPENAI_MODEL || 'text-embedding-3-small'
        })
    });
    const data = await response.json();
    return data?.data?.[0]?.embedding || null;
  } catch (e) {
    console.error('Embedding Error:', e);
    return null;
  }
}

export async function findMatches(runtime: IAgentRuntime, currentUserId: UUID, userInterests: string[]): Promise<MatchCandidate[]> {
  const queryText = userInterests.join(' ');
  const apiKey = process.env.OPENAI_API_KEY as string;
  const embedding = await getRemoteEmbedding(queryText, apiKey);
  
  if (!embedding) return [];
  
  // Use databaseAdapter directly to avoid MemoryManager's room restriction
  // We want to search GLOBALLY across all rooms/users
  const results = await runtime.databaseAdapter.searchMemoriesByEmbedding(embedding, {
    match_threshold: 0.6,
    count: 20,
    tableName: 'memories',
    agentId: runtime.agentId
  });
  
  const candidates: Map<string, MatchCandidate> = new Map();

  for (const mem of results) {
    if (mem.userId === currentUserId) continue; // Don't match with self
    
    const isProfile = (mem.content as any).type === ONBOARDING_MEMORY_TYPE;
    
    if (isProfile) {
      const profile = (mem.content as any).data?.profile;
      if (profile) {
        const score = calculateScore(userInterests, profile.interests || []);
        candidates.set(mem.userId, {
          userId: mem.userId,
          name: profile.name || 'Anonymous',
          role: profile.roles || [],
          interests: profile.interests || [],
          score
        });
      }
    }
  }

  return Array.from(candidates.values()).sort((a, b) => b.score - a.score).slice(0, 5);
}

function calculateScore(myInterests: string[], theirInterests: string[]): number {
  let score = 0;
  const mine = myInterests.map(i => i.toLowerCase());
  const theirs = theirInterests.map(i => i.toLowerCase());
  
  for (const i of mine) {
    if (theirs.some(t => t.includes(i) || i.includes(t))) {
      score += 1;
    }
  }
  return score;
}
