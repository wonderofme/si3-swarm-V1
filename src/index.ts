// CRITICAL: Set environment variables BEFORE any ElizaOS imports
// ElizaOS reads settings at module import time, so these must be set first
process.env.USE_OPENAI_EMBEDDING = 'true';
process.env.SMALL_OPENAI_MODEL = 'gpt-4o-mini';
process.env.MEDIUM_OPENAI_MODEL = 'gpt-4o-mini';
process.env.LARGE_OPENAI_MODEL = 'gpt-4o-mini';

// Load .env file
import 'dotenv/config';

// Re-apply overrides after .env load (in case .env tries to override them)
process.env.USE_OPENAI_EMBEDDING = 'true';
process.env.SMALL_OPENAI_MODEL = 'gpt-4o-mini';
process.env.MEDIUM_OPENAI_MODEL = 'gpt-4o-mini';
process.env.LARGE_OPENAI_MODEL = 'gpt-4o-mini';

// Debug: Verify env vars are set
console.log('[Model Override] SMALL_OPENAI_MODEL:', process.env.SMALL_OPENAI_MODEL);
console.log('[Model Override] MEDIUM_OPENAI_MODEL:', process.env.MEDIUM_OPENAI_MODEL);
console.log('[Model Override] LARGE_OPENAI_MODEL:', process.env.LARGE_OPENAI_MODEL);

import kaiaCharacter from '../characters/kaia.character.json' with { type: 'json' };
import moondaoCharacter from '../characters/moondao.character.json' with { type: 'json' };
import si3Character from '../characters/si3.character.json' with { type: 'json' };

const dbUrl = process.env.DATABASE_URL || '';
console.log(`[Debug] DATABASE_URL length: ${dbUrl.length}`);
console.log(`[Debug] DATABASE_URL starts with: ${dbUrl.substring(0, 15)}...`);
if (dbUrl.includes('base')) console.warn('[Debug] WARNING: URL contains "base"!');

// Import ElizaOS AFTER env vars are set (using dynamic import to ensure order)
const elizaCore = await import('@elizaos/core');
const elizaPostgres = await import('@elizaos/adapter-postgres');
const elizaDirect = await import('@elizaos/client-direct');
const elizaTelegram = await import('@elizaos/client-telegram');

const {
  AgentRuntime,
  CacheManager,
  MemoryCacheAdapter,
  ModelProviderName
} = elizaCore;
const { PostgresDatabaseAdapter } = elizaPostgres;
const { DirectClient } = elizaDirect;
const { TelegramClientInterface } = elizaTelegram;

// Import Plugins
import { createRouterPlugin } from './plugins/router/index.js';
import { createOnboardingPlugin } from './plugins/onboarding/index.js';
import { createMatchingPlugin } from './plugins/matching/index.js';
import { DbCacheAdapter } from './adapters/dbCache.js';
import { startFollowUpScheduler } from './services/followUpScheduler.js';
import express from 'express';

async function createRuntime(character: any) {
  const db = new PostgresDatabaseAdapter({
    connectionString: process.env.DATABASE_URL as string
  });

  // Use DbCacheAdapter for persistence
  const agentId = elizaCore.stringToUuid(character.name);
  const cacheManager = new CacheManager(new DbCacheAdapter(process.env.DATABASE_URL as string, agentId));

  const plugins = [];
  if (character.plugins?.includes('router')) plugins.push(createRouterPlugin());
  if (character.plugins?.includes('onboarding')) plugins.push(createOnboardingPlugin());
  if (character.plugins?.includes('matching')) plugins.push(createMatchingPlugin());

  const runtime = new AgentRuntime({
    character,
    token: process.env.OPENAI_API_KEY as string,
    modelProvider: ModelProviderName.OPENAI,
    databaseAdapter: db,
    cacheManager,
    plugins
  });

  await runtime.initialize();
  return runtime;
}

