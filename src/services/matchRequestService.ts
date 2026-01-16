/**
 * Match Request Service
 * Handles match request creation, approval, rejection, and querying
 */

import { IAgentRuntime } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { recordMatch } from './matchTracker.js';
// Import resolvePrimaryUserId dynamically to avoid circular dependencies
async function resolvePrimaryUserId(runtime: IAgentRuntime, userId: string): Promise<string> {
  try {
    const { resolvePrimaryUserId: resolve } = await import('../plugins/onboarding/utils.js');
    return await resolve(runtime, userId as any);
  } catch (error) {
    console.error('[Match Request Service] Error resolving primary userId:', error);
    return userId; // Fallback to original userId
  }
}

export interface MatchRequest {
  id: string;
  requesterId: string;
  requestedId: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  createdAt: Date;
  respondedAt?: Date;
  response?: 'approved' | 'rejected';
  matchScore?: number;
  matchReason?: string;
  expiresAt?: Date;
}

const REQUEST_EXPIRY_DAYS = 7;
const MAX_PENDING_REQUESTS = 10;
const REJECTION_COOLDOWN_DAYS = 30;

/**
 * Create a match request
 */
export async function createMatchRequest(
  runtime: IAgentRuntime,
  requesterId: string,
  requestedId: string,
  matchScore: number,
  matchReason: string
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const db = runtime.databaseAdapter as any;
  if (!db) {
    return { success: false, error: 'Database adapter not available' };
  }

  // Resolve to primary userIds
  const primaryRequesterId = await resolvePrimaryUserId(runtime, requesterId);
  const primaryRequestedId = await resolvePrimaryUserId(runtime, requestedId);

  // Check if same user
  if (primaryRequesterId === primaryRequestedId) {
    return { success: false, error: 'Cannot request match with yourself' };
  }

  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';

  try {
    // Check if already matched
    const alreadyMatched = await checkIfMatched(db, isMongo, primaryRequesterId, primaryRequestedId);
    if (alreadyMatched) {
      return { success: false, error: 'You are already matched with this user' };
    }

    // Check if pending request already exists
    const existingRequest = await getPendingRequest(db, isMongo, primaryRequesterId, primaryRequestedId);
    if (existingRequest) {
      return { success: false, error: 'You already have a pending request with this user' };
    }

    // Check for bidirectional request (mutual interest - auto-approve)
    const reverseRequest = await getPendingRequest(db, isMongo, primaryRequestedId, primaryRequesterId);
    if (reverseRequest) {
      // Reverse request exists: primaryRequestedId -> primaryRequesterId (User B requested User A)
      // New request: primaryRequesterId -> primaryRequestedId (User A requesting User B)
      // Auto-approve reverse request: User A (primaryRequesterId) approves User B's request to them
      // This creates the match, so we don't need to create a new request
      const reverseApproveResult = await approveRequest(runtime, reverseRequest.id, primaryRequesterId);
      if (reverseApproveResult.success) {
        return { success: true, requestId: reverseRequest.id };
      } else {
        console.error('[Match Request Service] Failed to auto-approve reverse request:', reverseApproveResult.error);
        return { success: false, error: reverseApproveResult.error || 'Failed to auto-approve mutual match request' };
      }
    }

    // Check request limit
    const pendingCount = await getPendingRequestCount(db, isMongo, primaryRequesterId);
    if (pendingCount >= MAX_PENDING_REQUESTS) {
      return { success: false, error: `You have ${MAX_PENDING_REQUESTS} pending requests. Please wait for responses before requesting more.` };
    }

    // Check if previous rejection exists (within cooldown period)
    const recentRejection = await getRecentRejection(db, isMongo, primaryRequesterId, primaryRequestedId);
    if (recentRejection) {
      return { success: false, error: `You previously requested this user and they declined. Please wait ${REJECTION_COOLDOWN_DAYS} days before requesting again.` };
    }

    // Create request
    const requestId = await createRequestRecord(db, isMongo, primaryRequesterId, primaryRequestedId, matchScore, matchReason);
    return { success: true, requestId };
  } catch (error: any) {
    console.error('[Match Request Service] Error creating request:', error);
    return { success: false, error: error.message || 'Failed to create match request' };
  }
}

/**
 * Approve a match request
 */
