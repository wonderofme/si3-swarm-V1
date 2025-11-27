import 'dotenv/config';

// Force OpenAI embeddings to match database vector(1536)
process.env.USE_OPENAI_EMBEDDING = 'true';

const dbUrl = process.env.DATABASE_URL || '';
console.log(`[Debug] DATABASE_URL length: ${dbUrl.length}`);
console.log(`[Debug] DATABASE_URL starts with: ${dbUrl.substring(0, 15)}...`);
if (dbUrl.includes('base')) console.warn('[Debug] WARNING: URL contains "base"!');

import {
  AgentRuntime,
  CacheManager,
  MemoryCacheAdapter,
  ModelProviderName
} from '@elizaos/core';
import { PostgresDatabaseAdapter } from '@elizaos/adapter-postgres';
import { DirectClient } from '@elizaos/client-direct';
import { TelegramClientInterface } from '@elizaos/client-telegram';
import kaiaCharacter from '../characters/kaia.character.json' with { type: 'json' };
import moondaoCharacter from '../characters/moondao.character.json' with { type: 'json' };
import si3Character from '../characters/si3.character.json' with { type: 'json' };

async function createRuntime(character: any) {
  const db = new PostgresDatabaseAdapter({
    connectionString: process.env.DATABASE_URL as string
  });

  const cacheManager = new CacheManager(new MemoryCacheAdapter());

  const runtime = new AgentRuntime({
    character,
    token: process.env.OPENAI_API_KEY as string,
    modelProvider: ModelProviderName.OPENAI,
    databaseAdapter: db,
    cacheManager
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
    await TelegramClientInterface.start(kaiaRuntime);
  } else {
    console.warn('Skipping Telegram client: TELEGRAM_BOT_TOKEN not set');
  }

  console.log('Kaia, MoonDAO, and SI<3> runtimes started.');
}

startAgents().catch((err) => {
  console.error('Failed to start agents', err);
  process.exit(1);
});

