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

  // Initialize runtime with error handling - make database connection failures non-fatal
  try {
    await runtime.initialize();
    console.log(`✅ ${character.name} runtime initialized successfully`);
  } catch (error: any) {
    // Check for database connection errors - be very broad to catch all variations
    const errorMessage = error.message || error.toString() || '';
    const errorCode = error.code || '';
    const errorStack = error.stack || '';
    
    const isDatabaseError = 
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'ENETUNREACH' ||
      errorMessage.toLowerCase().includes('failed to connect') ||
      errorMessage.toLowerCase().includes('database') ||
      errorMessage.toLowerCase().includes('testconnection') ||
      errorMessage.toLowerCase().includes('connection') ||
      errorStack.includes('PostgresDatabaseAdapter') ||
      errorStack.includes('testConnection') ||
      errorStack.includes('adapter-postgres');
    
    if (isDatabaseError) {
      console.error(`⚠️ ${character.name} runtime initialization failed due to database connection issue (non-fatal, continuing)`);
      console.error(`Database error code: ${errorCode}`);
      console.error(`Database error message: ${errorMessage}`);
      console.error('⚠️ Bot will continue running but database-dependent features may be unavailable');
      console.error('💡 The bot will still be able to respond to messages, but some features may not work until database is available');
      // Don't throw - allow runtime to continue without database
    } else {
      // For non-database errors, re-throw to fail fast
      console.error(`❌ ${character.name} runtime initialization failed with non-database error:`, error);
      console.error(`Error code: ${errorCode}, message: ${errorMessage}`);
      throw error;
    }
  }
  
  return runtime;
}

