# Agent Kaia - Project Architecture

## Overview

Agent Kaia is a **multi-agent Telegram bot** built on the ElizaOS framework that helps users in the SI<3> Web3 community connect through intelligent matchmaking. The system handles user onboarding, profile management, interest-based matching, and automated follow-ups.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User (Telegram)                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Telegram Client Interface                       │
│         (Telegraf-based message handling)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Message Interceptors & Patchers                 │
│  • LLM Response Interceptor                                 │
│  • Telegram Message Interceptor                             │
│  • Restart Handler                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    ElizaOS Runtime                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  AgentRuntime (Kaia)                                 │  │
│  │  • Evaluators → Determine intent                     │  │
│  │  • Providers → Give context to LLM                   │  │
│  │  • Actions → Execute specific behaviors              │  │
│  │  • MessageManager → Handle message flow             │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│   Plugins    │ │   LLM    │ │   Database   │
│              │ │ (OpenAI) │ │ (PostgreSQL) │
│ • Onboarding │ │          │ │              │
│ • Matching   │ │          │ │ • Cache      │
│ • Router     │ │          │ │ • Matches    │
│              │ │          │ │ • Follow-ups │
└──────────────┘ └──────────┘ └──────────────┘
```

---

## Component Layers

### 1. **Client Layer**

#### Telegram Client (`TelegramClientInterface`)
- **Purpose**: Primary user interface for receiving and sending Telegram messages
- **Technology**: Telegraf library
- **Features**:
  - Message reception via polling
  - Message sending via Telegram Bot API
  - Error handling for 409 conflicts (multiple bot instances)
  - Retry logic with exponential backoff

#### Direct Client (`DirectClient`)
- **Purpose**: REST API access for programmatic interactions
- **Port**: 3000 (configurable via `DIRECT_PORT`)
- **Use Case**: External services can interact with the bot via HTTP

---

### 2. **Interceptor Layer**

This layer patches ElizaOS and Telegram methods at runtime to modify behavior:

#### LLM Response Interceptor (`llmResponseInterceptor.ts`)
- **Purpose**: Block or modify LLM-generated responses during onboarding
- **Key Functions**:
  - Tracks action execution timestamps
  - Blocks duplicate LLM responses after action handlers run
  - Maintains synchronous onboarding step cache
  - Prevents LLM generation during active onboarding steps

#### Telegram Message Interceptor (`telegramMessageInterceptor.ts`)
- **Purpose**: Deduplicate messages at the Telegram API level
- **Key Functions**:
  - Detects exact duplicate content
  - Blocks rapid consecutive messages (within 10 seconds)
  - Checks for messages already blocked by LLM interceptor

#### Restart Handler (`telegramRestartHandler.ts`)
- **Purpose**: Handle "restart" commands before normal message processing
- **Key Functions**:
  - Intercepts restart commands ("restart", "start over", etc.)
  - Resets onboarding state immediately
  - Bypasses normal ElizaOS flow for restart commands

---

### 3. **Runtime Layer (ElizaOS)**

#### AgentRuntime
- **Framework**: ElizaOS v0.1
- **Model**: OpenAI GPT-4o-mini
- **Components**:
  - **Evaluators**: Determine what should happen (onboarding step, match request, etc.)
  - **Providers**: Give context to the LLM (instructions, system prompts)
  - **Actions**: Execute specific behaviors (send onboarding question, find match, etc.)
  - **MessageManager**: Manages message creation, storage, and retrieval
  - **CacheManager**: Manages state persistence

#### Multi-Agent System
Three separate `AgentRuntime` instances:

1. **Kaia** (Primary)
   - ID: `d24d3f40-0000-0000-0000-000000000000`
   - Role: Onboarding, matching, user interaction
   - Plugins: router, onboarding, matching
   - Languages: English, Spanish, Portuguese, French

2. **MoonDAO** (Sub-Agent)
   - ID: `d24d3f40-0000-0000-0000-000000000001`
   - Role: Space/Governance expert (stubbed for future use)

3. **SI<3>** (Sub-Agent)
   - ID: `d24d3f40-0000-0000-0000-000000000002`
   - Role: Web3 education expert (stubbed for future use)

---

### 4. **Plugin Layer**

Plugins extend ElizaOS functionality with domain-specific logic:

#### Onboarding Plugin (`plugins/onboarding/`)
- **Purpose**: Manage user onboarding flow (13 steps)
- **Components**:
  - **Actions** (`actions.ts`): Main flow logic, sends questions, processes responses
  - **Evaluator** (`evaluator.ts`): Tracks onboarding progress, sets state flags
  - **Provider** (`provider.ts`): Provides context to LLM during onboarding
  - **Translations** (`translations.ts`): Multi-language message support (4 languages)
  - **Language Action** (`languageAction.ts`): Handles language changes
  - **Utils** (`utils.ts`): State management, cache operations

#### Matching Plugin (`plugins/matching/`)
- **Purpose**: Find and present user matches
- **Components**:
  - **Action** (`action.ts`): Finds matches, presents to user
  - **Evaluator** (`evaluator.ts`): Detects match requests
  - **Utils** (`utils.ts`): Matching algorithm (keyword-based)
  - **History Action** (`historyAction.ts`): Displays match history
  - **History Evaluator** (`historyEvaluator.ts`): Detects history requests
  - **Follow-Up Handler** (`followUpHandler.ts`): Handles follow-up responses

#### Router Plugin (`plugins/router/`)
- **Purpose**: Route messages to appropriate sub-agents (stubbed for future use)
- **Status**: Not actively used, configured for future expansion

---

### 5. **Service Layer**

#### Follow-Up Scheduler (`services/followUpScheduler.ts`)
- **Purpose**: Background service that sends automated follow-up messages
- **Frequency**: Runs every hour
- **Types**:
  - **3-Day Check-In**: Asks if user connected with match
  - **7-Day Next Match**: Offers new match after a week
- **Process**:
  1. Queries `follow_ups` table for pending follow-ups
  2. Sends messages via Telegram Bot API
  3. Marks follow-ups as "sent"

#### Match Tracker (`services/matchTracker.ts`)
- **Purpose**: Database operations for matches and follow-ups
- **Functions**:
  - Create matches
  - Update match status
  - Create follow-up records
  - Query match history

---

### 6. **Data Layer**

#### PostgreSQL Database
- **Adapter**: `PostgresDatabaseAdapter` (ElizaOS)
- **Tables**:
  1. **`cache`**: ElizaOS cache table
     - Stores onboarding state, user profiles
     - Key format: `onboarding_{userId}`, `profile_{userId}`
     - Value: JSONB with state data
  2. **`matches`**: Match records
     - `user_id`, `matched_user_id`, `room_id`
     - `match_date`, `status` (pending/connected/not_interested)
  3. **`follow_ups`**: Scheduled follow-up messages
     - `match_id`, `user_id`, `type`, `scheduled_for`
     - `sent_at`, `status`, `response`

#### Cache Adapter (`adapters/dbCache.ts`)
- **Purpose**: Custom PostgreSQL-backed cache for ElizaOS
- **Features**:
  - Synchronous onboarding step cache (in-memory for fast access)
  - Persistent storage in PostgreSQL
  - Automatic cache updates

---

## Message Processing Flow

### Normal Message Flow

```
1. User sends message via Telegram
   ↓
