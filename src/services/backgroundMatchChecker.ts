/**
 * Background Match Checker Service
 * Runs hourly to find and notify users of new matches
 * Optimized to only check recently active users (completed/updated in last 24h)
 */

import { IAgentRuntime } from '@elizaos/core';
import { findMatches } from './matchingEngine.js';

interface UserProfile {
  userId: string;
  profile: any;
  onboardingCompletedAt?: Date;
  profileUpdatedAt?: Date;
  chatId?: string | number;
  source: 'telegram' | 'web';
}

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get all completed users who are active (completed or updated in last 24h)
 */
async function getActiveUsers(runtime: IAgentRuntime): Promise<UserProfile[]> {
  const db = runtime.databaseAdapter as any;
  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
  
  const activeUsers: UserProfile[] = [];
  const now = new Date();
  const activeWindowStart = new Date(now.getTime() - ACTIVE_WINDOW_MS);
  
  try {
    if (isMongo && db.getDb) {
      const mongoDb = await db.getDb();
      const cacheCollection = mongoDb.collection('cache');
      
      // Get all onboarding cache entries
      const cacheDocs = await cacheCollection.find({ 
        key: { $regex: /^onboarding_/ } 
      }).toArray();
      
      for (const doc of cacheDocs) {
        try {
          let state: any = null;
          if (typeof doc.value === 'string') {
            try {
              state = JSON.parse(doc.value);
            } catch (e) {
              try {
                state = JSON.parse(JSON.parse(doc.value));
              } catch (e2) {
                continue;
              }
            }
          } else {
            state = doc.value;
          }
          
          if (!state || !state.profile || state.step !== 'COMPLETED') continue;
          
          const userId = doc.key.replace('onboarding_', '');
          const completedAt = state.profile.onboardingCompletedAt 
            ? new Date(state.profile.onboardingCompletedAt) 
            : null;
          const updatedAt = state.profile.profileUpdatedAt 
            ? new Date(state.profile.profileUpdatedAt) 
            : null;
          
          // Check if user is active (completed or updated in last 24h)
          // Use updatedAt if available, otherwise fall back to completedAt
          const relevantDate = updatedAt || completedAt;
          if (!relevantDate || relevantDate < activeWindowStart) continue;
          
          // Determine source
          const source = state.profile.onboardingSource === 'telegram' ? 'telegram' : 'web';
          
          activeUsers.push({
            userId,
            profile: state.profile,
            onboardingCompletedAt: completedAt || undefined,
            profileUpdatedAt: updatedAt || undefined,
            chatId: source === 'telegram' ? userId : undefined, // Telegram chat_id = user_id
            source
          });
        } catch (e) {
          console.log(`[Background Match Checker] Error parsing cache for ${doc.key}:`, e);
          continue;
        }
      }
    } else if (db.query) {
      // PostgreSQL
      const result = await db.query(
        `SELECT key, value FROM cache WHERE key LIKE 'onboarding_%'`
      );
      
      for (const row of result.rows || []) {
        try {
          let state: any = null;
          const value = row.value;
          
          if (typeof value === 'string') {
            try {
              state = JSON.parse(value);
            } catch (e) {
              try {
                state = JSON.parse(JSON.parse(value));
              } catch (e2) {
                continue;
              }
            }
          } else {
            state = value;
          }
          
          if (!state || !state.profile || state.step !== 'COMPLETED') continue;
          
          const userId = row.key.replace('onboarding_', '');
          const completedAt = state.profile.onboardingCompletedAt 
            ? new Date(state.profile.onboardingCompletedAt) 
            : null;
          const updatedAt = state.profile.profileUpdatedAt 
            ? new Date(state.profile.profileUpdatedAt) 
            : null;
          
          // Check if user is active (completed or updated in last 24h)
          // Use updatedAt if available, otherwise fall back to completedAt
          const relevantDate = updatedAt || completedAt;
          if (!relevantDate || relevantDate < activeWindowStart) continue;
          
          // Determine source
          const source = state.profile.onboardingSource === 'telegram' ? 'telegram' : 'web';
          
          activeUsers.push({
            userId,
            profile: state.profile,
            onboardingCompletedAt: completedAt || undefined,
            profileUpdatedAt: updatedAt || undefined,
            chatId: source === 'telegram' ? userId : undefined,
            source
          });
        } catch (e) {
          console.log(`[Background Match Checker] Error parsing cache for ${row.key}:`, e);
          continue;
        }
      }
    }
  } catch (error: any) {
    // Check if it's a MongoDB connection error (expected during network issues)
    const errorMessage = error?.message || error?.toString() || '';
    const isMongoConnectionError = 
      errorMessage.includes('MongoServerSelectionError') ||
      errorMessage.includes('MongoNetworkError') ||
      errorMessage.includes('ReplicaSetNoPrimary') ||
      (errorMessage.includes('Socket') && errorMessage.includes('timed out')) ||
      error?.code === 'ETIMEDOUT' ||
      error?.code === 'ENETUNREACH';
    
    if (isMongoConnectionError) {
      // Log as warning, not error - this is expected during network issues
      console.warn('[Background Match Checker] ⚠️ MongoDB connection unavailable (non-fatal, will retry):', errorMessage.substring(0, 200));
    } else {
      // Other errors are unexpected, log as error
      console.error('[Background Match Checker] Error getting active users:', error);
    }
  }
  
  return activeUsers;
}