async function startAgents() {
  // Wrap each createRuntime call individually to handle errors gracefully
  let kaiaRuntime, moondaoRuntime, si3Runtime;
  
  try {
    kaiaRuntime = await createRuntime(kaiaCharacter);
  } catch (error: any) {
    console.error('❌ Failed to create Kaia runtime:', error);
    console.error('⚠️ Continuing without Kaia runtime');
    kaiaRuntime = null;
  }
  
  try {
    moondaoRuntime = await createRuntime(moondaoCharacter);
  } catch (error: any) {
    console.error('❌ Failed to create MoonDAO runtime:', error);
    console.error('⚠️ Continuing without MoonDAO runtime');
    moondaoRuntime = null;
  }
  
  try {
    si3Runtime = await createRuntime(si3Character);
  } catch (error: any) {
    console.error('❌ Failed to create SI<3> runtime:', error);
    console.error('⚠️ Continuing without SI<3> runtime');
    si3Runtime = null;
  }
  
  // Ensure at least Kaia runtime exists
  if (!kaiaRuntime) {
    console.error('❌ Kaia runtime is required but failed to initialize. Exiting.');
    process.exit(1);
  }

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
        
        // Start Telegram client with retry logic
        // Network timeouts are common in cloud deployments, so we retry with exponential backoff
        let telegramClient = null;
        const maxRetries = 5;
        const initialDelay = 2000; // 2 seconds
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`[Telegram Client] Attempting to start Telegram client (attempt ${attempt}/${maxRetries})...`);
            telegramClient = await TelegramClientInterface.start(kaiaRuntime);
            console.log(`[Telegram Client] ✅ Successfully started Telegram client on attempt ${attempt}`);
            
            // Verify bot is ready and listening
            if (telegramClient && (telegramClient as any).bot) {
              const bot = (telegramClient as any).bot;
              console.log('[Telegram Client] Bot info:', bot.botInfo);
              console.log('[Telegram Client] Bot username:', bot.botInfo?.username);
              console.log('[Telegram Client] Bot is ready to receive messages');
              
              // Test if we can get bot info
              try {
                const me = await bot.telegram.getMe();
                console.log('[Telegram Client] ✅ Bot is connected and verified:', me.username);
              } catch (error: any) {
                console.error('[Telegram Client] ⚠️ Could not verify bot connection:', error.message);
              }
            }
            
            break; // Success, exit retry loop
          } catch (error: any) {
            // Handle FetchError and other error types
            const errorMessage = error.message || error.toString() || 'Unknown error';
            const errorCode = error.code || error.errno || 'unknown';
            const errorType = error.type || error.constructor?.name || 'unknown';
            
            // Check for timeout errors (ETIMEDOUT, FetchError with timeout, etc.)
            const isTimeout = 
              errorCode === 'ETIMEDOUT' || 
              errorCode === 'ETIMEDOUT' ||
              errorMessage.toLowerCase().includes('timeout') ||
              errorMessage.toLowerCase().includes('timed out') ||
              (errorType === 'system' && errorCode === 'ETIMEDOUT');
            
            const isLastAttempt = attempt === maxRetries;
            
            if (isLastAttempt) {
              console.error(`[Telegram Client] ❌ Failed to start after ${maxRetries} attempts (non-fatal, continuing)`);
              console.error(`[Telegram Client] Last error: ${errorMessage}`);
              console.error(`[Telegram Client] Error type: ${errorType}, code: ${errorCode}`);
              if (error.stack) {
                console.error(`[Telegram Client] Error stack: ${error.stack.substring(0, 500)}`);
              }
              console.error('⚠️ Bot will continue running but Telegram functionality will be unavailable');
              console.error('💡 This is usually a network connectivity issue. The bot will retry when messages are received.');
              telegramClient = null;
            } else {
              const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff: 2s, 4s, 8s, 16s, 32s
              console.warn(`[Telegram Client] ⚠️ Attempt ${attempt} failed: ${errorMessage}`);
              console.warn(`[Telegram Client] Error type: ${errorType}, code: ${errorCode}`);
              if (isTimeout) {
                console.warn(`[Telegram Client] Network timeout detected. Retrying in ${delay}ms...`);
              } else {
                console.warn(`[Telegram Client] Connection error. Retrying in ${delay}ms...`);
              }
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        // Try to intercept Telegram client to capture chat IDs before they're converted to UUIDs
        console.log('[Telegram Chat ID Capture] Telegram client type:', typeof telegramClient);
        console.log('[Telegram Chat ID Capture] Telegram client keys:', telegramClient ? Object.keys(telegramClient) : 'null');
        
        if (telegramClient) {
          const telegramClientAny = telegramClient as any;
          console.log('[Telegram Chat ID Capture] Checking for bot property...');
          
          // Try different possible structures
          const bot = telegramClientAny.bot || telegramClientAny.client || telegramClientAny;
          console.log('[Telegram Chat ID Capture] Bot type:', typeof bot);
          console.log('[Telegram Chat ID Capture] Bot keys:', bot ? Object.keys(bot) : 'null');
          
          // Try intercepting the handler property instead
          // NOTE: bot.handler might not be the main entry point - Telegraf uses bot.on() for events
          // But we'll patch it anyway to see if it gets called
          if (bot && bot.handler) {
            console.log('[Telegram Chat ID Capture] Found bot.handler, attempting to patch...');
            const originalHandler = bot.handler.bind(bot);
            bot.handler = function(update: any) {
              // Log ALL updates to see what's coming in
              console.log('[Telegram Chat ID Capture] 📥 Handler called with update type:', update?.update_id ? 'update_id: ' + update.update_id : 'no update_id');
              console.log('[Telegram Chat ID Capture] Update keys:', Object.keys(update || {}));
              
              // Try to extract chat ID from update
              const chatId = update?.message?.chat?.id || 
                            update?.callback_query?.message?.chat?.id ||
                            update?.edited_message?.chat?.id ||
                            update?.channel_post?.chat?.id;
              const messageText = update?.message?.text || 
                                 update?.edited_message?.text || 
                                 update?.callback_query?.data ||
                                 '';
              
              console.log('[Telegram Chat ID Capture] Extracted chatId:', chatId, 'messageText:', messageText?.substring(0, 50) || '(empty)');
              
              if (chatId && messageText) {
                console.log('[Telegram Chat ID Capture] ✅ Captured chat ID from handler:', chatId, 'for message:', messageText.substring(0, 50));
                (global as any).__telegramChatIdMap = (global as any).__telegramChatIdMap || new Map();
                (global as any).__telegramChatIdMap.set(messageText, String(chatId));
                console.log('[Telegram Chat ID Capture] Stored in map. Map size:', (global as any).__telegramChatIdMap.size);
                
                // Also store it with a longer timeout (60 seconds) to ensure it's available for responses
                setTimeout(() => {
                  (global as any).__telegramChatIdMap?.delete(messageText);
                }, 60000);
              } else if (chatId) {
                console.log('[Telegram Chat ID Capture] ⚠️ Chat ID found but no message text. ChatId:', chatId);
              } else {
                console.log('[Telegram Chat ID Capture] ⚠️ No chat ID found in update');
              }
              
              // Wrap in try-catch to handle database errors gracefully
              try {
                console.log('[Telegram Chat ID Capture] Calling original handler...');
                const result = originalHandler(update);
                console.log('[Telegram Chat ID Capture] Original handler returned');
                return result;
              } catch (error: any) {
                console.error('[Telegram Chat ID Capture] ❌ Error in message handler:', error);
                console.error('[Telegram Chat ID Capture] Error stack:', error.stack);
                // If it's a database error and we have a chat ID, send a fallback response
                if (chatId && (error.code === 'ETIMEDOUT' || error.message?.includes('timeout') || error.message?.includes('database'))) {
                  console.log('[Telegram Chat ID Capture] Database error detected, sending fallback response to chat:', chatId);
                  bot.telegram.sendMessage(chatId, "I'm experiencing some technical difficulties right now. Please try again in a moment! 🔧").catch((err: any) => {
                    console.error('[Telegram Chat ID Capture] Failed to send fallback response:', err);
                  });
                }
                throw error; // Re-throw to let ElizaOS handle it
              }
            };
            console.log('[Telegram Chat ID Capture] Patched bot.handler to capture chat IDs');
          }
          
          // Also patch handleError to catch database errors and send fallback responses
          if (bot && bot.handleError) {
            console.log('[Telegram Chat ID Capture] Found bot.handleError, patching to send fallback responses on database errors...');
            const originalHandleError = bot.handleError.bind(bot);
            bot.handleError = async function(error: any, ctx: any) {
              console.error('[Telegram Chat ID Capture] Error in bot.handleError:', error);
              
              // Check if it's a database timeout error
              const isDatabaseError = error.code === 'ETIMEDOUT' || 
                                     error.message?.includes('timeout') || 
                                     error.message?.includes('database') ||
                                     error.message?.includes('getAccountById') ||
                                     error.message?.includes('getRoom') ||
                                     error.message?.includes('Circuit breaker');
              
              if (isDatabaseError && ctx && ctx.chat) {
                const chatId = ctx.chat.id;
                console.log('[Telegram Chat ID Capture] Database error detected in handleError, sending fallback response to chat:', chatId);
                try {
                  await bot.telegram.sendMessage(chatId, "I'm experiencing some technical difficulties with the database. Please try again in a moment! 🔧");
                  console.log('[Telegram Chat ID Capture] ✅ Sent fallback response');
                } catch (sendError: any) {
                  console.error('[Telegram Chat ID Capture] Failed to send fallback response:', sendError);
                }
              }
              
              // Call original error handler
              return originalHandleError(error, ctx);
            };
            console.log('[Telegram Chat ID Capture] Patched bot.handleError');
          }
          
          // Also try to patch bot.telegram.sendMessage to intercept all outgoing messages
          // This is critical: we need to block duplicate messages that might bypass createMemory
          if (bot && bot.telegram && bot.telegram.sendMessage) {
            console.log('[Telegram Chat ID Capture] Found bot.telegram.sendMessage, patching to block duplicates after action execution...');
            const originalSendMessage = bot.telegram.sendMessage.bind(bot.telegram);
            bot.telegram.sendMessage = async function(chatId: any, text: string, extra?: any) {
              console.log('[Telegram Chat ID Capture] sendMessage called with chatId:', chatId, 'text:', text?.substring(0, 50));
              
              // CRITICAL: Check if this message should be blocked due to recent action execution
              // This catches messages that might bypass createMemory
              const { getRoomIdForChatId, checkActionExecutedRecently, getLastAgentMessageTime } = await import('./services/llmResponseInterceptor.js');
              
              // Find roomId for this chatId
              const roomIdToCheck = getRoomIdForChatId(chatId);
              console.log(`[Telegram Chat ID Capture] 📤 sendMessage called - chatId: ${chatId}, roomId: ${roomIdToCheck || 'NOT FOUND'}, text: ${text?.substring(0, 50) || '(empty)'}`);
              
              if (roomIdToCheck && text && text.trim()) {
                // Check if action was executed recently (using 10 second window to match interceptor)
                console.log(`[Telegram Chat ID Capture] 🔍 Checking action execution for roomId: ${roomIdToCheck}`);
                if (checkActionExecutedRecently(roomIdToCheck)) {
                  console.log('[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage - action was executed recently, preventing duplicate');
                  console.log(`[Telegram Chat ID Capture] Blocked text: ${text.substring(0, 50)}`);
                  // Return a fake result to prevent sending
                  return { message_id: 0, date: Date.now(), chat: { id: chatId } };
                }
                
                // Also check if another agent message was sent very recently (rapid consecutive blocking)
                const lastAgentMessageTime = getLastAgentMessageTime(roomIdToCheck);
                console.log(`[Telegram Chat ID Capture] 🔍 Checking rapid consecutive message for roomId: ${roomIdToCheck}`);
                console.log(`[Telegram Chat ID Capture] Last agent message time: ${lastAgentMessageTime || 'NOT FOUND'}`);
                if (lastAgentMessageTime) {
                  const elapsed = Date.now() - lastAgentMessageTime;
                  const AGENT_MESSAGE_BLOCK_WINDOW_MS = 10000; // 10 seconds - increased to catch "No action found" follow-ups
                  console.log(`[Telegram Chat ID Capture] 🔍 Checking rapid consecutive message - elapsed: ${elapsed}ms, window: ${AGENT_MESSAGE_BLOCK_WINDOW_MS}ms`);
                  if (elapsed < AGENT_MESSAGE_BLOCK_WINDOW_MS) {
                    console.log(`[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage - another agent message was sent ${elapsed}ms ago (window: ${AGENT_MESSAGE_BLOCK_WINDOW_MS}ms), preventing duplicate`);
                    console.log(`[Telegram Chat ID Capture] Blocked text: ${text.substring(0, 50)}`);
                    console.log(`[Telegram Chat ID Capture] This is likely the "No action found" follow-up response - blocking to prevent duplicate`);
                    // Return a fake result to prevent sending
                    return { message_id: 0, date: Date.now(), chat: { id: chatId } };
                  } else {
                    console.log(`[Telegram Chat ID Capture] ✅ Rapid consecutive check passed - elapsed (${elapsed}ms) > window (${AGENT_MESSAGE_BLOCK_WINDOW_MS}ms)`);
                  }
                } else {
                  console.log(`[Telegram Chat ID Capture] ⚠️ No previous agent message timestamp found for roomId: ${roomIdToCheck}`);
                  console.log(`[Telegram Chat ID Capture] This is the FIRST agent message for this roomId - allowing`);
                }
                console.log(`[Telegram Chat ID Capture] ✅ All checks passed, allowing sendMessage`);
              } else {
                console.log(`[Telegram Chat ID Capture] ⚠️ Skipping checks - roomId: ${roomIdToCheck || 'missing'}, text: ${text ? 'present' : 'missing'}`);
              }
              
              try {
                const result = await originalSendMessage(chatId, text, extra);
                console.log('[Telegram Chat ID Capture] ✅ Message sent successfully via sendMessage');
                return result;
              } catch (error: any) {
                console.error('[Telegram Chat ID Capture] ❌ Error in sendMessage:', error.message);
                throw error;
              }
            };
            console.log('[Telegram Chat ID Capture] Patched bot.telegram.sendMessage');
          }
          
          // Also try patching bot.on to catch all events - but be less intrusive
          // Just log when events are registered, don't wrap handlers (that might break things)
          if (bot && typeof bot.on === 'function') {
            console.log('[Telegram Chat ID Capture] Patching bot.on to log event registration...');
            const originalOn = bot.on.bind(bot);
            bot.on = function(event: string, ...handlers: any[]) {
              console.log(`[Telegram Chat ID Capture] 📋 Event registered: ${event}, handlers: ${handlers.length}`);
              
              // For message events, also try to capture chat ID from the handler when it's called
              // But don't wrap the handler - just register it normally and let Telegraf handle it
              if (event === 'message' || event === 'text') {
                console.log(`[Telegram Chat ID Capture] Message event registered - handlers will be called by Telegraf`);
              }
              
              // Call original to register handlers normally - don't wrap them
              return originalOn(event, ...handlers);
            };
            console.log('[Telegram Chat ID Capture] Patched bot.on to log event registration');
          } else {
            console.log('[Telegram Chat ID Capture] Could not find bot.on method. bot:', bot);
          }
        } else {
          console.log('[Telegram Chat ID Capture] Telegram client is null or undefined');
        }
    } catch (error: any) {
        console.error('❌ Failed to start Telegram client:', error);
    }
  }

  console.log('Kaia, MoonDAO, and SI<3> runtimes started.');
  
  // Start Scheduler
  startFollowUpScheduler(kaiaRuntime);
}

