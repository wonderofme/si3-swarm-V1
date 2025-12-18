import 'dotenv/config';
import { MongoClient } from 'mongodb';
import pg from 'pg';

/**
 * One-time script to delete all users with "Ayoola" in their name
 * 
 * Usage:
 *   npm run ts-node scripts/delete-ayoola-users.ts
 * 
 * This will:
 * 1. Find all users in the cache collection
 * 2. Check if their name contains "Ayoola" (case-insensitive)
 * 3. Delete those users and all related data
 */

interface UserInfo {
  userId: string;
  key: string;
  name?: string;
  step?: string;
}

async function findAyoolaUsers(mongoDb: any, pgClient: pg.Pool | null): Promise<UserInfo[]> {
  const users: UserInfo[] = [];
  
  if (mongoDb) {
    const cacheCollection = mongoDb.collection('cache');
    const docs = await cacheCollection.find({
      key: { $regex: /^onboarding_/ }
    }).toArray();
    
    for (const doc of docs) {
      try {
        const userId = doc.key.replace('onboarding_', '');
        const value = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;
        const name = value?.profile?.name || '';
        
        // Check if name contains "Ayoola" (case-insensitive)
        if (name && name.toLowerCase().includes('ayoola')) {
          users.push({
            userId,
            key: doc.key,
            name: name,
            step: value?.step
          });
        }
      } catch (e) {
        console.error(`Error parsing document ${doc.key}:`, e);
      }
    }
  } else if (pgClient) {
    // PostgreSQL
    const result = await pgClient.query(`
      SELECT key, value 
      FROM cache 
      WHERE key LIKE 'onboarding_%'
    `);
    
    for (const row of result.rows) {
      try {
        const userId = row.key.replace('onboarding_', '');
        const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        const name = value?.profile?.name || '';
        
        // Check if name contains "Ayoola" (case-insensitive)
        if (name && name.toLowerCase().includes('ayoola')) {
          users.push({
            userId,
            key: row.key,
            name: name,
            step: value?.step
          });
        }
      } catch (e) {
        console.error(`Error parsing row ${row.key}:`, e);
      }
    }
  }
  
  return users;
}

