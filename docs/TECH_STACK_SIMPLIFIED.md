# Agent Kaia - Simplified Technology Stack

## Quick Overview

Agent Kaia is a Telegram bot that helps users in the SI<3> Web3 community connect through intelligent matchmaking. This is a simplified version of the full tech stack documentation.

---

## Core Stack

### Runtime
- **Node.js** 22.x
- **TypeScript** 5.6.3
- **ElizaOS** Framework (for infrastructure)

### Database
- **MongoDB** (recommended) or **PostgreSQL**
- Stores: user profiles, matches, onboarding state
- **Persistent cache** - data survives deployments

### AI
- **OpenAI GPT-4o-mini** for chat responses
- Direct API integration (bypasses ElizaOS for reliability)

### Communication
- **Telegram** - Main interface via `@elizaos/client-telegram`
- **REST API** - Web integration on port 3001
  - `POST /api/chat` - Chat endpoint
  - `GET /api/history/:userId` - User profile & matches
  - `GET /api/health` - Health check

---

## Key Features

### Matchmaking
- Finds users with similar interests
- Real-time match notifications
- Follow-up check-ins (3 days after match)

### Onboarding
- 11-step profile creation
- Multi-language support (EN, ES, PT, FR)
- Profile editing after completion

### Data Persistence
- All user data stored in database
- Survives container restarts
- Automatic state restoration

### Web Integration
- REST API for website integration
- API key authentication (optional)
- CORS support

---

## Deployment

### Docker
- **Image**: `ghcr.io/wonderofme/kaia-swarm:v294`
- **Base**: `node:22-slim`
- **Registry**: GitHub Container Registry (GHCR)

### Platform
- **Akash Network** (decentralized cloud)
- **Resources**: 1 CPU, 2Gi RAM, 1Gi storage
- **Ports**: 3000 (Telegram), 3001 (REST API)

### CI/CD
- **GitHub Actions** - Auto-builds on push to `main`
- Tags: `v294`, `latest`, commit SHA

---

## Environment Variables

### Required
```
DATABASE_URL          # MongoDB or PostgreSQL connection string
DATABASE_TYPE         # "mongodb" or "postgres"
OPENAI_API_KEY        # OpenAI API key
TELEGRAM_BOT_TOKEN    # Telegram bot token
JWT_SECRET            # JWT signing secret
```

### Optional
```
DIRECT_PORT=3000      # DirectClient port
WEB_API_KEY           # API key for web chat (or "disabled")
CORS_ORIGINS          # Allowed origins (default: "*")
SMTP_*                # Email config for notifications
```

---

## Project Structure

```
src/
├── index.ts              # Main entry point
├── bootstrap.ts          # Error handling
├── adapters/             # Database adapters
│   ├── mongoAdapter.ts
│   └── dbCache.ts
├── plugins/
│   ├── onboarding/      # Onboarding flow
│   └── matching/        # Matchmaking logic
└── services/             # Background services
```

---

## Development

### Setup
```bash
npm install
cp .env.example .env
# Fill in environment variables
npm run dev
```

### Build
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t kaia-swarm .
docker run -p 3000:3000 --env-file .env kaia-swarm
```

---

## Current Focus

- ✅ **Matchmaking** - Primary feature
- ✅ **Profile Management** - View and edit profiles
- ✅ **Multi-language** - 4 languages supported
- ⏳ **Knowledge Sharing** - Coming soon (currently shows "coming soon" message)

---

## Version

- **Docker Image**: v294
- **Node.js**: 22.x
- **TypeScript**: 5.6.3

---

*For detailed information, see [TECH_STACK.md](./TECH_STACK.md)*

*Last Updated: December 2024*