/**
 * Check if a match has already been notified
 */
async function isMatchNotified(
  db: any,
  isMongo: boolean,
  userId: string,
  matchedUserId: string
): Promise<boolean> {
  try {
    if (isMongo && db.getDb) {
      const mongoDb = await db.getDb();
      const match = await mongoDb.collection('matches').findOne({
        user_id: userId,
        matched_user_id: matchedUserId,
        notified_at: { $exists: true }
      });
      return !!match;
    } else if (db.query) {
      const result = await db.query(
        `SELECT id FROM matches 
         WHERE user_id = $1::text AND matched_user_id = $2::text 
         AND notified_at IS NOT NULL`,
        [userId, matchedUserId]
      );
      return (result.rows || []).length > 0;
    }
  } catch (error) {
    console.log(`[Background Match Checker] Error checking notification status:`, error);
    return false; // If we can't check, assume not notified to be safe
  }
  return false;
}

/**
 * Mark a match as notified
 */
async function markMatchAsNotified(
  db: any,
  isMongo: boolean,
  userId: string,
  matchedUserId: string
): Promise<void> {
  try {
    const notifiedAt = new Date();
    
    if (isMongo && db.getDb) {
      const mongoDb = await db.getDb();
      await mongoDb.collection('matches').updateOne(
        {
          user_id: userId,
          matched_user_id: matchedUserId
        },
        {
          $set: { notified_at: notifiedAt },
          $setOnInsert: {
            user_id: userId,
            matched_user_id: matchedUserId,
            room_id: String(userId),
            match_date: notifiedAt,
            status: 'pending'
          }
        },
        { upsert: true }
      );
    } else if (db.query) {
      // PostgreSQL: Update or insert using ON CONFLICT
      // Use the unique index we created in migrations
      try {
        await db.query(
          `INSERT INTO matches (user_id, matched_user_id, room_id, match_date, status, notified_at)
           VALUES ($1::text, $2::text, $3::text, $4, 'pending', $5)
           ON CONFLICT (user_id, matched_user_id) 
           DO UPDATE SET notified_at = $5`,
          [userId, matchedUserId, String(userId), notifiedAt, notifiedAt]
        );
      } catch (error: any) {
        // If unique constraint doesn't exist yet, fall back to update-then-insert
        // Check for specific error indicating constraint is missing (not a violation)
        const errorMsg = error?.message || '';
        const isMissingConstraint = 
          errorMsg.includes('no unique constraint') ||
          errorMsg.includes('constraint does not exist') ||
          errorMsg.includes('there is no unique constraint');
        
        if (isMissingConstraint) {
          // Try update first
          const updateResult = await db.query(
            `UPDATE matches 
             SET notified_at = $1 
             WHERE user_id = $2::text AND matched_user_id = $3::text`,
            [notifiedAt, userId, matchedUserId]
          );
          
          if ((updateResult.rowCount || 0) === 0) {
            // No existing match, insert new one
            await db.query(
              `INSERT INTO matches (user_id, matched_user_id, room_id, match_date, status, notified_at)
               VALUES ($1::text, $2::text, $3::text, $4, 'pending', $5)`,
              [userId, matchedUserId, String(userId), notifiedAt, notifiedAt]
            );
          }
        } else {
          // Re-throw other errors (constraint violations should be handled by ON CONFLICT)
          throw error;
        }
      }
    }
  } catch (error) {
    console.log(`[Background Match Checker] Error marking match as notified:`, error);
  }
}

