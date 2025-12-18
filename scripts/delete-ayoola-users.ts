import 'dotenv/config';
import { createDatabaseAdapter } from '../src/adapters/databaseAdapter.js';

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

async function findAyoolaUsers(db: any, isMongo: boolean): Promise<UserInfo[]> {
  const users: UserInfo[] = [];
  
  if (isMongo) {
    const cacheCollection = db.db.collection('cache');
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
  } else {
    // PostgreSQL
    const result = await db.query(`
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

async function deleteUser(db: any, isMongo: boolean, userId: string): Promise<boolean> {
  const key = `onboarding_${userId}`;
  
  try {
    if (isMongo) {
      const cacheCollection = db.db.collection('cache');
      const result = await cacheCollection.deleteOne({ key });
      
      // Also delete related data
      const matchesCollection = db.db.collection('matches');
      await matchesCollection.deleteMany({ 
        $or: [{ user_id: userId }, { matched_user_id: userId }] 
      });
      
      const followUpsCollection = db.db.collection('follow_ups');
      await followUpsCollection.deleteMany({ user_id: userId });
      
      const featureRequestsCollection = db.db.collection('feature_requests');
      await featureRequestsCollection.deleteMany({ user_id: userId });
      
      const manualRequestsCollection = db.db.collection('manual_connection_requests');
      await manualRequestsCollection.deleteMany({ user_id: userId });
      
      const diversityCollection = db.db.collection('diversity_research');
      await diversityCollection.deleteMany({ userId });
      
      return result.deletedCount > 0;
    } else {
      // PostgreSQL
      await db.query('BEGIN');
      
      // Delete from cache
      await db.query('DELETE FROM cache WHERE key = $1', [key]);
      
      // Delete related data
      await db.query('DELETE FROM matches WHERE user_id = $1 OR matched_user_id = $1', [userId]);
      await db.query('DELETE FROM follow_ups WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM feature_requests WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM manual_connection_requests WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM diversity_research WHERE user_id = $1', [userId]);
      
      await db.query('COMMIT');
      return true;
    }
  } catch (error: any) {
    if (!isMongo) {
      await db.query('ROLLBACK');
    }
    console.error(`Error deleting user ${userId}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🔍 Connecting to database...');
  
  const db = await createDatabaseAdapter();
  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
  
  console.log(`📊 Database type: ${databaseType}`);
  console.log('🔍 Searching for users with "Ayoola" in their name...\n');
  
  const ayoolaUsers = await findAyoolaUsers(db, isMongo);
  
  if (ayoolaUsers.length === 0) {
    console.log('✅ No users found with "Ayoola" in their name.');
    return;
  }
  
  console.log(`⚠️  Found ${ayoolaUsers.length} user(s) with "Ayoola" in their name:\n`);
  console.log('ID'.padEnd(20), 'Name'.padEnd(30), 'Step');
  console.log('-'.repeat(70));
  
  ayoolaUsers.forEach((user) => {
    console.log(
      user.userId.padEnd(20),
      (user.name || 'N/A').padEnd(30),
      user.step || 'N/A'
    );
  });
  
  console.log('\n' + '='.repeat(70));
  console.log(`\n⚠️  WARNING: This will delete ${ayoolaUsers.length} user(s) and all their related data!`);
  console.log('This includes:');
  console.log('  - User profile and onboarding state');
  console.log('  - All matches');
  console.log('  - All follow-ups');
  console.log('  - Feature requests');
  console.log('  - Manual connection requests');
  console.log('  - Diversity research records');
  
  // For safety, require confirmation via command line argument
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] !== '--confirm') {
    console.log('\n💡 To proceed, run with --confirm flag:');
    console.log('   npm run ts-node scripts/delete-ayoola-users.ts --confirm');
    return;
  }
  
  console.log('\n🗑️  Deleting users...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const user of ayoolaUsers) {
    console.log(`Deleting ${user.name || user.userId} (${user.userId})...`);
    const success = await deleteUser(db, isMongo, user.userId);
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
  console.log(`   Successfully deleted: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Total processed: ${ayoolaUsers.length}`);
  
  // Close database connection
  if (db && typeof db.close === 'function') {
    await db.close();
  }
}

main().catch(console.error);

