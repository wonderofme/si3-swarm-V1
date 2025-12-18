/**
 * Test script for the new weighted matching engine
 * Tests intent matrix, interest overlap, and event synchronization
 */

// Sample test profiles
const testProfiles = {
  founder: {
    name: 'Alice Founder',
    roles: ['Founder/Builder'],
    interests: ['AI', 'Tokenomics', 'Fundraising'],
    connectionGoals: ['Investors/grant programs'],
    events: ['Token2049 2025', 'Consensus 2025']
  },
  investor: {
    name: 'Bob Investor',
    roles: ['Investor/Grant Program Operator'],
    interests: ['Tokenomics', 'Fundraising', 'DAO\'s'],
    connectionGoals: ['Startups to invest in'],
    events: ['Token2049 2025']
  },
  marketer: {
    name: 'Charlie Marketer',
    roles: ['Marketing/BD/Partnerships'],
    interests: ['Web3 Growth Marketing', 'Sales, BD & Partnerships'],
    connectionGoals: ['Growth tools, strategies, and/or support'],
    events: []
  },
  developer: {
    name: 'Diana Developer',
    roles: ['Developer'],
    interests: ['AI', 'DeepTech'],
    connectionGoals: ['New job opportunities'],
    events: ['Consensus 2025']
  },
  devSeekingGrowth: {
    name: 'Eve Developer',
    roles: ['Developer', 'Founder/Builder'],
    interests: ['AI', 'Web3 Growth Marketing'],
    connectionGoals: ['Growth tools, strategies, and/or support'],
    events: []
  }
};

// Intent Matrix (from matchingEngine.ts)
const INTENT_MATRIX: Record<string, string[]> = {
  'Startups to invest in': ['Founder/Builder'],
  'Investors/grant programs': ['Investor/Grant Program Operator'],
  'Growth tools, strategies, and/or support': ['Marketing/BD/Partnerships', 'Media', 'Community Leader'],
  'Sales/BD tools, strategies and/or support': ['Marketing/BD/Partnerships', 'Community Leader'],
  'Communities and/or DAO\'s to join': ['Community Leader', 'DAO Council Member/Delegate'],
  'New job opportunities': ['Founder/Builder', 'Investor/Grant Program Operator']
};

function calculateIntentScore(
  userAGoals: string[],
  userARoles: string[],
  userBGoals: string[],
  userBRoles: string[]
): number {
  let score = 0;
  
  // 1. Transactional Matching (Goal A -> Role B)
  for (const goal of userAGoals) {
    const targetRoles = INTENT_MATRIX[goal] || [];
    if (targetRoles.some((target: string) => userBRoles.some((r: string) => r.includes(target)))) {
      score += 50;
      break;
    }
  }
  
  // 2. Transactional Matching (Goal B -> Role A)
  for (const goal of userBGoals) {
    const targetRoles = INTENT_MATRIX[goal] || [];
    if (targetRoles.some((target: string) => userARoles.some((r: string) => r.includes(target)))) {
      score += 50;
      break;
    }
  }
  
  // 3. Peer Support Fallback
  if (score < 50) {
    const commonRoles = userARoles.filter((r1: string) => 
      userBRoles.some((r2: string) => r1.toLowerCase() === r2.toLowerCase())
    );
    if (commonRoles.length > 0) {
      return 50;
    }
  }
  
  return Math.min(100, score);
}

function calculateInterestOverlap(interests1: string[], interests2: string[]): {
  similarity: number;
  common: string[];
} {
  if (interests1.length === 0 && interests2.length === 0) {
    return { similarity: 0, common: [] };
  }
  
  const normalized1 = interests1.map(i => i.toLowerCase().trim());
  const normalized2 = interests2.map(i => i.toLowerCase().trim());
  
  const common: string[] = [];
  for (const i1 of normalized1) {
    for (const i2 of normalized2) {
      if (i1 === i2 || i1.includes(i2) || i2.includes(i1)) {
        const commonInterest = i1.length <= i2.length ? interests1[normalized1.indexOf(i1)] : interests2[normalized2.indexOf(i2)];
        if (!common.includes(commonInterest)) {
          common.push(commonInterest);
        }
      }
    }
  }
  
  const union = new Set([...normalized1, ...normalized2]);
  const similarity = union.size > 0 ? common.length / union.size : 0;
  
  return { similarity, common };
}