// Add global error handlers to catch unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  const errorMessage = reason?.message || reason?.toString() || 'Unknown error';
  const errorCode = reason?.code || '';
  
  // Check if it's a database connection error
  const isDatabaseError = 
    errorCode === 'ETIMEDOUT' ||
    errorCode === 'ENETUNREACH' ||
    errorMessage.toLowerCase().includes('failed to connect') ||
    errorMessage.toLowerCase().includes('database') ||
    errorMessage.toLowerCase().includes('testconnection');
  
  if (isDatabaseError) {
    console.error('⚠️ Unhandled database error (non-fatal):', errorMessage);
    console.error('⚠️ Bot will continue running but database features may be unavailable');
    // Don't exit - allow bot to continue
  } else {
    console.error('❌ Unhandled promise rejection:', reason);
    console.error('⚠️ This may cause the bot to be unstable');
    // Don't exit immediately - let the bot try to recover
  }
});

process.on('uncaughtException', (error: Error) => {
  const errorMessage = error.message || error.toString();
  const errorCode = (error as any)?.code || '';
  
  // Check if it's a database connection error
  const isDatabaseError = 
    errorCode === 'ETIMEDOUT' ||
    errorCode === 'ENETUNREACH' ||
    errorMessage.toLowerCase().includes('failed to connect') ||
    errorMessage.toLowerCase().includes('database') ||
    errorMessage.toLowerCase().includes('testconnection');
  
  if (isDatabaseError) {
    console.error('⚠️ Uncaught database exception (non-fatal):', errorMessage);
    console.error('⚠️ Bot will continue running but database features may be unavailable');
    // Don't exit - allow bot to continue
  } else {
    console.error('❌ Uncaught exception:', error);
    console.error('⚠️ This may cause the bot to be unstable');
    // For non-database errors, we might want to exit, but let's be conservative
    // and only exit if it's a critical error
    if (!errorMessage.toLowerCase().includes('database')) {
      console.error('❌ Critical error detected, exiting');
      process.exit(1);
    }
  }
});

startAgents().catch((err) => {
  console.error('Failed to start agents', err);
  // Check if it's a database error - if so, don't exit
  const errorMessage = err?.message || err?.toString() || '';
  const isDatabaseError = errorMessage.toLowerCase().includes('database') || 
                         errorMessage.toLowerCase().includes('failed to connect');
  
  if (!isDatabaseError) {
    process.exit(1);
  } else {
    console.error('⚠️ Database error during startup, but continuing...');
  }
});
