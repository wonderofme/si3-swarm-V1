# Agent Kaia - Technology Stack

## Overview

Agent Kaia is a multi-agent Telegram bot built on the ElizaOS framework, designed to help users in the SI<3> Web3 community connect through intelligent matchmaking. This document outlines the complete technology stack used in the project.

---

## Core Technologies

### Runtime & Language
- **Node.js**: `22.x` (LTS)
- **TypeScript**: `5.6.3`
- **Module System**: ES Modules (ESM)
- **Target**: ES2022

### Framework
- **ElizaOS**: `^0.1.0` - Multi-agent AI framework
  - Core framework for agent runtime, message handling, and plugin architecture
  - Provides: AgentRuntime, Actions, Evaluators, Providers, MessageManager

---

## Database & Storage

### Primary Database
- **PostgreSQL** (default): Production database
  - **Adapter**: `@elizaos/adapter-postgres` `^0.1.0`
  - **Client**: `pg` `^8.13.0`
  - **Vector Search**: `pgvector` extension for knowledge base embeddings
  - **Tables**:
    - `cache` - ElizaOS cache (onboarding state, user profiles)
    - `matches` - Match records between users
    - `follow_ups` - Scheduled follow-up messages
    - `knowledge` - SI<3> knowledge base with vector embeddings

- **MongoDB** (optional): Alternative database support
  - **Adapter**: Custom `MongoAdapter` implementation
  - **Client**: `mongodb` `^6.3.0`
  - **Vector Search**: MongoDB Atlas Vector Search (requires Atlas)
  - **Collections**:
    - `cache` - ElizaOS cache (onboarding state, user profiles)
    - `matches` - Match records between users
    - `follow_ups` - Scheduled follow-up messages
    - `knowledge` - SI<3> knowledge base with vector embeddings

**Database Selection**: Controlled via `DATABASE_TYPE` environment variable:
- `DATABASE_TYPE=postgres` (default) - Uses PostgreSQL
- `DATABASE_TYPE=mongodb` - Uses MongoDB

### Caching
- **Dual-layer caching**:
  - PostgreSQL-backed persistent cache
  - In-memory synchronous cache for fast onboarding step checks

---

## AI & Machine Learning

### LLM Provider
- **OpenAI API**
  - **Model**: GPT-4o-mini
  - **Embeddings**: OpenAI embeddings (via `USE_OPENAI_EMBEDDING=true`)
  - **Models Used**:
    - Small: `gpt-4o-mini`
    - Medium: `gpt-4o-mini`
    - Large: `gpt-4o-mini`

### AI Framework Components
- **Evaluators**: Intent detection and routing
- **Providers**: Context injection for LLM
- **Actions**: Executable behaviors (onboarding, matching, etc.)

---

## Communication & APIs

### Telegram Integration
- **Library**: `@elizaos/client-telegram` `^0.1.0`
- **Underlying**: Telegraf (via ElizaOS)
- **Features**:
  - Message polling
  - Bot API integration
  - Error handling and retry logic

### REST API
- **Framework**: Express `^4.21.0`
- **Port**: 3000 (configurable via `DIRECT_PORT`)
- **Client**: `@elizaos/client-direct` `^0.1.0`
- **Endpoints**:
  - `/api/history/:userId` - User match history

### Email Service
- **Library**: `nodemailer` `^7.0.11`
- **Purpose**: Feature request email notifications
- **SMTP Support**: Gmail, Outlook, Yahoo, and other SMTP providers

---

## Security & Authentication

### Authentication
- **JWT**: `jsonwebtoken` `^9.0.2`
- **Secret**: Configurable via `JWT_SECRET` environment variable

### Password Hashing
- **Library**: `bcryptjs` `^2.4.3`
- **Purpose**: User authentication (future use)

---

## Image Processing

- **Library**: `sharp` `^0.34.5`
- **Purpose**: Image processing and optimization

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
  - `@types/nodemailer`: `^7.0.4`

### Environment Management
- **dotenv**: `^16.4.5` - Environment variable management

---

## Containerization & Deployment

### Docker
- **Base Image**: `node:22-slim`
- **Build Strategy**: Multi-stage build
- **Registry**: GitHub Container Registry (GHCR)
- **Image**: `ghcr.io/wonderofme/kaia-swarm:v237`
- **Build Dependencies**: Python3, make, g++ (for native modules)

