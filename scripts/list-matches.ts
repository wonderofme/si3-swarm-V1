import 'dotenv/config';
import { MongoClient } from 'mongodb';
import pg from 'pg';

/**
 * Script to list all matches from the database
 * 
 * Usage:
 *   npm run ts-node scripts/list-matches.ts
 */

interface MatchInfo {
  id: string;
  userId: string;
  matchedUserId: string;
  roomId: string;
  matchDate: Date;
  status: string;
  userName?: string;
  matchedUserName?: string;
}

async function getUserName(db: any, isMongo: boolean, userId: string): Promise<string | undefined> {
  const key = `onboarding_${userId}`;
  
  try {
    if (isMongo) {
      const cacheCollection = db.collection('cache');
      const doc = await cacheCollection.findOne({ key });
      if (doc && doc.value) {
        const value = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;
        return value?.profile?.name;
      }
    } else {
      const result = await db.query('SELECT value FROM cache WHERE key = $1', [key]);
      if (result.rows.length > 0) {
        const value = typeof result.rows[0].value === 'string' 
          ? JSON.parse(result.rows[0].value) 
          : result.rows[0].value;
        return value?.profile?.name;
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return undefined;
}

async function listMatches(mongoDb: any, pgClient: pg.Pool | null): Promise<MatchInfo[]> {
  const matches: MatchInfo[] = [];
  
  if (mongoDb) {
    const matchesCollection = mongoDb.collection('matches');
    const docs = await matchesCollection.find({}).sort({ match_date: -1 }).toArray();
    
    for (const doc of docs) {
      matches.push({
        id: doc.id || doc._id?.toString() || 'unknown',
        userId: doc.user_id || '',
        matchedUserId: doc.matched_user_id || '',
        roomId: doc.room_id || '',
        matchDate: doc.match_date ? new Date(doc.match_date) : new Date(),
        status: doc.status || 'unknown'
      });
    }
  } else if (pgClient) {
    const result = await pgClient.query(`
      SELECT id, user_id, matched_user_id, room_id, match_date, status
      FROM matches
      ORDER BY match_date DESC
    `);
    
    for (const row of result.rows) {
      matches.push({
        id: row.id,
        userId: row.user_id || '',
        matchedUserId: row.matched_user_id || '',
        roomId: row.room_id || '',
        matchDate: row.match_date ? new Date(row.match_date) : new Date(),
        status: row.status || 'unknown'
      });
    }
  }
  
  return matches;
}

async function main() {
  let mongoClient: MongoClient | null = null;
  let mongoDb: any = null;
  let pgClient: pg.Pool | null = null;
  
  try {
    console.log('🔍 Connecting to database...');
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL environment variable is required');
      process.exit(1);
    }
    
    const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
    const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
    
    console.log(`📊 Database type: ${databaseType}`);
    
    if (isMongo) {
      mongoClient = new MongoClient(process.env.DATABASE_URL);
      await mongoClient.connect();
      const dbName = process.env.DATABASE_URL.match(/\/([^/?]+)(\?|$)/)?.[1] || 'kaia';
      mongoDb = mongoClient.db(dbName);
      console.log(`✅ Connected to MongoDB database: ${dbName}`);
    } else {
      pgClient = new pg.Pool({
        connectionString: process.env.DATABASE_URL
      });
      await pgClient.query('SELECT 1');
      console.log('✅ Connected to PostgreSQL');
    }
    
    console.log('\n🔍 Fetching matches...\n');
    
    const matches = await listMatches(mongoDb, pgClient);
    
    if (matches.length === 0) {
      console.log('✅ No matches found in the database.');
      return;
    }
    
    console.log(`📊 Found ${matches.length} match(es):\n`);
    console.log('='.repeat(100));
    console.log(
      'ID'.padEnd(36),
      'User'.padEnd(25),
      'Matched With'.padEnd(25),
      'Status'.padEnd(15),
      'Date'
    );
    console.log('-'.repeat(100));
    
    // Fetch user names for all matches
    for (const match of matches) {
      const db = isMongo ? mongoDb : pgClient;
      match.userName = await getUserName(db, isMongo, match.userId);
      match.matchedUserName = await getUserName(db, isMongo, match.matchedUserId);
      
      const dateStr = match.matchDate.toLocaleDateString() + ' ' + match.matchDate.toLocaleTimeString();
      console.log(
        match.id.substring(0, 36).padEnd(36),
        (match.userName || match.userId.substring(0, 20) || 'Unknown').padEnd(25),
        (match.matchedUserName || match.matchedUserId.substring(0, 20) || 'Unknown').padEnd(25),
        match.status.padEnd(15),
        dateStr
      );
    }
    
    console.log('='.repeat(100));
    
    // Summary statistics
    const statusCounts: Record<string, number> = {};
    for (const match of matches) {
      statusCounts[match.status] = (statusCounts[match.status] || 0) + 1;
    }
    
    console.log('\n📈 Summary:');
    console.log(`   Total Matches: ${matches.length}`);
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`   ${status}: ${count}`);
    }
    
    // Recent matches (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentMatches = matches.filter(m => m.matchDate >= weekAgo);
    console.log(`\n   Matches in last 7 days: ${recentMatches.length}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log('\n✅ MongoDB connection closed');
    }
    if (pgClient) {
      await pgClient.end();
      console.log('✅ PostgreSQL connection closed');
    }
  }
}

main();





