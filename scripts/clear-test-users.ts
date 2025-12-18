import 'dotenv/config';
import { createDatabaseAdapter } from '../src/adapters/databaseAdapter.js';

/**
 * Script to clear test users from the database
 * 
 * Usage:
 *   npm run ts-node scripts/clear-test-users.ts
 * 
 * This will:
 * 1. List all users
 * 2. Allow you to delete specific users by ID or name pattern
 * 3. Optionally delete all users matching a pattern (e.g., "test", "tester")
 */

interface UserInfo {
  userId: string;
  key: string;
  name?: string;
  step?: string;
  completedAt?: string;
}

async function listAllUsers(db: any, isMongo: boolean): Promise<UserInfo[]> {
  const users: UserInfo[] = [];
  
  if (isMongo) {
    const cacheCollection = db.db.collection('cache');
    const docs = await cacheCollection.find({
      key: { $regex: /^onboarding_/ }
    }).toArray();
    
    for (const doc of docs) {
      const userId = doc.key.replace('onboarding_', '');
      const value = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;
      users.push({
        userId,
        key: doc.key,
        name: value?.profile?.name,
        step: value?.step,
        completedAt: value?.profile?.onboardingCompletedAt
      });
    }
  } else {
    // PostgreSQL
    const result = await db.query(`
      SELECT key, value 
      FROM cache 
      WHERE key LIKE 'onboarding_%'
      ORDER BY updated_at DESC
    `);
    
    for (const row of result.rows) {
      const userId = row.key.replace('onboarding_', '');
      const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      users.push({
        userId,
        key: row.key,
        name: value?.profile?.name,
        step: value?.step,
        completedAt: value?.profile?.onboardingCompletedAt
      });
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
  console.log('📋 Loading all users...\n');
  
  const users = await listAllUsers(db, isMongo);
  
  console.log(`Found ${users.length} users:\n`);
  console.log('ID'.padEnd(20), 'Name'.padEnd(30), 'Step'.padEnd(20), 'Completed');
  console.log('-'.repeat(90));
  
  users.forEach((user, index) => {
    const name = user.name || 'N/A';
    const step = user.step || 'N/A';
    const completed = user.completedAt ? 'Yes' : 'No';
    console.log(
      user.userId.padEnd(20),
      name.substring(0, 28).padEnd(30),
      step.substring(0, 18).padEnd(20),
      completed
    );
  });
  
  console.log('\n' + '='.repeat(90));
  console.log('\nOptions:');
  console.log('1. Delete user by ID (e.g., "delete 1234567890")');
  console.log('2. Delete users by name pattern (e.g., "delete-pattern test")');
  console.log('3. Delete all test users (names containing "test", "tester", "Test")');
  console.log('4. Exit');
  console.log('\nEnter command:');
  
  // For script usage, you can pass arguments
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    const command = args[0].toLowerCase();
    
    if (command === 'delete' && args[1]) {
      const userId = args[1];
      const user = users.find(u => u.userId === userId);
      if (user) {
        console.log(`\n🗑️  Deleting user: ${user.name || userId}...`);
        const success = await deleteUser(db, isMongo, userId);
        if (success) {
          console.log(`✅ Successfully deleted user ${userId}`);
        } else {
          console.log(`❌ Failed to delete user ${userId}`);
        }
      } else {
        console.log(`❌ User ${userId} not found`);
      }
    } else if (command === 'delete-pattern' && args[1]) {
      const pattern = args[1].toLowerCase();
      const matchingUsers = users.filter(u => 
        u.name?.toLowerCase().includes(pattern)
      );
      
      if (matchingUsers.length === 0) {
        console.log(`❌ No users found matching pattern "${pattern}"`);
        return;
      }
      
      console.log(`\n⚠️  Found ${matchingUsers.length} users matching "${pattern}":`);
      matchingUsers.forEach(u => console.log(`  - ${u.name || u.userId} (${u.userId})`));
      console.log('\nDeleting...');
      
      for (const user of matchingUsers) {
        await deleteUser(db, isMongo, user.userId);
        console.log(`✅ Deleted ${user.name || user.userId}`);
      }
    } else if (command === 'delete-test-users') {
      const testPatterns = ['test', 'tester', 'Test', 'Tester'];
      const testUsers = users.filter(u => 
        testPatterns.some(pattern => u.name?.includes(pattern))
      );
      
      if (testUsers.length === 0) {
        console.log('❌ No test users found');
        return;
      }
      
      console.log(`\n⚠️  Found ${testUsers.length} test users:`);
      testUsers.forEach(u => console.log(`  - ${u.name || u.userId} (${u.userId})`));
      console.log('\nDeleting all test users...');
      
      for (const user of testUsers) {
        await deleteUser(db, isMongo, user.userId);
        console.log(`✅ Deleted ${user.name || user.userId}`);
      }
      
      console.log(`\n✅ Deleted ${testUsers.length} test users`);
    } else {
      console.log('❌ Invalid command. Usage:');
      console.log('  npm run ts-node scripts/clear-test-users.ts delete <userId>');
      console.log('  npm run ts-node scripts/clear-test-users.ts delete-pattern <pattern>');
      console.log('  npm run ts-node scripts/clear-test-users.ts delete-test-users');
    }
  } else {
    console.log('\n💡 To use this script, run:');
    console.log('  npm run ts-node scripts/clear-test-users.ts delete <userId>');
    console.log('  npm run ts-node scripts/clear-test-users.ts delete-pattern <pattern>');
    console.log('  npm run ts-node scripts/clear-test-users.ts delete-test-users');
  }
  
  // Close database connection
  if (db && typeof db.close === 'function') {
    await db.close();
  }
}

main().catch(console.error);