async function startAgents() {
  const [kaiaRuntime, moondaoRuntime, si3Runtime] = await Promise.all([
    createRuntime(kaiaCharacter),
    createRuntime(moondaoCharacter),
    createRuntime(si3Character)
  ]);

  // Cross-references for future router behavior (currently unused)
  (kaiaRuntime as any).subAgents = {
    moondao: moondaoRuntime,
    si3: si3Runtime
  };

  // Direct (web) client for Kaia
  const directClient = new DirectClient();
  directClient.registerAgent(kaiaRuntime);
  const directPort = Number(process.env.DIRECT_PORT || 3000);
  directClient.start(directPort);
  
  // Add Express API for history endpoint
  const app = express();
  app.use(express.json());
  
  // History API endpoint
  app.get('/api/history/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { getUserMatches, getOnboardingCompletionDate } = await import('./services/matchTracker.js');
      const { getUserProfile, getOnboardingState } = await import('./plugins/onboarding/utils.js');
      
      const profile = await getUserProfile(kaiaRuntime, userId as any);
      const matches = await getUserMatches(userId as any, 50);
      const { step } = await getOnboardingState(kaiaRuntime, userId as any);
      const completionDate = await getOnboardingCompletionDate(userId as any);
      
      // Get matched user names
      const matchesWithNames = await Promise.all(matches.map(async (match) => {
        try {
          const matchedProfile = await getUserProfile(kaiaRuntime, match.matchedUserId);
          return {
            ...match,
            matchedUserName: matchedProfile.name || 'Anonymous',
            matchedUserTelegram: matchedProfile.telegramHandle
          };
        } catch (error) {
          return {
            ...match,
            matchedUserName: 'Unknown',
            matchedUserTelegram: undefined
          };
        }
      }));
      
      res.json({
        userId,
        profile: {
          name: profile.name,
          location: profile.location,
          roles: profile.roles,
          interests: profile.interests,
          events: profile.events,
          telegramHandle: profile.telegramHandle
        },
        matches: matchesWithNames.map(m => ({
          id: m.id,
          matchedUserId: m.matchedUserId,
          matchedUserName: m.matchedUserName,
          matchedUserTelegram: m.matchedUserTelegram,
          matchDate: m.matchDate,
          status: m.status
        })),
        onboardingStatus: step,
        onboardingCompletionDate: completionDate ? completionDate.toISOString() : null,
        totalMatches: matches.length
      });
    } catch (error: any) {
      console.error('[API] Error getting history:', error);
      res.status(500).json({ error: 'Failed to retrieve history' });
    }
  });
  
  // Start Express server on same port as Direct client (or separate port)
  app.listen(directPort + 1, () => {
    console.log(`[API] History endpoint available at http://localhost:${directPort + 1}/api/history/:userId`);
  });

  // Telegram client for Kaia
  if (process.env.TELEGRAM_BOT_TOKEN) {
    console.log('Starting Telegram client for Kaia...');
    try {
      await TelegramClientInterface.start(kaiaRuntime);
    } catch (error: any) {
      if (error?.response?.error_code === 409) {
        console.error('❌ Telegram Error 409: Another bot instance is already running.');
        console.error('   This usually means:');
        console.error('   1. Another deployment/container is using the same bot token');
        console.error('   2. A local instance is still running');
        console.error('   3. Multiple containers in the same deployment');
        console.error('   Solution: Ensure only ONE instance is running at a time.');
        // Don't exit - let the web client continue working
        console.warn('⚠️  Continuing without Telegram client (web client will still work)');
      } else {
        console.error('❌ Failed to start Telegram client:', error);
        throw error;
      }
    }
  } else {
    console.warn('Skipping Telegram client: TELEGRAM_BOT_TOKEN not set');
  }

  console.log('Kaia, MoonDAO, and SI<3> runtimes started.');
  
  // Start follow-up scheduler
  startFollowUpScheduler(kaiaRuntime);
}

startAgents().catch((err) => {
  console.error('Failed to start agents', err);
  process.exit(1);
});
