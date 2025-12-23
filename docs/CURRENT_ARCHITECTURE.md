# Current Technical Architecture

## System Overview
Agent Kaia is an AI-powered matchmaking bot built on the ElizaOS multi-agent framework, serving the SI<3> Web3 community through Telegram and web interfaces. The system enables intelligent user matching, multilingual onboarding, and automated follow-ups.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interfaces                           │
│  ┌──────────────┐              ┌──────────────┐            │
│  │   Telegram   │              │  Web Chat    │            │
│  │   Bot API    │              │  REST API    │            │
│  └──────┬───────┘              └──────┬───────┘            │
└─────────┼──────────────────────────────┼───────────────────┘
           │                              │
           ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Agent Kaia (ElizaOS Runtime)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  OpenAI API (GPT-4o-mini)                           │   │
│  │  - LLM Processing                                    │   │
│  │  - Natural Language Understanding                   │   │
│  │  - Response Generation                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Plugin System                                       │   │
│  │  - Onboarding Plugin (15-step flow)                │   │
│  │  - Matching Plugin (compatibility algorithm)       │   │
│  │  - Feature Request Plugin                           │   │
│  │  - Knowledge Plugin (SI<3> knowledge base)         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────┬──────────────────────────────────┬──────────────────┘
           │                                │
           ▼                                ▼
┌──────────────────────┐      ┌──────────────────────────────┐
│   MongoDB Database   │      │      Services Layer           │
│                      │      │                               │
│ • User Profiles      │      │ • Matching Engine             │
│ • Onboarding State   │      │ • Match Tracker               │
│ • Matches            │      │ • Follow-up Scheduler         │
│ • Follow-ups         │      │ • Web Chat API                │
│ • Feature Requests   │      │ • Metrics API                 │
│ • Manual Requests    │      │ • Email Service (SMTP)        │
│ • User Mappings      │      │ • Daily Report Scheduler     │
│ • Knowledge Base     │      │                               │
└──────────────────────┘      └──────────────────────────────┘
```

## Technology Stack

### Runtime & Language
- **Node.js 22**
- **TypeScript 5.6.3** (ES2022, strict mode, ES modules)

### Core Framework
- **ElizaOS** - Multi-agent framework providing runtime, plugins, and agent management
- **Express 4.21** - REST API server for web integration

### Database
- **MongoDB 6.3.0** (primary) - Document database for flexible schema
- **PostgreSQL 8.13.0** (supported) - Relational database option
- **Database Adapter Pattern** - Unified interface supporting both databases

### AI/ML
- **OpenAI API** - GPT-4o-mini for LLM processing
- **OpenAI Embeddings** - text-embedding-3-small for semantic search

### Integrations
- **Telegram Bot API** (Telegraf) - Bot framework for Telegram integration
- **Nodemailer** - SMTP email service for notifications
- **JWT** - Authentication for web API

### Infrastructure
- **Docker** - Multi-stage builds for containerization
- **Akash Network** - Decentralized cloud deployment
- **GitHub Actions** - CI/CD pipeline

## Component Architecture

### 1. ElizaOS Runtime
**Purpose**: Core agent runtime managing state, plugins, and AI interactions

**Key Features**:
- Multi-agent support (Kaia, MoonDAO, SI<3>)
- Plugin-based architecture
- Database-backed cache for persistence
- Character-based configuration

**Implementation**:
```typescript
const runtime = new AgentRuntime({
  character: kaiaCharacter,
  token: OPENAI_API_KEY,
  modelProvider: ModelProviderName.OPENAI,
  databaseAdapter: db,
  cacheManager: cacheManager,
  plugins: [onboarding, matching, featureRequest, knowledge]
});
```

### 2. Onboarding Plugin
**Purpose**: 15-step multilingual onboarding flow collecting user profiles

**Flow**:
1. Language selection (EN/ES/PT/FR)
2. Name collection
3. Email collection (with cross-platform linking)
4. Profile choice (if email exists)
5. Location, Role, Interests, Connection Goals
6. Events, Socials, Telegram Handle
7. Gender, Notifications
8. Confirmation & Completion

**Data Storage**: MongoDB `cache` collection with key `onboarding_{userId}`

### 3. Matching Plugin
**Purpose**: Intelligent user matching based on compatibility scoring

**Algorithm**:
- **Intent Matching** (40%): Connection goals alignment
- **Interest Overlap** (35%): Shared interests calculation
- **Event Matching** (15%): Common events/conferences
- **Location Proximity** (10%): Geographic similarity

**Scoring**:
- Weighted compatibility score (0-100)
- Minimum threshold: 75/100 for match
- Excludes: Self, existing matches, incomplete profiles

**Implementation**: `src/services/matchingEngine.ts`

### 4. Match Tracker
**Purpose**: Records matches and manages follow-up scheduling

**Features**:
- Match recording (user_id, matched_user_id, room_id, score)
- Follow-up scheduling (3-day check-in, 7-day next match)
- Match history retrieval
- Primary user ID resolution (cross-platform support)

**Data Storage**: MongoDB `matches` and `follow_ups` collections

### 5. Web Chat API
**Purpose**: REST API for web interface integration

**Endpoints**:
- `POST /api/chat` - Send message, get response
- `GET /api/history/:userId` - User profile & matches
- `GET /api/health` - Health check
- `GET /api/metrics` - Analytics & metrics
- `GET /api/users/search?name=<search>` - User search
- `GET /api/user/by-email?email=<email>` - Email lookup

**Authentication**: API key via `WEB_API_KEY` environment variable

### 6. Metrics API
**Purpose**: Analytics and user statistics

**Metrics**:
- User counts (total, started onboarding, completed)
- Match statistics (total, pending, connected, by date)
- Engagement metrics (feature requests, manual connections, diversity research)
- Follow-up statistics

**Implementation**: `src/services/metricsApi.ts`

### 7. Database Adapters
**Purpose**: Unified interface for MongoDB and PostgreSQL

**Features**:
- Automatic database type detection
- Query translation (SQL ↔ MongoDB)
- Migration support
- Index creation

**Implementation**: `src/adapters/mongoAdapter.ts`, `src/adapters/postgresAdapter.ts`

## Data Flow

### User Message Flow
```
1. User sends message (Telegram/Web)
   ↓
