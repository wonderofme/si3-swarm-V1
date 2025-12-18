// No database needed for this test - just logic testing

/**
 * Test script to verify matching logic with sample data
 * 
 * Usage:
 *   npm run ts-node scripts/test-matching-logic.ts
 */

interface UserProfile {
  name: string;
  interests: string[];
  roles: string[];
  connectionGoals: string[];
  notifications?: string;
}

interface MatchCandidate {
  id: string;
  profile: UserProfile;
  score: number;
  reason: string;
  commonInterests: string[];
  complementaryMatch: boolean;
}

// Sample user profiles for testing
const testUsers: Record<string, UserProfile> = {
  user1: {
    name: 'Alice Developer',
    interests: ['AI', 'Web3 Growth Marketing', 'DAO\'s'],
    roles: ['Developer', 'Founder/Builder'],
    connectionGoals: ['Growth tools, strategies, and/or support'],
    notifications: 'Yes'
  },
  user2: {
    name: 'Bob Marketer',
    interests: ['Web3 Growth Marketing', 'Sales, BD & Partnerships'],
    roles: ['Marketing/BD/Partnerships'],
    connectionGoals: ['Startups to invest in'],
    notifications: 'Yes'
  },
  user3: {
    name: 'Charlie Investor',
    interests: ['Tokenomics', 'Fundraising'],
    roles: ['Investor/Grant Program Operator'],
    connectionGoals: ['Startups to invest in'],
    notifications: 'Yes'
  },
  user4: {
    name: 'Diana Founder',
    interests: ['AI', 'DeepTech'],
    roles: ['Founder/Builder'],
    connectionGoals: ['Investors/grant programs'],
    notifications: 'Yes'
  },
  user5: {
    name: 'Eve Minimal',
    interests: ['AI'],
    roles: ['Developer'],
    connectionGoals: [],
    notifications: 'Yes'
  },
  user6: {
    name: 'Frank No Notifications',
    interests: ['AI', 'Web3 Growth Marketing'],
    roles: ['Developer'],
    connectionGoals: ['Growth tools, strategies, and/or support'],
    notifications: 'No'
  }
};

// Real-time matching logic (from checkForNewMatches)
function testRealTimeMatching(newUser: UserProfile, otherUser: UserProfile): {
  isMatch: boolean;
  reason: string;
  commonInterests: string[];
  complementaryMatch: boolean;
} {
  const newUserInterests = newUser.interests || [];
  const newUserRoles = newUser.roles || [];
  const newUserGoals = newUser.connectionGoals || [];
  
  const otherInterests = otherUser.interests || [];
  const otherRoles = otherUser.roles || [];
  const otherGoals = otherUser.connectionGoals || [];
  
  // Find common interests (same logic as code)
  const commonInterests = newUserInterests.filter((i: string) => 
    otherInterests.some((oi: string) => oi.toLowerCase().includes(i.toLowerCase()))
  );
  
  // Find complementary goals (same logic as code)
  const complementaryMatch = 
    (newUserGoals.some((g: string) => g.toLowerCase().includes('invest')) && otherRoles.some((r: string) => r.toLowerCase().includes('founder'))) ||
    (otherGoals.some((g: string) => g.toLowerCase().includes('invest')) && newUserRoles.some((r: string) => r.toLowerCase().includes('founder'))) ||
    (newUserGoals.some((g: string) => g.toLowerCase().includes('growth') || g.toLowerCase().includes('marketing')) && otherRoles.some((r: string) => r.toLowerCase().includes('marketing'))) ||
    (otherGoals.some((g: string) => g.toLowerCase().includes('growth') || g.toLowerCase().includes('marketing')) && newUserRoles.some((r: string) => r.toLowerCase().includes('marketing')));
  
  const isMatch = commonInterests.length >= 2 || complementaryMatch;
  const reason = commonInterests.length >= 2 
    ? `Shared interests: ${commonInterests.slice(0, 3).join(', ')}`
    : complementaryMatch ? 'Complementary goals - potential collaboration!' : 'No match';
  
  return { isMatch, reason, commonInterests, complementaryMatch };
}

