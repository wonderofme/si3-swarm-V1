/**
 * Match Request Expiration Service
 * Background job to expire old pending match requests
 */

import { IAgentRuntime } from '@elizaos/core';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check and expire old pending match requests
 */
export async function expireOldMatchRequests(runtime: IAgentRuntime): Promise<number> {
  const db = runtime.databaseAdapter as any;
  if (!db) {
    console.log('[Match Request Expiration] No database adapter');
    return 0;
  }

  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';

  try {
    const now = new Date();
    let expiredCount = 0;

    if (isMongo && db.getDb) {
      const mongoDb = await db.getDb();
      const result = await mongoDb.collection('match_requests').updateMany(
        {
          status: 'pending',
          expires_at: { $lt: now }
        },
        {
          $set: {
            status: 'expired',
            responded_at: now
          }
        }
      );
      expiredCount = result.modifiedCount || 0;
    } else if (db.query) {
      const result = await db.query(
        `UPDATE match_requests 
         SET status = 'expired', responded_at = NOW() 
         WHERE status = 'pending' AND expires_at < NOW()`
      );
      expiredCount = result.rowCount || 0;
    }

    if (expiredCount > 0) {
      console.log(`[Match Request Expiration] ✅ Expired ${expiredCount} old match request(s)`);
    }

    return expiredCount;
  } catch (error: any) {
    console.error('[Match Request Expiration] Error expiring requests:', error);
    return 0;
  }
}

/**
 * Start the expiration checker service
 */
export function startMatchRequestExpirationService(runtime: IAgentRuntime): void {
  console.log('[Match Request Expiration] 🚀 Starting expiration service (runs daily)');

  // Run immediately on startup (after a short delay)
  setTimeout(() => {
    expireOldMatchRequests(runtime).catch(console.error);
  }, 60000); // Wait 1 minute after startup

  // Then run daily
  setInterval(() => {
    expireOldMatchRequests(runtime).catch(console.error);
  }, CHECK_INTERVAL_MS);
}


