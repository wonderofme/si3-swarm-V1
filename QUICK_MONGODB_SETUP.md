# Quick MongoDB Setup for Testing

## 🚀 Quick Start (5 minutes)

### 1. Get MongoDB (Free)

1. Go to: https://www.mongodb.com/cloud/atlas/register
2. Sign up → Create FREE cluster (M0 Sandbox)
3. Wait 3-5 minutes for cluster to be ready

### 2. Get Connection String

1. Click **Connect** on your cluster
2. Choose **Connect your application**
3. Copy connection string
4. Replace `<username>` and `<password>` with your database user credentials

Example:
```
mongodb+srv://kaia-bot:yourpassword@cluster0.xxxxx.mongodb.net/kaia?retryWrites=true&w=majority
```

### 3. Configure Access

**Database Access**:
- Create user: `kaia-bot` with password
- Permissions: Read and write to any database

**Network Access**:
- Add IP: `0.0.0.0/0` (Allow from anywhere - for testing only!)

### 4. Update Your .env File

```bash
DATABASE_URL=mongodb+srv://kaia-bot:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/kaia?retryWrites=true&w=majority
DATABASE_TYPE=mongodb
```

### 5. Test Locally

```bash
npm install
npm run build
npm start
```

Look for:
- ✅ `[Database Adapter] Creating MongoDB adapter`
- ✅ `[MongoDB Adapter] Connection test successful`
- ✅ `✅ Kaia runtime initialized successfully`

### 6. Deploy to Your Repo

1. Push code to your personal repo
2. GitHub Actions will build Docker image
3. Use in Akash deployment with MongoDB connection string

## 📝 Full Guide

See `docs/MONGODB_SETUP_AND_TESTING.md` for detailed instructions.

## ⚠️ Important

- Don't commit `.env` file (already in `.gitignore`)
- Use `0.0.0.0/0` only for testing
- For production, restrict MongoDB network access to specific IPs

