/**
 * Advanced Matching Engine for Agent Kaia
 * Refined for ElizaOS Runtime Compliance
 * Implements weighted compatibility scoring with intent matrix, interest overlap, and event synchronization
 */

import { IAgentRuntime } from '@elizaos/core';

export interface MatchCandidate {
  userId: string;
  profile: any;
  score: number;
  intentScore: number;
  interestScore: number;
  eventScore: number;
  reason: string;
  commonInterests: string[];
  sharedEvents: string[];
  icebreaker?: string;
}

export interface MatchingConfig {
  minScoreThreshold: number; // Minimum score to trigger a match (default: 75)
  intentWeight: number; // Weight for intent matching (default: 0.6)
  interestWeight: number; // Weight for interest overlap (default: 0.3)
  eventWeight: number; // Weight for event synchronization (default: 0.1)
  highDemandRoles: string[]; // Roles that require higher scores (default: ['Investor/Grant Program Operator'])
  highDemandThreshold: number; // Score required for high-demand roles (default: 90)
}

const DEFAULT_CONFIG: MatchingConfig = {
  minScoreThreshold: 75,
  intentWeight: 0.6,
  interestWeight: 0.3,
  eventWeight: 0.1,
  highDemandRoles: ['Investor/Grant Program Operator'],
  highDemandThreshold: 90
};

// Intent Matrix: Maps Connection Goals to Matching Roles
const INTENT_MATRIX: Record<string, string[]> = {
  'Startups to invest in': ['Founder/Builder'],
  'Investors/grant programs': ['Investor/Grant Program Operator'],
  'Growth tools, strategies, and/or support': ['Marketing/BD/Partnerships', 'Media', 'Community Leader'],
  'Sales/BD tools, strategies and/or support': ['Marketing/BD/Partnerships', 'Community Leader'],
  'Communities and/or DAO\'s to join': ['Community Leader', 'DAO Council Member/Delegate'],
  'New job opportunities': ['Founder/Builder', 'Investor/Grant Program Operator']
};

// Reverse mapping for bidirectional matching
const REVERSE_INTENT_MATRIX: Record<string, string[]> = {
  'Founder/Builder': ['Startups to invest in', 'New job opportunities'],
  'Investor/Grant Program Operator': ['Investors/grant programs', 'New job opportunities'],
  'Marketing/BD/Partnerships': ['Growth tools, strategies, and/or support', 'Sales/BD tools, strategies and/or support'],
  'Media': ['Growth tools, strategies, and/or support'],
  'Community Leader': ['Growth tools, strategies, and/or support', 'Sales/BD tools, strategies and/or support', 'Communities and/or DAO\'s to join'],
  'DAO Council Member/Delegate': ['Communities and/or DAO\'s to join'],
  'Developer': [], // Peer matching handled separately
  'Artist': [],
  'Early Web3 Explorer': []
};

/**
 * Calculate Jaccard Similarity (intersection over union) for interests
 */
function calculateInterestOverlap(interests1: string[], interests2: string[]): {
  similarity: number;
  common: string[];
} {
  if (interests1.length === 0 && interests2.length === 0) {
    return { similarity: 0, common: [] };
  }
  
  // Normalize interests (lowercase, trim)
  const normalized1 = interests1.map(i => i.toLowerCase().trim());
  const normalized2 = interests2.map(i => i.toLowerCase().trim());
  
  // Find common interests (using substring matching for flexibility)
  const common: string[] = [];
  for (const i1 of normalized1) {
    for (const i2 of normalized2) {
      // Check if interests match (either exact or substring)
      if (i1 === i2 || i1.includes(i2) || i2.includes(i1)) {
        // Use the shorter version as the common interest
        const idx1 = normalized1.indexOf(i1);
        const idx2 = normalized2.indexOf(i2);
        if (idx1 >= 0 && idx2 >= 0) {
          const commonInterest = i1.length <= i2.length ? interests1[idx1] : interests2[idx2];
          if (commonInterest && !common.includes(commonInterest)) {
            common.push(commonInterest);
          }
        }
      }
    }
  }
  
  // Calculate Jaccard similarity: |A ∩ B| / |A ∪ B|
  const union = new Set([...normalized1, ...normalized2]);
  const similarity = union.size > 0 ? common.length / union.size : 0;
  
  return { similarity, common };
}

/**
 * REFINED: Calculate Intent Score with stricter Peer Matching
 */
