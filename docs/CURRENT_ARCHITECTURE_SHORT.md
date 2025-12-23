# Current Technical Architecture

## System Overview
Agent Kaia is an AI-powered matchmaking bot built on ElizaOS multi-agent framework, serving SI<3> Web3 community through Telegram and web interfaces.

## Architecture

```
User (Telegram/Web) 
  → Agent Kaia (ElizaOS Runtime)
    → OpenAI API (GPT-4o-mini) - LLM Processing
    → MongoDB Database
      • User Profiles & Onboarding State
      • Matches & Follow-ups
      • Feature Requests & Analytics
    → Matching Engine (Compatibility Algorithm)
    → Response (Telegram/Web API)
```

## Technology Stack

**Runtime**: Node.js 22, TypeScript 5.6.3
**Framework**: ElizaOS (multi-agent), Express 4.21 (REST API)
**Database**: MongoDB 6.3.0 (primary), PostgreSQL 8.13.0 (supported)
**AI/ML**: OpenAI GPT-4o-mini, OpenAI Embeddings
**Integrations**: Telegram Bot API (Telegraf), SMTP (Nodemailer)
**Infrastructure**: Docker, Akash Network, GitHub Actions CI/CD

## Core Components

### 1. ElizaOS Runtime
- Multi-agent framework managing state, plugins, AI interactions
- Plugin-based architecture (onboarding, matching, knowledge)
- Database-backed cache for persistence

### 2. Onboarding Plugin
- 15-step multilingual flow (EN/ES/PT/FR)
- Collects: language, name, email, location, roles, interests, goals, events, socials
- Cross-platform identity via email linking
- Data stored in MongoDB cache collection

### 3. Matching Engine
- Weighted compatibility algorithm:
  - Intent matching (40%): Connection goals alignment
  - Interest overlap (35%): Shared interests
  - Event matching (15%): Common events
  - Location proximity (10%): Geographic similarity
- Minimum threshold: 75/100 for match
- Excludes self, existing matches, incomplete profiles

### 4. Match Tracker
- Records matches (user_id, matched_user_id, score, status)
- Schedules follow-ups (3-day check-in, 7-day next match)
- Primary user ID resolution for cross-platform support

### 5. Web Chat API
- REST endpoints: `/api/chat`, `/api/history`, `/api/metrics`, `/api/health`
- API key authentication
- CORS support for web integration

### 6. Database Adapters
- Unified interface for MongoDB/PostgreSQL
- Automatic query translation
- Migration support

## Data Models

**User Profile** (MongoDB cache):
- Stored as `onboarding_{userId}` key
- Contains: language, name, email, location, roles, interests, goals, events, socials, telegramHandle, notifications

**Match Record** (MongoDB):
- user_id, matched_user_id, room_id, match_date, status, score

**Follow-up Record** (MongoDB):
- user_id, match_id, type, scheduled_for, sent_at, status, response

## Data Flow

**Message Flow**:
User → Handler → Onboarding Check → OpenAI LLM / Onboarding Plugin → Response

**Match Flow**:
User Request → Matching Engine → Compatibility Scoring → Match Recording → Follow-up Scheduling → Notification

## Deployment

- **Platform**: Akash Network (decentralized cloud)
- **Container**: Docker multi-stage build
- **CI/CD**: GitHub Actions
- **Database**: MongoDB (production)
- **Ports**: 3000 (REST API), 3002 (Direct Client, internal)

## Performance

- Message Processing: < 2s
- Match Finding: < 1s
- Profile Retrieval: < 100ms
- API Endpoints: < 500ms

## Current Features

✅ Multi-language support (4 languages)
✅ 15-step onboarding flow
✅ Intelligent matching algorithm
✅ Match tracking and follow-ups
✅ Web chat API
✅ Analytics and metrics
✅ Cross-platform identity
✅ Automated email notifications
✅ Daily analytics reports

This architecture supports a production AI agent serving the SI<3> Web3 community with real-time matching, multilingual support, and cross-platform integration.