export async function approveRequest(
  runtime: IAgentRuntime,
  requestId: string,
  userId: string
): Promise<{ success: boolean; error?: string; matchId?: string }> {
  const db = runtime.databaseAdapter as any;
  if (!db) {
    return { success: false, error: 'Database adapter not available' };
  }

  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';

  try {
    // Get request
    const request = await getRequestById(db, isMongo, requestId);
    if (!request) {
      return { success: false, error: 'Request not found' };
    }

    // Resolve to primary userIds
    const primaryUserId = await resolvePrimaryUserId(runtime, userId);
    const primaryRequestedId = await resolvePrimaryUserId(runtime, request.requestedId);
    const primaryRequesterId = await resolvePrimaryUserId(runtime, request.requesterId);

    // Verify user is the requested user
    if (primaryRequestedId !== primaryUserId) {
      return { success: false, error: 'You are not authorized to approve this request' };
    }

    // Check if already matched (use resolved primary IDs for consistency)
    const alreadyMatched = await checkIfMatched(db, isMongo, primaryRequesterId, primaryRequestedId);
    if (alreadyMatched) {
      // Update request status anyway
      await updateRequestStatus(db, isMongo, requestId, 'approved', 'approved');
      return { success: false, error: 'You are already matched with this user' };
    }

    // Update request status
    await updateRequestStatus(db, isMongo, requestId, 'approved', 'approved');

    // Create match record
    // Note: roomId is not available for match requests (not from direct chat), use empty string
    // recordMatch will resolve IDs internally, but we pass resolved IDs for consistency
    const matchId = await recordMatch(runtime, primaryRequesterId, primaryRequestedId, '');

    return { success: true, matchId };
  } catch (error: any) {
    console.error('[Match Request Service] Error approving request:', error);
    return { success: false, error: error.message || 'Failed to approve request' };
  }
}

/**
 * Reject a match request
 */
export async function rejectRequest(
  runtime: IAgentRuntime,
  requestId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const db = runtime.databaseAdapter as any;
  if (!db) {
    return { success: false, error: 'Database adapter not available' };
  }

  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';

  try {
    // Get request
    const request = await getRequestById(db, isMongo, requestId);
    if (!request) {
      return { success: false, error: 'Request not found' };
    }

    // Resolve to primary userId
    const primaryUserId = await resolvePrimaryUserId(runtime, userId);
    const primaryRequestedId = await resolvePrimaryUserId(runtime, request.requestedId);

    // Verify user is the requested user
    if (primaryRequestedId !== primaryUserId) {
      return { success: false, error: 'You are not authorized to reject this request' };
    }

    // Update request status
    await updateRequestStatus(db, isMongo, requestId, 'rejected', 'rejected');

    return { success: true };
  } catch (error: any) {
    console.error('[Match Request Service] Error rejecting request:', error);
    return { success: false, error: error.message || 'Failed to reject request' };
  }
}

/**
 * Cancel a match request (by requester)
 */
export async function cancelRequest(
  runtime: IAgentRuntime,
  requestId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const db = runtime.databaseAdapter as any;
  if (!db) {
    return { success: false, error: 'Database adapter not available' };
  }

  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';

  try {
    // Get request
    const request = await getRequestById(db, isMongo, requestId);
    if (!request) {
      return { success: false, error: 'Request not found' };
    }

    // Resolve to primary userId
    const primaryUserId = await resolvePrimaryUserId(runtime, userId);
    const primaryRequesterId = await resolvePrimaryUserId(runtime, request.requesterId);

    // Verify user is the requester
    if (primaryRequesterId !== primaryUserId) {
      return { success: false, error: 'You are not authorized to cancel this request' };
    }

    // Update request status
    await updateRequestStatus(db, isMongo, requestId, 'cancelled', undefined);

    return { success: true };
  } catch (error: any) {
    console.error('[Match Request Service] Error cancelling request:', error);
    return { success: false, error: error.message || 'Failed to cancel request' };
  }
}

/**
 * Get pending requests for a user (sent or received)
 */
