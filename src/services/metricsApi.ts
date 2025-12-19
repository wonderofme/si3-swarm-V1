import { IAgentRuntime } from '@elizaos/core';

export interface MatchMetrics {
  total: number;
  pending: number;
  connected: number;
  notInterested: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  byDate: Array<{ date: string; count: number }>;
}

export interface UserMetrics {
  total: number;
  completedOnboarding: number;
  activeLast7Days: number;
  activeLast30Days: number;
  onboardingCompletionRate: number;
}

export interface EngagementMetrics {
  featureRequests: {
    total: number;
    thisWeek: number;
    thisMonth: number;
  };
  manualConnectionRequests: {
    total: number;
    thisWeek: number;
    thisMonth: number;
  };
  diversityResearchInterest: {
    total: number;
    thisWeek: number;
    thisMonth: number;
  };
}

export interface FollowUpMetrics {
  scheduled: number;
  sent: number;
  pending: number;
  responseRate: number;
  byType: {
    '3_day_checkin': { scheduled: number; sent: number; responded: number };
    '7_day_next_match': { scheduled: number; sent: number; responded: number };
  };
}

export interface AgentMetrics {
  matches: MatchMetrics;
  users: UserMetrics;
  engagement: EngagementMetrics;
  followUps: FollowUpMetrics;
  timestamp: string;
}

export async function getAgentMetrics(
  runtime: IAgentRuntime,
  startDate?: Date,
  endDate?: Date
): Promise<AgentMetrics> {
  const db = runtime.databaseAdapter as any;
  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  
  const dateFilter = startDate && endDate 
    ? { start: startDate, end: endDate }
    : undefined;

  // Match Metrics
  const matchMetrics = await getMatchMetrics(db, isMongo, today, weekAgo, monthAgo, dateFilter);
  
  // User Metrics
  const userMetrics = await getUserMetrics(db, isMongo, weekAgo, monthAgo);
  
  // Engagement Metrics
  const engagementMetrics = await getEngagementMetrics(db, isMongo, weekAgo, monthAgo);
  
  // Follow-up Metrics
  const followUpMetrics = await getFollowUpMetrics(db, isMongo);

  return {
    matches: matchMetrics,
    users: userMetrics,
    engagement: engagementMetrics,
    followUps: followUpMetrics,
    timestamp: new Date().toISOString()
  };
}

