# Follow-Up Scheduler Implementation

## Overview
The follow-up scheduler automatically sends check-in messages to users after they receive matches:
- **3-day check-in**: "Were you able to connect yet?"
- **7-day next match**: "I've found you another match!"

## Database Setup

Run the migration to create the required tables:

```sql
-- Run this in your Neon PostgreSQL console or via psql
\i database/migrations/001_create_matches_and_followups.sql
```

Or manually execute the SQL from `database/migrations/001_create_matches_and_followups.sql`.

## How It Works

1. **Match Recording**: When a user receives a match, it's automatically recorded in the `matches` table with:
   - User IDs (both users)
   - Room ID (Telegram chat ID for sending messages)
   - Match date and status

2. **Follow-Up Scheduling**: Two follow-ups are automatically scheduled:
   - 3-day check-in (3 days after match)
   - 7-day next match (7 days after match)

3. **Scheduler Service**: The scheduler runs every hour and:
   - Checks for due follow-ups
   - Sends messages via Telegram API
   - Marks follow-ups as sent

4. **Response Handling**: Users can respond with:
   - **Yes** - if they connected
   - **No** - if they haven't connected yet
   - **Not interested** - to skip this match

## Files Created

- `database/migrations/001_create_matches_and_followups.sql` - Database schema
- `src/services/matchTracker.ts` - Database operations for matches and follow-ups
- `src/services/followUpScheduler.ts` - Scheduler service that runs every hour
- `src/plugins/matching/followUpHandler.ts` - Handler for user responses
- Updated `src/plugins/matching/action.ts` - Records matches when created
- Updated `src/index.ts` - Starts the scheduler on boot

## Testing

1. **Create a match**: Ask Kaia to "find me a match"
2. **Check database**: Verify match and follow-ups are created:
   ```sql
   SELECT * FROM matches ORDER BY "matchDate" DESC LIMIT 1;
   SELECT * FROM follow_ups WHERE "matchId" = '<match_id>';
   ```
3. **Wait or adjust dates**: For testing, you can manually adjust `scheduledDate` in the database:
   ```sql
   UPDATE follow_ups SET "scheduledDate" = NOW() - INTERVAL '1 minute' WHERE id = '<followup_id>';
   ```
4. **Check logs**: The scheduler will log when it processes follow-ups

## Notes

- The scheduler runs every hour (configurable in `followUpScheduler.ts`)
- Follow-ups are sent via Telegram API directly (not through ElizaOS runtime)
- The roomId (Telegram chat ID) is stored when matches are created
- If roomId is not available, it falls back to userId (may not work for Telegram)