### Deployment Platform
- **Akash Network**: Decentralized cloud deployment
- **Configuration**: `deploy.sdl.yaml`
- **Resources**:
  - CPU: 1.0 units
  - Memory: 2Gi
  - Storage: 1Gi
  - Port: 3000 (exposed as 80)

### CI/CD
- **Platform**: GitHub Actions
- **Workflow**: `.github/workflows/docker-publish.yml`
- **Trigger**: Push to `main` branch
- **Process**:
  1. Build Docker image
  2. Push to GHCR with tags: `latest` and commit SHA

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
├── adapters/                   # Database adapters
├── plugins/                    # ElizaOS plugins
│   ├── onboarding/            # Onboarding flow
│   ├── matching/              # Matchmaking logic
│   └── router/                # Message routing
├── services/                   # Background services
└── ...

characters/                     # Agent character definitions
database/                      # Database migrations
.github/workflows/             # CI/CD pipelines
```

---

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `JWT_SECRET` - JWT signing secret

### Optional
- `DIRECT_PORT` - REST API port (default: 3000)
- `USE_OPENAI_EMBEDDING` - Use OpenAI embeddings (default: true)
- `SMTP_HOST` - SMTP server hostname
- `SMTP_PORT` - SMTP server port
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password

---

## Key Dependencies Summary

### Production Dependencies
```json
{
  "@elizaos/adapter-postgres": "^0.1.0",
  "@elizaos/client-direct": "^0.1.0",
  "@elizaos/client-telegram": "^0.1.0",
  "@elizaos/core": "^0.1.0",
  "bcryptjs": "^2.4.3",
  "dotenv": "^16.4.5",
  "express": "^4.21.0",
  "jsonwebtoken": "^9.0.2",
  "nodemailer": "^7.0.11",
  "pg": "^8.13.0",
  "sharp": "^0.34.5"
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

### Plugin Architecture
- Modular plugins extend ElizaOS functionality
- Each plugin provides: Actions, Evaluators, Providers
- Plugins: Onboarding, Matching, Router

### Runtime Patching
- Patches ElizaOS and Telegraf methods at runtime
- Used for: LLM response blocking, message deduplication, restart handling

### Multi-Agent System
- Three separate AgentRuntime instances:
  - **Kaia** (Primary) - Main user interaction
  - **MoonDAO** (Sub-Agent) - Space/Governance expert
  - **SI<3>** (Sub-Agent) - Web3 education expert

### State Management
- Dual-layer caching: PostgreSQL (persistent) + in-memory (fast)
- Synchronous cache for onboarding step checks

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
- In-memory cache for frequently accessed data (onboarding state)
- PostgreSQL cache for persistent storage
- Reduces database queries

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
- Required for: OpenAI, Telegram, SMTP

### Database Security
- Connection string includes credentials
- Stored securely in environment variables

### JWT Security
- Secret key required for token signing
- Stored in environment variables

---

## Future Technology Considerations

### Potential Additions
- **Redis**: For distributed caching
- **WebSocket**: Real-time updates
- **GraphQL**: Flexible API queries
- **Vector Database**: For semantic matching (Pinecone, Weaviate)
- **Monitoring**: Prometheus, Grafana
- **Logging**: ELK Stack, Datadog

---

## Version Information

- **Project Version**: `0.2.0`
- **Node.js**: `22.x`
- **TypeScript**: `5.6.3`
- **ElizaOS**: `^0.1.0`

---

## Additional Resources

- **Architecture Documentation**: See `ARCHITECTURE.md`
- **Deployment Guide**: See `deploy.sdl.yaml`
- **Character Definitions**: See `characters/` directory

---

## Getting Started for New Developers

1. **Prerequisites**:
   - Node.js 22.x installed
   - PostgreSQL database running
   - OpenAI API key
   - Telegram bot token

2. **Setup**:
   ```bash
   git clone <repository>
   cd si3-multi-agent-swarm
   npm install
   cp .env.example .env
   # Fill in environment variables
   npm run dev
   ```

3. **Key Files to Understand**:
   - `src/index.ts` - Application entry point
   - `src/plugins/onboarding/` - Onboarding flow
   - `src/plugins/matching/` - Matchmaking logic
   - `characters/kaia.character.json` - Agent personality

---

*Last Updated: December 2024*


