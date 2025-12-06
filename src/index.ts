import 'dotenv/config';
import {
  AgentRuntime,
  CacheManager,
  ModelProviderName
} from '@elizaos/core';
import { PostgresDatabaseAdapter } from '@elizaos/adapter-postgres';
import { DirectClient } from '@elizaos/client-direct';
import { TelegramClientInterface } from '@elizaos/client-telegram';
import express from 'express';

import kaiaCharacter from '../characters/kaia.character.json' with { type: 'json' };
import moondaoCharacter from '../characters/moondao.character.json' with { type: 'json' };
import si3Character from '../characters/si3.character.json' with { type: 'json' };

// Import Plugins
import { createRouterPlugin } from './plugins/router/index.js';
import { createOnboardingPlugin } from './plugins/onboarding/index.js';
import { createMatchingPlugin } from './plugins/matching/index.js';
import { DbCacheAdapter } from './adapters/dbCache.js';
import { startFollowUpScheduler } from './services/followUpScheduler.js';

async function runMigrations(db: PostgresDatabaseAdapter) {
  console.log('Running database migrations...');
  try {
    // 1. Create tables if they don't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        match_date TIMESTAMPTZ DEFAULT NOW(),
        status TEXT NOT NULL DEFAULT 'pending'
      );

      CREATE TABLE IF NOT EXISTS follow_ups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        response TEXT
      );
    `);

    // 2. Add missing columns to 'matches' if needed (handling existing tables)
    await db.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='user_id') THEN
          ALTER TABLE matches ADD COLUMN user_id UUID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='matched_user_id') THEN
          ALTER TABLE matches ADD COLUMN matched_user_id UUID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='room_id') THEN
          ALTER TABLE matches ADD COLUMN room_id UUID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='match_date') THEN
          ALTER TABLE matches ADD COLUMN match_date TIMESTAMPTZ DEFAULT NOW();
        END IF;
      END $$;
    `);

    // 3. Add missing columns to 'follow_ups' if needed
    await db.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='follow_ups' AND column_name='match_id') THEN
          ALTER TABLE follow_ups ADD COLUMN match_id UUID REFERENCES matches(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='follow_ups' AND column_name='user_id') THEN
          ALTER TABLE follow_ups ADD COLUMN user_id UUID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='follow_ups' AND column_name='scheduled_for') THEN
          ALTER TABLE follow_ups ADD COLUMN scheduled_for TIMESTAMPTZ;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='follow_ups' AND column_name='sent_at') THEN
          ALTER TABLE follow_ups ADD COLUMN sent_at TIMESTAMPTZ;
        END IF;
      END $$;
    `);

    // 4. Create indexes (safe to run if exists)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_user_id ON matches(user_id);
      CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled_for ON follow_ups(scheduled_for) WHERE status = 'pending';
    `);

    console.log('Migration steps executed successfully.');
  } catch (error) {
    console.error('Error running migrations:', error);
  }
}

async function createRuntime(character: any) {
  const db = new PostgresDatabaseAdapter({
    connectionString: process.env.DATABASE_URL as string
  });
  
  if (character.name === 'Kaia') {
    await runMigrations(db);
  }

  // Use database-backed cache for persistent storage
  const agentId = character.id || character.name;
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

  // Cross-references (stubbed)
  (kaiaRuntime as any).subAgents = {
    moondao: moondaoRuntime,
    si3: si3Runtime
  };

  // Direct Client
  const directClient = new DirectClient();
  directClient.registerAgent(kaiaRuntime);
  const directPort = Number(process.env.DIRECT_PORT || 3000);
  directClient.start(directPort);

  // History API
  const app = express();
  app.use(express.json());
  
  app.get('/api/history/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { getUserMatches, getOnboardingCompletionDate } = await import('./services/matchTracker.js');
      const { getUserProfile, getOnboardingState } = await import('./plugins/onboarding/utils.js');
      
      const profile = await getUserProfile(kaiaRuntime, userId as any);
      const matches = await getUserMatches(userId, 50);
      const { step } = await getOnboardingState(kaiaRuntime, userId as any);
      const completionDate = await getOnboardingCompletionDate(userId);
      
      // Get matched user names (Basic implementation)
      const matchesWithNames = await Promise.all(matches.map(async (match) => {
        try {
          const matchedProfile = await getUserProfile(kaiaRuntime, match.matchedUserId as any);
          return {
            ...match,
            matchedUserName: matchedProfile.name || 'Anonymous',
            matchedUserTelegram: matchedProfile.telegramHandle || undefined
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
    } catch (error) {
      console.error('[API] Error getting history:', error);
      res.status(500).json({ error: 'Failed to retrieve history' });
    }
  });
  
  app.listen(directPort + 1, () => {
      console.log(`[API] History endpoint available at http://localhost:${directPort + 1}/api/history/:userId`);
  });

  // Telegram Client
  if (process.env.TELEGRAM_BOT_TOKEN) {
    console.log('Starting Telegram client for Kaia...');
    try {
        // Setup restart handler before starting Telegram client
        const { setupTelegramRestartHandler } = await import('./services/telegramRestartHandler.js');
        await setupTelegramRestartHandler(kaiaRuntime);
        
        // Setup LLM response interceptor to force action execution for restart commands
        // This must be BEFORE the message interceptor so patches chain correctly
        const { setupLLMResponseInterceptor } = await import('./services/llmResponseInterceptor.js');
        await setupLLMResponseInterceptor(kaiaRuntime);
        
        // Setup message interceptor for deduplication (this will wrap the LLM interceptor)
        const { setupTelegramMessageInterceptor } = await import('./services/telegramMessageInterceptor.js');
        await setupTelegramMessageInterceptor(kaiaRuntime);
        
        await TelegramClientInterface.start(kaiaRuntime);
    } catch (error: any) {
        console.error('❌ Failed to start Telegram client:', error);
    }
  }

  console.log('Kaia, MoonDAO, and SI<3> runtimes started.');
  
  // Start Scheduler
  startFollowUpScheduler(kaiaRuntime);
}

startAgents().catch((err) => {
  console.error('Failed to start agents', err);
  process.exit(1);
});
