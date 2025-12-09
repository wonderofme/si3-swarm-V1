# Agent Kaia - SI<3> Community Bot

A multi-agent Telegram bot built on ElizaOS that helps users in the SI<3> Web3 community connect through intelligent matchmaking, onboarding, and automated follow-ups.

## Features

- 🌍 **Multilingual Support**: English, Spanish, Portuguese, French
- 👤 **User Onboarding**: 13-step onboarding flow with profile collection
- 🔗 **Intelligent Matching**: Interest-based user matching algorithm
- 📅 **Automated Follow-Ups**: 3-day check-ins and 7-day next match prompts
- 📊 **Match History**: Track and view all your matches
- ✏️ **Profile Management**: Edit profile fields without re-onboarding
- 🤖 **Multi-Agent System**: Kaia (primary), MoonDAO, SI<3> (sub-agents)

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system architecture, component layers, and data flow.

## Prerequisites

- Node.js 22+
- PostgreSQL database
- OpenAI API key
- Telegram Bot Token

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/si3-ecosystem/AgentKaia.git
cd AgentKaia
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: Your OpenAI API key
- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `JWT_SECRET`: Secret for JWT tokens (any random string)
- `DIRECT_PORT`: Port for Direct client API (default: 3000)

### 4. Set Up Database

Ensure PostgreSQL is running and accessible. The application will automatically run migrations on first startup.

### 5. Build and Run

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

## Project Structure

```
src/
├── index.ts                    # Main entry point
├── adapters/
│   └── dbCache.ts             # PostgreSQL cache adapter
├── plugins/
│   ├── onboarding/           # Onboarding flow plugin
│   ├── matching/             # Matching algorithm plugin
│   └── router/               # Router plugin (stubbed)
└── services/
    ├── followUpScheduler.ts   # Background follow-up scheduler
    ├── llmResponseInterceptor.ts  # LLM response blocking
    └── telegramMessageInterceptor.ts  # Message deduplication
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete file structure.

## Development

### Available Scripts

- `npm run build`: Compile TypeScript to JavaScript
- `npm start`: Run the compiled application
- `npm run dev`: Run in development mode with hot reload
- `npm run ingest-knowledge`: Ingest knowledge base (if applicable)

### Code Style

- TypeScript with strict mode enabled
- ES2022 target
- NodeNext module resolution

## Troubleshooting

### Common Issues

1. **Bot not receiving messages**
   - Check for 409 Conflict errors (multiple bot instances running)
   - Verify `TELEGRAM_BOT_TOKEN` is correct
   - Ensure only one bot instance is running

2. **Database connection errors**
   - Verify `DATABASE_URL` is correct
   - Ensure PostgreSQL is running and accessible
   - Check network connectivity

3. **Duplicate messages during onboarding**
   - See [DUPLICATE_MESSAGE_PROBLEM.md](./DUPLICATE_MESSAGE_PROBLEM.md) for details
   - This is a known issue with partial mitigation

4. **Build errors**
   - Ensure Node.js 22+ is installed
   - Run `npm install` to ensure all dependencies are installed
   - Check that TypeScript is properly configured

### Debugging

Enable verbose logging by checking console output. The application logs:
- Runtime initialization
- Message processing
- Action execution
- Database operations
- Error details

## Deployment

### Docker

Build the Docker image:
```bash
docker build -t agentkaia .
```

Run the container:
```bash
docker run -d \
  -e DATABASE_URL="your-database-url" \
  -e OPENAI_API_KEY="your-api-key" \
  -e TELEGRAM_BOT_TOKEN="your-bot-token" \
  -e JWT_SECRET="your-jwt-secret" \
  agentkaia
```

### Akash Network

See `deploy.sdl.yaml` for Akash deployment configuration. The image is automatically built and pushed to GitHub Container Registry on push to `main` branch.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design
- [PROJECT_STATE.md](./PROJECT_STATE.md) - Complete project state documentation
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Troubleshooting guide for common issues
- [DUPLICATE_MESSAGE_PROBLEM.md](./DUPLICATE_MESSAGE_PROBLEM.md) - Duplicate message issue explanation
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Repository migration guide

### Detailed Issue Documentation

For detailed historical documentation about known issues and attempted fixes, see:
- [docs/known-issues/](./docs/known-issues/) - Detailed issue analysis and attempted solutions

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Private - SI<3> Ecosystem

## Support

For issues and questions, please open an issue on GitHub or contact the SI<3> team.