function calculateIntentScore(
  userAGoals: string[],
  userARoles: string[],
  userBGoals: string[],
  userBRoles: string[]
): number {
  let score = 0;
  
  // 1. Transactional Matching (Goal A -> Role B)
  let aSeeksB = false;
  for (const goal of userAGoals) {
    const targetRoles = INTENT_MATRIX[goal] || [];
    // Check if User B has ANY of the target roles
    if (targetRoles.some((target: string) => userBRoles.some((r: string) => r.includes(target)))) {
      score += 50; 
      aSeeksB = true;
      break; // Max 50 pts for this direction
    }
  }
  
  // 2. Transactional Matching (Goal B -> Role A)
  let bSeeksA = false;
  for (const goal of userBGoals) {
    const targetRoles = INTENT_MATRIX[goal] || [];
    if (targetRoles.some((target: string) => userARoles.some((r: string) => r.includes(target)))) {
      score += 50;
      bSeeksA = true;
      break;
    }
  }
  
  // 3. Peer Support Fallback (If no transactional match found)
  // Only apply if score is low (< 50) to avoid inflating transactional matches
  if (score < 50) {
    const commonRoles = userARoles.filter((r1: string) => 
      userBRoles.some((r2: string) => r1.toLowerCase() === r2.toLowerCase())
    );
    if (commonRoles.length > 0) {
      return 50; // Standard score for peer matching
    }
  }
  
  return Math.min(100, score);
}

/**
 * REFINED: Event Synchronization with Year Check
 */
function checkEventSynchronization(events1: string[], events2: string[]): {
  hasMatch: boolean;
  sharedEvents: string[];
  score: number;
} {
  if (!events1?.length || !events2?.length) {
    return { hasMatch: false, sharedEvents: [], score: 0 };
  }
  
  const shared: string[] = [];
  const currentYear = new Date().getFullYear().toString();
  const nextYear = (new Date().getFullYear() + 1).toString();
  
  for (const e1 of events1) {
    const e1Norm = e1.toLowerCase().trim();
    for (const e2 of events2) {
      const e2Norm = e2.toLowerCase().trim();
      
      // 1. Direct match
      if (e1Norm === e2Norm) {
        if (!shared.includes(e1)) {
          shared.push(e1);
        }
        continue;
      }
      
      // 2. Intelligent Fuzzy Match
      // Prevents "Consensus 2023" matching "Consensus 2024"
      const hasSameYear = (e1Norm.includes(currentYear) && e2Norm.includes(currentYear)) ||
                          (e1Norm.includes(nextYear) && e2Norm.includes(nextYear)) ||
                          (!e1Norm.match(/\d{4}/) && !e2Norm.match(/\d{4}/)); // No years present
      
      if (hasSameYear) {
        if (e1Norm.includes(e2Norm) || e2Norm.includes(e1Norm)) {
          if (!shared.includes(e1)) {
            shared.push(e1);
          }
        }
      }
    }
  }
  
  return {
    hasMatch: shared.length > 0,
    sharedEvents: shared,
    score: shared.length > 0 ? 100 : 0 // Full score if events match (acts as override)
  };
}

/**
 * Generate Icebreaker using direct OpenAI API (consistent with rest of codebase)
 * Bypasses ElizaOS generateText to avoid issues
 */
async function generateIcebreaker(
  runtime: IAgentRuntime,
  userA: any,
  userB: any,
  matchReason: string,
  commonInterests: string[],
  sharedEvents: string[]
): Promise<string> {
  const prompt = `Generate a warm, professional introduction message between two Web3 community members.

User A: ${userA.name}
- Location: ${userA.location || 'Not specified'}
- Roles: ${(userA.roles || []).join(', ')}
- Goals: ${(userA.connectionGoals || []).join(', ')}
- Interests: ${(userA.interests || []).join(', ')}

User B: ${userB.name}
- Location: ${userB.location || 'Not specified'}
- Roles: ${(userB.roles || []).join(', ')}
- Goals: ${(userB.connectionGoals || []).join(', ')}
- Interests: ${(userB.interests || []).join(', ')}

Why they matched:
${matchReason}
${commonInterests.length > 0 ? `- Shared interests: ${commonInterests.join(', ')}` : ''}
${sharedEvents.length > 0 ? `- Both attending: ${sharedEvents.join(', ')}` : ''}

Generate a brief (2-3 sentences), friendly introduction message that:
1. Mentions their complementary needs or shared interests
2. Highlights a specific topic they both like
3. Suggests a specific first step (e.g., "Exchange Telegram handles" or "Connect before [Event Name]")

Keep it warm, professional, and Web3-focused. Use emojis sparingly (💜, 🤝).`;

  try {
    // Use direct OpenAI API (consistent with rest of codebase - bypasses ElizaOS)
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      console.log('[Matching Engine] No OpenAI API key, using fallback reason');
      return matchReason;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are Agent Kaia, a friendly Web3 community matchmaker. Generate warm, professional introductions.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 150,
        temperature: 0.7
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.choices[0]?.message?.content || matchReason;
    } else {
      console.log('[Matching Engine] OpenAI API error, using fallback reason');
      return matchReason;
    }
  } catch (error: any) {
    console.error('[Matching Engine] Failed to generate icebreaker:', error);
    return matchReason; // Fallback
  }
}