async function getMatchMetrics(
  db: any,
  isMongo: boolean,
  today: Date,
  weekAgo: Date,
  monthAgo: Date,
  dateFilter?: { start: Date; end: Date }
): Promise<MatchMetrics> {
  if (isMongo && db.getDb) {
    const mongoDb = await db.getDb();
    const collection = mongoDb.collection('matches');
    
    // Total matches
    const total = await collection.countDocuments();
    const pending = await collection.countDocuments({ status: 'pending' });
    const connected = await collection.countDocuments({ status: 'connected' });
    const notInterested = await collection.countDocuments({ status: 'not_interested' });
    
    // Time-based counts
    const todayCount = await collection.countDocuments({
      match_date: { $gte: today }
    });
    const weekCount = await collection.countDocuments({
      match_date: { $gte: weekAgo }
    });
    const monthCount = await collection.countDocuments({
      match_date: { $gte: monthAgo }
    });
    
    // Daily breakdown (last 30 days)
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dailyMatches = await collection.aggregate([
      {
        $match: {
          match_date: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$match_date' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    const byDate = dailyMatches.map((item: any) => ({
      date: item._id,
      count: item.count
    }));
    
    return {
      total,
      pending,
      connected,
      notInterested,
      today: todayCount,
      thisWeek: weekCount,
      thisMonth: monthCount,
      byDate
    };
  } else {
    // PostgreSQL
    const total = (await db.query('SELECT COUNT(*) as count FROM matches')).rows[0].count;
    const pending = (await db.query("SELECT COUNT(*) as count FROM matches WHERE status = 'pending'")).rows[0].count;
    const connected = (await db.query("SELECT COUNT(*) as count FROM matches WHERE status = 'connected'")).rows[0].count;
    const notInterested = (await db.query("SELECT COUNT(*) as count FROM matches WHERE status = 'not_interested'")).rows[0].count;
    
    const todayCount = (await db.query(
      'SELECT COUNT(*) as count FROM matches WHERE match_date >= $1',
      [today]
    )).rows[0].count;
    
    const weekCount = (await db.query(
      'SELECT COUNT(*) as count FROM matches WHERE match_date >= $1',
      [weekAgo]
    )).rows[0].count;
    
    const monthCount = (await db.query(
      'SELECT COUNT(*) as count FROM matches WHERE match_date >= $1',
      [monthAgo]
    )).rows[0].count;
    
    // Daily breakdown (last 30 days)
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dailyMatches = await db.query(`
      SELECT 
        DATE(match_date) as date,
        COUNT(*) as count
      FROM matches
      WHERE match_date >= $1
      GROUP BY DATE(match_date)
      ORDER BY date ASC
    `, [thirtyDaysAgo]);
    
    const byDate = dailyMatches.rows.map((row: any) => ({
      date: row.date.toISOString().split('T')[0],
      count: parseInt(row.count)
    }));
    
    return {
      total: parseInt(total),
      pending: parseInt(pending),
      connected: parseInt(connected),
      notInterested: parseInt(notInterested),
      today: parseInt(todayCount),
      thisWeek: parseInt(weekCount),
      thisMonth: parseInt(monthCount),
      byDate
    };
  }
}

async function getUserMetrics(
  db: any,
  isMongo: boolean,
  weekAgo: Date,
  monthAgo: Date
): Promise<UserMetrics> {
  if (isMongo && db.getDb) {
    const mongoDb = await db.getDb();
    const cacheCollection = mongoDb.collection('cache');
    
    // Get all cache entries that look like user profiles
    const allCache = await cacheCollection.find({
      key: { $regex: /^onboarding_/ }
    }).toArray();
    
    const total = allCache.length;
    
    // Count completed onboarding (has onboardingCompletedAt)
    const completed = await cacheCollection.countDocuments({
      key: { $regex: /^onboarding_/ },
      'value.onboardingCompletedAt': { $exists: true }
    });
    
    // Active users (updated in last 7/30 days)
    const active7Days = await cacheCollection.countDocuments({
      key: { $regex: /^onboarding_/ },
      updated_at: { $gte: weekAgo }
    });
    
    const active30Days = await cacheCollection.countDocuments({
      key: { $regex: /^onboarding_/ },
      updated_at: { $gte: monthAgo }
    });
    
    return {
      total,
      completedOnboarding: completed,
      activeLast7Days: active7Days,
      activeLast30Days: active30Days,
      onboardingCompletionRate: total > 0 ? (completed / total) * 100 : 0
    };
  } else {
    // PostgreSQL
    const total = (await db.query(
      "SELECT COUNT(*) as count FROM cache WHERE key LIKE 'onboarding_%'"
    )).rows[0].count;
    
    const completed = (await db.query(`
      SELECT COUNT(*) as count 
      FROM cache 
      WHERE key LIKE 'onboarding_%' 
      AND value::jsonb->'profile'->>'onboardingCompletedAt' IS NOT NULL
    `)).rows[0].count;
    
    const active7Days = (await db.query(`
      SELECT COUNT(*) as count 
      FROM cache 
      WHERE key LIKE 'onboarding_%' 
      AND updated_at >= $1
    `, [weekAgo])).rows[0].count;
    
    const active30Days = (await db.query(`
      SELECT COUNT(*) as count 
      FROM cache 
      WHERE key LIKE 'onboarding_%' 
      AND updated_at >= $1
    `, [monthAgo])).rows[0].count;
    
    return {
      total: parseInt(total),
      completedOnboarding: parseInt(completed),
      activeLast7Days: parseInt(active7Days),
      activeLast30Days: parseInt(active30Days),
      onboardingCompletionRate: parseInt(total) > 0 
        ? (parseInt(completed) / parseInt(total)) * 100 
        : 0
    };
  }
}

async function getEngagementMetrics(
  db: any,
  isMongo: boolean,
  weekAgo: Date,
  monthAgo: Date
): Promise<EngagementMetrics> {
  if (isMongo) {
    // Feature requests
    let featureTotal = 0, featureWeek = 0, featureMonth = 0;
    try {
      const mongoDb = await db.getDb();
      const featureRequestsCollection = mongoDb.collection('feature_requests');
      featureTotal = await featureRequestsCollection.countDocuments();
      featureWeek = await featureRequestsCollection.countDocuments({
        created_at: { $gte: weekAgo }
      });
      featureMonth = await featureRequestsCollection.countDocuments({
        created_at: { $gte: monthAgo }
      });
    } catch (e) {
      console.log('[Metrics] Feature requests collection not found in MongoDB');
    }
    
    // Manual connection requests (no-match notifications)
    let manualTotal = 0, manualWeek = 0, manualMonth = 0;
    try {
      const mongoDb = await db.getDb();
      const manualRequestsCollection = mongoDb.collection('manual_connection_requests');
      manualTotal = await manualRequestsCollection.countDocuments();
      manualWeek = await manualRequestsCollection.countDocuments({
        created_at: { $gte: weekAgo }
      });
      manualMonth = await manualRequestsCollection.countDocuments({
        created_at: { $gte: monthAgo }
      });
    } catch (e) {
      console.log('[Metrics] Manual connection requests collection not found in MongoDB');
    }
    
    // Diversity research
    const mongoDb = await db.getDb();
    const diversityCollection = mongoDb.collection('diversity_research');
    const diversityTotal = await diversityCollection.countDocuments();
    const diversityWeek = await diversityCollection.countDocuments({
      interestedAt: { $gte: weekAgo }
    });
    const diversityMonth = await diversityCollection.countDocuments({
      interestedAt: { $gte: monthAgo }
    });
    
    return {
      featureRequests: {
        total: featureTotal,
        thisWeek: featureWeek,
        thisMonth: featureMonth
      },
      manualConnectionRequests: {
        total: manualTotal,
        thisWeek: manualWeek,
        thisMonth: manualMonth
      },
      diversityResearchInterest: {
        total: diversityTotal,
        thisWeek: diversityWeek,
        thisMonth: diversityMonth
      }
    };
  } else {
    // PostgreSQL
    // Feature requests
    let featureTotal = 0, featureWeek = 0, featureMonth = 0;
    try {
      const featureCounts = await db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE true) as total,
          COUNT(*) FILTER (WHERE created_at >= $1) as week_count,
          COUNT(*) FILTER (WHERE created_at >= $2) as month_count
        FROM feature_requests
      `, [weekAgo, monthAgo]);
      if (featureCounts.rows.length > 0) {
        featureTotal = parseInt(featureCounts.rows[0].total || '0');
        featureWeek = parseInt(featureCounts.rows[0].week_count || '0');
        featureMonth = parseInt(featureCounts.rows[0].month_count || '0');
      }
    } catch (e) {
      // Table might not exist
    }
    
    // Manual connection requests (no-match notifications)
    let manualTotal = 0, manualWeek = 0, manualMonth = 0;
    try {
      const manualCounts = await db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE true) as total,
          COUNT(*) FILTER (WHERE created_at >= $1) as week_count,
          COUNT(*) FILTER (WHERE created_at >= $2) as month_count
        FROM manual_connection_requests
      `, [weekAgo, monthAgo]);
      if (manualCounts.rows.length > 0) {
        manualTotal = parseInt(manualCounts.rows[0].total || '0');
        manualWeek = parseInt(manualCounts.rows[0].week_count || '0');
        manualMonth = parseInt(manualCounts.rows[0].month_count || '0');
      }
    } catch (e) {
      // Table might not exist yet
      console.log('[Metrics] Manual connection requests table not found in PostgreSQL');
    }
    
    // Diversity research
    let diversityTotal = 0, diversityWeek = 0, diversityMonth = 0;
    try {
      const diversityCounts = await db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE true) as total,
          COUNT(*) FILTER (WHERE created_at >= $1) as week_count,
          COUNT(*) FILTER (WHERE created_at >= $2) as month_count
        FROM diversity_research
      `, [weekAgo, monthAgo]);
      if (diversityCounts.rows.length > 0) {
        diversityTotal = parseInt(diversityCounts.rows[0].total || '0');
        diversityWeek = parseInt(diversityCounts.rows[0].week_count || '0');
        diversityMonth = parseInt(diversityCounts.rows[0].month_count || '0');
      }
    } catch (e) {
      // Table might not exist, check cache instead
      const diversityCache = await db.query(`
        SELECT COUNT(*) as count
        FROM cache
        WHERE key LIKE 'onboarding_%'
        AND value::jsonb->'profile'->>'diversityResearchInterest' = 'Yes'
      `);
      diversityTotal = parseInt(diversityCache.rows[0]?.count || '0');
    }
    
    return {
      featureRequests: {
        total: featureTotal,
        thisWeek: featureWeek,
        thisMonth: featureMonth
      },
      manualConnectionRequests: {
        total: manualTotal,
        thisWeek: manualWeek,
        thisMonth: manualMonth
      },
      diversityResearchInterest: {
        total: diversityTotal,
        thisWeek: diversityWeek,
        thisMonth: diversityMonth
      }
    };
  }
}

async function getFollowUpMetrics(
  db: any,
  isMongo: boolean
): Promise<FollowUpMetrics> {
  if (isMongo && db.getDb) {
    const mongoDb = await db.getDb();
    const collection = mongoDb.collection('follow_ups');
    
    const scheduled = await collection.countDocuments({ status: 'pending' });
    const sent = await collection.countDocuments({ status: 'sent' });
    
    const checkinScheduled = await collection.countDocuments({
      type: '3_day_checkin',
      status: 'pending'
    });
    const checkinSent = await collection.countDocuments({
      type: '3_day_checkin',
      status: 'sent'
    });
    const checkinResponded = await collection.countDocuments({
      type: '3_day_checkin',
      status: 'sent',
      response: { $exists: true, $ne: null }
    });
    
    const nextMatchScheduled = await collection.countDocuments({
      type: '7_day_next_match',
      status: 'pending'
    });
    const nextMatchSent = await collection.countDocuments({
      type: '7_day_next_match',
      status: 'sent'
    });
    const nextMatchResponded = await collection.countDocuments({
      type: '7_day_next_match',
      status: 'sent',
      response: { $exists: true, $ne: null }
    });
    
    const totalSent = checkinSent + nextMatchSent;
    const totalResponded = checkinResponded + nextMatchResponded;
    const responseRate = totalSent > 0 ? (totalResponded / totalSent) * 100 : 0;
    
    return {
      scheduled,
      sent,
      pending: scheduled,
      responseRate,
      byType: {
        '3_day_checkin': {
          scheduled: checkinScheduled,
          sent: checkinSent,
          responded: checkinResponded
        },
        '7_day_next_match': {
          scheduled: nextMatchScheduled,
          sent: nextMatchSent,
          responded: nextMatchResponded
        }
      }
    };
  } else {
    // PostgreSQL
    const scheduled = (await db.query(
      "SELECT COUNT(*) as count FROM follow_ups WHERE status = 'pending'"
    )).rows[0].count;
    
    const sent = (await db.query(
      "SELECT COUNT(*) as count FROM follow_ups WHERE status = 'sent'"
    )).rows[0].count;
    
    const checkinScheduled = (await db.query(`
      SELECT COUNT(*) as count 
      FROM follow_ups 
      WHERE type = '3_day_checkin' AND status = 'pending'
    `)).rows[0].count;
    
    const checkinSent = (await db.query(`
      SELECT COUNT(*) as count 
      FROM follow_ups 
      WHERE type = '3_day_checkin' AND status = 'sent'
    `)).rows[0].count;
    
    const checkinResponded = (await db.query(`
      SELECT COUNT(*) as count 
      FROM follow_ups 
      WHERE type = '3_day_checkin' 
      AND status = 'sent' 
      AND response IS NOT NULL
    `)).rows[0].count;
    
    const nextMatchScheduled = (await db.query(`
      SELECT COUNT(*) as count 
      FROM follow_ups 
      WHERE type = '7_day_next_match' AND status = 'pending'
    `)).rows[0].count;
    
    const nextMatchSent = (await db.query(`
      SELECT COUNT(*) as count 
      FROM follow_ups 
      WHERE type = '7_day_next_match' AND status = 'sent'
    `)).rows[0].count;
    
    const nextMatchResponded = (await db.query(`
      SELECT COUNT(*) as count 
      FROM follow_ups 
      WHERE type = '7_day_next_match' 
      AND status = 'sent' 
      AND response IS NOT NULL
    `)).rows[0].count;
    
    const totalSent = parseInt(sent);
    const totalResponded = parseInt(checkinResponded) + parseInt(nextMatchResponded);
    const responseRate = totalSent > 0 ? (totalResponded / totalSent) * 100 : 0;
    
    return {
      scheduled: parseInt(scheduled),
      sent: parseInt(sent),
      pending: parseInt(scheduled),
      responseRate,
      byType: {
        '3_day_checkin': {
          scheduled: parseInt(checkinScheduled),
          sent: parseInt(checkinSent),
          responded: parseInt(checkinResponded)
        },
        '7_day_next_match': {
          scheduled: parseInt(nextMatchScheduled),
          sent: parseInt(nextMatchSent),
          responded: parseInt(nextMatchResponded)
        }
      }
    };
  }
}

