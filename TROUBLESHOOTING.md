# Troubleshooting Guide

This guide helps developers diagnose and fix common issues when working with Agent Kaia.

## Table of Contents

1. [Setup Issues](#setup-issues)
2. [Runtime Issues](#runtime-issues)
3. [Database Issues](#database-issues)
4. [Telegram Issues](#telegram-issues)
5. [Message Processing Issues](#message-processing-issues)
6. [Deployment Issues](#deployment-issues)

---

## Setup Issues

### Node.js Version Mismatch

**Symptoms:**
- Build errors
- Module resolution errors
- Runtime errors

**Solution:**
- Ensure Node.js 22+ is installed: `node --version`
- Use `nvm` to switch versions if needed: `nvm use 22`

### Missing Dependencies

**Symptoms:**
- `Cannot find module` errors
- Import errors

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Compilation Errors

**Symptoms:**
- Type errors during build
- Compilation failures

**Solution:**
- Check `tsconfig.json` is present and valid
- Ensure all TypeScript types are installed: `npm install --save-dev @types/node`
- Run `npm run build` to see detailed error messages

---

## Runtime Issues

### Application Won't Start

**Symptoms:**
- Process exits immediately
- No logs or error messages

**Solution:**
1. Check environment variables are set:
   ```bash
   echo $DATABASE_URL
   echo $OPENAI_API_KEY
   echo $TELEGRAM_BOT_TOKEN
   ```
2. Verify `.env` file exists and contains all required variables
3. Check logs for specific error messages

### Runtime Initialization Fails

**Symptoms:**
- Error: "Failed to create Kaia runtime"
- Database connection errors during startup

**Solution:**
- The application is designed to continue running even if database connection fails initially
- Check database connectivity: `psql $DATABASE_URL -c "SELECT 1;"`
- Verify database is running and accessible
- Check network connectivity to database host

### Multiple Runtime Instances

**Symptoms:**
- Three runtimes (Kaia, MoonDAO, SI<3>) but only Kaia is needed

**Solution:**
- This is normal - MoonDAO and SI<3> are stubbed for future use
- Only Kaia runtime is actively used
- Other runtimes can fail to initialize without affecting Kaia

---

## Database Issues

### Connection Timeout

**Symptoms:**
- Error: "ETIMEDOUT" or "ENETUNREACH"
- "Failed to connect" errors

**Solution:**
1. Verify `DATABASE_URL` format: `postgresql://user:password@host:port/dbname`
2. Check database is running: `pg_isready -h hostname -p port`
3. Test connection: `psql $DATABASE_URL -c "SELECT 1;"`
4. Check firewall rules allow connection
5. Verify database credentials

### Migration Errors

**Symptoms:**
- "Migration failed" errors
- Table creation errors

**Solution:**
- Migrations run automatically on Kaia runtime initialization
- Check database user has CREATE TABLE permissions
- Verify tables don't already exist with conflicting schemas
- Check migration logs in console output

### Cache Table Issues

**Symptoms:**
- "Cache table not found" errors
- State not persisting

**Solution:**
- Cache table is created automatically by ElizaOS
- Verify database connection is working
- Check `cache` table exists: `SELECT * FROM cache LIMIT 1;`
- Ensure database user has CREATE TABLE permissions

---

## Telegram Issues

### Bot Not Receiving Messages

**Symptoms:**
- Bot is running but not responding
- "Polling status: NOT RUNNING" in logs
- No messages received

**Solution:**
1. **Check for 409 Conflict Error:**
   - Error: "409: Conflict: terminated by other getUpdates request"
   - **Cause**: Multiple bot instances running with same token
   - **Fix**: Stop all other bot instances, wait 60 seconds, restart

2. **Verify Bot Token:**
   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"
   ```
   Should return bot information

3. **Check Polling Status:**
   - Look for "Polling status: RUNNING" in logs
   - If "NOT RUNNING", bot won't receive messages

4. **Test Bot Connectivity:**
   - Application tests `getUpdates` on startup
   - Check logs for connectivity test results

### 409 Conflict Error

**Symptoms:**
- Error: "409: Conflict: terminated by other getUpdates request"
- Bot stops receiving messages

**Solution:**
1. **Stop All Bot Instances:**
   - Check all running processes: `ps aux | grep node`
   - Kill all bot instances: `pkill -f "node.*index.js"`
   - Wait 60 seconds for Telegram to release the connection

2. **Verify Only One Instance:**
   - Check Docker containers: `docker ps | grep agentkaia`
   - Check systemd services: `systemctl status agentkaia`
   - Check PM2 processes: `pm2 list`

3. **Restart Bot:**
   - Start only one instance
   - Monitor logs for "Polling status: RUNNING"

### Bot Not Sending Messages

**Symptoms:**
- Bot receives messages but doesn't respond
- No errors in logs

**Solution:**
1. Check OpenAI API key is valid and has credits
2. Verify database is accessible (needed for state)
3. Check logs for action execution
4. Verify message interceptors aren't blocking all messages

---

## Message Processing Issues

### Duplicate Messages

**Symptoms:**
- Same message sent twice during onboarding
- Duplicate responses to user input

**Solution:**
- See [DUPLICATE_MESSAGE_PROBLEM.md](./DUPLICATE_MESSAGE_PROBLEM.md) for detailed explanation
- This is a known issue with partial mitigation
- Multiple blocking mechanisms are in place but not 100% effective
- Check logs for "🚫" markers indicating blocked messages

### Messages Not Processing

**Symptoms:**
- Messages received but no response
- No action execution logs

**Solution:**
1. Check evaluators are detecting intent:
   - Look for evaluator logs in console
   - Verify onboarding step detection
   - Check match request detection

2. Verify actions are executing:
   - Look for action handler logs
   - Check for action execution timestamps

3. Check message interceptors:
   - Verify interceptors aren't blocking all messages
   - Check for "blocked" metadata in logs

### Onboarding Flow Stuck

**Symptoms:**
- Onboarding step doesn't advance
- Same question asked repeatedly

**Solution:**
1. Check onboarding state in cache:
   ```sql
   SELECT * FROM cache WHERE key LIKE 'onboarding_%';
   ```

2. Verify action handlers are executing:
   - Check logs for action execution
   - Verify state updates are being saved

3. Check for restart commands:
   - User might have sent "restart" which resets state
   - Verify restart handler is working

---

## Deployment Issues

### Docker Build Fails

**Symptoms:**
- Build errors during `docker build`
- Native module compilation errors

**Solution:**
1. **Native Module Issues:**
   - Dockerfile sets `USE_OPENAI_EMBEDDING=true` to avoid native modules
   - Ensure build stage has build dependencies (python3, make, g++)

2. **Platform-Specific Issues:**
   - Use `--platform linux/amd64` for cross-platform builds
   - Ensure base image matches target platform

3. **Dependency Issues:**
   - Run `npm install --force` in Dockerfile
   - Check package-lock.json is up to date

### Container Won't Start

**Symptoms:**
- Container exits immediately
- No logs

**Solution:**
1. Check environment variables are set:
   ```bash
   docker run --env-file .env agentkaia
   ```

2. Verify entrypoint:
   - Should be `node dist/index.js`
   - Check `dist/` directory exists in image

3. Check logs:
   ```bash
   docker logs <container-id>
   ```

### Akash Deployment Fails

**Symptoms:**
- "Invalid: deployment hash" error
- 503 Service Unavailable
- 401 Unauthorized when pulling image
- "Error while sending manifest to provider" / "Something went wrong"

**Solution:**
1. **401 Unauthorized (Image Pull Error):**
   - **Cause**: GHCR package is private by default, and Akash can't authenticate
   - **Solution Options**:
     
     **Option A: Use Docker Hub (Recommended if no GHCR permissions)**
     1. Create Docker Hub account at https://hub.docker.com
     2. Add `DOCKER_USERNAME` and `DOCKER_PASSWORD` to GitHub Secrets
     3. Update `deploy.sdl.yaml` to use: `docker.io/yourusername/agentkaia:latest`
     4. GitHub Actions will push to both GHCR and Docker Hub
     5. See [DOCKER_HUB_SETUP.md](./DOCKER_HUB_SETUP.md) for detailed steps
     
     **Option B: Make GHCR Package Public (If you have permissions)**
     1. Go to `https://github.com/orgs/si3-ecosystem/packages`
     2. Find `agentkaia` package → Package settings
     3. Danger Zone → Change visibility → Public
     
   - **Security Note**: 
     - ✅ **Safe**: Image contains only code, no secrets (all secrets are in env vars)
     - ✅ **Verified**: No hardcoded secrets in codebase (all use `process.env.*`)

2. **Invalid Deployment Hash:**
   - Check `deploy.sdl.yaml` syntax
   - Verify storage field format: `storage: - size: 1Gi class: default`
   - Ensure SDL version is correct (v2.0)

3. **503 Service Unavailable:**
   - Provider infrastructure issue
   - Wait and retry
   - Try different provider

4. **Image Not Found:**
   - Verify image is built and pushed to GHCR
   - Check image path: `ghcr.io/wonderofme/kaia-swarm:latest`
   - Ensure GitHub Actions workflow completed successfully

5. **"Error while sending manifest to provider" / "Something went wrong":**
   - **Most Common Cause**: Image tag doesn't exist yet (e.g., `v0.2.0` not built)
   - **Solution**: 
     - Use `latest` tag temporarily: `ghcr.io/wonderofme/kaia-swarm:latest`
     - Or wait for GitHub Actions to build the version tag, then retry
     - Or push code to trigger build, wait for workflow to complete
   - **Other Causes**:
     - Image is private (make GHCR package public or use Docker Hub)
     - Provider connectivity issues (refresh page, try different provider)
     - SDL syntax error (validate YAML syntax)
     - Network timeout (retry after a few minutes)

---

## Debugging Tips

### Enable Verbose Logging

The application logs extensively. Check console output for:
- `[Onboarding Provider]` - Provider execution
- `[Onboarding Action]` - Action handler execution
- `[Message Interceptor]` - Message blocking
- `[Telegram Client]` - Telegram API calls
- `[Follow-Up Scheduler]` - Follow-up processing

### Check Database State

```sql
-- Check onboarding state
SELECT key, value FROM cache WHERE key LIKE 'onboarding_%';

-- Check user profiles
SELECT key, value FROM cache WHERE key LIKE 'profile_%';

-- Check matches
SELECT * FROM matches ORDER BY match_date DESC LIMIT 10;

-- Check follow-ups
SELECT * FROM follow_ups WHERE status = 'pending' ORDER BY scheduled_for;
```

### Test Components Individually

1. **Test Database Connection:**
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

2. **Test Telegram Bot:**
   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"
   ```

3. **Test OpenAI API:**
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

### Common Error Patterns

- **"Cannot find module"**: Missing dependency or incorrect import path
- **"Connection refused"**: Service not running or wrong host/port
- **"Permission denied"**: File permissions or database user permissions
- **"Timeout"**: Network issue or service not responding
- **"409 Conflict"**: Multiple bot instances (Telegram specific)

---

## Getting Help

If you're still stuck:

1. Check the logs for specific error messages
2. Review [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the system
3. Check [DUPLICATE_MESSAGE_PROBLEM.md](./DUPLICATE_MESSAGE_PROBLEM.md) for known issues
4. Review [PROJECT_STATE.md](./PROJECT_STATE.md) for complete system documentation
5. Open an issue on GitHub with:
   - Error messages
   - Logs (sanitized of secrets)
   - Steps to reproduce
   - Environment details (Node version, OS, etc.)

