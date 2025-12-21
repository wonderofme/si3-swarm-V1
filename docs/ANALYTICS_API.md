# Analytics API Documentation

## Overview

The Agent Kaia bot exposes a comprehensive analytics API endpoint that provides real-time metrics for matches, users, engagement, and follow-ups. This endpoint is designed for integration with analytics dashboards.

## Endpoint

```
GET /api/metrics
```

## Authentication (Optional)

The API supports optional API key authentication via the `WEB_API_KEY` environment variable.

**If `WEB_API_KEY` is set and not "disabled":**
- Include the API key in one of these headers:
  - `X-API-Key: <your-api-key>`
  - `Authorization: Bearer <your-api-key>`

**If `WEB_API_KEY` is not set or is "disabled":**
- No authentication required (public endpoint)

## Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `startDate` | ISO 8601 date string | Filter metrics from this date (inclusive) | `2025-12-01` |
| `endDate` | ISO 8601 date string | Filter metrics until this date (inclusive) | `2025-12-31` |

**Note:** Date filtering applies to match metrics. User, engagement, and follow-up metrics are calculated for all time with time-based breakdowns.

## Response Format

The API returns a JSON object with the following structure:

```typescript
{
  matches: {
    total: number;              // Total matches ever created
    pending: number;            // Matches with status "pending"
    connected: number;          // Matches with status "connected"
    notInterested: number;      // Matches with status "not_interested"
    today: number;              // Matches created today
    thisWeek: number;           // Matches created in last 7 days
    thisMonth: number;          // Matches created in last 30 days
    byDate: Array<{             // Daily breakdown (last 30 days)
      date: string;             // ISO date string (YYYY-MM-DD)
      count: number;
    }>;
  };
  users: {
    total: number;              // Total users who completed onboarding (actual users)
    startedOnboarding: number;  // Total users who started onboarding (including incomplete)
    completedOnboarding: number; // Users who completed onboarding (same as total)
    activeLast7Days: number;    // Completed users active in last 7 days
    activeLast30Days: number;  // Completed users active in last 30 days
    onboardingCompletionRate: number; // Percentage (0-100) of started who completed
  };
  engagement: {
    featureRequests: {
      total: number;
      thisWeek: number;
      thisMonth: number;
    };
    manualConnectionRequests: {
      total: number;
      thisWeek: number;
      thisMonth: number;
    };
    diversityResearchInterest: {
      total: number;
      thisWeek: number;
      thisMonth: number;
    };
  };
  followUps: {
    scheduled: number;          // Total pending follow-ups
    sent: number;               // Total sent follow-ups
    pending: number;            // Same as scheduled
    responseRate: number;       // Percentage (0-100)
    byType: {
      "3_day_checkin": {
        scheduled: number;
        sent: number;
        responded: number;
      };
      "7_day_next_match": {
        scheduled: number;
        sent: number;
        responded: number;
      };
    };
  };
  timestamp: string;            // ISO timestamp of when metrics were generated
}
```

## Example Requests

### Basic Request (No Authentication)

```bash
curl https://your-deployment-url/api/metrics
```

### With API Key Authentication

```bash
curl -H "X-API-Key: your-api-key" https://your-deployment-url/api/metrics
```

### With Date Range Filtering

```bash
curl "https://your-deployment-url/api/metrics?startDate=2025-12-01&endDate=2025-12-31"
```

### JavaScript/Fetch Example

```javascript
const response = await fetch('https://your-deployment-url/api/metrics', {
  headers: {
    'X-API-Key': 'your-api-key' // Optional
  }
});

const metrics = await response.json();
console.log('Total matches:', metrics.matches.total);
console.log('Active users (7 days):', metrics.users.activeLast7Days);
```

## CORS Configuration

The API supports CORS for cross-origin requests. Configure allowed origins via the `CORS_ORIGINS` environment variable:

```bash
CORS_ORIGINS=https://dashboard.example.com,https://analytics.example.com
```

Or allow all origins:
```bash
CORS_ORIGINS=*
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```
Returned when API key authentication is required but invalid/missing.

### 400 Bad Request
```json
{
  "error": "Invalid startDate format. Use ISO 8601 (YYYY-MM-DD)"
}
```
Returned when date parameters are malformed.

### 500 Internal Server Error
```json
{
  "error": "Failed to fetch metrics",
  "message": "Error details..."
}
```
Returned when an internal error occurs.

## Database Compatibility

The API works with both:
- **MongoDB** (when `DATABASE_TYPE=mongodb`)
- **PostgreSQL** (when `DATABASE_TYPE=postgres`)

Metrics are calculated identically regardless of database type.

## Rate Limiting

Currently, there is no rate limiting implemented. Consider implementing rate limiting at the reverse proxy/load balancer level if needed.

## Deployment Notes

1. **Environment Variables:**
   - `WEB_API_KEY` - Optional API key for authentication
   - `CORS_ORIGINS` - Comma-separated list of allowed origins (default: `*`)
   - `DATABASE_TYPE` - Database type (`mongodb` or `postgres`)
   - `DATABASE_URL` - Database connection string

2. **Endpoint Availability:**
   - The endpoint is available at `/api/metrics` on the same port as the REST API (default: 3000)
   - Ensure the deployment exposes this port via ingress

3. **Dashboard Integration:**
   - The endpoint is designed for periodic polling (e.g., every 5-15 minutes)
   - Consider caching responses on the dashboard side to reduce load
   - The `timestamp` field indicates when metrics were generated

## Support

For issues or questions, contact the development team or open an issue in the repository.