function checkEventSynchronization(events1: string[], events2: string[]): {
  hasMatch: boolean;
  sharedEvents: string[];
  score: number;
} {
  if (!events1?.length || !events2?.length) {
    return { hasMatch: false, sharedEvents: [], score: 0 };
  }
  
  const shared: string[] = [];
  const currentYear = new Date().getFullYear().toString();
  const nextYear = (new Date().getFullYear() + 1).toString();
  
  for (const e1 of events1) {
    const e1Norm = e1.toLowerCase().trim();
    for (const e2 of events2) {
      const e2Norm = e2.toLowerCase().trim();
      
      if (e1Norm === e2Norm) {
        if (!shared.includes(e1)) {
          shared.push(e1);
        }
        continue;
      }
      
      const hasSameYear = (e1Norm.includes(currentYear) && e2Norm.includes(currentYear)) ||
                          (e1Norm.includes(nextYear) && e2Norm.includes(nextYear)) ||
                          (!e1Norm.match(/\d{4}/) && !e2Norm.match(/\d{4}/));
      
      if (hasSameYear) {
        if (e1Norm.includes(e2Norm) || e2Norm.includes(e1Norm)) {
          if (!shared.includes(e1)) {
            shared.push(e1);
          }
        }
      }
    }
  }
  
  return {
    hasMatch: shared.length > 0,
    sharedEvents: shared,
    score: shared.length > 0 ? 100 : 0
  };
}

function calculateTotalScore(
  intentScore: number,
  interestScore: number,
  eventScore: number,
  intentWeight: number = 0.6,
  interestWeight: number = 0.3,
  eventWeight: number = 0.1
): number {
  let total = (intentScore * intentWeight) + (interestScore * interestWeight) + (eventScore * eventWeight);
  
  // Event override
  if (eventScore > 0) {
    total = Math.max(total, 85);
  }
  
  return Math.round(total);
}

console.log('🧪 Testing New Weighted Matching Engine\n');
console.log('='.repeat(100));

// Test Case 1: Perfect Transactional Match (Founder seeking Investor)
console.log('\n📋 TEST 1: Perfect Transactional Match');
console.log('-'.repeat(100));
const founder = testProfiles.founder;
const investor = testProfiles.investor;

const intent1 = calculateIntentScore(founder.connectionGoals, founder.roles, investor.connectionGoals, investor.roles);
const { similarity: interestSim1, common: common1 } = calculateInterestOverlap(founder.interests, investor.interests);
const interest1 = Math.min(100, interestSim1 * 100 * (common1.length >= 3 ? 1.0 : common1.length >= 1 ? 0.8 : 0));
const { hasMatch: eventMatch1, sharedEvents: events1, score: event1 } = checkEventSynchronization(founder.events, investor.events);
const total1 = calculateTotalScore(intent1, interest1, event1);

console.log(`Founder (${founder.name}):`);
console.log(`  Goals: ${founder.connectionGoals.join(', ')}`);
console.log(`  Roles: ${founder.roles.join(', ')}`);
console.log(`  Interests: ${founder.interests.join(', ')}`);
console.log(`  Events: ${founder.events.join(', ')}`);

console.log(`\nInvestor (${investor.name}):`);
console.log(`  Goals: ${investor.connectionGoals.join(', ')}`);
console.log(`  Roles: ${investor.roles.join(', ')}`);
console.log(`  Interests: ${investor.interests.join(', ')}`);
console.log(`  Events: ${investor.events.join(', ')}`);

console.log(`\n📊 Scores:`);
console.log(`  Intent Score: ${intent1}/100 (${intent1 * 0.6} weighted)`);
console.log(`  Interest Score: ${interest1}/100 (${interest1 * 0.3} weighted)`);
console.log(`  Event Score: ${event1}/100 (${event1 * 0.1} weighted)`);
console.log(`  Common Interests: ${common1.join(', ') || 'none'}`);
console.log(`  Shared Events: ${events1.join(', ') || 'none'}`);
console.log(`\n  🎯 TOTAL SCORE: ${total1}/100 ${total1 >= 75 ? '✅ MATCH!' : '❌ No match'}`);

// Test Case 2: Growth Tools Match
console.log('\n\n📋 TEST 2: Growth Tools Match');
console.log('-'.repeat(100));
const devSeekingGrowth = testProfiles.devSeekingGrowth;
const marketer = testProfiles.marketer;

const intent2 = calculateIntentScore(devSeekingGrowth.connectionGoals, devSeekingGrowth.roles, marketer.connectionGoals, marketer.roles);
const { similarity: interestSim2, common: common2 } = calculateInterestOverlap(devSeekingGrowth.interests, marketer.interests);
const interest2 = Math.min(100, interestSim2 * 100 * (common2.length >= 3 ? 1.0 : common2.length >= 1 ? 0.8 : 0));
const { hasMatch: eventMatch2, sharedEvents: events2, score: event2 } = checkEventSynchronization(devSeekingGrowth.events, marketer.events);
const total2 = calculateTotalScore(intent2, interest2, event2);

console.log(`Developer Seeking Growth (${devSeekingGrowth.name}):`);
console.log(`  Goals: ${devSeekingGrowth.connectionGoals.join(', ')}`);
console.log(`  Roles: ${devSeekingGrowth.roles.join(', ')}`);
console.log(`  Interests: ${devSeekingGrowth.interests.join(', ')}`);

