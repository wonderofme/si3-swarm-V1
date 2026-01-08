/**
 * Analytics API Service
 * Provides comprehensive analytics by combining data from:
 * - Cache (in-progress onboarding)
 * - SI U Database (completed profiles)
 * - Matches collection
 */

import { AgentRuntime } from '@elizaos/core';
import { getSiuAnalyticsData } from './siuDatabaseService.js';
import { getSi3Database } from './si3Database.js';

// ==================== TYPES ====================

export interface OnboardingAnalytics {
  totalStarted: number;
  totalCompleted: number;
  completionRate: number;
  bySource: {
    telegram: { started: number; completed: number };
    web: { started: number; completed: number };
  };
  byEntryMethod: {
    wallet: number;
    email: number;
  };
  stepDropOffs: Array<{
    step: string;
    count: number;
    percentage: number;
  }>;
  averageCompletionTimeMinutes: number;
  siuNameClaims: number;
  walletConnections: number;
  byDate: Array<{
    date: string;
    started: number;
    completed: number;
  }>;
}

export interface UserEngagementAnalytics {
  activeUsers: {
    last7Days: number;
    last30Days: number;
    last90Days: number;
  };
  newUsers: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  byTier: {
    explorer: number;
    paid: number;
  };
  byLocation: Array<{
    location: string;
    count: number;
  }>;
  byLanguage: {
    en: number;
    es: number;
    pt: number;
    fr: number;
  };
  byRole: Array<{
    role: string;
    count: number;
  }>;
}

export interface MatchAnalytics {
  totalMatches: number;
  successfulConnections: number;
  connectionRate: number;
  bySource: {
    telegram: number;
    web: number;
  };
  averageMatchesPerUser: number;
  byStatus: {
    pending: number;
    connected: number;
    not_interested: number;
  };
  byDate: Array<{
    date: string;
    matches: number;
    connections: number;
  }>;
  topMatchingInterests: Array<{
    interest: string;
    matchCount: number;
  }>;
  // NEW: Conversion metrics
  totalCompletedUsers: number; // Total users who completed onboarding
  usersWithAtLeastOneMatch: number; // Users who got at least one match
  matchSuccessRate: number; // % of completed users who got at least one match
  usersWhoRequestedMatch: number; // Users who requested a match (inferred from matches)
  timeToFirstMatch: {
    averageDays: number; // Average days from onboarding completion to first match
    averageHours: number; // Average hours from onboarding completion to first match
  };
}

export interface FullAnalytics {
  onboarding: OnboardingAnalytics;
  engagement: UserEngagementAnalytics;
  matches: MatchAnalytics;
  generatedAt: string;
  period: {
    start?: string;
    end?: string;
  };
}

// ==================== MAIN ANALYTICS FUNCTION ====================

/**
 * Get comprehensive analytics from all data sources
 */
export async function getFullAnalytics(
  runtime: AgentRuntime,
  startDate?: Date,
  endDate?: Date
): Promise<FullAnalytics> {
  const [onboarding, engagement, matches] = await Promise.all([
    getOnboardingAnalytics(runtime, startDate, endDate),
    getUserEngagementAnalytics(runtime, startDate, endDate),
    getMatchAnalytics(runtime, startDate, endDate)
  ]);

  return {
    onboarding,
    engagement,
    matches,
    generatedAt: new Date().toISOString(),
    period: {
      start: startDate?.toISOString(),
      end: endDate?.toISOString()
    }
  };
}

// ==================== ONBOARDING ANALYTICS ====================

async function getOnboardingAnalytics(
  runtime: AgentRuntime,
  startDate?: Date,
  endDate?: Date
): Promise<OnboardingAnalytics> {
  // Get data from SI U database
  const siuData = await getSiuAnalyticsData(startDate, endDate);
  
  // Get in-progress onboarding from cache
  const cacheStats = await getCacheOnboardingStats(runtime, startDate, endDate);
  
  // Calculate completion rate
  const totalStarted = cacheStats.totalInProgress + siuData.totalUsers;
  const completionRate = totalStarted > 0 
    ? (siuData.totalUsers / totalStarted) * 100 
    : 0;

  return {
    totalStarted,
    totalCompleted: siuData.totalUsers,
    completionRate: Math.round(completionRate * 100) / 100,
    bySource: {
      telegram: {
        started: cacheStats.bySource.telegram + siuData.bySource.telegram,
        completed: siuData.bySource.telegram
      },
      web: {
        started: cacheStats.bySource.web + siuData.bySource.web,
        completed: siuData.bySource.web
      }
    },
    byEntryMethod: siuData.byEntryMethod,
    stepDropOffs: cacheStats.stepDropOffs,
    averageCompletionTimeMinutes: 0, // TODO: Implement with onboardingStartedAt tracking
    siuNameClaims: siuData.siuNameClaims,
    walletConnections: siuData.walletConnections,
    byDate: siuData.recentCompletions.map(d => ({
      date: d.date,
      started: 0, // Would need cache history to track
      completed: d.count
    }))
  };
}

