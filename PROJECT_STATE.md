# Kaia Bot - Complete Project State Documentation

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Core Features](#core-features)
3. [Onboarding System](#onboarding-system)
4. [Matching System](#matching-system)
5. [Follow-Up System](#follow-up-system)
6. [History & Profile Management](#history--profile-management)
7. [Multilingual Support](#multilingual-support)
8. [Database Schema](#database-schema)
9. [API Endpoints](#api-endpoints)
10. [Deployment & Infrastructure](#deployment--infrastructure)
11. [Character Agents](#character-agents)
12. [Technical Stack](#technical-stack)

---

## Architecture Overview

### Multi-Agent System
- **Primary Agent**: Kaia (Main onboarding, matching, and user interaction)
- **Sub-Agents**: 
  - MoonDAO (Space/Governance expert - stubbed for future use)
  - SI<3> (Web3 education expert - stubbed for future use)
- **Framework**: ElizaOS v0.1
- **Runtime**: Node.js with TypeScript

### Core Components
1. **Agent Runtimes**: Three separate AgentRuntime instances (Kaia, MoonDAO, SI<3>)
2. **Database**: PostgreSQL with PostgresDatabaseAdapter
3. **Cache**: DbCacheAdapter (PostgreSQL-backed persistent cache)
4. **Clients**: 
   - TelegramClientInterface (primary user interface)
   - DirectClient (for API access)
5. **Plugins**: Modular plugin system (Router, Onboarding, Matching)

---

## Core Features

### ✅ Implemented Features

1. **User Onboarding** - Complete multilingual onboarding flow
2. **Profile Management** - Edit profile fields without re-onboarding
3. **Matchmaking** - Interest-based user matching
4. **Follow-Up Automation** - Scheduled check-ins and next match prompts
5. **History Tracking** - Match history and profile viewing
6. **Language Support** - 4 languages (English, Spanish, Portuguese, French)
7. **Persistent Memory** - Database-backed state persistence
8. **REST API** - History endpoint for external access

---

## Onboarding System

### Flow Steps (in order)
1. **NONE** → **ASK_NAME**: Initial greeting with privacy policy
2. **ASK_NAME** → **ASK_LANGUAGE**: Collect preferred name
3. **ASK_LANGUAGE** → **ASK_LOCATION**: Select language (1=EN, 2=ES, 3=PT, 4=FR)
4. **ASK_LOCATION** → **ASK_ROLE**: Location (city and country, optional)
5. **ASK_ROLE** → **ASK_INTERESTS**: Professional roles (1-10, multiple allowed)
6. **ASK_INTERESTS** → **ASK_CONNECTION_GOALS**: Learning interests (1-9, multiple allowed)
7. **ASK_CONNECTION_GOALS** → **ASK_EVENTS**: Connection goals (1-6, multiple allowed)
8. **ASK_EVENTS** → **ASK_SOCIALS**: Events/conferences attending (optional)
9. **ASK_SOCIALS** → **ASK_TELEGRAM_HANDLE**: Social media links (optional)
10. **ASK_TELEGRAM_HANDLE** → **ASK_GENDER**: Telegram handle (e.g., @username)
11. **ASK_GENDER** → **ASK_NOTIFICATIONS**: Gender identity (1-4, optional)
12. **ASK_NOTIFICATIONS** → **CONFIRMATION**: Notification preferences (1-3)
13. **CONFIRMATION** → **COMPLETED**: Profile summary with edit options

### Profile Data Collected
- **name**: User's preferred name
- **language**: Preferred language code (en, es, pt, fr)
- **location**: City and country
- **roles**: Array of professional roles (Founder/Builder, Developer, etc.)
- **interests**: Array of learning interests (Web3 Growth Marketing, AI, etc.)
- **connectionGoals**: Array of connection goals (Investors, Startups, etc.)
- **events**: Array of events/conferences attending
- **socials**: Array of social media links
- **telegramHandle**: Telegram username (without @)
- **gender**: Gender identity (optional)
- **notifications**: Notification preference (Yes/No/Not sure)
- **onboardingCompletedAt**: Timestamp when onboarding completed
- **isConfirmed**: Boolean flag for profile confirmation

### Special Features
- **Restart Onboarding**: Users can restart by saying "restart", "start over", "pretend this is my first message", "begin again"
- **Edit Profile**: After confirmation, users can edit any field by saying "Edit [field name]"
- **State Persistence**: All onboarding state stored in PostgreSQL cache table
- **Memory Logging**: Each step creates a memory record for audit trail

### Files
- `src/plugins/onboarding/actions.ts` - Main onboarding flow logic
- `src/plugins/onboarding/utils.ts` - State management utilities
- `src/plugins/onboarding/types.ts` - TypeScript types and interfaces
- `src/plugins/onboarding/provider.ts` - LLM context provider for exact messages
- `src/plugins/onboarding/evaluator.ts` - Evaluator to track onboarding progress
- `src/plugins/onboarding/languageAction.ts` - Language change action
- `src/plugins/onboarding/translations.ts` - All message translations

---

## Matching System

### Matching Algorithm
**Current Implementation**: Keyword-based matching
- Searches all completed user profiles in cache
- Calculates overlap between user interests and other users' interests/roles
- Scores matches based on number of common interests
- Returns sorted list (highest score first)

### Match Process
1. User requests match (via "find match", "connect", "find someone")
2. System validates user has completed onboarding
3. System finds candidates with overlapping interests
4. Top match is presented to user
5. Match is recorded in `matches` table
6. Follow-ups are automatically scheduled (3-day and 7-day)

### Match Presentation Format
```
I found a match for you! 🚀

Meet [Name] from [Location].
Roles: [Role1, Role2]
Interests: [Interest1, Interest2]
Telegram: @[handle]

Why: Shared interests: [common interests]

I've saved this match. I'll check in with you in 3 days to see if you connected!
```

### Match Statuses
- **pending**: Initial status when match is created
- **connected**: User confirmed they connected (via follow-up response)
- **not_interested**: User indicated not interested

### Files
- `src/plugins/matching/action.ts` - Main match finding action
- `src/plugins/matching/utils.ts` - Matching algorithm
- `src/plugins/matching/evaluator.ts` - Detects match requests
- `src/services/matchTracker.ts` - Database operations for matches

---

## Follow-Up System

### Follow-Up Types

#### 1. 3-Day Check-In
- **Trigger**: 3 days after match is created
- **Message**: "Hola! 👋 It's been 3 days since your match. Were you able to connect yet? (Reply with 'Yes', 'No', or 'Not interested')"
- **User Responses**:
  - **"Yes"**: 
    - Updates match status to "connected"
    - Records response
    - Offers another match
  - **"No"**: 
    - Records response
    - Status remains "pending"
    - Bot says will check back later
  - **"Not interested"**: 
    - Updates match status to "not_interested"
    - Records response
    - Immediately triggers new match search

#### 2. 7-Day Next Match
- **Trigger**: 7 days after match is created
- **Message**: "Hola! It's been a week. I've found you another match! 🚀 Would you like to see it? (Reply 'Yes' or 'No')"
- **User Responses**:
  - **"Yes"**: Triggers `FIND_MATCH` action to find and present new match
  - **"No"**: Records response, user can request match later

### Scheduler
- **Frequency**: Runs every hour
- **Process**: 
  1. Queries `follow_ups` table for pending follow-ups where `scheduled_for <= NOW()`
  2. Processes each due follow-up
  3. Sends message via Telegram Bot API
  4. Marks follow-up as "sent" with timestamp

### Follow-Up Record Structure
- **id**: UUID
- **match_id**: Reference to match
- **user_id**: User receiving follow-up
- **type**: '3_day_checkin' | '7_day_next_match'
- **scheduled_for**: Timestamp when follow-up should be sent
- **sent_at**: Timestamp when actually sent
- **status**: 'pending' | 'sent' | 'cancelled'
- **response**: User's response ('yes', 'no', 'not_interested')

### Files
- `src/services/followUpScheduler.ts` - Background scheduler service
- `src/plugins/matching/followUpHandler.ts` - Handles user responses to follow-ups
- `src/services/matchTracker.ts` - Database operations for follow-ups

---

## History & Profile Management

### History Command
**Trigger**: "what is my history", "my matches", "my profile", "show history"

**Displays**:
1. **Match History**: 
   - List of all matches (up to 10 shown)
   - Match date
   - Status with emoji (✅ connected, ❌ not_interested, ⏳ pending)
2. **Profile Summary**:
   - Name
   - Roles
   - Interests
3. **Onboarding Status**: Completed ✅ or In Progress ⏳

### Profile Editing
After onboarding completion, users can edit any field:
- "Edit name" → Re-asks name question
- "Edit location" → Re-asks location question
- "Edit professional roles" → Re-asks roles question
- "Edit learning Goals" → Re-asks interests question
- "Edit connection Goals" → Re-asks goals question
- "Edit conferences attending" → Re-asks events question
- "Edit personal links" → Re-asks socials question
- "Edit telegram handle" → Re-asks Telegram handle question
- "Edit gender info" → Re-asks gender question
- "Edit notifications for collabs" → Re-asks notifications question

After editing, returns to confirmation screen with updated summary.

### Files
- `src/plugins/matching/historyAction.ts` - History display action
- `src/plugins/matching/historyEvaluator.ts` - Detects history requests

---

## Multilingual Support

### Supported Languages
1. **English (en)** - Default
2. **Spanish (es)**
3. **Portuguese (pt)**
4. **French (fr)**

### Language Selection
- Asked during onboarding (step 2, after name)
- User selects by number: 1=English, 2=Spanish, 3=Portuguese, 4=French
- All subsequent onboarding messages use selected language
- Language preference saved to profile

### Language Change
**Post-Onboarding**: Users can change language anytime
- **Trigger**: "change language to [language]", "switch to [language]", "set language to [language]"
- **Action**: `CHANGE_LANGUAGE`
- Updates profile language
- Confirms in new language
- All future messages use new language

### Translation Coverage
All onboarding messages translated:
- Initial greeting
- Language selection
- Location question
- Roles question
- Interests question
- Connection goals question
- Events question
- Socials question
- Telegram handle question
- Gender question
- Notifications question
- Completion message
- Summary labels
- Edit options
- Confirm button

### Files
- `src/plugins/onboarding/translations.ts` - All translations and language utilities
- `src/plugins/onboarding/languageAction.ts` - Language change action

---

## Database Schema

### Tables

#### 1. `cache` (ElizaOS standard + custom)
- **key**: VARCHAR(255) - Cache key (e.g., "onboarding_{userId}")
- **agent_id**: UUID - Agent identifier
- **value**: JSONB - Cached data (onboarding state, profiles)
- **created_at**: TIMESTAMPTZ
- **updated_at**: TIMESTAMPTZ
- **Primary Key**: (key, agent_id)

#### 2. `matches`
- **id**: UUID (Primary Key)
- **user_id**: UUID - User who received the match
- **matched_user_id**: UUID - User they were matched with
- **room_id**: UUID - Telegram chat/room ID
- **match_date**: TIMESTAMPTZ - When match was created
- **status**: TEXT - 'pending', 'connected', 'not_interested'
- **Index**: `idx_matches_user_id` on `user_id`

#### 3. `follow_ups`
- **id**: UUID (Primary Key)
- **match_id**: UUID - Reference to match (Foreign Key)
- **user_id**: UUID - User receiving follow-up
- **type**: TEXT - '3_day_checkin' | '7_day_next_match'
- **scheduled_for**: TIMESTAMPTZ - When to send
- **sent_at**: TIMESTAMPTZ - When actually sent (nullable)
- **status**: TEXT - 'pending' | 'sent' | 'cancelled'
- **response**: TEXT - User's response (nullable)
- **Index**: `idx_follow_ups_scheduled_for` on `scheduled_for` WHERE status = 'pending'

### Migration System
- Automatic migrations on Kaia runtime initialization
- Handles existing tables gracefully
- Adds missing columns if tables exist but are incomplete
- Creates indexes safely (IF NOT EXISTS)

### Files
- `database/migrations/001_create_matches_and_followups.sql` - Manual migration script
- `src/index.ts` - `runMigrations()` function for automatic migrations
- `src/adapters/dbCache.ts` - Cache table initialization

---

## API Endpoints

### REST API (Express.js)

#### GET `/api/history/:userId`
**Purpose**: Retrieve user's complete history and profile

**Response**:
```json
{
  "userId": "uuid",
  "profile": {
    "name": "string",
    "location": "string",
    "roles": ["string"],
    "interests": ["string"],
    "events": ["string"],
    "telegramHandle": "string"
  },
  "matches": [
    {
      "id": "uuid",
      "matchedUserId": "uuid",
      "matchedUserName": "string",
      "matchedUserTelegram": "string",
      "matchDate": "ISO8601",
      "status": "pending|connected|not_interested"
    }
  ],
  "onboardingStatus": "COMPLETED|NONE|...",
  "onboardingCompletionDate": "ISO8601|null",
  "totalMatches": 0
}
```

**Port**: `DIRECT_PORT + 1` (default: 3001)

**Files**: `src/index.ts` (lines 142-205)

---

## Deployment & Infrastructure

### Docker
- **Base Image**: `node:22-slim` (Debian-based)
- **Registry**: GitHub Container Registry (ghcr.io)
- **Image**: `ghcr.io/wonderofme/si3-swarm-v1:v0.2.0`
- **Build**: GitHub Actions workflow

### Akash Network Deployment
- **SDL File**: `deploy.sdl.yaml`
- **Resources**:
  - CPU: 1.0 units
  - Memory: 2Gi
  - Storage: 1Gi
- **Port**: 3000 (exposed as 80)
- **Environment Variables**:
  - `DATABASE_URL`
  - `OPENAI_API_KEY`
  - `TELEGRAM_BOT_TOKEN`
  - `JWT_SECRET`
  - `DIRECT_PORT=3000`

### CI/CD
- **Workflow**: `.github/workflows/docker-publish.yml`
- **Trigger**: Push to `main` branch
- **Process**: Builds Docker image and pushes to GHCR

### Files
- `Dockerfile` - Container build instructions
- `deploy.sdl.yaml` - Akash deployment configuration
- `.github/workflows/docker-publish.yml` - CI/CD pipeline

---

## Character Agents

### 1. Kaia (Primary Agent)
- **ID**: `d24d3f40-0000-0000-0000-000000000000`
- **Model**: `gpt-4o-mini` (OpenAI)
- **Role**: Onboarding, matchmaking, user interaction
- **Plugins**: router, onboarding, matching
- **Languages**: English, Spanish, Portuguese, French
- **Personality**: Friendly, helpful, inclusive
- **Capabilities**:
  - Complete onboarding flow
  - User matching
  - Follow-up handling
  - History display
  - Language switching
  - Profile editing
  - General Web3 questions

### 2. MoonDAO (Sub-Agent)
- **ID**: `d24d3f40-0000-0000-0000-000000000001`
- **Role**: Space/Governance expert (stubbed for future use)
- **Personality**: Professional, scientific, precise
- **Status**: Configured but not actively used in routing

### 3. SI<3> (Sub-Agent)
- **ID**: `d24d3f40-0000-0000-0000-000000000002`
- **Role**: Web3 education expert (stubbed for future use)
- **Personality**: Empowering, educational, accessible
- **Status**: Configured but not actively used in routing

### Files
- `characters/kaia.character.json`
- `characters/moondao.character.json`
- `characters/si3.character.json`

---

## Technical Stack

### Core Dependencies
- **Framework**: ElizaOS (@elizaos/core)
- **Runtime**: Node.js 22
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM/Adapter**: @elizaos/adapter-postgres
- **Cache**: Custom DbCacheAdapter (PostgreSQL-backed)

### Clients
- **Telegram**: @elizaos/client-telegram
- **Direct**: @elizaos/client-direct

### Additional Libraries
- **Express**: REST API server
- **Telegraf**: Telegram Bot API (for follow-up messages)
- **pg**: PostgreSQL client
- **uuid**: UUID generation

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key for LLM
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `JWT_SECRET` - JWT secret (for future auth)
- `DIRECT_PORT` - Direct client port (default: 3000)
- `USE_OPENAI_EMBEDDING` - Use OpenAI embeddings (default: true)

---

## Current Limitations & Future Improvements

### Known Limitations
1. **Matching Algorithm**: Simple keyword matching (not semantic/embedding-based)
2. **Router Plugin**: Stubbed (MoonDAO/SI<3> routing not implemented)
3. **Event Matching**: Events collected but not used in matching algorithm
4. **Match Quality**: No feedback loop to improve match quality
5. **Scalability**: Cache queries scan all profiles (inefficient for large user base)

### Potential Enhancements
1. Semantic matching using embeddings
2. Event-based matching (same events = higher priority)
3. Multi-factor scoring (interests + roles + goals + location + events)
4. Match feedback system (rate matches to improve algorithm)
5. Router plugin implementation (route to MoonDAO/SI<3> for specialized queries)
6. Analytics dashboard
7. Admin commands
8. Group matching
9. Proactive recommendations

---

## File Structure

```
src/
├── index.ts                    # Main entry point, runtime initialization
├── adapters/
│   └── dbCache.ts             # PostgreSQL cache adapter
├── plugins/
│   ├── onboarding/
│   │   ├── actions.ts         # Onboarding flow logic
│   │   ├── evaluator.ts       # Onboarding progress tracking
│   │   ├── index.ts           # Plugin export
│   │   ├── languageAction.ts  # Language change action
│   │   ├── provider.ts        # LLM context provider
│   │   ├── translations.ts   # All translations (4 languages)
│   │   ├── types.ts           # TypeScript types
│   │   └── utils.ts           # State management utilities
│   ├── matching/
│   │   ├── action.ts          # Match finding action
│   │   ├── evaluator.ts       # Match request detection
│   │   ├── followUpHandler.ts # Follow-up response handling
│   │   ├── historyAction.ts   # History display action
│   │   ├── historyEvaluator.ts # History request detection
│   │   ├── index.ts           # Plugin export
│   │   └── utils.ts           # Matching algorithm
│   └── router/
│       └── index.ts           # Router plugin (stubbed)
└── services/
    ├── followUpScheduler.ts   # Background follow-up scheduler
    └── matchTracker.ts        # Database operations for matches/follow-ups

characters/
├── kaia.character.json        # Kaia agent configuration
├── moondao.character.json     # MoonDAO agent configuration
└── si3.character.json         # SI<3> agent configuration

database/
└── migrations/
    └── 001_create_matches_and_followups.sql

.github/
└── workflows/
    └── docker-publish.yml     # CI/CD pipeline

deploy.sdl.yaml                # Akash deployment config
Dockerfile                     # Container build instructions
```

---

## Summary

**Kaia** is a fully functional multi-agent Telegram bot built on ElizaOS that:
- ✅ Onboards users in 4 languages with comprehensive profile collection
- ✅ Matches users based on interests using keyword matching
- ✅ Automatically follows up on matches (3-day check-in, 7-day next match)
- ✅ Tracks match history and allows profile editing
- ✅ Persists all state in PostgreSQL
- ✅ Provides REST API for history access
- ✅ Deploys to Akash Network via Docker

The system is production-ready for small to medium user bases, with clear paths for scaling and enhancement.

