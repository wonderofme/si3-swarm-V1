import nodemailer from 'nodemailer';
import { IAgentRuntime } from '@elizaos/core';
import { getAgentMetrics, AgentMetrics } from './metricsApi.js';

const DAILY_REPORT_EMAIL = 'members@si3.space';

// Create transporter function - reuse from featureRequest
function createTransporter() {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error('SMTP credentials not configured');
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    requireTLS: smtpPort === 587,
  });
}

function formatMetricsAsHTML(metrics: AgentMetrics): string {
  const date = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Calculate growth percentages (comparing this week to last week)
  const weekGrowth = metrics.matches.thisWeek > 0 
    ? ((metrics.matches.thisWeek / Math.max(metrics.matches.thisWeek - metrics.matches.today, 1)) - 1) * 100 
    : 0;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #6366f1;
      border-bottom: 3px solid #6366f1;
      padding-bottom: 10px;
      margin-top: 0;
    }
    h2 {
      color: #4f46e5;
      margin-top: 30px;
      font-size: 1.3em;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .metric-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .metric-card.primary {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    }
    .metric-card.success {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    }
    .metric-card.warning {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    }
    .metric-value {
      font-size: 2.5em;
      font-weight: bold;
      margin: 10px 0;
    }
    .metric-label {
      font-size: 0.9em;
      opacity: 0.9;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .section {
      margin: 25px 0;
      padding: 20px;
      background-color: #f9fafb;
      border-radius: 6px;
      border-left: 4px solid #6366f1;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .stat-row:last-child {
      border-bottom: none;
    }
    .stat-label {
      font-weight: 500;
      color: #6b7280;
    }
    .stat-value {
      font-weight: 600;
      color: #111827;
    }
    .trend {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.85em;
      font-weight: 600;
    }
    .trend.up {
      background-color: #d1fae5;
      color: #065f46;
    }
    .trend.down {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 0.9em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background-color: #f3f4f6;
      font-weight: 600;
      color: #374151;
    }
    .highlight {
      background-color: #fef3c7;
      padding: 2px 6px;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Agent Kaia Daily Report</h1>
    <p style="color: #6b7280; margin-top: -10px;">${date}</p>

    <div class="metric-grid">
      <div class="metric-card primary">
        <div class="metric-label">Total Matches</div>
        <div class="metric-value">${metrics.matches.total}</div>
      </div>
      <div class="metric-card success">
        <div class="metric-label">Today's Matches</div>
        <div class="metric-value">${metrics.matches.today}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Feature Requests</div>
        <div class="metric-value">${metrics.engagement.featureRequests.total}</div>
      </div>
      <div class="metric-card warning">
        <div class="metric-label">Manual Connections</div>
        <div class="metric-value">${metrics.engagement.manualConnectionRequests.total}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Users</div>
        <div class="metric-value">${metrics.users.total}</div>
      </div>
    </div>

    <div class="section">
      <h2>🎯 Match Statistics</h2>
      <div class="stat-row">
        <span class="stat-label">Total Matches</span>
        <span class="stat-value">${metrics.matches.total}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Pending</span>
        <span class="stat-value">${metrics.matches.pending}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Connected</span>
        <span class="stat-value">${metrics.matches.connected}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Not Interested</span>
        <span class="stat-value">${metrics.matches.notInterested}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">This Week</span>
        <span class="stat-value">${metrics.matches.thisWeek} matches</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">This Month</span>
        <span class="stat-value">${metrics.matches.thisMonth} matches</span>
      </div>
    </div>

    <div class="section">
      <h2>👥 User Metrics</h2>
      <div class="stat-row">
        <span class="stat-label">Total Users</span>
        <span class="stat-value">${metrics.users.total}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Completed Onboarding</span>
        <span class="stat-value">${metrics.users.completedOnboarding} <span class="highlight">(${metrics.users.onboardingCompletionRate.toFixed(1)}%)</span></span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Active (Last 7 Days)</span>
        <span class="stat-value">${metrics.users.activeLast7Days}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Active (Last 30 Days)</span>
        <span class="stat-value">${metrics.users.activeLast30Days}</span>
      </div>
    </div>

    <div class="section">
      <h2>💬 Engagement</h2>
      <div class="stat-row">
        <span class="stat-label">Feature Requests (Total)</span>
        <span class="stat-value">${metrics.engagement.featureRequests.total}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Feature Requests (This Week)</span>
        <span class="stat-value">${metrics.engagement.featureRequests.thisWeek}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Manual Connection Requests (Total)</span>
        <span class="stat-value">${metrics.engagement.manualConnectionRequests.total}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Manual Connection Requests (This Week)</span>
        <span class="stat-value">${metrics.engagement.manualConnectionRequests.thisWeek}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Diversity Research Interest (Total)</span>
        <span class="stat-value">${metrics.engagement.diversityResearchInterest.total}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Diversity Research Interest (This Week)</span>
        <span class="stat-value">${metrics.engagement.diversityResearchInterest.thisWeek}</span>
      </div>
    </div>

    <div class="section">
      <h2>📅 Follow-Up Metrics</h2>
      <div class="stat-row">
        <span class="stat-label">Scheduled Follow-ups</span>
        <span class="stat-value">${metrics.followUps.scheduled}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Sent Follow-ups</span>
        <span class="stat-value">${metrics.followUps.sent}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Response Rate</span>
        <span class="stat-value">${metrics.followUps.responseRate.toFixed(1)}%</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Scheduled</th>
            <th>Sent</th>
            <th>Responded</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>3-Day Check-in</td>
            <td>${metrics.followUps.byType['3_day_checkin'].scheduled}</td>
            <td>${metrics.followUps.byType['3_day_checkin'].sent}</td>
            <td>${metrics.followUps.byType['3_day_checkin'].responded}</td>
          </tr>
          <tr>
            <td>7-Day Next Match</td>
            <td>${metrics.followUps.byType['7_day_next_match'].scheduled}</td>
            <td>${metrics.followUps.byType['7_day_next_match'].sent}</td>
            <td>${metrics.followUps.byType['7_day_next_match'].responded}</td>
          </tr>
        </tbody>
      </table>
    </div>

    ${metrics.matches.byDate.length > 0 ? `
    <div class="section">
      <h2>📈 Daily Match Trend (Last 7 Days)</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Matches</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.matches.byDate.slice(-7).map(day => `
            <tr>
              <td>${new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
              <td><strong>${day.count}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div class="footer">
      <p>This report was automatically generated by Agent Kaia.</p>
      <p>Report generated at: ${new Date(metrics.timestamp).toLocaleString()}</p>
    </div>
  </div>
</body>
</html>
  `;
}

function formatMetricsAsText(metrics: AgentMetrics): string {
  const date = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return `
AGENT KAIA DAILY REPORT
${date}

═══════════════════════════════════════════════════════

📊 MATCH STATISTICS
───────────────────────────────────────────────────────
Total Matches:        ${metrics.matches.total}
Pending:              ${metrics.matches.pending}
Connected:            ${metrics.matches.connected}
Not Interested:       ${metrics.matches.notInterested}
Today:                ${metrics.matches.today}
This Week:           ${metrics.matches.thisWeek}
This Month:          ${metrics.matches.thisMonth}

👥 USER METRICS
───────────────────────────────────────────────────────
Total Users:          ${metrics.users.total}
Completed Onboarding: ${metrics.users.completedOnboarding} (${metrics.users.onboardingCompletionRate.toFixed(1)}%)
Active (7 Days):      ${metrics.users.activeLast7Days}
Active (30 Days):     ${metrics.users.activeLast30Days}

💬 ENGAGEMENT
───────────────────────────────────────────────────────
Feature Requests (Total):           ${metrics.engagement.featureRequests.total}
Feature Requests (This Week):       ${metrics.engagement.featureRequests.thisWeek}
Manual Connection Requests (Total): ${metrics.engagement.manualConnectionRequests.total}
Manual Connection Requests (Week):  ${metrics.engagement.manualConnectionRequests.thisWeek}
Diversity Research (Total):         ${metrics.engagement.diversityResearchInterest.total}
Diversity Research (This Week):     ${metrics.engagement.diversityResearchInterest.thisWeek}

📅 FOLLOW-UP METRICS
───────────────────────────────────────────────────────
Scheduled:            ${metrics.followUps.scheduled}
Sent:                 ${metrics.followUps.sent}
Response Rate:        ${metrics.followUps.responseRate.toFixed(1)}%

3-Day Check-in:
  Scheduled: ${metrics.followUps.byType['3_day_checkin'].scheduled}
  Sent:      ${metrics.followUps.byType['3_day_checkin'].sent}
  Responded: ${metrics.followUps.byType['3_day_checkin'].responded}

7-Day Next Match:
  Scheduled: ${metrics.followUps.byType['7_day_next_match'].scheduled}
  Sent:      ${metrics.followUps.byType['7_day_next_match'].sent}
  Responded: ${metrics.followUps.byType['7_day_next_match'].responded}

${metrics.matches.byDate.length > 0 ? `
📈 DAILY TREND (Last 7 Days)
───────────────────────────────────────────────────────
${metrics.matches.byDate.slice(-7).map(day => 
  `${new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${day.count} matches`
).join('\n')}
` : ''}

═══════════════════════════════════════════════════════
Report generated at: ${new Date(metrics.timestamp).toLocaleString()}
This report was automatically generated by Agent Kaia.
  `;
}

export async function sendDailyReport(runtime: IAgentRuntime): Promise<void> {
  try {
    console.log('[Daily Report] 📊 Generating daily metrics report...');
    
    // Get metrics
    const metrics = await getAgentMetrics(runtime);
    
    // Check SMTP configuration
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    
    if (!smtpUser || !smtpPass) {
      console.error('[Daily Report] ❌ SMTP credentials not configured. Skipping daily report.');
      return;
    }
    
    const htmlContent = formatMetricsAsHTML(metrics);
    const textContent = formatMetricsAsText(metrics);
    
    const mailOptions = {
      from: smtpUser,
      to: DAILY_REPORT_EMAIL,
      subject: `Agent Kaia Daily Report - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      text: textContent,
      html: htmlContent,
    };
    
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    
    console.log(`[Daily Report] ✅ Successfully sent daily report to ${DAILY_REPORT_EMAIL}`);
  } catch (error: any) {
    console.error('[Daily Report] ❌ Error sending daily report:', error);
    // Don't throw - we don't want daily report failures to crash the bot
  }
}

// Calculate milliseconds until next 9 AM (or use 8 AM if preferred)
function getMillisecondsUntilNextReport(): number {
  const now = new Date();
  const reportTime = new Date();
  reportTime.setHours(9, 0, 0, 0); // 9 AM
  
  // If it's already past 9 AM today, schedule for tomorrow
  if (now >= reportTime) {
    reportTime.setDate(reportTime.getDate() + 1);
  }
  
  return reportTime.getTime() - now.getTime();
}

export function startDailyReportScheduler(runtime: IAgentRuntime): void {
  console.log('[Daily Report Scheduler] 📅 Starting daily report scheduler...');
  
  // Send first report after calculating delay
  const initialDelay = getMillisecondsUntilNextReport();
  console.log(`[Daily Report Scheduler] First report will be sent in ${Math.round(initialDelay / 1000 / 60)} minutes`);
  
  setTimeout(() => {
    // Send immediately
    sendDailyReport(runtime).catch(err => {
      console.error('[Daily Report Scheduler] Error in initial report:', err);
    });
    
    // Then schedule for every 24 hours
    setInterval(() => {
      sendDailyReport(runtime).catch(err => {
        console.error('[Daily Report Scheduler] Error in scheduled report:', err);
      });
    }, 24 * 60 * 60 * 1000); // 24 hours
  }, initialDelay);
}

