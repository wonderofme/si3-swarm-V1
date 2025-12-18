// Test script for Metrics API
// Usage: node test-metrics-api.js [api-url] [api-key]

const apiUrl = process.argv[2] || 'http://localhost:3001';
const apiKey = process.argv[3] || 'disabled';

console.log('🧪 Testing Metrics API...\n');
console.log(`URL: ${apiUrl}/api/metrics`);
console.log(`API Key: ${apiKey === 'disabled' ? 'None (public access)' : '***' + apiKey.slice(-4)}\n`);

async function testMetricsAPI() {
  try {
    // Test 1: Basic metrics request
    console.log('📊 Test 1: Fetching all metrics...');
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey && apiKey !== 'disabled') {
      headers['X-API-Key'] = apiKey;
    }
    
    const response = await fetch(`${apiUrl}/api/metrics`, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error: ${response.status} ${response.statusText}`);
      console.error(`Response: ${errorText}`);
      return;
    }
    
    const metrics = await response.json();
    
    console.log('✅ Success! Metrics received:\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📈 MATCH METRICS');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total Matches:        ${metrics.matches.total}`);
    console.log(`Pending:              ${metrics.matches.pending}`);
    console.log(`Connected:            ${metrics.matches.connected}`);
    console.log(`Not Interested:       ${metrics.matches.notInterested}`);
    console.log(`Today:                ${metrics.matches.today}`);
    console.log(`This Week:            ${metrics.matches.thisWeek}`);
    console.log(`This Month:           ${metrics.matches.thisMonth}`);
    console.log(`Daily Breakdown:      ${metrics.matches.byDate.length} days of data`);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('👥 USER METRICS');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total Users:          ${metrics.users.total}`);
    console.log(`Completed Onboarding: ${metrics.users.completedOnboarding}`);
    console.log(`Onboarding Rate:      ${metrics.users.onboardingCompletionRate.toFixed(1)}%`);
    console.log(`Active (7 Days):      ${metrics.users.activeLast7Days}`);
    console.log(`Active (30 Days):     ${metrics.users.activeLast30Days}`);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('💬 ENGAGEMENT METRICS');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Feature Requests:`);
    console.log(`  Total:              ${metrics.engagement.featureRequests.total}`);
    console.log(`  This Week:          ${metrics.engagement.featureRequests.thisWeek}`);
    console.log(`  This Month:         ${metrics.engagement.featureRequests.thisMonth}`);
    console.log(`Diversity Research:`);
    console.log(`  Total:              ${metrics.engagement.diversityResearchInterest.total}`);
    console.log(`  This Week:          ${metrics.engagement.diversityResearchInterest.thisWeek}`);
    console.log(`  This Month:         ${metrics.engagement.diversityResearchInterest.thisMonth}`);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📅 FOLLOW-UP METRICS');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Scheduled:            ${metrics.followUps.scheduled}`);
    console.log(`Sent:                 ${metrics.followUps.sent}`);
    console.log(`Response Rate:        ${metrics.followUps.responseRate.toFixed(1)}%`);
    console.log(`3-Day Check-ins:`);
    console.log(`  Scheduled:          ${metrics.followUps.byType['3_day_checkin'].scheduled}`);
    console.log(`  Sent:               ${metrics.followUps.byType['3_day_checkin'].sent}`);
    console.log(`  Responded:          ${metrics.followUps.byType['3_day_checkin'].responded}`);
    console.log(`7-Day Next Match:`);
    console.log(`  Scheduled:          ${metrics.followUps.byType['7_day_next_match'].scheduled}`);
    console.log(`  Sent:               ${metrics.followUps.byType['7_day_next_match'].sent}`);
    console.log(`  Responded:          ${metrics.followUps.byType['7_day_next_match'].responded}`);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`📅 Report Generated: ${new Date(metrics.timestamp).toLocaleString()}`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Test 2: Date range filtering
    if (metrics.matches.byDate.length > 0) {
      console.log('📊 Test 2: Testing date range filtering...');
      const firstDate = metrics.matches.byDate[0].date;
      const lastDate = metrics.matches.byDate[metrics.matches.byDate.length - 1].date;
      
      const rangeResponse = await fetch(`${apiUrl}/api/metrics?startDate=${firstDate}&endDate=${lastDate}`, {
        method: 'GET',
        headers: headers
      });
      
      if (rangeResponse.ok) {
        const rangeMetrics = await rangeResponse.json();
        console.log(`✅ Date range filter works! Matches in range: ${rangeMetrics.matches.total}`);
      } else {
        console.log(`⚠️  Date range filter test failed: ${rangeResponse.status}`);
      }
    }
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Make sure the API server is running and accessible.');
      console.error('   For local testing: npm run dev (then use http://localhost:3001)');
      console.error('   For production: Check if deployment is updated to v298');
    }
  }
}

testMetricsAPI();