2. Message intercepted by handler
   ↓
3. Onboarding state checked (MongoDB cache)
   ↓
4a. If onboarding incomplete → Onboarding Plugin
4b. If onboarding complete → OpenAI LLM processing
   ↓
5. Response generated (with actions if needed)
   ↓
6. Response sent to user
```

### Match Request Flow
```
1. User requests match ("Match" command)
   ↓
2. Matching Engine queries all users (MongoDB)
   ↓
3. Compatibility scoring algorithm runs
   ↓
4. Top candidates selected (score ≥ 75)
   ↓
5. Match recorded (MongoDB matches collection)
   ↓
6. Follow-up scheduled (3-day, 7-day)
   ↓
7. Match notification sent to user
```

### Onboarding Flow
```
1. User starts conversation
   ↓
2. Onboarding Plugin activated
   ↓
3. Step-by-step questions (15 steps)
   ↓
4. User responses stored in MongoDB cache
   ↓
5. Profile validated and completed
   ↓
6. Profile saved, onboarding marked complete
```

## Data Models

### User Profile (MongoDB cache)
```typescript
{
  key: "onboarding_{userId}",
  value: {
    step: "COMPLETED",
    profile: {
      language: "en",
      name: "John Doe",
      email: "john@example.com",
      location: "New York, USA",
      roles: ["Developer", "Founder"],
      interests: ["AI", "Web3"],
      connectionGoals: ["Investors", "Partners"],
      events: ["ETHDenver 2025"],
      socials: ["@twitter"],
      telegramHandle: "johndoe",
      notifications: "Yes",
      onboardingCompletedAt: "2025-01-01T00:00:00Z"
    }
  }
}
```

### Match Record (MongoDB)
```typescript
{
  user_id: "userId1",
  matched_user_id: "userId2",
  room_id: "roomId",
  match_date: ISODate(),
  status: "pending" | "connected" | "not_interested",
  score: 85
}
```

### Follow-up Record (MongoDB)
```typescript
{
  user_id: "userId",
  match_id: "matchId",
  type: "3_day_checkin" | "7_day_next_match",
  scheduled_for: ISODate(),
  sent_at: ISODate() | null,
  status: "pending" | "sent" | "cancelled",
  response: "yes" | "no" | "not_interested" | null
}
```

## Deployment Architecture

### Container Structure
- **Base Image**: Node.js 22-slim
- **Build Stage**: TypeScript compilation, dependency installation
- **Runtime Stage**: Production dependencies only
- **Ports**: 3000 (REST API), 3002 (Direct Client, internal)

### Deployment
- **Platform**: Akash Network (decentralized cloud)
- **CI/CD**: GitHub Actions (auto-build on push)
- **Image Registry**: GitHub Container Registry (ghcr.io)
- **Configuration**: `deploy.sdl.yaml`

### Environment Variables
- `DATABASE_URL` - Database connection string
- `DATABASE_TYPE` - "mongodb" or "postgres"
- `OPENAI_API_KEY` - OpenAI API key
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` - Email configuration
- `WEB_API_KEY` - Web API authentication
- `CORS_ORIGINS` - Allowed CORS origins

## Performance Characteristics

### Response Times
- **Message Processing**: < 2s (OpenAI API dependent)
- **Match Finding**: < 1s (MongoDB query)
- **Profile Retrieval**: < 100ms (MongoDB cache)
- **API Endpoints**: < 500ms (database queries)

### Scalability
- **Horizontal Scaling**: Stateless design allows multiple instances
- **Database**: MongoDB sharding support
- **Caching**: Database-backed cache for persistence
- **Load Balancing**: Akash Network handles distribution

## Security

### Authentication
- **Telegram**: Bot token authentication
- **Web API**: API key authentication (`WEB_API_KEY`)
- **JWT**: Token-based auth for web sessions

### Data Privacy
- **Email Lookups**: Secure database queries
- **Profile Data**: Stored in MongoDB with access controls
- **Cross-Platform Linking**: Email-based identity resolution

### Error Handling
- **Graceful Degradation**: System continues if non-critical components fail
- **Error Logging**: Comprehensive error tracking
- **Retry Logic**: Automatic retries for transient failures

## Current Status

### Production Features
✅ Multi-language support (EN/ES/PT/FR)
✅ 15-step onboarding flow
✅ Intelligent matching algorithm
✅ Match tracking and follow-ups
✅ Web chat API
✅ Analytics and metrics
✅ Cross-platform identity (email-based)
✅ Automated email notifications
✅ Daily analytics reports

### Infrastructure
✅ Deployed on Akash Network
✅ MongoDB database
✅ CI/CD pipeline
✅ Docker containerization
✅ Health monitoring

This architecture supports a production AI agent serving the SI<3> Web3 community with real-time matching, multilingual support, and cross-platform integration.