2. Telegram Client receives message
   ↓
3. Telegram Message Interceptor checks for duplicates
   ↓
4. Message passed to ElizaOS Runtime
   ↓
5. Evaluators run → Determine intent (onboarding step, match request, etc.)
   ↓
6. Provider runs → Gives context to LLM (if not blocked)
   ↓
7. LLM generates response (if not blocked)
   ↓
8. Actions run → Execute specific behaviors (send onboarding question, etc.)
   ↓
9. LLM Response Interceptor blocks duplicate LLM responses
   ↓
10. Message sent via Telegram Client
```

### Onboarding Message Flow (Special Case)

```
1. User responds to onboarding question
   ↓
2. Telegram Message Interceptor checks for duplicates
   ↓
3. Evaluator detects onboarding step
   ↓
4. Provider returns null (blocks LLM generation)
   ↓
5. Action handler processes response
   ↓
6. Action handler sends next question directly via Telegram API
   ↓
7. LLM Response Interceptor blocks any LLM response
   ↓
8. Message sent (only from action handler)
```

**Note**: Despite multiple blocking mechanisms, duplicates can still occur due to ElizaOS's parallel processing of LLM and actions.

---

## Data Flow

### Onboarding State Management

```
User Response
    ↓
Action Handler (actions.ts)
    ↓
Update State (utils.ts)
    ↓
Save to Cache (DbCacheAdapter)
    ↓
Update Synchronous Cache (in-memory)
    ↓
Send Next Question
```

### Matching Flow

```
User: "find match"
    ↓
Evaluator detects match request
    ↓
Action handler (action.ts)
    ↓
Query all profiles from cache
    ↓
Calculate match scores (utils.ts)
    ↓
Select top match
    ↓
Create match record (matchTracker.ts)
    ↓
Create follow-up records (3-day, 7-day)
    ↓
Send match to user
```

### Follow-Up Flow

```
Follow-Up Scheduler (every hour)
    ↓
Query pending follow-ups (scheduled_for <= NOW())
    ↓
Send message via Telegram Bot API
    ↓
Mark as "sent"
    ↓
User responds
    ↓
Follow-Up Handler processes response
    ↓
