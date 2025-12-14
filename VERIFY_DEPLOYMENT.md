# Deployment Verification Guide

## Current Status

✅ **Code Status**: All MongoDB adapter methods are implemented and compiled:
- `getRoom()` - ✅ Implemented
- `getAccountById()` - ✅ Implemented  
- `getParticipantsForAccount()` - ✅ Implemented

✅ **Build Status**: TypeScript compiles successfully with no errors

✅ **Commits Pushed**: 
- `bcc92ade` - Add getParticipantsForAccount method
- `cdcd6000` - Add getRoom and getAccountById methods
- `8f1fa7de` - Fix TypeScript compilation errors

## Verification Steps

### 1. Check GitHub Actions Status

Go to: `https://github.com/si3-ecosystem/AgentKaia/actions`

Look for:
- ✅ Latest workflow run should show "✅ Success" (green checkmark)
- ⏱️ Should have completed after the latest commits were pushed
- 📦 Should show "Build and push Docker image" step completed

**If workflow failed:**
- Check the error logs
- Verify the workflow has permission to push to GHCR
- Ensure `GITHUB_TOKEN` secret is available

### 2. Verify Docker Image

The workflow builds to: `ghcr.io/si3-ecosystem/kaia-swarm:latest`

**Check image exists:**
- Go to: `https://github.com/si3-ecosystem/AgentKaia/pkgs/container/kaia-swarm`
- Verify `latest` tag exists and was updated recently
- Check the "Updated" timestamp matches your latest push

### 3. Verify Image Contains Fixes

**Option A: Use commit SHA tag (Recommended)**
Instead of `latest`, use the specific commit SHA in `deploy.sdl.yaml`:
```yaml
image: ghcr.io/si3-ecosystem/kaia-swarm:bcc92ade
```

This ensures you're using the exact image with the fixes.

**Option B: Force pull latest**
In Akash, you may need to:
1. Delete the current deployment
2. Wait 60 seconds (for Telegram lock to release)
3. Create a new deployment (this will force pull the latest image)

### 4. Check Deployment Logs

After redeploying, check the logs for:
- ✅ `[MongoDB Adapter] Created new room: ...` (means getRoom works)
- ✅ `[MongoDB Adapter] Created new account: ...` (means getAccountById works)
- ❌ Should NOT see: `this.databaseAdapter.getRoom is not a function`

## Troubleshooting

### If GitHub Actions hasn't run:
1. Check if workflow file exists: `.github/workflows/docker-publish.yml`
2. Verify it triggers on `push` to `main` branch
3. Manually trigger workflow: Actions → "Build and Publish" → "Run workflow"

### If image is old:
1. The `latest` tag might be cached
2. Use commit SHA tag instead: `ghcr.io/si3-ecosystem/kaia-swarm:bcc92ade`
3. Or wait for the workflow to complete and redeploy

### If deployment still crashes:
1. Check Akash logs for the actual error
2. Verify environment variables are set correctly
3. Ensure `DATABASE_TYPE=mongodb` is set if using MongoDB
4. Check database connection string is valid

## Next Steps

1. ✅ Verify GitHub Actions completed successfully
2. ✅ Update `deploy.sdl.yaml` to use commit SHA tag (optional but recommended)
3. ✅ Redeploy on Akash
4. ✅ Monitor logs to confirm methods are working

## Expected Logs After Fix

When the fix works, you should see:
```
[Database Adapter] Creating MongoDB adapter
[MongoDB Adapter] Created new room: d24d3f40-0000-0000-0000-000000000000
[MongoDB Adapter] Created new account: d24d3f40-0000-0000-0000-000000000000
✅ Kaia runtime initialized successfully
```

Instead of:
```
❌ this.databaseAdapter.getRoom is not a function
❌ this.databaseAdapter.getAccountById is not a function
```