async function deleteUser(mongoDb: any, pgClient: pg.Pool | null, userId: string): Promise<boolean> {
  const key = `onboarding_${userId}`;
  
  try {
    if (mongoDb) {
      const cacheCollection = mongoDb.collection('cache');
      // Delete ALL cache entries for this user (there might be multiple entries with same key)
      // Use exact match first, but also handle any edge cases
      const cacheResult = await cacheCollection.deleteMany({ 
        key: key  // Exact match - MongoDB should handle this correctly
      });
      
      // Also delete related data
      const matchesCollection = mongoDb.collection('matches');
      await matchesCollection.deleteMany({ 
        $or: [{ user_id: userId }, { matched_user_id: userId }] 
      });
      
      const followUpsCollection = mongoDb.collection('follow_ups');
      await followUpsCollection.deleteMany({ user_id: userId });
      
      const featureRequestsCollection = mongoDb.collection('feature_requests');
      await featureRequestsCollection.deleteMany({ user_id: userId });
      
      const manualRequestsCollection = mongoDb.collection('manual_connection_requests');
      await manualRequestsCollection.deleteMany({ user_id: userId });
      
      const diversityCollection = mongoDb.collection('diversity_research');
      await diversityCollection.deleteMany({ userId });
      
      return cacheResult.deletedCount > 0;
    } else if (pgClient) {
      // PostgreSQL
      await pgClient.query('BEGIN');
      
      // Delete from cache
      await pgClient.query('DELETE FROM cache WHERE key = $1', [key]);
      
      // Delete related data
      await pgClient.query('DELETE FROM matches WHERE user_id = $1 OR matched_user_id = $1', [userId]);
      await pgClient.query('DELETE FROM follow_ups WHERE user_id = $1', [userId]);
      await pgClient.query('DELETE FROM feature_requests WHERE user_id = $1', [userId]);
      await pgClient.query('DELETE FROM manual_connection_requests WHERE user_id = $1', [userId]);
      await pgClient.query('DELETE FROM diversity_research WHERE user_id = $1', [userId]);
      
      await pgClient.query('COMMIT');
      return true;
    }
    return false;
  } catch (error: any) {
    if (pgClient) {
      await pgClient.query('ROLLBACK');
    }
    console.error(`Error deleting user ${userId}:`, error.message);
    return false;
  }
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
      // MongoDB connection
      mongoClient = new MongoClient(process.env.DATABASE_URL);
      await mongoClient.connect();
      const dbName = process.env.DATABASE_URL.match(/\/([^/?]+)(\?|$)/)?.[1] || 'kaia';
      mongoDb = mongoClient.db(dbName);
      console.log(`✅ Connected to MongoDB database: ${dbName}`);
    } else {
      // PostgreSQL connection
      pgClient = new pg.Pool({
        connectionString: process.env.DATABASE_URL
      });
      await pgClient.query('SELECT 1'); // Test connection
      console.log('✅ Connected to PostgreSQL');
    }
    
    console.log('🔍 Searching for users with "Ayoola" in their name...\n');
    
    const ayoolaUsers = await findAyoolaUsers(mongoDb, pgClient);
  
  if (ayoolaUsers.length === 0) {
    console.log('✅ No users found with "Ayoola" in their name.');
    return;
  }
  
  // Group by userId to get unique users (there might be multiple cache entries per user)
  const uniqueUsers = new Map<string, UserInfo>();
  for (const user of ayoolaUsers) {
    if (!uniqueUsers.has(user.userId)) {
      uniqueUsers.set(user.userId, user);
    } else {
      // Keep the one with the most complete profile (COMPLETED > other steps)
      const existing = uniqueUsers.get(user.userId)!;
      if (user.step === 'COMPLETED' && existing.step !== 'COMPLETED') {
        uniqueUsers.set(user.userId, user);
      } else if (user.name && user.name.length > (existing.name || '').length) {
        uniqueUsers.set(user.userId, user);
      }
    }
  }
  
  const uniqueUserList = Array.from(uniqueUsers.values());
  const totalEntries = ayoolaUsers.length;
  
  console.log(`⚠️  Found ${totalEntries} cache entry/entries for ${uniqueUserList.length} unique user(s) with "Ayoola" in their name:\n`);
  console.log('ID'.padEnd(20), 'Name'.padEnd(30), 'Step');
  console.log('-'.repeat(70));
  
  uniqueUserList.forEach((user) => {
    const entryCount = ayoolaUsers.filter(u => u.userId === user.userId).length;
    const entryInfo = entryCount > 1 ? ` (${entryCount} entries)` : '';
    console.log(
      user.userId.padEnd(20),
      ((user.name || 'N/A') + entryInfo).padEnd(30),
      user.step || 'N/A'
    );
  });
  
  console.log('\n' + '='.repeat(70));
  console.log(`\n⚠️  WARNING: This will delete ${uniqueUserList.length} unique user(s) and all their related data!`);
  console.log(`   (This includes ${totalEntries} cache entry/entries)`);
  console.log('This includes:');
  console.log('  - User profile and onboarding state (all cache entries)');
  console.log('  - All matches');
  console.log('  - All follow-ups');
  console.log('  - Feature requests');
  console.log('  - Manual connection requests');
  console.log('  - Diversity research records');
  
  // For safety, require confirmation via command line argument
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] !== '--confirm') {
    console.log('\n💡 To proceed, run with --confirm flag:');
    console.log('   npm run delete-ayoola-users --confirm');
    return;
  }
  
  console.log('\n🗑️  Deleting users...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  // Delete each unique user (this will delete all cache entries for that userId)
  for (const user of uniqueUserList) {
    const entryCount = ayoolaUsers.filter(u => u.userId === user.userId).length;
    console.log(`Deleting ${user.name || user.userId} (${user.userId})${entryCount > 1 ? ` - ${entryCount} cache entries` : ''}...`);
    const success = await deleteUser(mongoDb, pgClient, user.userId);
    if (success) {
      console.log(`✅ Successfully deleted ${user.name || user.userId}`);
      successCount++;
    } else {
      console.log(`❌ Failed to delete ${user.name || user.userId}`);
      failCount++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`\n✅ Deletion complete!`);
  console.log(`   Successfully deleted: ${successCount} unique user(s)`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Total processed: ${uniqueUserList.length} unique user(s)`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close database connections
    if (mongoClient) {
      await mongoClient.close();
      console.log('✅ MongoDB connection closed');
    }
    if (pgClient) {
      await pgClient.end();
      console.log('✅ PostgreSQL connection closed');
    }
  }
}

main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