// Manual matching logic (from "find me a match" handler)
function testManualMatching(myUser: UserProfile, otherUser: UserProfile): {
  isMatch: boolean;
  score: number;
  reason: string;
  common: string[];
} {
  const myInterests = myUser.interests || [];
  const myRoles = myUser.roles || [];
  
  const otherInterests = otherUser.interests || [];
  const otherRoles = otherUser.roles || [];
  
  // Same logic as code: interests match OR interests match roles
  const common = myInterests.filter((i: string) => 
    otherInterests.some((oi: string) => oi.toLowerCase().includes(i.toLowerCase())) ||
    otherRoles.some((or: string) => or.toLowerCase().includes(i.toLowerCase()))
  );
  
  const isMatch = common.length > 0;
  const score = common.length;
  const reason = `Shared interests: ${common.join(', ')}`;
  
  return { isMatch, score, reason, common };
}

function printSeparator() {
  console.log('='.repeat(100));
}

function main() {
  console.log('🧪 Testing Matching Logic\n');
  
  // Test 1: Real-time matching scenarios
  console.log('📋 TEST 1: Real-Time Matching (requires 2+ common interests OR complementary match)');
  printSeparator();
  
  const testCases = [
    { newUser: 'user1', existingUser: 'user2', description: 'Alice (AI, Web3, DAOs) vs Bob (Web3, Sales)' },
    { newUser: 'user1', existingUser: 'user4', description: 'Alice (AI, Web3, DAOs) vs Diana (AI, DeepTech, Founder)' },
    { newUser: 'user3', existingUser: 'user4', description: 'Charlie (Investor) vs Diana (Founder seeking investors)' },
    { newUser: 'user2', existingUser: 'user1', description: 'Bob (Marketer) vs Alice (Developer seeking growth)' },
    { newUser: 'user5', existingUser: 'user1', description: 'Eve (only AI) vs Alice (AI, Web3, DAOs)' },
    { newUser: 'user1', existingUser: 'user6', description: 'Alice vs Frank (no notifications)' },
  ];
  
  for (const testCase of testCases) {
    const newUser = testUsers[testCase.newUser];
    const existingUser = testUsers[testCase.existingUser];
    
    console.log(`\n${testCase.description}`);
    console.log(`  New User: ${newUser.name}`);
    console.log(`    Interests: ${newUser.interests.join(', ')}`);
    console.log(`    Roles: ${newUser.roles.join(', ')}`);
    console.log(`    Goals: ${newUser.connectionGoals.join(', ')}`);
    console.log(`  Existing User: ${existingUser.name}`);
    console.log(`    Interests: ${existingUser.interests.join(', ')}`);
    console.log(`    Roles: ${existingUser.roles.join(', ')}`);
    console.log(`    Goals: ${existingUser.connectionGoals.join(', ')}`);
    console.log(`    Notifications: ${existingUser.notifications || 'Not set'}`);
    
    const result = testRealTimeMatching(newUser, existingUser);
    
    console.log(`\n  Result:`);
    console.log(`    Common Interests: ${result.commonInterests.length} (${result.commonInterests.join(', ') || 'none'})`);
    console.log(`    Complementary Match: ${result.complementaryMatch ? 'Yes' : 'No'}`);
    console.log(`    Match Found: ${result.isMatch ? '✅ YES' : '❌ NO'}`);
    console.log(`    Reason: ${result.reason}`);
    console.log(`    Would Notify: ${result.isMatch && existingUser.notifications === 'Yes' ? '✅ YES' : '❌ NO'}`);
  }
  
  // Test 2: Manual matching scenarios
  console.log('\n\n📋 TEST 2: Manual Matching (requires 1+ common interest, scores by count)');
  printSeparator();
  
  const manualTestCases = [
    { user: 'user1', description: 'Alice looking for matches' },
    { user: 'user2', description: 'Bob looking for matches' },
    { user: 'user5', description: 'Eve (minimal interests) looking for matches' },
  ];
  
  for (const testCase of manualTestCases) {
    const myUser = testUsers[testCase.user];
    console.log(`\n${testCase.description}`);
    console.log(`  User: ${myUser.name}`);
    console.log(`    Interests: ${myUser.interests.join(', ')}`);
    console.log(`    Roles: ${myUser.roles.join(', ')}`);
    
    const candidates: MatchCandidate[] = [];
    
    for (const [userId, otherUser] of Object.entries(testUsers)) {
      if (userId === testCase.user) continue; // Skip self
      
      const result = testManualMatching(myUser, otherUser);
      
      if (result.isMatch) {
        candidates.push({
          id: userId,
          profile: otherUser,
          score: result.score,
          reason: result.reason,
          commonInterests: result.common,
          complementaryMatch: false
        });
      }
    }
    
    // Sort by score (highest first)
    candidates.sort((a, b) => b.score - a.score);
    
    console.log(`\n  Found ${candidates.length} candidate(s):`);
    if (candidates.length === 0) {
      console.log(`    ❌ No matches found`);
    } else {
      for (const candidate of candidates) {
        console.log(`\n    ✅ ${candidate.profile.name} (Score: ${candidate.score})`);
        console.log(`       Common: ${candidate.commonInterests.join(', ')}`);
        console.log(`       Reason: ${candidate.reason}`);
      }
      console.log(`\n    🏆 Top Match: ${candidates[0].profile.name} (Score: ${candidates[0].score})`);
    }
  }
  
  // Test 3: Edge cases
  console.log('\n\n📋 TEST 3: Edge Cases');
  printSeparator();
  
  const edgeCases = [
    {
      name: 'Case-insensitive matching',
      user1: { interests: ['AI'], roles: [], connectionGoals: [] },
      user2: { interests: ['ai'], roles: [], connectionGoals: [] },
      expected: 'Should match (case-insensitive)'
    },
    {
      name: 'Substring matching',
      user1: { interests: ['AI'], roles: [], connectionGoals: [] },
      user2: { interests: ['AI and Machine Learning'], roles: [], connectionGoals: [] },
      expected: 'Should match (substring)'
    },
    {
      name: 'Reverse substring (might fail)',
      user1: { interests: ['AI and Machine Learning'], roles: [], connectionGoals: [] },
      user2: { interests: ['AI'], roles: [], connectionGoals: [] },
      expected: 'Might NOT match (substring only works one way)'
    },
    {
      name: 'Interest matches role',
      user1: { interests: ['Marketing'], roles: [], connectionGoals: [] },
      user2: { interests: [], roles: ['Marketing/BD/Partnerships'], connectionGoals: [] },
      expected: 'Should match in manual matching (interest matches role)'
    },
  ];
  
  for (const edgeCase of edgeCases) {
    console.log(`\n${edgeCase.name}:`);
    console.log(`  User 1: Interests: ${edgeCase.user1.interests.join(', ')}, Roles: ${edgeCase.user1.roles.join(', ')}`);
    console.log(`  User 2: Interests: ${edgeCase.user2.interests.join(', ')}, Roles: ${edgeCase.user2.roles.join(', ')}`);
    console.log(`  Expected: ${edgeCase.expected}`);
    
    const realTime = testRealTimeMatching(edgeCase.user1 as UserProfile, edgeCase.user2 as UserProfile);
    const manual = testManualMatching(edgeCase.user1 as UserProfile, edgeCase.user2 as UserProfile);
    
    console.log(`  Real-time: ${realTime.isMatch ? '✅' : '❌'} (${realTime.commonInterests.length} common)`);
    console.log(`  Manual: ${manual.isMatch ? '✅' : '❌'} (Score: ${manual.score})`);
  }
  
  // Summary
  console.log('\n\n📊 SUMMARY');
  printSeparator();
  console.log('\nIssues Found:');
  console.log('1. Real-time matching requires 2+ interests, manual requires 1+ (inconsistent)');
  console.log('2. Substring matching only works one way (e.g., "AI" matches "AI and ML" but not reverse)');
  console.log('3. Real-time matching only notifies existing users, not the new user');
  console.log('4. Complementary matching is very narrow (only 4 specific cases)');
  console.log('5. Manual matching checks if interests match roles, real-time does not');
  
  console.log('\n✅ Test completed!\n');
}

try {
  main();
} catch (error: any) {
  console.error('Error:', error);
  process.exit(1);
}

