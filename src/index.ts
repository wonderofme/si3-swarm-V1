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

async function createRuntime(character: any) {
  const db = new PostgresDatabaseAdapter({
    connectionString: process.env.DATABASE_URL as string
  });

  const cacheManager = new CacheManager(new MemoryCacheAdapter());

  const plugins = [];
  if (character.plugins?.includes('router')) plugins.push(createRouterPlugin());
  if (character.plugins?.includes('onboarding')) plugins.push(createOnboardingPlugin());

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
  directClient.start(Number(process.env.DIRECT_PORT || 3000));

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
}

startAgents().catch((err) => {
  console.error('Failed to start agents', err);
  process.exit(1);
});