/**
 * Send Telegram notification
 */
async function sendTelegramNotification(
  chatId: string | number,
  message: string
): Promise<boolean> {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!telegramToken) return false;
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message
      })
    });
    
    return response.ok;
  } catch (error) {
    console.log(`[Background Match Checker] Error sending Telegram notification:`, error);
    return false;
  }
}

/**
 * Check for new matches for a single user and notify
 */
async function checkAndNotifyUserMatches(
  runtime: IAgentRuntime,
  user: UserProfile
): Promise<number> {
  const db = runtime.databaseAdapter as any;
  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
  
  // Only notify users who opted in
  if (user.profile.notifications !== 'Yes') {
    return 0;
  }
  
  try {
    // Resolve to primary userId (matching engine uses primary userId internally)
    const { resolvePrimaryUserId } = await import('../plugins/onboarding/utils.js');
    const primaryUserId = await resolvePrimaryUserId(runtime, user.userId as any);
    
    // Get previous matches to exclude (use primary userId for consistency)
    let previousMatchIds: string[] = [];
    try {
      if (isMongo && db.getDb) {
        const mongoDb = await db.getDb();
        // Check both user.userId and primaryUserId to catch all matches
        const prevMatches = await mongoDb.collection('matches')
          .find({ 
            $or: [
              { user_id: user.userId },
              { user_id: primaryUserId }
            ]
          })
          .toArray();
        previousMatchIds = prevMatches.map((m: any) => m.matched_user_id);
      } else if (db.query) {
        const prevMatches = await db.query(
          `SELECT matched_user_id FROM matches 
           WHERE user_id = $1::text OR user_id = $2::text`,
          [user.userId, primaryUserId]
        );
        previousMatchIds = (prevMatches.rows || []).map((r: any) => r.matched_user_id);
      }
    } catch (e) {
      console.log(`[Background Match Checker] Could not get previous matches for ${user.userId}:`, e);
    }
    
    // Find new matches (matching engine will resolve to primary userId internally)
    const matchCandidates = await findMatches(
      runtime,
      primaryUserId, // Use primary userId for consistency
      user.profile,
      previousMatchIds,
      { minScoreThreshold: 60 } // Use 60 threshold for background checks
    );
    
    if (matchCandidates.length === 0) {
      return 0;
    }
    
    let notifiedCount = 0;
    const userLang = user.profile.language || 'en';
    
    // Check and notify for each match
    for (const match of matchCandidates.slice(0, 3)) { // Top 3 matches
      // Check if already notified (use primary userId for consistency)
      const alreadyNotified = await isMatchNotified(
        db,
        isMongo,
        primaryUserId, // Use primary userId for consistency
        match.userId
      );
      
      if (alreadyNotified) {
        continue;
      }
      
      // Get matched user's profile for notification
      let matchedUserState: any = null;
      try {
        if (isMongo && db.getDb) {
          const mongoDb = await db.getDb();
          const cacheCollection = mongoDb.collection('cache');
          const doc = await cacheCollection.findOne({ 
            key: `onboarding_${match.userId}` 
          });
          
          if (doc && doc.value) {
            if (typeof doc.value === 'string') {
              try {
                matchedUserState = JSON.parse(doc.value);
              } catch (e) {
                try {
                  matchedUserState = JSON.parse(JSON.parse(doc.value));
                } catch (e2) {
                  continue;
                }
              }
            } else {
              matchedUserState = doc.value;
            }
          }
        } else if (db.query) {
          const res = await db.query(
            `SELECT value FROM cache WHERE key = $1`,
            [`onboarding_${match.userId}`]
          );
          
          if (res.rows.length > 0) {
            const value = res.rows[0].value;
            if (typeof value === 'string') {
              try {
                matchedUserState = JSON.parse(value);
              } catch (e) {
                try {
                  matchedUserState = JSON.parse(JSON.parse(value));
                } catch (e2) {
                  continue;
                }
              }
            } else {
              matchedUserState = value;
            }
          }
        }
      } catch (e) {
        console.log(`[Background Match Checker] Could not load matched user profile:`, e);
        continue;
      }
      
      if (!matchedUserState || !matchedUserState.profile) continue;
      
      const matchedProfile = matchedUserState.profile;
      const matchMessage = match.icebreaker || match.reason;
      
      // Determine platform
      const matchedRoles = matchedProfile.roles || [];
      const matchedIsGrow3dge = matchedRoles.includes('partner');
      const matchedIsSiHer = matchedRoles.includes('team');
      const matchedHasBoth = matchedIsGrow3dge && matchedIsSiHer;
      
      let platformText = '';
      if (matchedHasBoth) {
        platformText = '\nPlatform: SI Her & Grow3dge Member\n';
      } else if (matchedIsGrow3dge) {
        platformText = '\nPlatform: Grow3dge Member\n';
      } else if (matchedIsSiHer) {
        platformText = '\nPlatform: SI Her Member\n';
      }
      
      const notificationMessages: Record<string, string> = {
        en: `🎉 New match alert!\n\nI found someone who might be a great connection for you:\n\n${matchedProfile.name} from ${matchedProfile.location || 'the community'}${platformText}Roles: ${(matchedProfile.roles || []).join(', ') || 'Not specified'}\nInterests: ${(matchedProfile.interests || []).slice(0, 3).join(', ') || 'Not specified'}\n${matchedProfile.telegramHandle ? `Telegram: @${matchedProfile.telegramHandle}\n` : ''}\n💡 ${matchMessage}\n\nSay "find me a match" for more connections! 🤝`,
        es: `🎉 ¡Nueva conexión encontrada!\n\nEncontré a alguien que podría ser una gran conexión para ti:\n\n${matchedProfile.name} de ${matchedProfile.location || 'la comunidad'}${platformText}Roles: ${(matchedProfile.roles || []).join(', ') || 'No especificado'}\nIntereses: ${(matchedProfile.interests || []).slice(0, 3).join(', ') || 'No especificado'}\n${matchedProfile.telegramHandle ? `Telegram: @${matchedProfile.telegramHandle}\n` : ''}\n💡 ${matchMessage}\n\n¡Di "encuéntrame una conexión" para más! 🤝`,
        pt: `🎉 Nova conexão encontrada!\n\nEncontrei alguém que pode ser uma ótima conexão para você:\n\n${matchedProfile.name} de ${matchedProfile.location || 'a comunidade'}${platformText}Funções: ${(matchedProfile.roles || []).join(', ') || 'Não especificado'}\nInteresses: ${(matchedProfile.interests || []).slice(0, 3).join(', ') || 'Não especificado'}\n${matchedProfile.telegramHandle ? `Telegram: @${matchedProfile.telegramHandle}\n` : ''}\n💡 ${matchMessage}\n\nDiga "encontre uma conexão" para mais! 🤝`,
        fr: `🎉 Nouvelle connexion trouvée!\n\nJ'ai trouvé quelqu'un qui pourrait être une excellente connexion pour vous:\n\n${matchedProfile.name} de ${matchedProfile.location || 'la communauté'}${platformText}Rôles: ${(matchedProfile.roles || []).join(', ') || 'Non spécifié'}\nIntérêts: ${(matchedProfile.interests || []).slice(0, 3).join(', ') || 'Non spécifié'}\n${matchedProfile.telegramHandle ? `Telegram: @${matchedProfile.telegramHandle}\n` : ''}\n💡 ${matchMessage}\n\nDites "trouve-moi une connexion" pour plus! 🤝`
      };
      
      const notificationText = notificationMessages[userLang] || notificationMessages.en;
      
      // Send notification (Telegram only for now)
      if (user.source === 'telegram' && user.chatId) {
        const sent = await sendTelegramNotification(user.chatId, notificationText);
        if (sent) {
          // Mark as notified using primary userId for consistency
          await markMatchAsNotified(db, isMongo, primaryUserId, match.userId);
          notifiedCount++;
          console.log(`[Background Match Checker] ✅ Notified ${user.profile.name} (${user.userId}) about match with ${matchedProfile.name} (${match.userId})`);
        }
      }
      // TODO: Add web notification support (WebSocket/push notifications)
    }
    
    return notifiedCount;
  } catch (error: any) {
    // Check if it's a MongoDB connection error (expected during network issues)
    const errorMessage = error?.message || error?.toString() || '';
    const isMongoConnectionError = 
      errorMessage.includes('MongoServerSelectionError') ||
      errorMessage.includes('MongoNetworkError') ||
      errorMessage.includes('ReplicaSetNoPrimary') ||
      (errorMessage.includes('Socket') && errorMessage.includes('timed out')) ||
      error?.code === 'ETIMEDOUT' ||
      error?.code === 'ENETUNREACH';
    
    if (isMongoConnectionError) {
      // Log as warning, not error - this is expected during network issues
      console.warn(`[Background Match Checker] ⚠️ MongoDB connection unavailable for user ${user.userId} (non-fatal, will retry)`);
    } else {
      // Other errors are unexpected, log as error
      console.error(`[Background Match Checker] Error checking matches for ${user.userId}:`, error);
    }
    return 0;
  }
}

