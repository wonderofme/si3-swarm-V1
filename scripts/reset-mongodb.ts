#!/usr/bin/env tsx
/**
 * Reset MongoDB - Deletes all user data collections
 * Usage: npx tsx scripts/reset-mongodb.ts
 */

import { MongoClient } from 'mongodb';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const collectionsToDelete = [
  'cache',
  'matches',
  'follow_ups',
  'user_mappings',
  'feature_requests',
  'manual_connection_requests',
  'diversity_research',
  'knowledge',
  'rooms',
  'accounts',
  'participants'
];

async function resetMongoDB() {
  const client = new MongoClient(DATABASE_URL);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    
    // Get list of existing collections
    const existingCollections = await db.listCollections().toArray();
    const existingNames = existingCollections.map(c => c.name);
    
    console.log('\n🗑️  Deleting collections...\n');
    
    let totalDeleted = 0;
    
    for (const collectionName of collectionsToDelete) {
      if (existingNames.includes(collectionName)) {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        await collection.drop();
        console.log(`  ✓ Deleted ${collectionName} (${count} documents)`);
        totalDeleted += count;
      } else {
        console.log(`  ⊘ ${collectionName} (does not exist)`);
      }
    }
    
    // Also check for any other collections that might exist
    const remainingCollections = existingCollections
      .filter(c => !collectionsToDelete.includes(c.name))
      .map(c => c.name);
    
    if (remainingCollections.length > 0) {
      console.log(`\n⚠️  Other collections found (not deleted): ${remainingCollections.join(', ')}`);
      console.log('   If you want to delete these too, add them to the script.\n');
    }
    
    console.log(`\n✅ Reset complete! Deleted ${totalDeleted} total documents across ${collectionsToDelete.length} collections.`);
    console.log('\n🔄 All testers can now start fresh onboarding.\n');
    
  } catch (error: any) {
    console.error('❌ Error resetting MongoDB:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Confirm before deleting
console.log('⚠️  WARNING: This will delete ALL user data from MongoDB!');
console.log('Collections to be deleted:');
collectionsToDelete.forEach(c => console.log(`  - ${c}`));
console.log('\nPress Ctrl+C to cancel, or wait 3 seconds to continue...\n');

setTimeout(() => {
  resetMongoDB();
}, 3000);


