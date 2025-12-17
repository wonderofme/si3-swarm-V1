# Agent Kaia - Technology Stack

## Overview

Agent Kaia is a Telegram bot designed to help users in the SI<3> Web3 community connect through intelligent matchmaking. This document outlines the complete technology stack used in the project.

---

## Core Technologies

### Runtime & Language
- **Node.js**: `22.x` (LTS)
- **TypeScript**: `5.6.3`
- **Module System**: ES Modules (ESM)
- **Target**: ES2022

### Framework
- **ElizaOS**: `^0.1.0` - Multi-agent AI framework (used for runtime infrastructure)
  - Provides: AgentRuntime, Actions, Evaluators, Providers, MessageManager
  - Note: Message handling is done via direct Telegram integration for reliability

---

## Database & Storage

### Database Support
The bot supports both MongoDB and PostgreSQL:

**MongoDB** (recommended):
- **Adapter**: Custom `MongoAdapter` implementation
- **Client**: `mongodb` `^6.3.0`
- **Collections**:
  - `cache` - Persistent cache (onboarding state, user profiles)
  - `matches` - Match records between users
  - `follow_ups` - Scheduled follow-up messages
  - `profiles` - User profile data
  - `diversity_research` - Users interested in diversity research (Telegram handles)
  - `feature_requests` - User feature suggestions

**PostgreSQL** (alternative):
- **Adapter**: `@elizaos/adapter-postgres` `^0.1.0`
- **Client**: `pg` `^8.13.0`
- **Tables**:
  - `cache` - Persistent cache (onboarding state, user profiles)
  - `matches` - Match records between users
  - `follow_ups` - Scheduled follow-up messages

**Database Selection**: Controlled via `DATABASE_TYPE` environment variable:
- `DATABASE_TYPE=mongodb` (recommended) - Uses MongoDB
- `DATABASE_TYPE=postgres` - Uses PostgreSQL

### Caching
- **Persistent Cache**: Database-backed cache adapter (`DatabaseCacheAdapter`)
  - Stores onboarding state and user profiles in database
  - Survives container restarts and redeployments
  - Ensures user data persistence across deployments
  - Automatic database fallback if cache is empty (loads from DB on startup)

---

## AI & Machine Learning

### LLM Provider
- **OpenAI API**
  - **Model**: GPT-4o-mini
  - **Models Used**:
    - Small: `gpt-4o-mini`
    - Medium: `gpt-4o-mini`
    - Large: `gpt-4o-mini`

### AI Integration
- Direct OpenAI API integration for chat completions
- Conversation history management (last 20 messages)
- Context-aware responses based on user profile
- Knowledge-sharing capabilities: Currently responds with "coming soon" message for Web3 educational questions (focused on matchmaking)

---

## Communication & APIs

### Telegram Integration
- **Library**: `@elizaos/client-telegram` `^0.1.0`
- **Underlying**: Telegraf (via ElizaOS)
- **Features**:
  - Message polling
  - Bot API integration
  - Error handling and retry logic
  - Direct message handling for reliability

### REST API
- **Framework**: Express `^4.21.0`
- **Port**: 3001 (DIRECT_PORT + 1)
- **Client**: `@elizaos/client-direct` `^0.1.0` (port 3000)
- **CORS**: Configurable via `CORS_ORIGINS` environment variable
- **Authentication**: Optional API key via `WEB_API_KEY` environment variable
- **Endpoints**:
  - `POST /api/chat` - Web chat interface (same functionality as Telegram)
    - Request: `{ "userId": "string", "message": "string" }`
    - Response: `{ "success": true, "response": "string", "profile": {...}, "onboardingStatus": "string" }`
    - Auth: `X-API-Key` header or `Authorization: Bearer <key>`
  - `GET /api/history/:userId` - User profile & match history
  - `GET /api/health` - Health check endpoint
- **Features**:
  - Same functionality as Telegram bot
  - User profile persistence
  - Onboarding state management
  - Matchmaking capabilities

---

## Security & Authentication

### Authentication
- **JWT**: `jsonwebtoken` `^9.0.2`
- **Secret**: Configurable via `JWT_SECRET` environment variable

---

## Development Tools

### TypeScript Configuration
- **Strict Mode**: Enabled
- **Module Resolution**: NodeNext
- **Target**: ES2022
- **Output**: `dist/` directory

### Development Dependencies
- **TypeScript**: `^5.6.3`
- **ts-node-dev**: `^2.0.0` - Development server with hot reload
- **Type Definitions**:
  - `@types/node`: `^22.7.4`
  - `@types/express`: `^4.17.21`
  - `@types/jsonwebtoken`: `^9.0.6`

### Environment Management
- **dotenv**: `^16.4.5` - Environment variable management

---

## Containerization & Deployment

### Docker
- **Base Image**: `node:22-slim`
- **Build Strategy**: Multi-stage build
- **Registry**: GitHub Container Registry (GHCR)
- **Image**: `ghcr.io/wonderofme/kaia-swarm:v294`
- **Build Dependencies**: Python3, make, g++ (for native modules)

### Deployment Platform
- **Akash Network**: Decentralized cloud deployment
- **Configuration**: `deploy.sdl.yaml`
- **Resources**:
  - CPU: 1.0 units
  - Memory: 2Gi
  - Storage: 1Gi
  - Ports:
    - 3000 (DirectClient, exposed as 80)
    - 3001 (REST API, exposed as 3001)

### CI/CD
- **Platform**: GitHub Actions
- **Workflow**: `.github/workflows/docker-publish.yml`
- **Trigger**: Push to `main` branch
- **Process**:
  1. Build Docker image
  2. Push to GHCR with tags: `v294`, `v${{ github.run_number }}`, `latest`, and commit SHA

---

