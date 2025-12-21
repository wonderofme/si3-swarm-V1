/**
 * Simple test script to verify matching logic
 */

interface UserProfile {
  name: string;
  interests: string[];
  roles: string[];
  connectionGoals: string[];
}

function testRealTimeMatching(newUser: UserProfile, otherUser: UserProfile): {
  isMatch: boolean;
  reason: string;
  commonInterests: string[];
} {
  const newUserInterests = newUser.interests || [];
  const newUserRoles = newUser.roles || [];
  const newUserGoals = newUser.connectionGoals || [];
  
  const otherInterests = otherUser.interests || [];
  const otherRoles = otherUser.roles || [];
  const otherGoals = otherUser.connectionGoals || [];
  
  // Find common interests
  const commonInterests = newUserInterests.filter((i: string) => 
    otherInterests.some((oi: string) => oi.toLowerCase().includes(i.toLowerCase()))
  );
  
  // Find complementary goals
  const complementaryMatch = 
    (newUserGoals.some((g: string) => g.toLowerCase().includes('invest')) && otherRoles.some((r: string) => r.toLowerCase().includes('founder'))) ||
    (otherGoals.some((g: string) => g.toLowerCase().includes('invest')) && newUserRoles.some((r: string) => r.toLowerCase().includes('founder'))) ||
    (newUserGoals.some((g: string) => g.toLowerCase().includes('growth') || g.toLowerCase().includes('marketing')) && otherRoles.some((r: string) => r.toLowerCase().includes('marketing'))) ||
    (otherGoals.some((g: string) => g.toLowerCase().includes('growth') || g.toLowerCase().includes('marketing')) && newUserRoles.some((r: string) => r.toLowerCase().includes('marketing')));
  
  const isMatch = commonInterests.length >= 2 || complementaryMatch;
  const reason = commonInterests.length >= 2 
    ? `Shared interests: ${commonInterests.slice(0, 3).join(', ')}`
    : complementaryMatch ? 'Complementary goals - potential collaboration!' : 'No match';
  
  return { isMatch, reason, commonInterests };
}

// Test cases
const user1 = {
  name: 'Alice',
  interests: ['AI', 'Web3 Growth Marketing', 'DAO\'s'],
  roles: ['Developer', 'Founder/Builder'],
  connectionGoals: ['Growth tools, strategies, and/or support']
};

const user2 = {
  name: 'Bob',
  interests: ['Web3 Growth Marketing', 'Sales, BD & Partnerships'],
  roles: ['Marketing/BD/Partnerships'],
  connectionGoals: ['Startups to invest in']
};

console.log('🧪 Testing Matching Logic\n');
console.log('User 1:', user1.name, '- Interests:', user1.interests.join(', '));
console.log('User 2:', user2.name, '- Interests:', user2.interests.join(', '));

const result = testRealTimeMatching(user1, user2);
console.log('\nResult:');
console.log('  Common Interests:', result.commonInterests.length, '(', result.commonInterests.join(', '), ')');
console.log('  Match Found:', result.isMatch ? '✅ YES' : '❌ NO');
console.log('  Reason:', result.reason);

console.log('\n✅ Test completed!');