export async function getPendingRequests(
  runtime: IAgentRuntime,
  userId: string,
  type: 'sent' | 'received' | 'all' = 'all'
): Promise<MatchRequest[]> {
  const db = runtime.databaseAdapter as any;
  if (!db) {
    return [];
  }

  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';

  try {
    const primaryUserId = await resolvePrimaryUserId(runtime, userId);

    if (isMongo && db.getDb) {
      const mongoDb = await db.getDb();
      const query: any = { status: 'pending' };
      
      if (type === 'sent') {
        query.requester_id = primaryUserId;
      } else if (type === 'received') {
        query.requested_id = primaryUserId;
      } else {
        query.$or = [
          { requester_id: primaryUserId },
          { requested_id: primaryUserId }
        ];
      }

      const docs = await mongoDb.collection('match_requests')
        .find(query)
        .sort({ created_at: -1 })
        .toArray();

      return docs.map(mapMongoRequest);
    } else if (db.query) {
      let query = '';
      const params: any[] = [primaryUserId];

      if (type === 'sent') {
        query = `SELECT * FROM match_requests WHERE requester_id = $1::text AND status = 'pending' ORDER BY created_at DESC`;
      } else if (type === 'received') {
        query = `SELECT * FROM match_requests WHERE requested_id = $1::text AND status = 'pending' ORDER BY created_at DESC`;
      } else {
        query = `SELECT * FROM match_requests WHERE (requester_id = $1::text OR requested_id = $1::text) AND status = 'pending' ORDER BY created_at DESC`;
      }

      const result = await db.query(query, params);
      return (result.rows || []).map(mapPostgresRequest);
    }
  } catch (error) {
    console.error('[Match Request Service] Error getting pending requests:', error);
  }

  return [];
}

/**
 * Check if user has pending request with another user
 */
export async function hasPendingRequest(
  runtime: IAgentRuntime,
  requesterId: string,
  requestedId: string
): Promise<boolean> {
  const db = runtime.databaseAdapter as any;
  if (!db) {
    return false;
  }

  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';

  try {
    const primaryRequesterId = await resolvePrimaryUserId(runtime, requesterId);
    const primaryRequestedId = await resolvePrimaryUserId(runtime, requestedId);

    const request = await getPendingRequest(db, isMongo, primaryRequesterId, primaryRequestedId);
    return !!request;
  } catch (error) {
    console.error('[Match Request Service] Error checking pending request:', error);
    return false;
  }
}

/**
 * Get request by ID
 */
async function getRequestById(db: any, isMongo: boolean, requestId: string): Promise<MatchRequest | null> {
  try {
    if (isMongo && db.getDb) {
      const mongoDb = await db.getDb();
      const doc = await mongoDb.collection('match_requests').findOne({ id: requestId });
      return doc ? mapMongoRequest(doc) : null;
    } else if (db.query) {
      const result = await db.query(`SELECT * FROM match_requests WHERE id = $1`, [requestId]);
      return result.rows?.length > 0 ? mapPostgresRequest(result.rows[0]) : null;
    }
  } catch (error) {
    console.error('[Match Request Service] Error getting request by ID:', error);
  }
  return null;
}

/**
 * Get pending request between two users
 */
async function getPendingRequest(db: any, isMongo: boolean, requesterId: string, requestedId: string): Promise<MatchRequest | null> {
  try {
    if (isMongo && db.getDb) {
      const mongoDb = await db.getDb();
      const doc = await mongoDb.collection('match_requests').findOne({
        requester_id: requesterId,
        requested_id: requestedId,
        status: 'pending'
      });
      return doc ? mapMongoRequest(doc) : null;
    } else if (db.query) {
      const result = await db.query(
        `SELECT * FROM match_requests WHERE requester_id = $1::text AND requested_id = $2::text AND status = 'pending'`,
        [requesterId, requestedId]
      );
      return result.rows?.length > 0 ? mapPostgresRequest(result.rows[0]) : null;
    }
  } catch (error) {
    console.error('[Match Request Service] Error getting pending request:', error);
  }
  return null;
}

/**
 * Check if two users are already matched
 */
async function checkIfMatched(db: any, isMongo: boolean, userId1: string, userId2: string): Promise<boolean> {
  try {
    if (isMongo && db.getDb) {
      const mongoDb = await db.getDb();
      const match = await mongoDb.collection('matches').findOne({
        $or: [
          { user_id: userId1, matched_user_id: userId2 },
          { user_id: userId2, matched_user_id: userId1 }
        ]
      });
      return !!match;
    } else if (db.query) {
      const result = await db.query(
        `SELECT id FROM matches WHERE (user_id = $1::text AND matched_user_id = $2::text) OR (user_id = $2::text AND matched_user_id = $1::text) LIMIT 1`,
        [userId1, userId2]
      );
      return (result.rows || []).length > 0;
    }
  } catch (error) {
    console.error('[Match Request Service] Error checking if matched:', error);
  }
  return false;
}

/**
 * Get count of pending requests for a user
 */