async function getCacheOnboardingStats(
  runtime: AgentRuntime,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalInProgress: number;
  bySource: { telegram: number; web: number };
  stepDropOffs: Array<{ step: string; count: number; percentage: number }>;
}> {
  const stepCounts: Record<string, number> = {};
  let totalInProgress = 0;
  let telegramCount = 0;
  let webCount = 0;

  try {
    const db = runtime.databaseAdapter as any;
    const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
    const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';

    if (isMongo && db.getDb) {
      const mongoDb = await db.getDb();
      const docs = await mongoDb.collection('cache')
        .find({ key: { $regex: /^onboarding_/ } })
        .limit(10000)
        .toArray();

      for (const doc of docs) {
        try {
          const value = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;
          if (!value || !value.step || value.step === 'COMPLETED') continue;
          
          totalInProgress++;
          stepCounts[value.step] = (stepCounts[value.step] || 0) + 1;
          
          // Check source: prefer onboardingSource from profile, fallback to userId pattern
          const profile = value.profile || {};
          const onboardingSource = profile.onboardingSource;
          const userId = doc.key.replace('onboarding_', '');
          
          if (onboardingSource === 'web' || (!onboardingSource && userId.startsWith('web_'))) {
            webCount++;
          } else {
            // telegram source or default (Telegram userIds don't start with web_)
            telegramCount++;
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
    } else if (db && db.query) {
      const result = await db.query(`
        SELECT key, value FROM cache 
        WHERE key LIKE 'onboarding_%'
        LIMIT 10000
      `);

      for (const row of result.rows || []) {
        try {
          const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
          if (!value || !value.step || value.step === 'COMPLETED') continue;
          
          totalInProgress++;
          stepCounts[value.step] = (stepCounts[value.step] || 0) + 1;
          
          // Check source: prefer onboardingSource from profile, fallback to userId pattern
          const profile = value.profile || {};
          const onboardingSource = profile.onboardingSource;
          const userId = row.key.replace('onboarding_', '');
          
          if (onboardingSource === 'web' || (!onboardingSource && userId.startsWith('web_'))) {
            webCount++;
          } else {
            // telegram source or default (Telegram userIds don't start with web_)
            telegramCount++;
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
    }
  } catch (error) {
    console.error('[Analytics API] Error getting cache stats:', error);
  }

  // Convert to step drop-offs with percentages
  const steps = [
    'NONE', 'ASK_LANGUAGE', 'ASK_NAME', 'ASK_ENTRY_METHOD', 'ASK_WALLET_CONNECTION',
    'ASK_SIU_NAME', 'ASK_EMAIL', 'ASK_PROFILE_CHOICE', 'ASK_LOCATION', 'ASK_ROLE',
    'ASK_INTERESTS', 'ASK_CONNECTION_GOALS', 'ASK_EVENTS', 'ASK_SOCIALS',
    'ASK_TELEGRAM_HANDLE', 'ASK_GENDER', 'ASK_NOTIFICATIONS'
  ];

  const stepDropOffs = steps.map(step => ({
    step,
    count: stepCounts[step] || 0,
    percentage: totalInProgress > 0 
      ? Math.round(((stepCounts[step] || 0) / totalInProgress) * 100) 
      : 0
  })).filter(s => s.count > 0);

  return {
    totalInProgress,
    bySource: {
      telegram: telegramCount,
      web: webCount
    },
    stepDropOffs
  };
}

// ==================== USER ENGAGEMENT ANALYTICS ====================

async function getUserEngagementAnalytics(
  runtime: AgentRuntime,
  startDate?: Date,
  endDate?: Date
): Promise<UserEngagementAnalytics> {
  try {
    const siuDb = await getSi3Database();
    if (!siuDb) {
      return getEmptyEngagementAnalytics();
    }

    const collection = siuDb.collection('test-si3Users');
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Active users
    const activeUsers = {
      last7Days: await collection.countDocuments({ lastLogin: { $gte: weekAgo } }),
      last30Days: await collection.countDocuments({ lastLogin: { $gte: monthAgo } }),
      last90Days: await collection.countDocuments({ lastLogin: { $gte: ninetyDaysAgo } })
    };

    // New users
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const newUsers = {
      today: await collection.countDocuments({ createdAt: { $gte: today } }),
      thisWeek: await collection.countDocuments({ createdAt: { $gte: thisWeek } }),
      thisMonth: await collection.countDocuments({ createdAt: { $gte: thisMonth } })
    };

    // By tier
    const byTier = {
      explorer: await collection.countDocuments({ userTier: 'explorer' }),
      paid: await collection.countDocuments({ userTier: 'paid' })
    };

    // By location (top 20)
    const locationAgg = await collection.aggregate([
      { $match: { location: { $exists: true, $ne: null } } },
      { $group: { _id: '$location', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]).toArray();

    const byLocation = locationAgg.map((item: any) => ({
      location: item._id,
      count: item.count
    }));

    // By language
    const byLanguage = {
      en: await collection.countDocuments({ language: 'en' }),
      es: await collection.countDocuments({ language: 'es' }),
      pt: await collection.countDocuments({ language: 'pt' }),
      fr: await collection.countDocuments({ language: 'fr' })
    };

    // By role (top 10)
    const roleAgg = await collection.aggregate([
      { $unwind: '$roles' },
      { $group: { _id: '$roles', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();

    const byRole = roleAgg.map((item: any) => ({
      role: item._id,
      count: item.count
    }));

    return {
      activeUsers,
      newUsers,
      byTier,
      byLocation,
      byLanguage,
      byRole
    };
  } catch (error) {
    console.error('[Analytics API] Error getting engagement stats:', error);
    return getEmptyEngagementAnalytics();
  }
}

function getEmptyEngagementAnalytics(): UserEngagementAnalytics {
  return {
    activeUsers: { last7Days: 0, last30Days: 0, last90Days: 0 },
    newUsers: { today: 0, thisWeek: 0, thisMonth: 0 },
    byTier: { explorer: 0, paid: 0 },
    byLocation: [],
    byLanguage: { en: 0, es: 0, pt: 0, fr: 0 },
    byRole: []
  };
}

// ==================== MATCH ANALYTICS ====================

async function getMatchAnalytics(
  runtime: AgentRuntime,
  startDate?: Date,
  endDate?: Date
): Promise<MatchAnalytics> {
  try {
    const db = runtime.databaseAdapter as any;
    const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
    const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';

    let totalMatches = 0;
    let connectedCount = 0;
    let pendingCount = 0;
    let notInterestedCount = 0;
    let telegramMatches = 0;
    let webMatches = 0;
    let uniqueUsers = new Set<string>();
    const byDate: Array<{ date: string; matches: number; connections: number }> = [];
    const interestCounts: Record<string, number> = {};
    // Track first match date for each user (for time-to-first-match calculation)
    const userFirstMatchDates = new Map<string, Date>();

    // Build date filter
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.match_date = {};
      if (startDate) dateFilter.match_date.$gte = startDate;
      if (endDate) dateFilter.match_date.$lte = endDate;
    }

    if (isMongo && db.getDb) {
      const mongoDb = await db.getDb();
      const matchesCollection = mongoDb.collection('matches');

      // Total matches
      totalMatches = await matchesCollection.countDocuments(dateFilter);

      // By status
      connectedCount = await matchesCollection.countDocuments({ ...dateFilter, status: 'connected' });
      pendingCount = await matchesCollection.countDocuments({ ...dateFilter, status: 'pending' });
      notInterestedCount = await matchesCollection.countDocuments({ ...dateFilter, status: 'not_interested' });

      // By source (from room_id pattern)
      const allMatches = await matchesCollection.find(dateFilter).toArray();
      for (const match of allMatches) {
        uniqueUsers.add(match.user_id);
        
        // NEW: Track first match date for each user
        if (match.match_date) {
          const matchDate = new Date(match.match_date);
          if (!userFirstMatchDates.has(match.user_id) || 
              matchDate < userFirstMatchDates.get(match.user_id)!) {
            userFirstMatchDates.set(match.user_id, matchDate);
          }
        }
        
        if (match.room_id?.startsWith('web_')) {
          webMatches++;
        } else {
          telegramMatches++;
        }
      }

      // By date (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const dateAgg = await matchesCollection.aggregate([
        { $match: { match_date: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$match_date' } },
            matches: { $sum: 1 },
            connections: { $sum: { $cond: [{ $eq: ['$status', 'connected'] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray();

      byDate.push(...dateAgg.map((item: any) => ({
        date: item._id,
        matches: item.matches,
        connections: item.connections
      })));

    } else if (db && db.query) {
      // PostgreSQL queries
      const totalResult = await db.query(`SELECT COUNT(*) as count FROM matches`);
      totalMatches = parseInt(totalResult.rows?.[0]?.count || '0');

      const statusResult = await db.query(`
        SELECT status, COUNT(*) as count FROM matches 
        GROUP BY status
      `);
      for (const row of statusResult.rows || []) {
        if (row.status === 'connected') connectedCount = parseInt(row.count);
        else if (row.status === 'pending') pendingCount = parseInt(row.count);
        else if (row.status === 'not_interested') notInterestedCount = parseInt(row.count);
      }

      const allMatchesResult = await db.query(`SELECT user_id, room_id, match_date FROM matches`);
      for (const row of allMatchesResult.rows || []) {
        uniqueUsers.add(row.user_id);
        
        // NEW: Track first match date for each user
        if (row.match_date) {
          const matchDate = new Date(row.match_date);
          if (!userFirstMatchDates.has(row.user_id) || 
              matchDate < userFirstMatchDates.get(row.user_id)!) {
            userFirstMatchDates.set(row.user_id, matchDate);
          }
        }
        
        if (row.room_id?.startsWith('web_')) {
          webMatches++;
        } else {
          telegramMatches++;
        }
      }

      const dateResult = await db.query(`
        SELECT 
          DATE(match_date) as date,
          COUNT(*) as matches,
          SUM(CASE WHEN status = 'connected' THEN 1 ELSE 0 END) as connections
        FROM matches
        WHERE match_date >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(match_date)
        ORDER BY date
      `);
      byDate.push(...(dateResult.rows || []).map((row: any) => ({
        date: row.date.toISOString().split('T')[0],
        matches: parseInt(row.matches),
        connections: parseInt(row.connections)
      })));
    }

    // Connection rate
    const connectionRate = totalMatches > 0 
      ? (connectedCount / totalMatches) * 100 
      : 0;

    // Average matches per user
    const averageMatchesPerUser = uniqueUsers.size > 0 
      ? totalMatches / uniqueUsers.size 
      : 0;

    // NEW: Get total completed users from onboarding analytics
    const onboardingAnalytics = await getOnboardingAnalytics(runtime, startDate, endDate);
    const totalCompletedUsers = onboardingAnalytics.totalCompleted;
    const usersWithAtLeastOneMatch = uniqueUsers.size;
    
    // NEW: Calculate match success rate
    const matchSuccessRate = totalCompletedUsers > 0
      ? (usersWithAtLeastOneMatch / totalCompletedUsers) * 100
      : 0;
    
    // NEW: Users who requested match (inferred from having matches)
    const usersWhoRequestedMatch = usersWithAtLeastOneMatch;
    
    // NEW: Calculate time-to-first-match
    // Get onboarding completion dates from SI U database
    let timeToFirstMatchDays: number[] = [];
    try {
      const { getSi3Database } = await import('./si3Database.js');
      const si3Db = await getSi3Database();
      
      if (si3Db) {
        const siuCollection = si3Db.collection('test-si3Users');
        
        // Get onboarding dates for users who have matches
        for (const userId of uniqueUsers) {
          try {
            // Try to find user by email or userId in SI U database
            // Note: userId might be different format, so we'll check matches for user_id
            let userEmail: string | null = null;
            
            // Get user email from matches (if stored) or try to find in cache
            if (isMongo && db.getDb) {
              const mongoDb = await db.getDb();
              const matchesCollection = mongoDb.collection('matches');
              const userMatch = await matchesCollection.findOne({ user_id: userId });
              
              // Try to get user profile from cache to find email
              const cacheCollection = mongoDb.collection('cache');
              const cacheEntry = await cacheCollection.findOne({ key: `onboarding_${userId}` });
              if (cacheEntry) {
                const profile = typeof cacheEntry.value === 'string' 
                  ? JSON.parse(cacheEntry.value) 
                  : cacheEntry.value;
                userEmail = profile?.profile?.email || profile?.email;
              }
            } else if (db.query) {
              // PostgreSQL: try to get from cache
              const cacheResult = await db.query(
                `SELECT value FROM cache WHERE key = $1`,
                [`onboarding_${userId}`]
              );
              if (cacheResult.rows?.[0]) {
                const profile = typeof cacheResult.rows[0].value === 'string'
                  ? JSON.parse(cacheResult.rows[0].value)
                  : cacheResult.rows[0].value;
                userEmail = profile?.profile?.email || profile?.email;
              }
            }
            
            if (userEmail) {
              const siuUser = await siuCollection.findOne({ 
                email: userEmail.toLowerCase().trim() 
              });
              
              if (siuUser && siuUser.onboardingCompletedAt && userFirstMatchDates.has(userId)) {
                const onboardingDate = new Date(siuUser.onboardingCompletedAt);
                const firstMatchDate = userFirstMatchDates.get(userId)!;
                const diffMs = firstMatchDate.getTime() - onboardingDate.getTime();
                const diffDays = diffMs / (1000 * 60 * 60 * 24);
                if (diffDays >= 0 && diffDays < 365) { // Valid range: 0 to 1 year
                  timeToFirstMatchDays.push(diffDays);
                }
              }
            }
          } catch (err) {
            // Skip if can't find user
            console.log(`[Analytics] Could not get onboarding date for user ${userId}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('[Analytics] Error calculating time-to-first-match:', err);
    }
    
    const averageDays = timeToFirstMatchDays.length > 0
      ? timeToFirstMatchDays.reduce((a, b) => a + b, 0) / timeToFirstMatchDays.length
      : 0;
    const averageHours = averageDays * 24;

    // Top matching interests (would need match reason parsing)
    // For now, return empty - could be enhanced later
    const topMatchingInterests: Array<{ interest: string; matchCount: number }> = [];

    return {
      totalMatches,
      successfulConnections: connectedCount,
      connectionRate: Math.round(connectionRate * 100) / 100,
      bySource: {
        telegram: telegramMatches,
        web: webMatches
      },
      averageMatchesPerUser: Math.round(averageMatchesPerUser * 100) / 100,
      byStatus: {
        pending: pendingCount,
        connected: connectedCount,
        not_interested: notInterestedCount
      },
      byDate,
      topMatchingInterests,
      // NEW: Conversion metrics
      totalCompletedUsers,
      usersWithAtLeastOneMatch,
      matchSuccessRate: Math.round(matchSuccessRate * 100) / 100,
      usersWhoRequestedMatch,
      timeToFirstMatch: {
        averageDays: Math.round(averageDays * 100) / 100,
        averageHours: Math.round(averageHours * 100) / 100
      }
    };
  } catch (error) {
    console.error('[Analytics API] Error getting match stats:', error);
    return {
      totalMatches: 0,
      successfulConnections: 0,
      connectionRate: 0,
      bySource: { telegram: 0, web: 0 },
      averageMatchesPerUser: 0,
      byStatus: { pending: 0, connected: 0, not_interested: 0 },
      byDate: [],
      topMatchingInterests: [],
      // NEW: Default values for conversion metrics
      totalCompletedUsers: 0,
      usersWithAtLeastOneMatch: 0,
      matchSuccessRate: 0,
      usersWhoRequestedMatch: 0,
      timeToFirstMatch: {
        averageDays: 0,
        averageHours: 0
      }
    };
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get quick summary stats for dashboard
 */
export async function getQuickStats(runtime: AgentRuntime): Promise<{
  totalUsers: number;
  activeToday: number;
  totalMatches: number;
  pendingMatches: number;
  onboardingInProgress: number;
}> {
  const [engagement, matches, cacheStats] = await Promise.all([
    getUserEngagementAnalytics(runtime),
    getMatchAnalytics(runtime),
    getCacheOnboardingStats(runtime)
  ]);

  return {
    totalUsers: engagement.byTier.explorer + engagement.byTier.paid,
    activeToday: engagement.newUsers.today, // Using newUsers.today as proxy for active
    totalMatches: matches.totalMatches,
    pendingMatches: matches.byStatus.pending,
    onboardingInProgress: cacheStats.totalInProgress
  };
}

