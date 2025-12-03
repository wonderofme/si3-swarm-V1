import { IAgentRuntime, UUID } from '@elizaos/core';

export interface MatchCandidate {
  userId: UUID;
  score: number;
  commonInterests: string[];
  reason: string;
}

export async function findMatches(runtime: IAgentRuntime, currentUserId: UUID, userInterests: string[]): Promise<MatchCandidate[]> {
  // Dummy implementation for now, replacing the complex embedding one to save space/time
  // In a real scenario, this would use embeddings.
  // For this restoration, we'll do a simple keyword match against all other profiles in cache/db.
  
  // 1. Get all onboarding keys from cache (this is inefficient but works for small scale)
  // A better way is to query the PG database if we stored profiles there.
  // Our `dbCache` stores them in `cache` table.
  
  const adapter = runtime.databaseAdapter as any;
  // Fetch all onboarding profiles except current user
  const res = await adapter.query(
    `SELECT key, value FROM cache WHERE key LIKE 'onboarding_%'`
  );
  
  const candidates: MatchCandidate[] = [];
  
  for (const row of res.rows) {
    const otherUserId = row.key.replace('onboarding_', '');
    if (otherUserId === currentUserId) continue;
    
    const state = JSON.parse(row.value);
    if (state.step !== 'COMPLETED' || !state.profile) continue;
    
    const otherInterests = state.profile.interests || [];
    const otherRoles = state.profile.roles || [];
    
    // Calculate overlap
    const common = userInterests.filter(i => 
        otherInterests.some((oi: string) => oi.toLowerCase().includes(i.toLowerCase())) ||
        otherRoles.some((or: string) => or.toLowerCase().includes(i.toLowerCase()))
    );
    
    if (common.length > 0) {
        candidates.push({
            userId: otherUserId as UUID,
            score: common.length,
            commonInterests: common,
            reason: `Shared interests: ${common.join(', ')}`
        });
    }
  }
  
  return candidates.sort((a, b) => b.score - a.score);
}