/**
 * Main matching function - calculates weighted compatibility score
 */
export async function findMatches(
  runtime: IAgentRuntime,
  userId: string,
  userProfile: any,
  excludeUserIds: string[] = [],
  config: Partial<MatchingConfig> = {}
): Promise<MatchCandidate[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const db = runtime.databaseAdapter as any;
  
  if (!db) {
    console.log('[Matching Engine] No database adapter');
    return [];
  }
  
  // Resolve to primary userId if mapping exists
  const { resolvePrimaryUserId } = await import('../plugins/onboarding/utils.js');
  const primaryUserId = await resolvePrimaryUserId(runtime, userId as any);
  
  // Check if database adapter has required methods (query for PostgreSQL, getDb for MongoDB)
  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
  if (!isMongo && !db.query) {
    console.log('[Matching Engine] PostgreSQL adapter missing query method');
    return [];
  }
  if (isMongo && !db.getDb) {
    console.log('[Matching Engine] MongoDB adapter missing getDb method');
    return [];
  }
  
  const userAGoals = userProfile.connectionGoals || [];
  const userARoles = userProfile.roles || [];
  const userAInterests = userProfile.interests || [];
  const userAEvents = userProfile.events || [];
  
  // Get all completed profiles
  let allUsers: any[] = [];
  try {
    const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
    const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
    
    if (isMongo && db.getDb) {
      // MongoDB
      const mongoDb = await db.getDb();
      const cacheCollection = mongoDb.collection('cache');
      const docs = await cacheCollection.find({ key: { $regex: /^onboarding_/ } }).toArray();
      
      for (const doc of docs) {
        const otherUserId = doc.key.replace('onboarding_', '');
        // Resolve other user's primary userId
        const otherPrimaryUserId = await resolvePrimaryUserId(runtime, otherUserId as any);
        // Exclude if it's the same primary user (could be different platform userIds)
        if (otherPrimaryUserId === primaryUserId || excludeUserIds.includes(otherUserId) || excludeUserIds.includes(otherPrimaryUserId)) continue;
        
        try {
          const state = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;
          if (state.step === 'COMPLETED' && state.profile) {
            if (state.profile.notifications === 'No' || state.profile.notifications === 'Not sure yet') {
              continue;
            }
            allUsers.push({
              userId: otherPrimaryUserId, // Use primary userId for matching
              profile: state.profile
            });
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
    } else {
      // PostgreSQL
      const res: any = await db.query(`SELECT key, value FROM cache WHERE key LIKE 'onboarding_%'`);
      const rows: any[] = res?.rows || [];
      for (const row of rows) {
        const otherUserId = row.key.replace('onboarding_', '');
        // Resolve other user's primary userId
        const otherPrimaryUserId = await resolvePrimaryUserId(runtime, otherUserId as any);
        // Exclude if it's the same primary user (could be different platform userIds)
        if (otherPrimaryUserId === primaryUserId || excludeUserIds.includes(otherUserId) || excludeUserIds.includes(otherPrimaryUserId)) continue;
        
        try {
          const state = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
          if (state.step === 'COMPLETED' && state.profile) {
            if (state.profile.notifications === 'No' || state.profile.notifications === 'Not sure yet') {
              continue;
            }
            allUsers.push({
              userId: otherPrimaryUserId, // Use primary userId for matching
              profile: state.profile
            });
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
    }
  } catch (error) {
    console.error('[Matching Engine] Error fetching users:', error);
    return [];
  }
  
  console.log(`[Matching Engine] Found ${allUsers.length} potential candidate(s) in database`);
  
  if (allUsers.length === 0) {
    console.log('[Matching Engine] No other users found in database - cannot match');
    return [];
  }
  
  const candidates: MatchCandidate[] = [];
  
  for (const otherUser of allUsers) {
    const userB = otherUser.profile;
    const userBGoals = userB.connectionGoals || [];
    const userBRoles = userB.roles || [];
    const userBInterests = userB.interests || [];
    const userBEvents = userB.events || [];
    
    // Calculate component scores
    const intentScore = calculateIntentScore(userAGoals, userARoles, userBGoals, userBRoles);
    const { similarity: interestSimilarity, common: commonInterests } = calculateInterestOverlap(userAInterests, userBInterests);
    const interestScore = Math.min(100, interestSimilarity * 100 * (commonInterests.length >= 3 ? 1.0 : commonInterests.length >= 1 ? 0.8 : 0));
    const { hasMatch: eventMatch, sharedEvents, score: eventScore } = checkEventSynchronization(userAEvents, userBEvents);
    
    // Calculate weighted total score
    let totalScore = 
      (intentScore * finalConfig.intentWeight) +
      (interestScore * finalConfig.interestWeight) +
      (eventScore * finalConfig.eventWeight);
    
    // Event override: if events match, boost score significantly
    if (eventMatch) {
      totalScore = Math.max(totalScore, 85); // Minimum 85 if events match
    }
    
    // Check for high-demand roles (require higher threshold)
    const isHighDemand = userBRoles.some((role: string) => 
      finalConfig.highDemandRoles.some((hdr: string) => role.includes(hdr))
    );
    
    if (isHighDemand && totalScore < finalConfig.highDemandThreshold) {
      console.log(`[Matching Engine] ⚠️ Skipping high-demand role ${userBRoles.join(', ')} - score ${totalScore.toFixed(1)} below threshold ${finalConfig.highDemandThreshold}`);
      continue; // Skip high-demand roles that don't meet threshold
    }
    
    // Log rejected candidates for debugging
    if (totalScore < finalConfig.minScoreThreshold) {
      console.log(`[Matching Engine] ❌ Score too low: ${userB.name || 'Anonymous'} (Score: ${totalScore.toFixed(1)} < ${finalConfig.minScoreThreshold}, Intent: ${intentScore}, Interest: ${interestScore.toFixed(1)}, Event: ${eventScore})`);
      continue; // Skip candidates below threshold
    }
    
    // Only include if above minimum threshold
    if (totalScore >= finalConfig.minScoreThreshold) {
      console.log(`[Matching Engine] ✅ Match found: ${userB.name || 'Anonymous'} (Score: ${totalScore.toFixed(1)}, Intent: ${intentScore}, Interest: ${interestScore.toFixed(1)}, Event: ${eventScore})`);
      // Generate match reason
      let reason = '';
      if (intentScore >= 80) {
        reason = 'Perfect complementary match - your goals align with their expertise!';
      } else if (intentScore >= 50) {
        reason = 'Strong complementary potential - your needs match their skills';
      } else if (commonInterests.length >= 3) {
        reason = `Shared deep interests: ${commonInterests.slice(0, 3).join(', ')}`;
      } else if (commonInterests.length >= 1) {
        reason = `Shared interests: ${commonInterests.join(', ')}`;
      } else {
        reason = 'Potential peer connection';
      }
      
      if (eventMatch) {
        reason += ` | Both attending: ${sharedEvents.join(', ')}`;
      }
      
      candidates.push({
        userId: otherUser.userId,
        profile: userB,
        score: Math.round(totalScore),
        intentScore: Math.round(intentScore),
        interestScore: Math.round(interestScore),
        eventScore: Math.round(eventScore),
        reason,
        commonInterests,
        sharedEvents
      });
    }
  }
  
  // Sort by score (highest first)
  candidates.sort((a, b) => b.score - a.score);
  
  console.log(`[Matching Engine] Evaluated ${allUsers.length} user(s), found ${candidates.length} match(es) above threshold ${finalConfig.minScoreThreshold}`);
  
  // LIMITER: Only generate icebreakers for the Top 3 to save latency/tokens
  const topCandidates = candidates.slice(0, 3);
  
  for (const candidate of topCandidates) {
    try {
      candidate.icebreaker = await generateIcebreaker(
        runtime,
        userProfile,
        candidate.profile,
        candidate.reason,
        candidate.commonInterests,
        candidate.sharedEvents
      );
    } catch (error: any) {
      console.error('[Matching Engine] Could not generate icebreaker:', error);
    }
  }
  
  return topCandidates; // Return only top 3 with icebreakers
}

