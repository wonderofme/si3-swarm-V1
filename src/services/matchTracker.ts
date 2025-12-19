import { IAgentRuntime } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { createDatabaseAdapter } from '../adapters/databaseAdapter.js';

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
  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
  
  if (isMongo && adapter.getDb) {
    const mongoDb = await adapter.getDb();
    await mongoDb.collection('matches').insertOne({
      id: matchId,
      user_id: userId,
      matched_user_id: matchedUserId,
      room_id: roomId,
      match_date: new Date(),
      status: 'pending'
    });
    
    // Schedule 3-day check-in
    const checkInDate = new Date();
    checkInDate.setDate(checkInDate.getDate() + 3);
    await mongoDb.collection('follow_ups').insertOne({
      id: uuidv4(),
      match_id: matchId,
      user_id: userId,
      type: '3_day_checkin',
      scheduled_for: checkInDate,
      status: 'pending'
    });
    
    // Schedule 7-day next match
    const nextMatchDate = new Date();
    nextMatchDate.setDate(nextMatchDate.getDate() + 7);
    await mongoDb.collection('follow_ups').insertOne({
      id: uuidv4(),
      match_id: matchId,
      user_id: userId,
      type: '7_day_next_match',
      scheduled_for: nextMatchDate,
      status: 'pending'
    });
  } else if (adapter.query) {
    // PostgreSQL
    await adapter.query(
      `INSERT INTO matches (id, user_id, matched_user_id, room_id, match_date, status)
       VALUES ($1, $2::text, $3::text, $4::text, NOW(), 'pending')`,
      [matchId, userId, matchedUserId, roomId]
    );

    // Schedule 3-day check-in
    const checkInDate = new Date();
    checkInDate.setDate(checkInDate.getDate() + 3);
    await adapter.query(
      `INSERT INTO follow_ups (id, match_id, user_id, type, scheduled_for, status)
       VALUES ($1, $2, $3::text, '3_day_checkin', $4, 'pending')`,
      [uuidv4(), matchId, userId, checkInDate]
    );

    // Schedule 7-day next match
    const nextMatchDate = new Date();
    nextMatchDate.setDate(nextMatchDate.getDate() + 7);
    await adapter.query(
      `INSERT INTO follow_ups (id, match_id, user_id, type, scheduled_for, status)
       VALUES ($1, $2, $3::text, '7_day_next_match', $4, 'pending')`,
      [uuidv4(), matchId, userId, nextMatchDate]
    );
  }

  return matchId;
}

export async function getDueFollowUps(runtime: IAgentRuntime): Promise<FollowUpRecord[]> {
  const adapter = runtime.databaseAdapter as any;
  try {
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
  } catch (error: any) {
    // If table doesn't exist, return empty array
    if (error?.message?.includes('does not exist') || error?.code === '42703') {
      return [];
    }
    throw error;
  }
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
  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
  
  let rows: any[] = [];
  if (isMongo && adapter.getDb) {
    const mongoDb = await adapter.getDb();
    const docs = await mongoDb.collection('follow_ups')
      .find({ user_id: userId, status: 'sent' })
      .sort({ sent_at: -1 })
      .limit(1)
      .toArray();
    rows = docs;
  } else if (adapter.query) {
    const result = await adapter.query(
      `SELECT * FROM follow_ups 
       WHERE user_id = $1::text AND status = 'sent' 
       ORDER BY sent_at DESC LIMIT 1`,
      [userId]
    );
    rows = result.rows || [];
  }
  
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
  // Create adapter for API context (when runtime is not available)
  const adapter = createDatabaseAdapter();
  
  try {
    const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
    const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
    
    let rows: any[] = [];
    if (isMongo && adapter.getDb) {
      const mongoDb = await adapter.getDb();
      const docs = await mongoDb.collection('matches')
        .find({ user_id: userId })
        .sort({ match_date: -1 })
        .limit(limit)
        .toArray();
      rows = docs;
    } else if (adapter.query) {
      const result = await adapter.query(
        `SELECT id, user_id, matched_user_id, room_id, match_date, status 
         FROM matches 
         WHERE user_id = $1::text 
         ORDER BY match_date DESC 
         LIMIT $2`,
        [userId, limit]
      );
      rows = result.rows || [];
    }
    return rows.map((row: any) => ({
       id: row.id || row._id?.toString(),
       userId: row.user_id || row.userId,
       matchedUserId: row.matched_user_id || row.matchedUserId,
       roomId: row.room_id || row.roomId,
       matchDate: row.match_date || row.matchDate,
       status: row.status
    }));
  } catch (error: any) {
    console.error('[MatchTracker] Error getting user matches:', error);
    return [];
  } finally {
    if (adapter.close) {
      await adapter.close();
    }
  }
}

export async function getOnboardingCompletionDate(userId: string): Promise<Date | null> {
    // This requires accessing the onboarding state cache/memory.
    // We can query the cache table/collection directly if we know the key.
    const adapter = createDatabaseAdapter();
    
    try {
        // Try to get from cache first
        const res = await adapter.query(
            `SELECT value FROM cache WHERE key = $1`,
            [`onboarding_${userId}`]
        );
        
        if (res.rows && res.rows.length > 0) {
            const value = res.rows[0].value;
            const state = typeof value === 'string' ? JSON.parse(value) : value;
            if (state.profile && state.profile.onboardingCompletedAt) {
                return new Date(state.profile.onboardingCompletedAt);
            }
        }
        return null;
    } catch (e) {
        console.error("Error fetching onboarding date", e);
        return null;
    } finally {
        if (adapter.close) {
            await adapter.close();
        }
    }
}

