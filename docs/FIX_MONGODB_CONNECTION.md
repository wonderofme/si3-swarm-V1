# Fix: MongoDB Connection Error

## Problem

The bot is trying to use **PostgreSQL adapter** instead of **MongoDB adapter**, even though you provided a MongoDB connection string.

**Error**: `getaddrinfo ENOTFOUND kaia-bot.gv8u6sf.mongodb.net`
**Cause**: `PostgresDatabaseAdapter` is being used instead of `MongoAdapter`

## Solution

You **must** set `DATABASE_TYPE=mongodb` in your environment variables.

### For Local Testing (.env file)

Add this line to your `.env` file:

```bash
DATABASE_TYPE=mongodb
DATABASE_URL=mongodb+srv://kaia-bot:password@kaia-bot.gv8u6sf.mongodb.net/kaia?retryWrites=true&w=majority
```

### For Akash Deployment

In your `deploy.sdl.yaml` or Akash environment variables, ensure you have:

```yaml
env:
  - DATABASE_TYPE=mongodb
  - DATABASE_URL=mongodb+srv://kaia-bot:password@kaia-bot.gv8u6sf.mongodb.net/kaia?retryWrites=true&w=majority
```

## Why This Happens

The code checks `DATABASE_TYPE` to decide which adapter to use:

```typescript
const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
```

If `DATABASE_TYPE` is not set, it **defaults to `postgres`**, which causes the PostgreSQL adapter to try to parse your MongoDB connection string as a PostgreSQL connection string, resulting in the `ENOTFOUND` error.

## Verification

After setting `DATABASE_TYPE=mongodb`, you should see in the logs:

✅ `[Database Adapter] Creating MongoDB adapter`
✅ `[MongoDB Adapter] Connection test successful`

Instead of:
❌ `PostgresDatabaseAdapter.testConnection` (wrong adapter)
❌ `getaddrinfo ENOTFOUND` (trying to parse MongoDB URL as PostgreSQL)

## Complete .env Example

```bash
# Database Configuration
DATABASE_TYPE=mongodb
DATABASE_URL=mongodb+srv://kaia-bot:YOUR_PASSWORD@kaia-bot.gv8u6sf.mongodb.net/kaia?retryWrites=true&w=majority

# OpenAI
OPENAI_API_KEY=sk-your-key-here

# Telegram
TELEGRAM_BOT_TOKEN=your-token-here

# JWT Secret
JWT_SECRET=your-random-secret-here

# Server
DIRECT_PORT=3000

# OpenAI Models
USE_OPENAI_EMBEDDING=true
SMALL_OPENAI_MODEL=gpt-4o-mini
MEDIUM_OPENAI_MODEL=gpt-4o-mini
LARGE_OPENAI_MODEL=gpt-4o-mini
```

## Quick Fix Checklist

- [ ] Set `DATABASE_TYPE=mongodb` in `.env` (local) or environment variables (deployment)
- [ ] Verify `DATABASE_URL` is correct MongoDB connection string
- [ ] Restart the bot
- [ ] Check logs for `[Database Adapter] Creating MongoDB adapter`