Update match status or trigger new match
```

---

## Deployment Architecture

### Containerization
- **Base Image**: `node:22-slim`
- **Registry**: GitHub Container Registry (ghcr.io)
- **Image**: `ghcr.io/wonderofme/si3-swarm-v1:latest`
- **Build**: Automated via GitHub Actions on push to `main`

### Akash Network Deployment
- **SDL File**: `deploy.sdl.yaml`
- **Resources**:
  - CPU: 1.0 units
  - Memory: 2Gi
  - Storage: 1Gi
- **Port**: 3000 (exposed as 80)
- **Environment Variables**:
  - `DATABASE_URL`: PostgreSQL connection string
  - `OPENAI_API_KEY`: OpenAI API key
  - `TELEGRAM_BOT_TOKEN`: Telegram bot token
  - `JWT_SECRET`: JWT secret (for future auth)
  - `DIRECT_PORT`: Direct client port (default: 3000)

### CI/CD Pipeline
- **Workflow**: `.github/workflows/docker-publish.yml`
- **Trigger**: Push to `main` branch
- **Process**:
  1. Checkout code
  2. Set up Docker Buildx
  3. Build Docker image
  4. Push to GHCR with tags: `latest` and commit SHA

---

## Key Design Patterns

### 1. **Runtime Patching**
- Patches ElizaOS and Telegraf methods at runtime to modify behavior
- Used for blocking LLM responses, deduplication, and restart handling
- **Files**: `llmResponseInterceptor.ts`, `telegramMessageInterceptor.ts`, `index.ts`

### 2. **Plugin Architecture**
- Modular plugins extend ElizaOS functionality
- Each plugin provides: actions, evaluators, providers
- **Files**: `plugins/onboarding/`, `plugins/matching/`, `plugins/router/`

### 3. **State Management**
- Dual-layer caching: PostgreSQL (persistent) + in-memory (fast)
- Synchronous cache for onboarding step checks
- **Files**: `adapters/dbCache.ts`, `plugins/onboarding/utils.ts`

### 4. **Action-Based Flow Control**
- Actions execute specific behaviors (send message, update state)
- Actions can bypass ElizaOS message flow (direct Telegram API calls)
- **Files**: `plugins/onboarding/actions.ts`, `plugins/matching/action.ts`

### 5. **Background Services**
- Follow-up scheduler runs independently of message processing
- Uses PostgreSQL for scheduling and state
- **Files**: `services/followUpScheduler.ts`

---

## Technology Stack

### Core
- **Framework**: ElizaOS v0.1
- **Runtime**: Node.js 22
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: `@elizaos/adapter-postgres`

### Clients
- **Telegram**: `@elizaos/client-telegram` + Telegraf
- **Direct**: `@elizaos/client-direct`

### LLM
- **Provider**: OpenAI
- **Model**: GPT-4o-mini

### Additional
- **Express**: REST API server
- **pg**: PostgreSQL client
- **uuid**: UUID generation

---

## File Structure

```
src/
├── index.ts                          # Main entry point, runtime initialization
├── adapters/
│   └── dbCache.ts                    # PostgreSQL cache adapter
├── plugins/
│   ├── onboarding/
│   │   ├── actions.ts                # Onboarding flow logic
│   │   ├── evaluator.ts              # Onboarding progress tracking
│   │   ├── provider.ts               # LLM context provider
│   │   ├── translations.ts           # Multi-language messages
│   │   ├── languageAction.ts         # Language change action
│   │   ├── types.ts                  # TypeScript types
│   │   ├── utils.ts                  # State management utilities
│   │   └── index.ts                  # Plugin export
│   ├── matching/
│   │   ├── action.ts                 # Match finding action
│   │   ├── evaluator.ts              # Match request detection
│   │   ├── utils.ts                  # Matching algorithm
│   │   ├── historyAction.ts          # History display action
│   │   ├── historyEvaluator.ts       # History request detection
│   │   ├── followUpHandler.ts        # Follow-up response handling
│   │   └── index.ts                  # Plugin export
│   └── router/
│       └── index.ts                  # Router plugin (stubbed)
└── services/
    ├── followUpScheduler.ts          # Background follow-up scheduler
    ├── matchTracker.ts               # Database operations
    ├── llmResponseInterceptor.ts     # LLM response blocking
    ├── telegramMessageInterceptor.ts # Message deduplication
    └── telegramRestartHandler.ts     # Restart command handling

characters/
├── kaia.character.json               # Kaia agent configuration
├── moondao.character.json            # MoonDAO agent configuration
└── si3.character.json                # SI<3> agent configuration

database/
└── migrations/
    └── 001_create_matches_and_followups.sql

.github/
└── workflows/
    └── docker-publish.yml            # CI/CD pipeline

deploy.sdl.yaml                       # Akash deployment config
Dockerfile                            # Container build instructions
```

---

## Current Limitations

1. **Duplicate Messages**: LLM and action handlers both send messages during onboarding (partially mitigated)
2. **Simple Matching**: Keyword-based matching, not semantic/embedding-based
3. **Router Plugin**: Stubbed, not actively routing to sub-agents
4. **Scalability**: Cache queries scan all profiles (inefficient for large user bases)

---

## Future Enhancements

1. **Semantic Matching**: Use embeddings for better match quality
2. **Event-Based Matching**: Prioritize users attending same events
3. **Multi-Factor Scoring**: Combine interests, roles, goals, location, events
4. **Router Implementation**: Actively route to MoonDAO/SI<3> for specialized queries
5. **Analytics Dashboard**: Track matches, connections, user engagement
6. **Admin Commands**: Manage users, matches, system state
7. **Group Matching**: Match multiple users for group connections