## Package Management

### Package Manager
- **npm**: Node.js package manager
- **Lock File**: `package-lock.json` (for reproducible builds)

### Dependency Overrides
- **zod**: `3.25.32` (overridden for compatibility)
- **zod-to-json-schema**: `3.23.3` (overridden for compatibility)

---

## Project Structure

```
src/
├── index.ts                    # Main entry point
├── bootstrap.ts                # Error interception setup
├── adapters/                   # Database adapters
│   ├── databaseAdapter.ts     # Database adapter factory
│   ├── mongoAdapter.ts        # MongoDB adapter
│   └── dbCache.ts             # Persistent cache adapter
├── plugins/                    # ElizaOS plugins
│   ├── onboarding/            # Onboarding flow
│   └── matching/              # Matchmaking logic
└── services/                   # Background services
```

---

## Environment Variables

### Required
- `DATABASE_URL` - MongoDB or PostgreSQL connection string
- `DATABASE_TYPE` - `mongodb` or `postgres` (default: `postgres`)
- `OPENAI_API_KEY` - OpenAI API key
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `JWT_SECRET` - JWT signing secret

### Optional
- `DIRECT_PORT` - DirectClient port (default: 3000). REST API runs on DIRECT_PORT + 1
- `SMALL_OPENAI_MODEL` - OpenAI model for small tasks (default: `gpt-4o-mini`)
- `MEDIUM_OPENAI_MODEL` - OpenAI model for medium tasks (default: `gpt-4o-mini`)
- `LARGE_OPENAI_MODEL` - OpenAI model for large tasks (default: `gpt-4o-mini`)
- `SMTP_HOST` - SMTP server hostname (for feature requests)
- `SMTP_PORT` - SMTP server port
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `WEB_API_KEY` - API key for web chat endpoint (set to `disabled` to allow public access)
- `CORS_ORIGINS` - Comma-separated list of allowed origins (default: `*`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - Email configuration for feature requests and no-match notifications

---

## Key Dependencies Summary

### Production Dependencies
```json
{
  "@elizaos/adapter-postgres": "^0.1.0",
  "@elizaos/client-direct": "^0.1.0",
  "@elizaos/client-telegram": "^0.1.0",
  "@elizaos/core": "^0.1.0",
  "dotenv": "^16.4.5",
  "express": "^4.21.0",
  "jsonwebtoken": "^9.0.2",
  "mongodb": "^6.3.0",
  "pg": "^8.13.0"
}
```

### Development Dependencies
```json
{
  "@types/express": "^4.17.21",
  "@types/jsonwebtoken": "^9.0.6",
  "@types/node": "^22.7.4",
  "ts-node-dev": "^2.0.0",
  "typescript": "^5.6.3"
}
```

---

## Architecture Patterns

### Direct Message Handling
- Custom message handler bypasses ElizaOS message processing for reliability
- Direct OpenAI API integration for responses
- Conversation history management for context
- Knowledge-sharing: Responds with "coming soon" message for Web3 educational questions
- Focus: Matchmaking and community connections (knowledge base temporarily disabled)

### Plugin Architecture
- Modular plugins extend ElizaOS functionality
- Each plugin provides: Actions, Evaluators, Providers
- Plugins: Onboarding, Matching

### State Management
- Database-backed persistent cache
- User profiles and onboarding state stored in database
- Survives container restarts and redeployments
- Automatic state restoration from database on startup
- Diversity research interest tracking (MongoDB collection)

### Multi-Agent System
- Three separate AgentRuntime instances:
  - **Kaia** (Primary) - Main user interaction
  - **MoonDAO** (Sub-Agent) - Space/Governance expert
  - **SI<3>** (Sub-Agent) - Web3 education expert

---

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Start production build
npm start
```

### Docker Development
```bash
# Build image
docker build -t kaia-swarm .

# Run container
docker run -p 3000:3000 --env-file .env kaia-swarm
```

---

## Browser & Client Support

### Supported Platforms
- **Telegram**: Desktop, Mobile, Web
- **REST API**: Any HTTP client

### Language Support
- English
- Spanish
- Portuguese
- French

---

## Performance Considerations

### Caching Strategy
- Database-backed persistent cache
- Reduces database queries
- Ensures data persistence across restarts

### Database Optimization
- Indexed queries on user_id, match_id
- Efficient match scoring algorithm

### Resource Limits
- Akash deployment: 1 CPU, 2Gi RAM, 1Gi storage
- Suitable for moderate user loads

---

## Security Considerations

### API Keys
- All API keys stored as environment variables
- Never committed to repository
- Required for: OpenAI, Telegram

### Database Security
- Connection string includes credentials
- Stored securely in environment variables

### JWT Security
- Secret key required for token signing
- Stored in environment variables

---

## Version Information

- **Project Version**: `0.2.0`
- **Node.js**: `22.x`
- **TypeScript**: `5.6.3`
- **ElizaOS**: `^0.1.0`
- **Docker Image**: `v294`

---

## Getting Started for New Developers

1. **Prerequisites**:
   - Node.js 22.x installed
   - MongoDB or PostgreSQL database running
   - OpenAI API key
   - Telegram bot token

2. **Setup**:
   ```bash
   git clone <repository>
   cd AgentKaia
   npm install
   cp .env.example .env
   # Fill in environment variables
   npm run dev
   ```

3. **Key Files to Understand**:
   - `src/index.ts` - Application entry point
   - `src/bootstrap.ts` - Error interception setup
   - `src/plugins/onboarding/` - Onboarding flow
   - `src/plugins/matching/` - Matchmaking logic
   - `src/adapters/mongoAdapter.ts` - MongoDB adapter
   - `characters/kaia.character.json` - Agent personality

---

*Last Updated: December 2024*
