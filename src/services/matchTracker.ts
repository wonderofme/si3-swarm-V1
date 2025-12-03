import { IAgentRuntime } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

export interface MatchRecord {
  id: string;
  userId: string;
  matchedUserId: string;
  roomId: string;
  matchDate: Date;
  status: string;
}

export interface FollowUpRecord {
  id: string;
  matchId: string;
  userId: string;
  type: '3_day_checkin' | '7_day_next_match';
  scheduledFor: Date;
  sentAt?: Date;
  status: 'pending' | 'sent' | 'cancelled';
  response?: string;
}

export async function recordMatch(
  runtime: IAgentRuntime,
  userId: string,
  matchedUserId: string,
  roomId: string
): Promise<string> {
  const matchId = uuidv4();
  const adapter = runtime.databaseAdapter as any;
  
  // Insert match
  await adapter.query(
    `INSERT INTO matches (id, user_id, matched_user_id, room_id, match_date, status)
     VALUES ($1, $2, $3, $4, NOW(), 'pending')`,
    [matchId, userId, matchedUserId, roomId]
  );

  // Schedule 3-day check-in
  const checkInDate = new Date();
  checkInDate.setDate(checkInDate.getDate() + 3);
  await adapter.query(
    `INSERT INTO follow_ups (match_id, user_id, type, scheduled_for, status)
     VALUES ($1, $2, '3_day_checkin', $3, 'pending')`,
    [matchId, userId, checkInDate]
  );

  // Schedule 7-day next match
  const nextMatchDate = new Date();
  nextMatchDate.setDate(nextMatchDate.getDate() + 7);
  await adapter.query(
    `INSERT INTO follow_ups (match_id, user_id, type, scheduled_for, status)
     VALUES ($1, $2, '7_day_next_match', $3, 'pending')`,
    [matchId, userId, nextMatchDate]
  );

  return matchId;
}

export async function getDueFollowUps(runtime: IAgentRuntime): Promise<FollowUpRecord[]> {
  const adapter = runtime.databaseAdapter as any;
  const { rows } = await adapter.query(
    `SELECT * FROM follow_ups WHERE status = 'pending' AND scheduled_for <= NOW()`
  );
  
  return rows.map((row: any) => ({
    id: row.id,
    matchId: row.match_id,
    userId: row.user_id,
    type: row.type,
    scheduledFor: row.scheduled_for,
    sentAt: row.sent_at,
    status: row.status,
    response: row.response
  }));
}

export async function markFollowUpSent(runtime: IAgentRuntime, followUpId: string): Promise<void> {
  const adapter = runtime.databaseAdapter as any;
  await adapter.query(
    `UPDATE follow_ups SET status = 'sent', sent_at = NOW() WHERE id = $1`,
    [followUpId]
  );
}

export async function recordFollowUpResponse(
  runtime: IAgentRuntime,
  followUpId: string,
  response: string
): Promise<void> {
  const adapter = runtime.databaseAdapter as any;
  await adapter.query(
    `UPDATE follow_ups SET response = $1 WHERE id = $2`,
    [response, followUpId]
  );
}

export async function updateMatchStatus(
  runtime: IAgentRuntime,
  matchId: string,
  status: string
): Promise<void> {
  const adapter = runtime.databaseAdapter as any;
  await adapter.query(
    `UPDATE matches SET status = $1 WHERE id = $2`,
    [status, matchId]
  );
}

export async function getRecentSentFollowUp(
  runtime: IAgentRuntime, 
  userId: string
): Promise<FollowUpRecord | null> {
  const adapter = runtime.databaseAdapter as any;
  const { rows } = await adapter.query(
    `SELECT * FROM follow_ups 
     WHERE user_id = $1 AND status = 'sent' 
     ORDER BY sent_at DESC LIMIT 1`,
    [userId]
  );
  
  if (rows.length === 0) return null;
  
  return {
    id: rows[0].id,
    matchId: rows[0].match_id,
    userId: rows[0].user_id,
    type: rows[0].type,
    scheduledFor: rows[0].scheduled_for,
    sentAt: rows[0].sent_at,
    status: rows[0].status,
    response: rows[0].response
  };
}

export async function getUserMatches(userId: string, limit: number = 20): Promise<MatchRecord[]> {
  // Note: We need runtime for adapter, but this function might be called from API context
  // For now, we assume we can get a PG client or use a singleton runtime if needed.
  // BUT, usually we pass runtime. For the API endpoint, we might need to refactor to pass runtime or DB pool.
  // Since this is a service, we'll assume the caller passes runtime or we use a separate DB connection if strictly needed.
  // However, for simplicity in ElizaOS context, let's assume we are passed runtime or using a global if available.
  // Wait, in index.ts we import this. Let's adhere to passing runtime or using a new pool if strictly standalone.
  // For now, let's rely on the fact that `index.ts` has a db adapter.
  // Actually, the API endpoint in index.ts imports this. It will fail if it doesn't have DB access.
  // Let's update the signature to take runtime if possible, or use `process.env.DATABASE_URL` for a new pool.
  
  const pg = await import('pg');
  const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const { rows } = await pool.query(
      `SELECT * FROM matches WHERE user_id = $1 ORDER BY match_date DESC LIMIT $2`,
      [userId, limit]
    );
    return rows.map((row: any) => ({
       id: row.id,
       userId: row.user_id,
       matchedUserId: row.matched_user_id,
       roomId: row.room_id,
       matchDate: row.match_date,
       status: row.status
    }));
  } finally {
    await pool.end();
  }
}

export async function getOnboardingCompletionDate(userId: string): Promise<Date | null> {
    // This requires accessing the onboarding state cache/memory.
    // We can query the cache table directly if we know the key.
    const pg = await import('pg');
    const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL });
    
    try {
        // Try to get from cache first
        const res = await pool.query(
            `SELECT value FROM cache WHERE key = $1`,
            [`onboarding_${userId}`]
        );
        
        if (res.rows.length > 0) {
            const state = JSON.parse(res.rows[0].value);
            if (state.profile && state.profile.onboardingCompletedAt) {
                return new Date(state.profile.onboardingCompletedAt);
            }
        }
        return null;
    } catch (e) {
        console.error("Error fetching onboarding date", e);
        return null;
    } finally {
        await pool.end();
    }
}

