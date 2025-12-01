import pg from 'pg';
import { UUID, IAgentRuntime } from '@elizaos/core';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface MatchRecord {
  id: UUID;
  userId: UUID;
  matchedUserId: UUID;
  roomId?: UUID; // Telegram chat ID / room ID
  matchDate: Date;
  status: 'pending' | 'connected' | 'not_interested' | 'expired';
}

export interface FollowUpRecord {
  id: UUID;
  matchId: UUID;
  userId: UUID;
  type: '3_day_checkin' | '7_day_next_match';
  scheduledDate: Date;
  sentDate: Date | null;
  status: 'pending' | 'sent' | 'responded' | 'skipped';
  response: string | null;
}

/**
 * Record a new match in the database
 */
export async function recordMatch(
  userId: UUID,
  matchedUserId: UUID,
  roomId?: UUID
): Promise<MatchRecord> {
  const result = await pool.query(
    `INSERT INTO matches ("userId", "matchedUserId", "roomId", status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING id, "userId", "matchedUserId", "roomId", "matchDate", status`,
    [userId, matchedUserId, roomId || null]
  );
  return result.rows[0];
}

/**
 * Schedule follow-up messages for a match
 */
export async function scheduleFollowUps(matchId: UUID, userId: UUID): Promise<void> {
  const now = new Date();
  
  // Schedule 3-day check-in
  const threeDayDate = new Date(now);
  threeDayDate.setDate(threeDayDate.getDate() + 3);
  
  // Schedule 7-day next match
  const sevenDayDate = new Date(now);
  sevenDayDate.setDate(sevenDayDate.getDate() + 7);
  
  await pool.query(
    `INSERT INTO follow_ups ("matchId", "userId", "type", "scheduledDate", status)
     VALUES 
       ($1, $2, '3_day_checkin', $3, 'pending'),
       ($1, $2, '7_day_next_match', $4, 'pending')`,
    [matchId, userId, threeDayDate, sevenDayDate]
  );
}

/**
 * Get all pending follow-ups that are due to be sent
 */
export async function getDueFollowUps(): Promise<(FollowUpRecord & { roomId?: UUID })[]> {
  const result = await pool.query(
    `SELECT f.*, m."matchedUserId", m."roomId"
     FROM follow_ups f
     JOIN matches m ON f."matchId" = m.id
     WHERE f.status = 'pending'
       AND f."scheduledDate" <= NOW()
     ORDER BY f."scheduledDate" ASC`,
    []
  );
  return result.rows;
}

/**
 * Mark a follow-up as sent
 */
export async function markFollowUpSent(followUpId: UUID): Promise<void> {
  await pool.query(
    `UPDATE follow_ups 
     SET status = 'sent', "sentDate" = NOW(), "updatedAt" = NOW()
     WHERE id = $1`,
    [followUpId]
  );
}

/**
 * Record user response to a follow-up
 */
export async function recordFollowUpResponse(
  followUpId: UUID,
  response: string
): Promise<void> {
  await pool.query(
    `UPDATE follow_ups 
     SET status = 'responded', response = $1, "updatedAt" = NOW()
     WHERE id = $2`,
    [response, followUpId]
  );
}

/**
 * Get match by ID
 */
export async function getMatch(matchId: UUID): Promise<MatchRecord | null> {
  const result = await pool.query(
    `SELECT * FROM matches WHERE id = $1`,
    [matchId]
  );
  return result.rows[0] || null;
}

/**
 * Update match status
 */
export async function updateMatchStatus(
  matchId: UUID,
  status: MatchRecord['status']
): Promise<void> {
  await pool.query(
    `UPDATE matches 
     SET status = $1, "updatedAt" = NOW()
     WHERE id = $2`,
    [status, matchId]
  );
}

/**
 * Get user's recent matches
 */
export async function getUserMatches(userId: UUID, limit: number = 10): Promise<MatchRecord[]> {
  const result = await pool.query(
    `SELECT * FROM matches 
     WHERE "userId" = $1 
     ORDER BY "matchDate" DESC 
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

/**
 * Get the most recent sent (but not responded) follow-up for a user
 * This helps identify which follow-up the user is responding to
 */
export async function getRecentSentFollowUp(userId: UUID): Promise<(FollowUpRecord & { matchId: UUID }) | null> {
  const result = await pool.query(
    `SELECT f.*
     FROM follow_ups f
     WHERE f."userId" = $1
       AND f.status = 'sent'
       AND f."sentDate" >= NOW() - INTERVAL '24 hours'
     ORDER BY f."sentDate" DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Get user profile (imported from onboarding utils)
 */
export { getUserProfile } from '../plugins/onboarding/utils.js';

/**
 * Get onboarding completion date from database
 */
export async function getOnboardingCompletionDate(userId: UUID): Promise<Date | null> {
  try {
    // Query memories table for onboarding completion
    const result = await pool.query(
      `SELECT "createdAt" 
       FROM memories 
       WHERE "userId" = $1 
         AND content->>'type' = 'onboarding_state'
         AND content->'data'->>'step' = 'COMPLETED'
       ORDER BY "createdAt" DESC 
       LIMIT 1`,
      [userId]
    );
    
    if (result.rows.length > 0 && result.rows[0].createdAt) {
      return new Date(result.rows[0].createdAt);
    }
    
    return null;
  } catch (error) {
    console.error('[MatchTracker] Error getting onboarding date:', error);
    return null;
  }
}

