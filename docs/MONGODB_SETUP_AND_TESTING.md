# MongoDB Setup and Testing Guide

This guide will help you set up a MongoDB database and test the bot on your personal repository.

## Step 1: Create MongoDB Atlas Account (Free Tier)

1. **Go to MongoDB Atlas**: https://www.mongodb.com/cloud/atlas/register
2. **Sign up** for a free account (or log in if you have one)
3. **Create a new cluster**:
   - Choose **FREE** tier (M0 Sandbox)
   - Select a cloud provider (AWS, Google Cloud, or Azure)
   - Choose a region closest to you
   - Click **Create Cluster** (takes 3-5 minutes)

## Step 2: Configure Database Access

1. **Create Database User**:
   - Go to **Database Access** (left sidebar)
   - Click **Add New Database User**
   - Choose **Password** authentication
   - Username: `kaia-bot` (or your choice)
   - Password: Generate a secure password (save it!)
   - Database User Privileges: **Read and write to any database**
   - Click **Add User**

2. **Configure Network Access**:
   - Go to **Network Access** (left sidebar)
   - Click **Add IP Address**
   - For testing: Click **Allow Access from Anywhere** (0.0.0.0/0)
   - ⚠️ **Note**: For production, restrict to specific IPs
   - Click **Confirm**

## Step 3: Get Connection String

1. **Go to Database** (left sidebar)
2. Click **Connect** on your cluster
3. Choose **Connect your application**
4. **Driver**: Node.js
5. **Version**: 6.0 or later
6. **Copy the connection string** - it looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
7. **Replace placeholders**:
   - Replace `<username>` with your database username (e.g., `kaia-bot`)
   - Replace `<password>` with your database password
   - Optionally add database name: `mongodb+srv://kaia-bot:password@cluster0.xxxxx.mongodb.net/kaia?retryWrites=true&w=majority`

## Step 4: Set Up Your Personal Repository

### Option A: Fork the Repository

1. Go to: https://github.com/si3-ecosystem/AgentKaia
2. Click **Fork** (top right)
3. Fork to your personal account

### Option B: Use Your Existing Repository

If you already have `wonderofme/si3-swarm-V1`, you can use that.

## Step 5: Configure Environment Variables

Create a `.env` file in your repository root:

```bash
# Database Configuration
DATABASE_URL=mongodb+srv://kaia-bot:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/kaia?retryWrites=true&w=majority
DATABASE_TYPE=mongodb

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key-here

# Telegram
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here

# JWT Secret (generate a random string)
JWT_SECRET=your-random-jwt-secret-here

# Server
DIRECT_PORT=3000

# OpenAI Models
USE_OPENAI_EMBEDDING=true
SMALL_OPENAI_MODEL=gpt-4o-mini
MEDIUM_OPENAI_MODEL=gpt-4o-mini
LARGE_OPENAI_MODEL=gpt-4o-mini

# SMTP (Optional - for feature requests)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Important**: 
- Replace `YOUR_PASSWORD` with your MongoDB password
- Replace `cluster0.xxxxx.mongodb.net` with your actual cluster URL
- Add `.env` to `.gitignore` (don't commit secrets!)

## Step 6: Test Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Run the bot**:
   ```bash
   npm start
   ```

4. **Check logs** for:
   - ✅ `[Database Adapter] Creating MongoDB adapter`
   - ✅ `[MongoDB Adapter] Connection test successful`
   - ✅ `[MongoDB Adapter] Created new room: ...`
   - ✅ `[MongoDB Adapter] Created new account: ...`
   - ✅ `✅ Kaia runtime initialized successfully`

## Step 7: Deploy to Your Personal Repository

### Update GitHub Actions Workflow

If you forked the repo, the workflow should already be set up. If using your own repo:

1. **Check `.github/workflows/docker-publish.yml` exists**
2. **Verify it builds to your repo**:
   ```yaml
   tags: |
     ghcr.io/${{ github.repository_owner }}/kaia-swarm:latest
     ghcr.io/${{ github.repository_owner }}/kaia-swarm:${{ github.sha }}
   ```

### Push Code

```bash
git add .
git commit -m "Configure for MongoDB testing"
git push origin main
```

### Wait for Build

1. Go to: `https://github.com/YOUR_USERNAME/YOUR_REPO/actions`
2. Wait for the workflow to complete (✅ green checkmark)

## Step 8: Deploy to Akash (Optional)

If you want to deploy to Akash:

1. **Update `deploy.sdl.yaml`**:
   ```yaml
   image: ghcr.io/YOUR_USERNAME/kaia-swarm:latest
   ```

2. **Set environment variables in Akash**:
   - `DATABASE_URL` - Your MongoDB connection string
   - `DATABASE_TYPE=mongodb`
   - `OPENAI_API_KEY` - Your OpenAI key
   - `TELEGRAM_BOT_TOKEN` - Your bot token
   - All other required variables

3. **Deploy using Akash Console or CLI**

## Step 9: Verify MongoDB Connection

### Check Collections Created

In MongoDB Atlas:

1. Go to **Database** → **Browse Collections**
2. You should see collections created automatically:
   - `rooms` - Created when bot initializes
   - `accounts` - Created when bot initializes
   - `cache` - ElizaOS cache
   - `matches` - Match records
   - `follow_ups` - Follow-up messages
   - `knowledge` - Knowledge base (if ingested)

### Test Database Operations

The bot will automatically:
- Create rooms when initializing
- Create accounts when users interact
- Store onboarding state in `cache`
- Store matches in `matches` collection

## Troubleshooting

### Connection Errors

**Error**: `getaddrinfo ENOTFOUND`
- **Solution**: Check your connection string is correct
- Verify network access allows your IP (or 0.0.0.0/0 for testing)

**Error**: `Authentication failed`
- **Solution**: Check username and password in connection string
- Verify database user has read/write permissions

### Missing Methods Error

**Error**: `getRoom is not a function`
- **Solution**: Ensure you're using the latest code with MongoDB adapter fixes
- Rebuild Docker image if deploying

### Collection Not Found

**Error**: Collection doesn't exist
- **Solution**: This is normal - MongoDB creates collections automatically
- The bot will create them on first use

## Quick Test Checklist

- [ ] MongoDB Atlas cluster created
- [ ] Database user created with read/write permissions
- [ ] Network access configured (0.0.0.0/0 for testing)
- [ ] Connection string copied and configured in `.env`
- [ ] `DATABASE_TYPE=mongodb` set in `.env`
- [ ] Bot runs locally without errors
- [ ] MongoDB collections appear in Atlas
- [ ] Bot responds to Telegram messages
- [ ] Onboarding works (creates cache entries)

## Next Steps

Once testing is successful:
1. Ingest knowledge base: `npm run ingest-knowledge`
2. Test matchmaking functionality
3. Test follow-up system
4. Deploy to production (restrict MongoDB network access)

## Security Notes

⚠️ **Important for Production**:
- Don't use `0.0.0.0/0` for network access in production
- Restrict to specific IPs (your server IPs)
- Use strong passwords
- Rotate credentials regularly
- Consider using MongoDB Atlas IP Access List for better security