console.log(`\nMarketer (${marketer.name}):`);
console.log(`  Goals: ${marketer.connectionGoals.join(', ')}`);
console.log(`  Roles: ${marketer.roles.join(', ')}`);
console.log(`  Interests: ${marketer.interests.join(', ')}`);

console.log(`\n📊 Scores:`);
console.log(`  Intent Score: ${intent2}/100 (${intent2 * 0.6} weighted)`);
console.log(`  Interest Score: ${interest2}/100 (${interest2 * 0.3} weighted)`);
console.log(`  Event Score: ${event2}/100 (${event2 * 0.1} weighted)`);
console.log(`  Common Interests: ${common2.join(', ') || 'none'}`);
console.log(`\n  🎯 TOTAL SCORE: ${total2}/100 ${total2 >= 75 ? '✅ MATCH!' : '❌ No match'}`);

// Test Case 3: Event Override
console.log('\n\n📋 TEST 3: Event Synchronization Override');
console.log('-'.repeat(100));
const founder2 = testProfiles.founder;
const developer = testProfiles.developer;

const intent3 = calculateIntentScore(founder2.connectionGoals, founder2.roles, developer.connectionGoals, developer.roles);
const { similarity: interestSim3, common: common3 } = calculateInterestOverlap(founder2.interests, developer.interests);
const interest3 = Math.min(100, interestSim3 * 100 * (common3.length >= 3 ? 1.0 : common3.length >= 1 ? 0.8 : 0));
const { hasMatch: eventMatch3, sharedEvents: events3, score: event3 } = checkEventSynchronization(founder2.events, developer.events);
const total3 = calculateTotalScore(intent3, interest3, event3);

console.log(`Founder (${founder2.name}):`);
console.log(`  Goals: ${founder2.connectionGoals.join(', ')}`);
console.log(`  Events: ${founder2.events.join(', ')}`);

console.log(`\nDeveloper (${developer.name}):`);
console.log(`  Goals: ${developer.connectionGoals.join(', ')}`);
console.log(`  Events: ${developer.events.join(', ')}`);

console.log(`\n📊 Scores:`);
console.log(`  Intent Score: ${intent3}/100 (${intent3 * 0.6} weighted)`);
console.log(`  Interest Score: ${interest3}/100 (${interest3 * 0.3} weighted)`);
console.log(`  Event Score: ${event3}/100 (${event3 * 0.1} weighted) - ${eventMatch3 ? 'OVERRIDE ACTIVE' : ''}`);
console.log(`  Common Interests: ${common3.join(', ') || 'none'}`);
console.log(`  Shared Events: ${events3.join(', ') || 'none'}`);
console.log(`\n  🎯 TOTAL SCORE: ${total3}/100 ${total3 >= 75 ? '✅ MATCH!' : '❌ No match'}`);
if (eventMatch3 && total3 >= 85) {
  console.log(`  🎉 Event override triggered! Both attending same event.`);
}

// Test Case 4: Peer Matching
console.log('\n\n📋 TEST 4: Peer Support Match (Same Roles)');
console.log('-'.repeat(100));
const dev1 = { ...testProfiles.developer, connectionGoals: [] };
const dev2 = { ...testProfiles.devSeekingGrowth, connectionGoals: [] };

const intent4 = calculateIntentScore(dev1.connectionGoals, dev1.roles, dev2.connectionGoals, dev2.roles);
const { similarity: interestSim4, common: common4 } = calculateInterestOverlap(dev1.interests, dev2.interests);
const interest4 = Math.min(100, interestSim4 * 100 * (common4.length >= 3 ? 1.0 : common4.length >= 1 ? 0.8 : 0));
const { hasMatch: eventMatch4, sharedEvents: events4, score: event4 } = checkEventSynchronization(dev1.events, dev2.events);
const total4 = calculateTotalScore(intent4, interest4, event4);

console.log(`Developer 1 (${dev1.name}):`);
console.log(`  Roles: ${dev1.roles.join(', ')}`);
console.log(`  Interests: ${dev1.interests.join(', ')}`);

console.log(`\nDeveloper 2 (${dev2.name}):`);
console.log(`  Roles: ${dev2.roles.join(', ')}`);
console.log(`  Interests: ${dev2.interests.join(', ')}`);

console.log(`\n📊 Scores:`);
console.log(`  Intent Score: ${intent4}/100 (${intent4 * 0.6} weighted) - Peer match`);
console.log(`  Interest Score: ${interest4}/100 (${interest4 * 0.3} weighted)`);
console.log(`  Event Score: ${event4}/100 (${event4 * 0.1} weighted)`);
console.log(`  Common Interests: ${common4.join(', ') || 'none'}`);
console.log(`\n  🎯 TOTAL SCORE: ${total4}/100 ${total4 >= 75 ? '✅ MATCH!' : '❌ No match'}`);

console.log('\n' + '='.repeat(100));
console.log('\n✅ Matching Engine Tests Completed!\n');