async function getPendingRequestCount(db: any, isMongo: boolean, userId: string): Promise<number> {
  try {
    if (isMongo && db.getDb) {
      const mongoDb = await db.getDb();
      return await mongoDb.collection('match_requests').countDocuments({
        requester_id: userId,
        status: 'pending'
      });
    } else if (db.query) {
      const result = await db.query(
        `SELECT COUNT(*) as count FROM match_requests WHERE requester_id = $1::text AND status = 'pending'`,
        [userId]
      );
      return parseInt(result.rows?.[0]?.count || '0');
    }
  } catch (error) {
    console.error('[Match Request Service] Error getting pending request count:', error);
  }
  return 0;
}

/**
 * Get recent rejection (within cooldown period)
 */
async function getRecentRejection(db: any, isMongo: boolean, requesterId: string, requestedId: string): Promise<MatchRequest | null> {
  try {
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() - REJECTION_COOLDOWN_DAYS);

    if (isMongo && db.getDb) {
      const mongoDb = await db.getDb();
      const doc = await mongoDb.collection('match_requests').findOne({
        requester_id: requesterId,
        requested_id: requestedId,
        status: 'rejected',
        responded_at: { $gte: cooldownDate }
      });
      return doc ? mapMongoRequest(doc) : null;
    } else if (db.query) {
      const result = await db.query(
        `SELECT * FROM match_requests WHERE requester_id = $1::text AND requested_id = $2::text AND status = 'rejected' AND responded_at >= $3 ORDER BY responded_at DESC LIMIT 1`,
        [requesterId, requestedId, cooldownDate]
      );
      return result.rows?.length > 0 ? mapPostgresRequest(result.rows[0]) : null;
    }
  } catch (error) {
    console.error('[Match Request Service] Error getting recent rejection:', error);
  }
  return null;
}

/**
 * Create request record in database
 */
async function createRequestRecord(
  db: any,
  isMongo: boolean,
  requesterId: string,
  requestedId: string,
  matchScore: number,
  matchReason: string
): Promise<string> {
  const requestId = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REQUEST_EXPIRY_DAYS);

  if (isMongo && db.getDb) {
    const mongoDb = await db.getDb();
    await mongoDb.collection('match_requests').insertOne({
      id: requestId,
      requester_id: requesterId,
      requested_id: requestedId,
      status: 'pending',
      created_at: new Date(),
      match_score: matchScore,
      match_reason: matchReason,
      expires_at: expiresAt
    });
  } else if (db.query) {
    await db.query(
      `INSERT INTO match_requests (id, requester_id, requested_id, status, created_at, match_score, match_reason, expires_at)
       VALUES ($1, $2::text, $3::text, 'pending', NOW(), $4, $5, $6)`,
      [requestId, requesterId, requestedId, matchScore, matchReason, expiresAt]
    );
  }

  return requestId;
}

/**
 * Update request status
 */
async function updateRequestStatus(
  db: any,
  isMongo: boolean,
  requestId: string,
  status: string,
  response?: string
): Promise<void> {
  const respondedAt = new Date();

  if (isMongo && db.getDb) {
    const mongoDb = await db.getDb();
    const update: any = {
      status,
      responded_at: respondedAt
    };
    if (response) {
      update.response = response;
    }
    await mongoDb.collection('match_requests').updateOne(
      { id: requestId },
      { $set: update }
    );
  } else if (db.query) {
    if (response) {
      await db.query(
        `UPDATE match_requests SET status = $1, responded_at = NOW(), response = $2 WHERE id = $3`,
        [status, response, requestId]
      );
    } else {
      await db.query(
        `UPDATE match_requests SET status = $1, responded_at = NOW() WHERE id = $2`,
        [status, requestId]
      );
    }
  }
}

/**
 * Map MongoDB document to MatchRequest
 */
function mapMongoRequest(doc: any): MatchRequest {
  return {
    id: doc.id,
    requesterId: doc.requester_id,
    requestedId: doc.requested_id,
    status: doc.status,
    createdAt: doc.created_at,
    respondedAt: doc.responded_at,
    response: doc.response,
    matchScore: doc.match_score,
    matchReason: doc.match_reason,
    expiresAt: doc.expires_at
  };
}

/**
 * Map PostgreSQL row to MatchRequest
 */
function mapPostgresRequest(row: any): MatchRequest {
  return {
    id: row.id,
    requesterId: row.requester_id,
    requestedId: row.requested_id,
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
    response: row.response,
    matchScore: row.match_score,
    matchReason: row.match_reason,
    expiresAt: row.expires_at
  };
}