/**
 * Main background check function
 */
export async function runBackgroundMatchCheck(runtime: IAgentRuntime): Promise<void> {
  console.log('[Background Match Checker] 🔍 Starting hourly match check...');
  
  try {
    const activeUsers = await getActiveUsers(runtime);
    console.log(`[Background Match Checker] Found ${activeUsers.length} active users to check`);
    
    let totalNotified = 0;
    
    // Process users with rate limiting to avoid overwhelming database
    for (let i = 0; i < activeUsers.length; i++) {
      const user = activeUsers[i];
      const notified = await checkAndNotifyUserMatches(runtime, user);
      totalNotified += notified;
      
      // Add delay between users to avoid overwhelming database (except for last user)
      if (i < activeUsers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }
    
    console.log(`[Background Match Checker] ✅ Completed check: ${totalNotified} new match notification(s) sent`);
  } catch (error: any) {
    // Check if it's a MongoDB connection error (expected during network issues)
    const errorMessage = error?.message || error?.toString() || '';
    const isMongoConnectionError = 
      errorMessage.includes('MongoServerSelectionError') ||
      errorMessage.includes('MongoNetworkError') ||
      errorMessage.includes('ReplicaSetNoPrimary') ||
      (errorMessage.includes('Socket') && errorMessage.includes('timed out')) ||
      error?.code === 'ETIMEDOUT' ||
      error?.code === 'ENETUNREACH';
    
    if (isMongoConnectionError) {
      // Log as warning, not error - this is expected during network issues
      console.warn('[Background Match Checker] ⚠️ MongoDB connection unavailable during background check (non-fatal, will retry)');
    } else {
      // Other errors are unexpected, log as error
      console.error('[Background Match Checker] Error during background check:', error);
    }
  }
}

/**
 * Start the background match checking service
 */
export function startBackgroundMatchChecker(runtime: IAgentRuntime): void {
  console.log('[Background Match Checker] 🚀 Starting background match checker (runs every hour)');
  
  // Run immediately on startup (after a short delay to let server initialize)
  setTimeout(() => {
    runBackgroundMatchCheck(runtime).catch(console.error);
  }, 30000); // Wait 30 seconds after startup
  
  // Then run every hour
  setInterval(() => {
    runBackgroundMatchCheck(runtime).catch(console.error);
  }, CHECK_INTERVAL_MS);
}

