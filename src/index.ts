// Note: Error interceptors are set up in bootstrap.ts which runs before this file is imported
import 'dotenv/config';
import {
  AgentRuntime,
  CacheManager,
  ModelProviderName
} from '@elizaos/core';
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
import { createFeatureRequestPlugin } from './plugins/featureRequest/index.js';
import { createKnowledgePlugin } from './plugins/knowledge/index.js';
import { DatabaseCacheAdapter } from './adapters/dbCache.js';
import { createDatabaseAdapter, DatabaseAdapter } from './adapters/databaseAdapter.js';

// ==================== REAL-TIME MATCH NOTIFICATION (TINDER-STYLE) ====================
// This function checks for matches when a new user completes onboarding and notifies both parties
async function checkForNewMatches(
  newUserId: string, 
  newUserProfile: any, 
  newUserChatId: string | number,
  sendMessage: (chatId: string | number, text: string) => Promise<any>
) {
  console.log('[Real-Time Matching] 🔍 Checking for matches for new user:', newUserProfile.name);
  
  if (!kaiaRuntimeForOnboardingCheck) {
    console.log('[Real-Time Matching] No runtime available');
    return;
  }
  
  const db = kaiaRuntimeForOnboardingCheck.databaseAdapter as any;
  if (!db || !db.query) {
    console.log('[Real-Time Matching] No database adapter');
    return;
  }
  
  const newUserInterests = newUserProfile.interests || [];
  const newUserRoles = newUserProfile.roles || [];
  const newUserGoals = newUserProfile.connectionGoals || [];
  
  if (newUserInterests.length === 0 && newUserRoles.length === 0) {
    console.log('[Real-Time Matching] New user has no interests/roles');
    return;
  }
  
  try {
    // Get all completed profiles
    const res = await db.query(`SELECT key, value FROM cache WHERE key LIKE 'onboarding_%'`);
    
    for (const row of (res.rows || [])) {
      const otherUserId = row.key.replace('onboarding_', '');
      if (otherUserId === newUserId) continue;
      
      try {
        const otherState = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        if (otherState.step !== 'COMPLETED' || !otherState.profile) continue;
        if (otherState.profile.notifications !== 'Yes') continue; // Only notify users who opted in
        
        const otherInterests = otherState.profile.interests || [];
        const otherRoles = otherState.profile.roles || [];
        const otherGoals = otherState.profile.connectionGoals || [];
        
        // Find common interests
        const commonInterests = newUserInterests.filter((i: string) => 
          otherInterests.some((oi: string) => oi.toLowerCase().includes(i.toLowerCase()))
        );
        
        // Find complementary goals (one looking for what the other offers)
        const complementaryMatch = 
          (newUserGoals.some((g: string) => g.toLowerCase().includes('invest')) && otherRoles.some((r: string) => r.toLowerCase().includes('founder'))) ||
          (otherGoals.some((g: string) => g.toLowerCase().includes('invest')) && newUserRoles.some((r: string) => r.toLowerCase().includes('founder'))) ||
          (newUserGoals.some((g: string) => g.toLowerCase().includes('growth') || g.toLowerCase().includes('marketing')) && otherRoles.some((r: string) => r.toLowerCase().includes('marketing'))) ||
          (otherGoals.some((g: string) => g.toLowerCase().includes('growth') || g.toLowerCase().includes('marketing')) && newUserRoles.some((r: string) => r.toLowerCase().includes('marketing')));
        
        if (commonInterests.length >= 2 || complementaryMatch) {
          const matchReason = commonInterests.length >= 2 
            ? `Shared interests: ${commonInterests.slice(0, 3).join(', ')}`
            : 'Complementary goals - potential collaboration!';
          
          console.log(`[Real-Time Matching] 🎉 Found match: ${newUserProfile.name} <-> ${otherState.profile.name}`);
          
          // Notify the existing user about the new match
          const otherUserLang = otherState.profile.language || 'en';
          const notificationMessages: Record<string, string> = {
            en: `🎉 New match alert!\n\nI found someone who might be a great connection for you:\n\n${newUserProfile.name} from ${newUserProfile.location || 'the community'}\nRoles: ${newUserRoles.join(', ') || 'Not specified'}\nInterests: ${newUserInterests.slice(0, 3).join(', ') || 'Not specified'}\n${newUserProfile.telegramHandle ? `Telegram: @${newUserProfile.telegramHandle}` : ''}\n\n💡 ${matchReason}\n\nSay "find me a match" for more connections! 🤝`,
            es: `🎉 ¡Nueva conexión encontrada!\n\nEncontré a alguien que podría ser una gran conexión para ti:\n\n${newUserProfile.name} de ${newUserProfile.location || 'la comunidad'}\nRoles: ${newUserRoles.join(', ') || 'No especificado'}\nIntereses: ${newUserInterests.slice(0, 3).join(', ') || 'No especificado'}\n${newUserProfile.telegramHandle ? `Telegram: @${newUserProfile.telegramHandle}` : ''}\n\n💡 ${matchReason}\n\n¡Di "encuéntrame una conexión" para más! 🤝`,
            pt: `🎉 Nova conexão encontrada!\n\nEncontrei alguém que pode ser uma ótima conexão para você:\n\n${newUserProfile.name} de ${newUserProfile.location || 'a comunidade'}\nFunções: ${newUserRoles.join(', ') || 'Não especificado'}\nInteresses: ${newUserInterests.slice(0, 3).join(', ') || 'Não especificado'}\n${newUserProfile.telegramHandle ? `Telegram: @${newUserProfile.telegramHandle}` : ''}\n\n💡 ${matchReason}\n\nDiga "encontre uma conexão" para mais! 🤝`,
            fr: `🎉 Nouvelle connexion trouvée!\n\nJ'ai trouvé quelqu'un qui pourrait être une excellente connexion pour vous:\n\n${newUserProfile.name} de ${newUserProfile.location || 'la communauté'}\nRôles: ${newUserRoles.join(', ') || 'Non spécifié'}\nIntérêts: ${newUserInterests.slice(0, 3).join(', ') || 'Non spécifié'}\n${newUserProfile.telegramHandle ? `Telegram: @${newUserProfile.telegramHandle}` : ''}\n\n💡 ${matchReason}\n\nDites "trouve-moi une connexion" pour plus! 🤝`
          };
          
          // Send notification to existing user via Telegram
          const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
          if (telegramToken) {
            try {
              await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: otherUserId,
                  text: notificationMessages[otherUserLang] || notificationMessages.en
                })
              });
              console.log(`[Real-Time Matching] ✅ Notified ${otherState.profile.name} about new match`);
            } catch (notifyErr) {
              console.log(`[Real-Time Matching] Could not notify ${otherState.profile.name}:`, notifyErr);
            }
          }
        }
      } catch (e) { /* skip invalid entries */ }
    }
  } catch (error) {
    console.error('[Real-Time Matching] Error:', error);
  }
}

// Variable to store Kaia runtime for match checking
let kaiaRuntimeForOnboardingCheck: any = null;

async function runMigrations(db: DatabaseAdapter) {
  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  console.log(`Running database migrations for ${databaseType}...`);
  
  try {
    if (databaseType === 'mongodb' || databaseType === 'mongo') {
      // MongoDB migrations - collections are created automatically, just ensure indexes exist
      // Use query method to create indexes via CREATE INDEX statements
      try {
        // Create indexes for matches collection
        await db.query(`CREATE INDEX IF NOT EXISTS idx_matches_user_id ON matches(user_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_matches_matched_user_id ON matches(matched_user_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_matches_room_id ON matches(room_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_matches_match_date ON matches(match_date)`);

        // Create indexes for follow_ups collection
        await db.query(`CREATE INDEX IF NOT EXISTS idx_follow_ups_user_id ON follow_ups(user_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled_for ON follow_ups(scheduled_for)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_follow_ups_status_scheduled ON follow_ups(status, scheduled_for)`);

        // Create indexes for knowledge collection (for vector search)
        await db.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_agent_id ON knowledge(agent_id)`);

        console.log('[Migrations] MongoDB indexes created successfully.');
      } catch (error: any) {
        // Index creation errors are non-fatal in MongoDB
        console.warn('[Migrations] Some MongoDB indexes may already exist:', error.message);
      }
    } else {
      // PostgreSQL migrations (existing code)
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

      console.log('[Migrations] PostgreSQL migrations executed successfully.');
    }
  } catch (error) {
    console.error('Error running migrations:', error);
  }
}

async function createRuntime(character: any) {
  const db = createDatabaseAdapter();
  
  if (character.name === 'Kaia') {
    await runMigrations(db);
  }

  // Use database-backed cache adapter for persistence across restarts
  const agentId = character.id || character.name;
  const cacheManager = new CacheManager(new DatabaseCacheAdapter());
  console.log(`[Runtime] Using DatabaseCacheAdapter for persistent state storage`);

  const plugins = [];
  if (character.plugins?.includes('router')) plugins.push(createRouterPlugin());
  if (character.plugins?.includes('onboarding')) plugins.push(createOnboardingPlugin());
  if (character.plugins?.includes('matching')) plugins.push(createMatchingPlugin());
  plugins.push(createFeatureRequestPlugin()); // Always include feature request plugin
  plugins.push(createKnowledgePlugin()); // Always include knowledge plugin for SI<3> knowledge base

  // Merge character settings with secrets from environment
  const characterWithSecrets = {
    ...character,
    settings: {
      ...character.settings,
      secrets: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      }
    }
  };
  
  const runtime = new AgentRuntime({
    character: characterWithSecrets,
    token: process.env.OPENAI_API_KEY as string,
    modelProvider: ModelProviderName.OPENAI,
    databaseAdapter: db as any, // Cast to any since we're using a compatibility layer
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
      errorStack.includes('MongoAdapter') ||
      errorStack.includes('testConnection') ||
      errorStack.includes('adapter-postgres') ||
      errorStack.includes('mongodb');
    
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

// CRITICAL: Patch Telegraf instances as they're created
// Since ES modules have read-only exports, we can't replace the class directly
// Instead, we'll patch instances when they're created by intercepting the constructor
// We'll store a reference to patch instances globally
let telegrafInstancePatcher: ((instance: any) => Promise<void> | void) | null = null;
// kaiaRuntimeForOnboardingCheck is declared at the top of the file

async function setupTelegrafInstancePatcher() {
  try {
    console.log('[Telegram Chat ID Capture] 🔧 Setting up Telegraf instance patcher...');
    
    // Create the patcher function that will be applied to all instances
    telegrafInstancePatcher = (instance: any) => {
      if (instance.telegram && instance.telegram.sendMessage) {
        const originalSendMessage = instance.telegram.sendMessage.bind(instance.telegram);
        const sendMessageAny = originalSendMessage as any;
        
        if (!sendMessageAny.__patched) {
          instance.telegram.sendMessage = async function(chatId: any, text: string, extra?: any): Promise<any> {
            const sendTime = Date.now();
            console.log(`[Telegram Chat ID Capture] ========== sendMessage INTERCEPTED (INSTANCE PATCHER) ==========`);
            console.log(`[Telegram Chat ID Capture] Timestamp: ${sendTime}`);
            console.log(`[Telegram Chat ID Capture] 📤 sendMessage called - chatId: ${chatId}, text: ${text?.substring(0, 100) || '(empty)'}`);
            
            // NEW: Check if we've already replied to the most recent user message
            // This prevents duplicate replies to the same user message
            try {
              const { getUnrepliedMessages, markMessageAsReplied, hasRepliedToMessage } = await import('./services/messageIdTracker.js');
              const unreplied = getUnrepliedMessages(chatId);
              
              // If there are unreplied messages, check if we've already replied to the most recent one
              if (unreplied.length > 0) {
                const mostRecentMessage = unreplied[unreplied.length - 1];
                const messageId = mostRecentMessage.messageId;
                
                if (hasRepliedToMessage(chatId, messageId)) {
                  console.log(`[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage - already replied to message ${messageId}`);
                  return { message_id: 0, date: Date.now(), chat: { id: chatId } };
                }
                
                // Mark as replied BEFORE sending (prevents race conditions)
                markMessageAsReplied(chatId, messageId);
                console.log(`[Telegram Chat ID Capture] ✅ Marked message ${messageId} as replied before sending`);
              }
            } catch (error) {
              console.error('[Telegram Chat ID Capture] Error checking message ID tracker:', error);
              // Continue with other checks if message ID tracking fails
            }
            
            // CRITICAL: Check if this message should be blocked due to recent action execution
            // Use dynamic import to avoid circular dependency issues
            const interceptorModule = await import('./services/llmResponseInterceptor.js');
            const { getRoomIdForChatId, checkActionExecutedRecently, getLastAgentMessageTime } = interceptorModule;
            
            // Find roomId for this chatId
            const roomIdToCheck = getRoomIdForChatId(String(chatId));
            
            if (roomIdToCheck && text && text.trim()) {
              // CRITICAL: Check if message lock is active (action handler is executing)
              const { isMessageLocked } = await import('./services/llmResponseInterceptor.js');
              if (isMessageLocked(roomIdToCheck)) {
                console.log(`[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage (INSTANCE PATCHER) - message lock is active (action handler executing)`);
                console.log(`[Telegram Chat ID Capture] Blocked text: ${text.substring(0, 100)}`);
                return { message_id: 0, date: Date.now(), chat: { id: chatId } };
              }
              
              // CRITICAL: Block LLM responses during onboarding steps (except CONFIRMATION)
              // The action handler sends all onboarding messages, so LLM should not respond
              // Action handler messages are sent immediately after action execution (within 1 second)
              // Use synchronous cache for fast checking
              try {
                const { getUserIdForRoomId, getOnboardingStepFromCache } = await import('./services/llmResponseInterceptor.js');
                const userId = getUserIdForRoomId(roomIdToCheck);
                console.log(`[Telegram Chat ID Capture] 🔍 Checking onboarding step - roomId: ${roomIdToCheck}, userId: ${userId || 'NOT FOUND'}`);
                if (userId) {
                  // Try synchronous cache first (fast)
                  let onboardingStep = getOnboardingStepFromCache?.(userId);
                  console.log(`[Telegram Chat ID Capture] 🔍 Onboarding step from cache: ${onboardingStep || 'NOT FOUND'}`);
                  
                  // If cache miss, do async check (slower, but fallback)
                  if (!onboardingStep && kaiaRuntimeForOnboardingCheck) {
                    const { getOnboardingStep } = await import('./plugins/onboarding/utils.js');
                    onboardingStep = await getOnboardingStep(kaiaRuntimeForOnboardingCheck, userId as any);
                    console.log(`[Telegram Chat ID Capture] 🔍 Onboarding step from async check: ${onboardingStep || 'NOT FOUND'}`);
                  }
                  
                  if (onboardingStep && onboardingStep !== 'COMPLETED' && onboardingStep !== 'CONFIRMATION' && onboardingStep !== 'NONE') {
                    console.log(`[Telegram Chat ID Capture] 🔍 User is in onboarding step: ${onboardingStep}, checking if this is action handler message...`);
                    // During onboarding, only action handler messages should be sent
                    // Action handler messages are sent within 1 second of action execution
                    // All other messages during onboarding are LLM responses and should be blocked
                    const actionWasRecent = checkActionExecutedRecently(roomIdToCheck);
                    let isActionHandlerMessage = false;
                    
                    if (actionWasRecent) {
                      const { getActionExecutionTime } = await import('./services/llmResponseInterceptor.js');
                      const actionExecutionTime = getActionExecutionTime?.(roomIdToCheck);
                      if (actionExecutionTime) {
                        const elapsed = Date.now() - actionExecutionTime;
                        const ACTION_HANDLER_WINDOW_MS = 1000; // 1 second
                        if (elapsed < ACTION_HANDLER_WINDOW_MS) {
                          // This is likely an action handler callback - allow it
                          isActionHandlerMessage = true;
                          console.log(`[Telegram Chat ID Capture] ✅ ALLOWING sendMessage (INSTANCE PATCHER) - action handler message during onboarding (${elapsed}ms after action)`);
                        }
                      }
                    }
                    
                    if (!isActionHandlerMessage) {
                      // This is an LLM response during onboarding, block it
                      console.log(`[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage (INSTANCE PATCHER) - LLM response during onboarding step: ${onboardingStep}`);
                      console.log(`[Telegram Chat ID Capture] Blocked text: ${text.substring(0, 100)}`);
                      return { message_id: 0, date: Date.now(), chat: { id: chatId } };
                    }
                  }
                }
              } catch (error) {
                console.error('[Telegram Chat ID Capture] Error checking onboarding step:', error);
                // Continue with other checks if onboarding check fails
              }
              
              // CRITICAL: Check for EXACT duplicate content first
              const dedupModule = await import('./services/messageDeduplication.js');
              const { isDuplicateMessage } = dedupModule;
              if (isDuplicateMessage(null as any, roomIdToCheck, text)) {
                console.log('[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage (INSTANCE PATCHER) - EXACT DUPLICATE CONTENT detected');
                console.log(`[Telegram Chat ID Capture] Blocked duplicate text: ${text.substring(0, 100)}`);
                return { message_id: 0, date: Date.now(), chat: { id: chatId } };
              }
              
              // Check if action was executed recently
              // BUT: Allow messages sent within 1 second of action execution - these are likely action handler callbacks
              // Action handler callbacks are sent immediately after action execution and should be allowed
              const actionWasRecent = checkActionExecutedRecently(roomIdToCheck);
              if (actionWasRecent) {
                // Get the action execution timestamp to check how recent it was
                const { getActionExecutionTime } = await import('./services/llmResponseInterceptor.js');
                const actionExecutionTime = getActionExecutionTime?.(roomIdToCheck);
                if (actionExecutionTime) {
                  const elapsed = Date.now() - actionExecutionTime;
                  const ACTION_HANDLER_WINDOW_MS = 1000; // 1 second - action handler callbacks are sent immediately
                  if (elapsed < ACTION_HANDLER_WINDOW_MS) {
                    console.log(`[Telegram Chat ID Capture] ✅ ALLOWING sendMessage (INSTANCE PATCHER) - sent ${elapsed}ms after action execution (likely action handler callback)`);
                    // Allow this message - it's likely from an action handler callback
                  } else {
                    console.log('[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage (INSTANCE PATCHER) - action was executed recently, preventing duplicate');
                    console.log(`[Telegram Chat ID Capture] Blocked text: ${text.substring(0, 100)}`);
                    return { message_id: 0, date: Date.now(), chat: { id: chatId } };
                  }
                } else {
                  console.log('[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage (INSTANCE PATCHER) - action was executed recently, preventing duplicate');
                  console.log(`[Telegram Chat ID Capture] Blocked text: ${text.substring(0, 100)}`);
                  return { message_id: 0, date: Date.now(), chat: { id: chatId } };
                }
              }
              
              // Check for rapid consecutive messages
              const lastAgentMessageTime = getLastAgentMessageTime(roomIdToCheck);
              if (lastAgentMessageTime) {
                const elapsed = Date.now() - lastAgentMessageTime;
                const AGENT_MESSAGE_BLOCK_WINDOW_MS = 10000;
                if (elapsed < AGENT_MESSAGE_BLOCK_WINDOW_MS) {
                  console.log(`[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage (INSTANCE PATCHER) - another agent message was sent ${elapsed}ms ago, preventing duplicate`);
                  console.log(`[Telegram Chat ID Capture] Blocked text: ${text.substring(0, 100)}`);
                  return { message_id: 0, date: Date.now(), chat: { id: chatId } };
                }
              }
              
              // Record this message as sent
              const dedupModule2 = await import('./services/messageDeduplication.js');
              const { recordMessageSent } = dedupModule2;
              recordMessageSent(roomIdToCheck, text);
            }
            
            // Call original method
            return originalSendMessage.call(this, chatId, text, extra);
          };
          (instance.telegram.sendMessage as any).__patched = true;
          console.log('[Telegram Chat ID Capture] ✅ Patched sendMessage on Telegraf instance');
        }
      }
    };
    
    console.log('[Telegram Chat ID Capture] ✅ Telegraf instance patcher ready');
  } catch (error: any) {
    console.error('[Telegram Chat ID Capture] ❌ Failed to setup Telegraf instance patcher:', error.message);
  }
}

// Export the patcher so it can be used in llmResponseInterceptor
export { telegrafInstancePatcher };

// Note: console.error interceptor is set up in bootstrap.ts

async function startAgents() {
  // CRITICAL: Setup Telegraf instance patcher BEFORE creating any runtimes or clients
  await setupTelegrafInstancePatcher();
  
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

  // REST API (History + Chat)
  const app = express();
  
  // CORS middleware - Allow cross-origin requests for web integration
  const corsOrigins = (process.env.CORS_ORIGINS || '*').split(',').map(o => o.trim());
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (corsOrigins.includes('*') || (origin && corsOrigins.includes(origin))) {
      res.header('Access-Control-Allow-Origin', origin || '*');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
  
  app.use(express.json());
  
  // Web Chat API - POST /api/chat
  // Allows web applications to interact with Kaia
  app.post('/api/chat', async (req, res) => {
    try {
      const { processWebChatMessage, validateApiKey } = await import('./services/webChatApi.js');
      
      // Get API key from header or body
      const apiKey = req.headers['x-api-key'] as string || req.headers['authorization']?.replace('Bearer ', '') || req.body.apiKey;
      const webApiKey = process.env.WEB_API_KEY;
      
      // Validate API key if one is configured
      if (webApiKey && webApiKey !== 'disabled') {
        if (!apiKey || !validateApiKey(apiKey)) {
          return res.status(401).json({
            success: false,
            error: 'Invalid or missing API key. Provide via X-API-Key header or Authorization: Bearer <key>'
          });
        }
      }
      
      const { userId, message } = req.body;
      
      if (!userId || !message) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: userId and message'
        });
      }
      
      // Process the chat message
      const result = await processWebChatMessage(kaiaRuntime, userId, message);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error: any) {
      console.error('[API] Chat error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  });
  
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'kaia-bot',
      timestamp: new Date().toISOString(),
      endpoints: {
        chat: 'POST /api/chat',
        history: 'GET /api/history/:userId',
        health: 'GET /api/health',
        metrics: 'GET /api/metrics'
      }
    });
  });
  
  // Metrics API - Agent analytics for dashboard integration
  app.get('/api/metrics', async (req, res) => {
    try {
      // Optional API key authentication
      const apiKey = process.env.WEB_API_KEY;
      if (apiKey && apiKey !== 'disabled') {
        const providedKey = req.headers['x-api-key'] || 
                           req.headers['authorization']?.replace('Bearer ', '');
        if (providedKey !== apiKey) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }
      
      // Optional date range filtering
      const startDate = req.query.startDate 
        ? new Date(req.query.startDate as string)
        : undefined;
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined;
      
      if (startDate && isNaN(startDate.getTime())) {
        return res.status(400).json({ error: 'Invalid startDate format. Use ISO 8601 (YYYY-MM-DD)' });
      }
      if (endDate && isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'Invalid endDate format. Use ISO 8601 (YYYY-MM-DD)' });
      }
      
      const { getAgentMetrics } = await import('./services/metricsApi.js');
      const metrics = await getAgentMetrics(kaiaRuntime, startDate, endDate);
      
      res.json(metrics);
    } catch (error: any) {
      console.error('[Metrics API] Error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch metrics',
        message: error.message 
      });
    }
  });
  
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
      console.log(`[API] REST API available at http://localhost:${directPort + 1}`);
      console.log(`[API] Endpoints:`);
      console.log(`[API]   POST /api/chat - Web chat interface`);
      console.log(`[API]   GET /api/history/:userId - User profile & matches`);
      console.log(`[API]   GET /api/health - Health check`);
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
        
        // Store runtime reference for onboarding step check in sendMessage patcher
        kaiaRuntimeForOnboardingCheck = kaiaRuntime;
        
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
            
            // CRITICAL: Delete any existing webhook before starting polling
            // If a webhook is set, polling won't work
            try {
              const botToken = process.env.TELEGRAM_BOT_TOKEN;
              if (botToken) {
                const webhookInfo = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
                const webhookData = await webhookInfo.json();
                if (webhookData.ok && webhookData.result.url) {
                  console.log('[Telegram Client] ⚠️ Webhook detected, deleting it to enable polling...');
                  console.log('[Telegram Client] Webhook URL:', webhookData.result.url);
                  const deleteResponse = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ drop_pending_updates: true })
                  });
                  const deleteResult = await deleteResponse.json();
                  if (deleteResult.ok) {
                    console.log('[Telegram Client] ✅ Webhook deleted successfully');
                  } else {
                    console.error('[Telegram Client] ⚠️ Failed to delete webhook:', deleteResult.description);
                  }
                } else {
                  console.log('[Telegram Client] ✅ No webhook set (polling can work)');
                }
              }
            } catch (webhookError: any) {
              console.error('[Telegram Client] ⚠️ Error checking/deleting webhook:', webhookError.message);
              // Continue anyway - might still work
            }
            
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
                
                // Set bot profile picture if character has an image
                if (kaiaCharacter.image && process.env.TELEGRAM_BOT_TOKEN) {
                  try {
                    const { setProfilePictureFromCharacter } = await import('./services/botProfilePicture.js');
                    await setProfilePictureFromCharacter(process.env.TELEGRAM_BOT_TOKEN, kaiaCharacter.image);
                    console.log('[Telegram Client] ✅ Bot profile picture set successfully');
                  } catch (profileError: any) {
                    console.warn('[Telegram Client] ⚠️ Could not set profile picture:', profileError.message);
                    console.warn('[Telegram Client] This is non-critical - bot will continue without profile picture update');
                  }
                }
              } catch (error: any) {
                console.error('[Telegram Client] ⚠️ Could not verify bot connection:', error.message);
              }
              
              // Check if bot is polling (Telegraf uses polling by default)
              if (bot.polling) {
                console.log('[Telegram Client] ✅ Bot is using polling mode');
                const pollingStatus = bot.polling?.isRunning ? 'RUNNING' : 'NOT RUNNING';
                console.log('[Telegram Client] Polling status:', pollingStatus);
                if (pollingStatus === 'NOT RUNNING') {
                  console.error('[Telegram Client] ❌ CRITICAL: Polling is NOT RUNNING - bot will not receive messages!');
                  console.error('[Telegram Client] This is likely why messages are not being received');
                }
              } else if (bot.webhookReply) {
                console.log('[Telegram Client] ⚠️ Bot might be using webhook mode (not polling)');
              } else {
                console.log('[Telegram Client] ⚠️ Could not determine bot connection mode');
                // Try to check if bot has a launch method or polling property
                console.log('[Telegram Client] Bot properties:', Object.keys(bot).slice(0, 20).join(', '));
              }
              
              // Log bot options to see polling/webhook settings
              if (bot.options) {
                console.log('[Telegram Client] Bot options:', JSON.stringify(bot.options, null, 2).substring(0, 200));
              }
              
              // Minimal check: if polling isn't running, log and rely on Telegraf's own polling loop.
              if (bot.polling?.isRunning) {
                console.log('[Telegram Client] ✅ Polling already running; skipping extra getUpdates to avoid 409 conflicts');
              } else {
                console.error('[Telegram Client] ⚠️ Polling not running; ensure only one bot instance is active for this token');
                console.error('[Telegram Client] ⚠️ If issue persists, rotate token and redeploy a single pod');
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
            bot.handler = async function(update: any) {
              // Log ALL updates to see what's coming in
              console.log('[Telegram Chat ID Capture] 📥 Handler called with update type:', update?.update_id ? 'update_id: ' + update.update_id : 'no update_id');
              console.log('[Telegram Chat ID Capture] Update keys:', Object.keys(update || {}));
              
              // Try to extract chat ID and message ID from update
              const chatId = update?.message?.chat?.id || 
                            update?.callback_query?.message?.chat?.id ||
                            update?.edited_message?.chat?.id ||
                            update?.channel_post?.chat?.id;
              const messageId = update?.message?.message_id ||
                               update?.edited_message?.message_id ||
                               update?.callback_query?.message?.message_id;
              const messageText = update?.message?.text || 
                                 update?.edited_message?.text || 
                                 update?.callback_query?.data ||
                                 '';
              
              console.log('[Telegram Chat ID Capture] Extracted chatId:', chatId, 'messageId:', messageId, 'messageText:', messageText?.substring(0, 50) || '(empty)');
              
              // Record user message ID for tracking
              if (chatId && messageId && messageText) {
                try {
                  const { recordUserMessage } = await import('./services/messageIdTracker.js');
                  // We need roomId - try to get it from the update or use chatId temporarily
                  // The roomId will be set properly when the message is processed by ElizaOS
                  const roomId = String(chatId); // Use chatId as roomId initially
                  recordUserMessage(chatId, messageId, roomId);
                } catch (error) {
                  console.error('[Telegram Chat ID Capture] Error recording user message:', error);
                }
              }
              
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
              
              // DIRECT HANDLER: Skip ElizaOS and use our custom implementation
              // ElizaOS was causing silent failures - this is simpler and more reliable
              const originalSendMessage = bot.telegram.sendMessage.bind(bot.telegram);
              
              if (chatId && messageText) {
                console.log('[Kaia Handler] 💜 Processing message directly (ElizaOS bypassed)');
                try {
                  const openaiKey = process.env.OPENAI_API_KEY;
                  if (openaiKey && kaiaRuntimeForOnboardingCheck) {
                      // Use cache-only state management to avoid database issues
                      const { getMessages } = await import('./plugins/onboarding/translations.js');
                      
                      const userId = update.message?.from?.id?.toString() || chatId;
                      
                      // Get state from cache first, then database (for persistence across deployments)
                      let state: { step: string, profile: any } = { step: 'NONE', profile: {} };
                      try {
                        const cached = await kaiaRuntimeForOnboardingCheck.cacheManager.get(`onboarding_${userId}`);
                        if (cached && typeof cached === 'object') {
                          state = cached as { step: string, profile: any };
                          console.log('[Telegram Chat ID Capture] 📋 Loaded state from cache');
                        } else {
                          // Cache miss - try database
                          const db = kaiaRuntimeForOnboardingCheck.databaseAdapter as any;
                          if (db && db.query) {
                            // PostgreSQL
                            const result = await db.query(
                              `SELECT value FROM cache WHERE key = $1`,
                              [`onboarding_${userId}`]
                            );
                            if (result.rows && result.rows.length > 0) {
                              const dbValue = typeof result.rows[0].value === 'string' 
                                ? JSON.parse(result.rows[0].value) 
                                : result.rows[0].value;
                              if (dbValue && typeof dbValue === 'object') {
                                state = dbValue;
                                // Restore to cache for faster access
                                await kaiaRuntimeForOnboardingCheck.cacheManager.set(`onboarding_${userId}`, state);
                                console.log('[Telegram Chat ID Capture] 💾 Loaded state from database and restored to cache');
                              }
                            }
                          } else if (db && db.getDb) {
                            // MongoDB
                            const mongoDb = await db.getDb();
                            const cacheCollection = mongoDb.collection('cache');
                            const dbDoc = await cacheCollection.findOne({ key: `onboarding_${userId}` });
                            if (dbDoc && dbDoc.value) {
                              state = typeof dbDoc.value === 'string' ? JSON.parse(dbDoc.value) : dbDoc.value;
                              // Restore to cache for faster access
                              await kaiaRuntimeForOnboardingCheck.cacheManager.set(`onboarding_${userId}`, state);
                              console.log('[Telegram Chat ID Capture] 💾 Loaded state from MongoDB and restored to cache');
                            }
                          }
                        }
                      } catch (cacheErr) {
                        console.log('[Telegram Chat ID Capture] Cache/database read error, using default state:', cacheErr);
                      }
                      
                      // Helper to update state (cache + database for persistence)
                      const updateState = async (newStep: string, profileUpdate: any = {}) => {
                        const newState = {
                          step: newStep,
                          profile: { ...state.profile, ...profileUpdate }
                        };
                        
                        // Save to cache (fast access)
                        await kaiaRuntimeForOnboardingCheck.cacheManager.set(`onboarding_${userId}`, newState);
                        
                        // CRITICAL: Also persist to database so it survives deployments
                        try {
                          const db = kaiaRuntimeForOnboardingCheck.databaseAdapter as any;
                          if (db && db.query) {
                            // PostgreSQL: Save as JSON in cache table
                            await db.query(
                              `INSERT INTO cache (key, value, created_at, updated_at) 
                               VALUES ($1, $2, NOW(), NOW())
                               ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
                              [`onboarding_${userId}`, JSON.stringify(newState)]
                            );
                            console.log('[Telegram Chat ID Capture] 💾 Persisted state to database');
                          } else if (db && db.getDb) {
                            // MongoDB: Save to collection
                            const mongoDb = await db.getDb();
                            const cacheCollection = mongoDb.collection('cache');
                            await cacheCollection.updateOne(
                              { key: `onboarding_${userId}` },
                              { 
                                $set: { 
                                  value: newState,
                                  updated_at: new Date()
                                },
                                $setOnInsert: {
                                  created_at: new Date()
                                }
                              },
                              { upsert: true }
                            );
                            console.log('[Telegram Chat ID Capture] 💾 Persisted state to MongoDB');
                          }
                        } catch (dbError: any) {
                          console.error('[Telegram Chat ID Capture] ⚠️ Could not persist to database:', dbError.message);
                          // Continue even if database save fails - cache is still updated
                        }
                        
                        state = newState;
                        console.log('[Telegram Chat ID Capture] 📋 Updated state to:', newStep);
                      };
                      
                      console.log('[Telegram Chat ID Capture] 📋 Onboarding state:', state.step, JSON.stringify(state.profile));
                      
                      // Handle onboarding flow directly
                      let responseText = '';
                      const lowerText = messageText.toLowerCase().trim();
                      const msgs = getMessages(state.profile.language || 'en');
                      
                      // Check for restart commands
                      const isRestart = lowerText.includes('restart') || lowerText.includes('start over') || lowerText.includes('begin again');
                      
                      // Check for "next" to skip optional questions
                      const isNext = lowerText === 'next' || lowerText === 'skip';
                      
                      if (isRestart || state.step === 'NONE') {
                        // Start/restart onboarding - ask for language
                        await updateState('ASK_LANGUAGE', {});
                        responseText = msgs.LANGUAGE || "What's your preferred language?\n\n1. English\n2. Spanish\n3. Portuguese\n4. French\n\nReply with the number (for example: 1)";
                        console.log('[Telegram Chat ID Capture] 📋 Starting onboarding, asking for language');
                      } else if (state.step === 'ASK_LANGUAGE') {
                        // Process language selection
                        let lang: 'en' | 'es' | 'pt' | 'fr' = 'en';
                        if (lowerText.includes('1') || lowerText.includes('english')) lang = 'en';
                        else if (lowerText.includes('2') || lowerText.includes('español') || lowerText.includes('spanish')) lang = 'es';
                        else if (lowerText.includes('3') || lowerText.includes('português') || lowerText.includes('portuguese')) lang = 'pt';
                        else if (lowerText.includes('4') || lowerText.includes('français') || lowerText.includes('french')) lang = 'fr';
                        
                        await updateState('ASK_NAME', { language: lang });
                        const newMsgs = getMessages(lang);
                        responseText = newMsgs.GREETING;
                        console.log('[Telegram Chat ID Capture] 📋 Language set to:', lang);
                      } else if (state.step === 'ASK_NAME') {
                        // Save name and ask for location
                        await updateState('ASK_LOCATION', { name: messageText.trim() });
                        responseText = msgs.LOCATION;
                        console.log('[Telegram Chat ID Capture] 📋 Name saved:', messageText.trim());
                      } else if (state.step === 'ASK_LOCATION') {
                        // Save location (or skip) and ask for roles
                        const location = isNext ? undefined : messageText.trim();
                        await updateState('ASK_ROLE', { location });
                        responseText = msgs.ROLES;
                        console.log('[Telegram Chat ID Capture] 📋 Location saved:', location || 'skipped');
                      } else if (state.step === 'ASK_ROLE') {
                        // Save roles and ask for interests
                        const roles = messageText.split(',').map((r: string) => r.trim()).filter((r: string) => r);
                        await updateState('ASK_INTERESTS', { roles });
                        responseText = msgs.INTERESTS;
                        console.log('[Telegram Chat ID Capture] 📋 Roles saved:', roles);
                      } else if (state.step === 'ASK_INTERESTS') {
                        // Save interests and ask for connection goals
                        const interests = messageText.split(',').map((r: string) => r.trim()).filter((r: string) => r);
                        await updateState('ASK_CONNECTION_GOALS', { interests });
                        responseText = msgs.GOALS;
                        console.log('[Telegram Chat ID Capture] 📋 Interests saved:', interests);
                      } else if (state.step === 'ASK_CONNECTION_GOALS') {
                        // Save goals and ask for events
                        const connectionGoals = messageText.split(',').map((r: string) => r.trim()).filter((r: string) => r);
                        await updateState('ASK_EVENTS', { connectionGoals });
                        responseText = msgs.EVENTS;
                        console.log('[Telegram Chat ID Capture] 📋 Goals saved:', connectionGoals);
                      } else if (state.step === 'ASK_EVENTS') {
                        // Save events (or skip) and ask for socials
                        const events = isNext ? undefined : messageText.split(',').map((r: string) => r.trim()).filter((r: string) => r);
                        await updateState('ASK_SOCIALS', { events });
                        responseText = msgs.SOCIALS;
                        console.log('[Telegram Chat ID Capture] 📋 Events saved:', events || 'skipped');
                      } else if (state.step === 'ASK_SOCIALS') {
                        // Save socials (or skip) and ask for telegram handle
                        const socials = isNext ? undefined : messageText.split(',').map((r: string) => r.trim()).filter((r: string) => r);
                        await updateState('ASK_TELEGRAM_HANDLE', { socials });
                        responseText = msgs.TELEGRAM;
                        console.log('[Telegram Chat ID Capture] 📋 Socials saved:', socials || 'skipped');
                      } else if (state.step === 'ASK_TELEGRAM_HANDLE') {
                        // Save telegram handle and ask for gender
                        const telegramHandle = messageText.trim().replace('@', '');
                        await updateState('ASK_GENDER', { telegramHandle });
                        responseText = msgs.GENDER;
                        console.log('[Telegram Chat ID Capture] 📋 Telegram handle saved:', telegramHandle);
                      } else if (state.step === 'ASK_GENDER') {
                        // Check if user wants to participate in diversity research
                        // If they say "Yes" (with or without "Diversity"), or "Yes, Diversity", treat as wanting to participate
                        // If they say "Next" or "No", treat as not interested
                        const saidYes = lowerText.includes('yes') || lowerText.includes('sí') || lowerText.includes('sim') || lowerText.includes('oui');
                        const saidNo = lowerText.includes('no') && !lowerText.includes('not sure');
                        const wantsDiversityResearch = saidYes && !saidNo && !isNext;
                        
                        let diversityResearchInterest: string | undefined;
                        if (wantsDiversityResearch) {
                          diversityResearchInterest = 'Yes';
                          // Track Telegram handle for diversity research
                          try {
                            const telegramHandle = state.profile.telegramHandle || chatId.toString();
                            const db = kaiaRuntimeForOnboardingCheck.databaseAdapter as any;
                            if (db && db.getDb) {
                              const mongoDb = await db.getDb();
                              const diversityCollection = mongoDb.collection('diversity_research');
                              // Check if already exists
                              const existing = await diversityCollection.findOne({ userId: userId });
                              if (!existing) {
                                await diversityCollection.insertOne({
                                  userId: userId,
                                  telegramHandle: telegramHandle,
                                  roomId: chatId.toString(),
                                  interestedAt: new Date(),
                                  status: 'pending'
                                });
                                console.log('[Diversity Research] ✅ Tracked Telegram handle for diversity research:', telegramHandle);
                              } else {
                                // Update existing record
                                await diversityCollection.updateOne(
                                  { userId: userId },
                                  { $set: { interestedAt: new Date(), status: 'pending' } }
                                );
                                console.log('[Diversity Research] ✅ Updated diversity research interest');
                              }
                            }
                          } catch (error) {
                            console.error('[Diversity Research] Error tracking diversity research interest:', error);
                            // Don't fail the onboarding flow if tracking fails
                          }
                        } else if (saidNo || isNext) {
                          // User explicitly said "No" or skipped with "Next"
                          diversityResearchInterest = 'No';
                          // Remove from diversity research tracking if they said No
                          try {
                            const db = kaiaRuntimeForOnboardingCheck.databaseAdapter as any;
                            if (db && db.getDb) {
                              const mongoDb = await db.getDb();
                              const diversityCollection = mongoDb.collection('diversity_research');
                              await diversityCollection.deleteOne({ userId: userId });
                              console.log('[Diversity Research] ✅ Removed from diversity research tracking');
                            }
                          } catch (error) {
                            console.error('[Diversity Research] Error removing from tracking:', error);
                          }
                        }
                        
                        // Save gender (or skip) and ask for notifications
                        let gender: string | undefined;
                        if (!isNext && !wantsDiversityResearch && !saidYes) {
                          // Only save gender if it's not a diversity research response
                          gender = messageText.trim();
                        }
                        await updateState('ASK_NOTIFICATIONS', { gender, diversityResearchInterest });
                        responseText = msgs.NOTIFICATIONS;
                        console.log('[Telegram Chat ID Capture] 📋 Gender saved:', gender || 'skipped', 'Diversity research:', diversityResearchInterest || 'skipped');
                      } else if (state.step === 'ASK_NOTIFICATIONS') {
                        // Save notifications preference and complete
                        let notifications = 'Not sure';
                        if (lowerText.includes('1') || lowerText.includes('yes')) notifications = 'Yes';
                        else if (lowerText.includes('2') || lowerText.includes('no')) notifications = 'No';
                        else if (lowerText.includes('3')) notifications = 'Check later';
                        
                        await updateState('COMPLETED', { notifications, onboardingCompletedAt: new Date() });
                        
                        // Send completion message with profile
                        const { formatProfileForDisplay } = await import('./plugins/onboarding/utils.js');
                        const profileText = formatProfileForDisplay(state.profile, state.profile.language || 'en');
                        responseText = msgs.COMPLETION + '\n\n' + profileText;
                        
                        console.log('[Telegram Chat ID Capture] 📋 Onboarding completed!');
                        
                        // Trigger real-time match check for new user
                        setTimeout(async () => {
                          try {
                            await checkForNewMatches(userId, state.profile, chatId, originalSendMessage);
                          } catch (e) {
                            console.log('[Match Notification] Error checking for matches after onboarding:', e);
                          }
                        }, 5000);
                      } else if (state.step === 'AWAITING_UPDATE_FIELD') {
                        // User is choosing which field to update
                        const fieldMap: Record<string, { step: string, prompt: string, number: number }> = {
                          'name': { step: 'UPDATING_NAME', prompt: 'What would you like to change your name to?', number: 1 },
                          'location': { step: 'UPDATING_LOCATION', prompt: 'What is your new location (city and country)?', number: 2 },
                          'roles': { step: 'UPDATING_ROLES', prompt: msgs.ROLES, number: 3 },
                          'interests': { step: 'UPDATING_INTERESTS', prompt: msgs.INTERESTS, number: 4 },
                          'goals': { step: 'UPDATING_GOALS', prompt: msgs.GOALS, number: 5 },
                          'events': { step: 'UPDATING_EVENTS', prompt: 'What events will you be attending? (event name, date, location)', number: 6 },
                          'socials': { step: 'UPDATING_SOCIALS', prompt: 'Share your social media links:', number: 7 },
                          'telegram': { step: 'UPDATING_TELEGRAM', prompt: 'What is your Telegram handle? (e.g., @username)', number: 8 },
                          'diversity': { step: 'UPDATING_DIVERSITY', prompt: 'Would you like to be (anonymously) included within our diversity research?\n\n1. Yes\n2. No\n3. Not sure yet\n\nPlease reply with the number (for example: 1)', number: 9 },
                          'notifications': { step: 'UPDATING_NOTIFICATIONS', prompt: msgs.NOTIFICATIONS, number: 10 }
                        };
                        
                        // Check for number input (1-10)
                        const numberMatch = lowerText.match(/\b([1-9]|10)\b/);
                        let matchedField: string | null = null;
                        
                        if (numberMatch) {
                          // User provided a number
                          const fieldNumber = parseInt(numberMatch[1]);
                          const fieldEntry = Object.entries(fieldMap).find(([_, info]) => info.number === fieldNumber);
                          if (fieldEntry) {
                            matchedField = fieldEntry[0];
                          }
                        } else {
                          // Check for field name in text
                          for (const [field, _] of Object.entries(fieldMap)) {
                            if (lowerText.includes(field) || 
                                (field === 'name' && (lowerText.includes('name') || lowerText.includes('nombre'))) ||
                                (field === 'location' && (lowerText.includes('location') || lowerText.includes('ubicación') || lowerText.includes('localização'))) ||
                                (field === 'roles' && (lowerText.includes('role') || lowerText.includes('rol'))) ||
                                (field === 'interests' && (lowerText.includes('interest') || lowerText.includes('interés'))) ||
                                (field === 'goals' && lowerText.includes('goal')) ||
                                (field === 'events' && (lowerText.includes('event') || lowerText.includes('conference'))) ||
                                (field === 'socials' && (lowerText.includes('social') || lowerText.includes('link'))) ||
                                (field === 'telegram' && lowerText.includes('telegram')) ||
                                (field === 'diversity' && (lowerText.includes('diversity') || lowerText.includes('diversidad'))) ||
                                (field === 'notifications' && (lowerText.includes('notification') || lowerText.includes('collab')))) {
                              matchedField = field;
                              break;
                            }
                          }
                        }
                        
                        if (matchedField) {
                          const updateInfo = fieldMap[matchedField];
                          await updateState(updateInfo.step, {});
                          responseText = updateInfo.prompt;
                        } else {
                          responseText = `I didn't recognize that field. Please choose from:\n\n` +
                            `1. Name\n` +
                            `2. Location\n` +
                            `3. Professional role(s)\n` +
                            `4. Professional interests\n` +
                            `5. Professional goals\n` +
                            `6. Events & conferences attending\n` +
                            `7. Personal social and/or digital links\n` +
                            `8. Telegram handle\n` +
                            `9. Diversity research interest\n` +
                            `10. Collaboration notifications\n\n` +
                            `Just type the field number(s) (e.g. 1, 3).`;
                        }
                      } else if (state.step.startsWith('UPDATING_')) {
                        // Handle update for specific field
                        const fieldBeingUpdated = state.step.replace('UPDATING_', '').toLowerCase();
                        let updateValue: any = messageText.trim();
                        
                        // Parse based on field type
                        if (['roles', 'interests', 'goals', 'events', 'socials'].includes(fieldBeingUpdated)) {
                          updateValue = messageText.split(',').map((s: string) => s.trim()).filter((s: string) => s);
                        } else if (fieldBeingUpdated === 'notifications') {
                          if (lowerText.includes('1') || lowerText.includes('yes')) updateValue = 'Yes';
                          else if (lowerText.includes('2') || lowerText.includes('no')) updateValue = 'No';
                          else if (lowerText.includes('3')) updateValue = 'Check later';
                        } else if (fieldBeingUpdated === 'diversity') {
                          // Handle diversity research interest
                          if (lowerText.includes('1') || lowerText.includes('yes')) {
                            updateValue = 'Yes';
                            // Track Telegram handle for diversity research if they said Yes
                            try {
                              const telegramHandle = state.profile.telegramHandle || chatId.toString();
                              const db = kaiaRuntimeForOnboardingCheck.databaseAdapter as any;
                              if (db && db.getDb) {
                                const mongoDb = await db.getDb();
                                const diversityCollection = mongoDb.collection('diversity_research');
                                // Check if already exists
                                const existing = await diversityCollection.findOne({ userId: userId });
                                if (!existing) {
                                  await diversityCollection.insertOne({
                                    userId: userId,
                                    telegramHandle: telegramHandle,
                                    roomId: chatId.toString(),
                                    interestedAt: new Date(),
                                    status: 'pending'
                                  });
                                  console.log('[Diversity Research] ✅ Tracked Telegram handle for diversity research:', telegramHandle);
                                } else {
                                  // Update existing record
                                  await diversityCollection.updateOne(
                                    { userId: userId },
                                    { $set: { interestedAt: new Date(), status: 'pending' } }
                                  );
                                  console.log('[Diversity Research] ✅ Updated diversity research interest');
                                }
                              }
                            } catch (error) {
                              console.error('[Diversity Research] Error tracking diversity research interest:', error);
                              // Don't fail the update if tracking fails
                            }
                          } else if (lowerText.includes('2') || lowerText.includes('no')) {
                            updateValue = 'No';
                            // Remove from diversity research tracking if they said No
                            try {
                              const db = kaiaRuntimeForOnboardingCheck.databaseAdapter as any;
                              if (db && db.getDb) {
                                const mongoDb = await db.getDb();
                                const diversityCollection = mongoDb.collection('diversity_research');
                                await diversityCollection.deleteOne({ userId: userId });
                                console.log('[Diversity Research] ✅ Removed from diversity research tracking');
                              }
                            } catch (error) {
                              console.error('[Diversity Research] Error removing from tracking:', error);
                            }
                          } else if (lowerText.includes('3') || lowerText.includes('not sure')) {
                            updateValue = 'Not sure yet';
                          }
                        } else if (fieldBeingUpdated === 'telegram') {
                          updateValue = messageText.trim().replace('@', '');
                        }
                        
                        // Map field names to profile keys
                        const fieldToKey: Record<string, string> = {
                          'name': 'name',
                          'location': 'location',
                          'roles': 'roles',
                          'interests': 'interests',
                          'goals': 'connectionGoals',
                          'events': 'events',
                          'socials': 'socials',
                          'telegram': 'telegramHandle',
                          'diversity': 'diversityResearchInterest',
                          'notifications': 'notifications'
                        };
                        
                        const profileKey = fieldToKey[fieldBeingUpdated] || fieldBeingUpdated;
                        const updateObj: any = {};
                        updateObj[profileKey] = updateValue;
                        
                        await updateState('COMPLETED', updateObj);
                        // Reload state to ensure it's up to date
                        try {
                          const updatedCached = await kaiaRuntimeForOnboardingCheck.cacheManager.get(`onboarding_${userId}`);
                          if (updatedCached && typeof updatedCached === 'object') {
                            state = updatedCached as { step: string, profile: any };
                          }
                        } catch (e) {
                          // State already updated above
                        }
                        responseText = `✅ Your ${fieldBeingUpdated === 'diversity' ? 'diversity research interest' : fieldBeingUpdated} has been updated!\n\nSay "my profile" to see your updated profile! 💜`;
                        console.log(`[Telegram Chat ID Capture] ✏️ Updated ${fieldBeingUpdated} to:`, updateValue);
                      } else if (state.step === 'AWAITING_FEATURE_DETAILS') {
                        // User is providing feature request details
                        console.log('[Telegram Chat ID Capture] 💡 Feature request details received...');
                        
                        // Try to send email first
                        let emailSent = false;
                        try {
                          const { sendFeatureRequest } = await import('./services/featureRequest.js');
                          await sendFeatureRequest(userId, state.profile.name || 'Anonymous', messageText, messageText);
                          emailSent = true;
                          console.log('[Feature Request] ✅ Email sent successfully');
                        } catch (emailError: any) {
                          console.log('[Feature Request] ⚠️ Could not send email:', emailError.message);
                          // Continue to save to database even if email fails
                        }
                        
                        // Always save to database as backup
                        try {
                          const db = kaiaRuntimeForOnboardingCheck.databaseAdapter as any;
                          if (db && db.query) {
                            const { v4: uuidv4 } = await import('uuid');
                            await db.query(
                              `INSERT INTO feature_requests (id, user_id, user_name, request_text, created_at) VALUES ($1, $2, $3, $4, NOW())`,
                              [uuidv4(), userId, state.profile.name || 'Anonymous', messageText]
                            );
                            console.log('[Feature Request] ✅ Saved to database');
                          }
                        } catch (e) {
                          console.log('[Feature Request] Could not save to DB:', e);
                        }
                        
                        await updateState('COMPLETED', {});
                        
                        if (emailSent) {
                          responseText = `Thank you for your suggestion, ${state.profile.name}! 💜\n\n` +
                            `I've sent your request to tech@si3.space:\n"${messageText.substring(0, 200)}${messageText.length > 200 ? '...' : ''}"\n\n` +
                            `The SI<3> team reviews all suggestions. Your feedback helps make me better! 🚀`;
                        } else {
                          responseText = `Thank you for your suggestion, ${state.profile.name}! 💜\n\n` +
                            `I've recorded your request:\n"${messageText.substring(0, 200)}${messageText.length > 200 ? '...' : ''}"\n\n` +
                            `The SI<3> team reviews all suggestions. Your feedback helps make me better! 🚀`;
                        }
                      } else if (state.step === 'COMPLETED') {
                        // User has completed onboarding - handle all commands with full features
                        console.log('[Telegram Chat ID Capture] 🤖 Processing completed user request...');
                        
                        // ==================== CONVERSATION HISTORY ====================
                        // Load and update conversation history from cache
                        const MAX_HISTORY_MESSAGES = 10;
                        let conversationHistory: Array<{role: string, content: string, timestamp: number}> = [];
                        try {
                          const historyCache = await kaiaRuntimeForOnboardingCheck.cacheManager.get(`conversation_${userId}`);
                          if (historyCache && Array.isArray(historyCache)) {
                            conversationHistory = historyCache;
                          }
                        } catch (e) { /* start fresh */ }
                        
                        // Add current message to history
                        conversationHistory.push({ role: 'user', content: messageText, timestamp: Date.now() });
                        if (conversationHistory.length > MAX_HISTORY_MESSAGES * 2) {
                          conversationHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES * 2);
                        }
                        
                        // ==================== KNOWLEDGE QUESTION DETECTION ====================
                        // Detect knowledge/educational questions to redirect with "coming soon" message
                        const knowledgeKeywords = [
                          'what is', 'what are', 'explain', 'tell me about', 'how does', 'define',
                          'dao', 'defi', 'nft', 'blockchain', 'cryptocurrency', 'crypto', 'web3',
                          'smart contract', 'token', 'wallet', 'ethereum', 'bitcoin', 'solana',
                          'proof of stake', 'proof of work', 'mining', 'staking', 'yield', 'liquidity'
                        ];
                        const isKnowledgeQuestion = knowledgeKeywords.some(k => lowerText.includes(k)) && 
                          !lowerText.includes('match') && !lowerText.includes('profile') && !lowerText.includes('update');
                        
                        // ==================== COMMAND DETECTION ====================
                        const isMatchRequest = lowerText.includes('match') || lowerText.includes('connect me') || lowerText.includes('find someone') || lowerText.includes('find me') || lowerText.includes('introduce');
                        const isHistoryRequest = lowerText.includes('history') || lowerText.includes('my profile') || lowerText.includes('my matches') || lowerText.includes('show profile');
                        const isLanguageChange = lowerText.includes('change language') || lowerText.includes('cambiar idioma') || lowerText.includes('mudar idioma') || lowerText.includes('changer de langue');
                        const isUpdateRequest = lowerText === 'update' || 
                          lowerText === 'edit' ||
                          lowerText.startsWith('update ') || 
                          lowerText.startsWith('edit ') ||
                          lowerText.includes('edit my') || 
                          lowerText.includes('change my') ||
                          lowerText.includes('edit profile') ||
                          lowerText.includes('change details') ||
                          lowerText.includes('update profile') ||
                          lowerText.includes('edit details') ||
                          lowerText.includes('modify profile') ||
                          lowerText.includes('change profile');
                        // Natural language feature request detection
                        const hasFeatureRequestKeywords = 
                          lowerText.includes('feature') || 
                          lowerText.includes('suggest') || 
                          lowerText.includes('idea') ||
                          lowerText.includes('request') ||
                          lowerText.includes('want') ||
                          lowerText.includes('wish') ||
                          lowerText.includes('would like') ||
                          lowerText.includes('can you add') ||
                          lowerText.includes('could you add') ||
                          lowerText.includes('it would be') ||
                          lowerText.includes('itd be') ||
                          lowerText.includes('should have') ||
                          lowerText.includes('need') ||
                          lowerText.includes('would be cool') ||
                          lowerText.includes('would be great');
                        
                        // Check if message has actual details (more than just keywords)
                        // Exclude cases where user just says keywords without details
                        const isJustKeyword = 
                          lowerText.trim() === 'feature request' || 
                          lowerText.trim() === 'feature' || 
                          lowerText.trim() === 'suggestion' || 
                          lowerText.trim() === 'suggest' ||
                          lowerText.trim() === 'idea' ||
                          lowerText.trim() === 'i want' ||
                          (lowerText.startsWith('i want') && messageText.trim().length < 50) ||
                          (lowerText.startsWith('can you add') && messageText.trim().length < 50) ||
                          (lowerText.startsWith('could you add') && messageText.trim().length < 50);
                        
                        const hasDetails = messageText.trim().length > 30 && !isJustKeyword;
                        
                        const isFeatureRequest = hasFeatureRequestKeywords;
                        const isHelpRequest = lowerText === 'help' || lowerText === '?' || lowerText.includes('what can you do');
                        
                        if (isHelpRequest) {
                          // HELP MENU
                          const langPhrases: Record<string, any> = {
                            en: { title: 'Here\'s what I can help you with', match: 'Find a match', profile: 'Show my profile', lang: 'Change language', feature: 'Suggest a feature', update: 'Update profile' },
                            es: { title: 'Esto es lo que puedo hacer por ti', match: 'Encontrar una conexión', profile: 'Mostrar mi perfil', lang: 'Cambiar idioma', feature: 'Sugerir una función', update: 'Actualizar perfil' },
                            pt: { title: 'Aqui está o que posso fazer por você', match: 'Encontrar uma conexão', profile: 'Mostrar meu perfil', lang: 'Mudar idioma', feature: 'Sugerir uma função', update: 'Atualizar perfil' },
                            fr: { title: 'Voici ce que je peux faire pour vous', match: 'Trouver une connexion', profile: 'Afficher mon profil', lang: 'Changer de langue', feature: 'Suggérer une fonctionnalité', update: 'Mettre à jour le profil' }
                          };
                          const phrases = langPhrases[state.profile.language || 'en'] || langPhrases.en;
                          responseText = `💜 ${phrases.title}:\n\n` +
                            `🤝 "${phrases.match}" - I'll connect you with someone who shares your interests\n` +
                            `📋 "${phrases.profile}" - View your Grow3dge profile\n` +
                            `✏️ "${phrases.update}" - Edit a specific field in your profile\n` +
                            `🌍 "${phrases.lang}" - Switch to another language\n` +
                            `💡 "${phrases.feature}" - Tell me what features you'd like`;
                        } else if (isMatchRequest) {
                          // ==================== MATCHING WITH TRACKING ====================
                          console.log('[Telegram Chat ID Capture] 🤝 Processing match request...');
                          try {
                            const myInterests = state.profile.interests || [];
                            const myRoles = state.profile.roles || [];
                            
                            if (myInterests.length === 0 && myRoles.length === 0) {
                              responseText = "I don't have enough info about your interests yet to match you. Try 'restart' to update your profile! 💜";
                            } else {
                              let candidates: any[] = [];
                              let matchedUserId: string | null = null;
                              
                              // Query database for other completed profiles
                              try {
                                const db = kaiaRuntimeForOnboardingCheck.databaseAdapter as any;
                                if (db && db.query) {
                                  // Check for previous matches to avoid duplicates
                                  let previousMatchIds: string[] = [];
                                  try {
                                    const prevMatches = await db.query(
                                      `SELECT matched_user_id FROM matches WHERE user_id = $1`,
                                      [userId]
                                    );
                                    previousMatchIds = (prevMatches.rows || []).map((r: any) => r.matched_user_id);
                                  } catch (e) { /* no previous matches */ }
                                  
                                  const res = await db.query(`SELECT key, value FROM cache WHERE key LIKE 'onboarding_%'`);
                                  for (const row of (res.rows || [])) {
                                    const otherUserId = row.key.replace('onboarding_', '');
                                    if (otherUserId === userId) continue;
                                    if (previousMatchIds.includes(otherUserId)) continue; // Skip previous matches
                                    
                                    try {
                                      const otherState = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
                                      if (otherState.step !== 'COMPLETED' || !otherState.profile) continue;
                                      
                                      const otherInterests = otherState.profile.interests || [];
                                      const otherRoles = otherState.profile.roles || [];
                                      const common = myInterests.filter((i: string) => 
                                        otherInterests.some((oi: string) => oi.toLowerCase().includes(i.toLowerCase())) ||
                                        otherRoles.some((or: string) => or.toLowerCase().includes(i.toLowerCase()))
                                      );
                                      
                                      if (common.length > 0) {
                                        candidates.push({
                                          id: otherUserId,
                                          profile: otherState.profile,
                                          score: common.length,
                                          reason: `Shared interests: ${common.join(', ')}`
                                        });
                                      }
                                    } catch (e) { /* skip invalid entries */ }
                                  }
                                }
                              } catch (dbErr) {
                                console.log('[Telegram Chat ID Capture] Database query error:', dbErr);
                              }
                              
                              if (candidates.length === 0) {
                                // Send email notification to members@si3.space with user info
                                try {
                                  const { sendNoMatchNotification } = await import('./services/featureRequest.js');
                                  await sendNoMatchNotification(userId, state.profile);
                                  console.log('[No Match] ✅ Sent no-match notification email');
                                } catch (emailError: any) {
                                  console.log('[No Match] ⚠️ Could not send no-match notification email:', emailError.message);
                                  // Continue even if email fails
                                }
                                
                                responseText = "I couldn't find a match within the current pool, but don't worry! 💜\n\nSI<3> will explore potential matches within its broader network and reach out if we find someone great for you.\n\nIn the meantime, feel free to share any specific connection requests with us at members@si3.space. 🚀";
                              } else {
                                const topMatch = candidates.sort((a, b) => b.score - a.score)[0];
                                matchedUserId = topMatch.id;
                                
                                // ==================== RECORD MATCH IN DATABASE ====================
                                try {
                                  const { v4: uuidv4 } = await import('uuid');
                                  const matchId = uuidv4();
                                  const db = kaiaRuntimeForOnboardingCheck.databaseAdapter as any;
                                  if (db && db.query) {
                                    // Record the match
                                    await db.query(
                                      `INSERT INTO matches (id, user_id, matched_user_id, room_id, match_date, status) VALUES ($1, $2, $3, $4, NOW(), 'pending')`,
                                      [matchId, userId, matchedUserId, chatId.toString()]
                                    );
                                    
                                    // Schedule 3-day follow-up
                                    const followUpDate = new Date();
                                    followUpDate.setDate(followUpDate.getDate() + 3);
                                    await db.query(
                                      `INSERT INTO follow_ups (id, match_id, user_id, type, scheduled_for, status) VALUES ($1, $2, $3, '3_day_checkin', $4, 'pending')`,
                                      [uuidv4(), matchId, userId, followUpDate]
                                    );
                                    console.log('[Match Tracker] ✅ Match recorded and follow-up scheduled');
                                  }
                                } catch (trackErr) {
                                  console.log('[Match Tracker] Could not record match:', trackErr);
                                }
                                
                                responseText = `🚀 I found a match for you!\n\n` +
                                  `Meet ${topMatch.profile.name || 'Anonymous'} from ${topMatch.profile.location || 'Earth'}.\n` +
                                  `Roles: ${topMatch.profile.roles?.join(', ') || 'Not specified'}\n` +
                                  `Interests: ${topMatch.profile.interests?.join(', ') || 'Not specified'}\n` +
                                  (topMatch.profile.telegramHandle ? `Telegram: @${topMatch.profile.telegramHandle}\n` : '') +
                                  `\n💡 Why: ${topMatch.reason}\n\n` +
                                  `I've saved this match. I'll check in with you in 3 days to see if you connected! 🤝`;
                              }
                            }
                          } catch (matchErr: any) {
                            console.error('[Telegram Chat ID Capture] Match error:', matchErr);
                            responseText = "I had trouble finding matches right now. Please try again later! 💜";
                          }
                        } else if (isHistoryRequest) {
                          // ==================== PROFILE WITH MATCH HISTORY ====================
                          console.log('[Telegram Chat ID Capture] 📋 Showing profile with match history...');
                          const p = state.profile;
                          
                          // Fetch match history
                          let matchCount = 0;
                          let matchList = '';
                          try {
                            const db = kaiaRuntimeForOnboardingCheck.databaseAdapter as any;
                            if (db && db.query) {
                              const matchRes = await db.query(
                                `SELECT * FROM matches WHERE user_id = $1 ORDER BY match_date DESC LIMIT 5`,
                                [userId]
                              );
                              matchCount = matchRes.rows?.length || 0;
                              if (matchCount > 0) {
                                matchList = '\n\nRecent Matches:\n';
                                for (const match of matchRes.rows) {
                                  const statusEmoji = match.status === 'connected' ? '✅' : match.status === 'not_interested' ? '❌' : '⏳';
                                  const date = new Date(match.match_date).toLocaleDateString();
                                  matchList += `${statusEmoji} ${date} - ${match.status}\n`;
                                }
                              }
                            }
                          } catch (e) { /* no matches */ }
                          
                          responseText = `💜 Your Grow3dge Profile:\n\n` +
                            `Name: ${p.name || 'Not set'}\n` +
                            `Location: ${p.location || 'Not set'}\n` +
                            `Language: ${p.language || 'en'}\n` +
                            `Roles: ${p.roles?.join(', ') || 'Not set'}\n` +
                            `Interests: ${p.interests?.join(', ') || 'Not set'}\n` +
                            `Goals: ${p.connectionGoals?.join(', ') || 'Not set'}\n` +
                            `Events: ${p.events?.join(', ') || 'None'}\n` +
                            `Socials: ${p.socials?.join(', ') || 'None'}\n` +
                            `Telegram: ${p.telegramHandle ? '@' + p.telegramHandle : 'Not set'}\n` +
                            `Diversity Research Interest: ${p.diversityResearchInterest || 'Not set'}\n` +
                            `Notifications: ${p.notifications || 'Not set'}\n` +
                            `Total Matches: ${matchCount}` +
                            matchList +
                            `\n\n✅ Onboarding: Completed\n\nTo update any field, say "update" or "update [field name]".`;
                        } else if (isUpdateRequest) {
                          // ==================== PROFILE UPDATE FEATURE ====================
                          console.log('[Telegram Chat ID Capture] ✏️ Update request...');
                          
                          // Check if they specified what to update by number or name
                          const updateFields: Record<string, { step: string, prompt: string, number: number }> = {
                            'name': { step: 'UPDATING_NAME', prompt: 'What would you like to change your name to?', number: 1 },
                            'location': { step: 'UPDATING_LOCATION', prompt: 'What is your new location (city and country)?', number: 2 },
                            'roles': { step: 'UPDATING_ROLES', prompt: msgs.ROLES, number: 3 },
                            'interests': { step: 'UPDATING_INTERESTS', prompt: msgs.INTERESTS, number: 4 },
                            'goals': { step: 'UPDATING_GOALS', prompt: msgs.GOALS, number: 5 },
                            'events': { step: 'UPDATING_EVENTS', prompt: 'What events will you be attending? (event name, date, location)', number: 6 },
                            'socials': { step: 'UPDATING_SOCIALS', prompt: 'Share your social media links:', number: 7 },
                            'telegram': { step: 'UPDATING_TELEGRAM', prompt: 'What is your Telegram handle? (e.g., @username)', number: 8 },
                            'diversity': { step: 'UPDATING_DIVERSITY', prompt: 'Would you like to be (anonymously) included within our diversity research?\n\n1. Yes\n2. No\n3. Not sure yet\n\nPlease reply with the number (for example: 1)', number: 9 },
                            'notifications': { step: 'UPDATING_NOTIFICATIONS', prompt: msgs.NOTIFICATIONS, number: 10 }
                          };
                          
                          // Check for number input (1-10)
                          const numberMatch = lowerText.match(/\b([1-9]|10)\b/);
                          let fieldToUpdate: string | null = null;
                          
                          if (numberMatch) {
                            // User provided a number
                            const fieldNumber = parseInt(numberMatch[1]);
                            const fieldEntry = Object.entries(updateFields).find(([_, info]) => info.number === fieldNumber);
                            if (fieldEntry) {
                              fieldToUpdate = fieldEntry[0];
                            }
                          } else {
                            // Check for field name in text
                            for (const [field, _] of Object.entries(updateFields)) {
                              if (lowerText.includes(field) || 
                                  (field === 'name' && (lowerText.includes('name') || lowerText.includes('nombre'))) ||
                                  (field === 'location' && (lowerText.includes('location') || lowerText.includes('ubicación') || lowerText.includes('localização'))) ||
                                  (field === 'roles' && (lowerText.includes('role') || lowerText.includes('rol'))) ||
                                  (field === 'interests' && (lowerText.includes('interest') || lowerText.includes('interés'))) ||
                                  (field === 'goals' && lowerText.includes('goal')) ||
                                  (field === 'events' && (lowerText.includes('event') || lowerText.includes('conference'))) ||
                                  (field === 'socials' && (lowerText.includes('social') || lowerText.includes('link'))) ||
                                  (field === 'telegram' && lowerText.includes('telegram')) ||
                                  (field === 'diversity' && (lowerText.includes('diversity') || lowerText.includes('diversidad'))) ||
                                  (field === 'notifications' && (lowerText.includes('notification') || lowerText.includes('collab')))) {
                                fieldToUpdate = field;
                                break;
                              }
                            }
                          }
                          
                          if (fieldToUpdate) {
                            // They specified a field - go directly to updating it
                            const updateInfo = updateFields[fieldToUpdate];
                            await updateState(updateInfo.step, {});
                            responseText = updateInfo.prompt;
                          } else {
                            // They just said "update" - ask what they want to update with numbered list
                            await updateState('AWAITING_UPDATE_FIELD', {});
                            responseText = `What would you like to update? 📝\n\n` +
                              `1. Name\n` +
                              `2. Location\n` +
                              `3. Professional role(s)\n` +
                              `4. Professional interests\n` +
                              `5. Professional goals\n` +
                              `6. Events & conferences attending\n` +
                              `7. Personal social and/or digital links\n` +
                              `8. Telegram handle\n` +
                              `9. Diversity research interest\n` +
                              `10. Collaboration notifications\n\n` +
                              `Just type the field number(s) (e.g. 1, 3).`;
                          }
                        } else if (isLanguageChange) {
                          // LANGUAGE CHANGE
                          console.log('[Telegram Chat ID Capture] 🌍 Language change requested...');
                          let newLang: 'en' | 'es' | 'pt' | 'fr' | null = null;
                          if (lowerText.includes('english') || lowerText.includes('inglés') || lowerText.includes('inglês')) newLang = 'en';
                          else if (lowerText.includes('spanish') || lowerText.includes('español') || lowerText.includes('espanhol')) newLang = 'es';
                          else if (lowerText.includes('portuguese') || lowerText.includes('português') || lowerText.includes('portugués')) newLang = 'pt';
                          else if (lowerText.includes('french') || lowerText.includes('français') || lowerText.includes('francés')) newLang = 'fr';
                          
                          if (newLang) {
                            await updateState('COMPLETED', { language: newLang });
                            const langNames: Record<string, string> = { en: 'English', es: 'Español', pt: 'Português', fr: 'Français' };
                            responseText = `✅ Language changed to ${langNames[newLang]}! I'll respond in ${langNames[newLang]} from now on. 💜`;
                          } else {
                            responseText = "Which language would you like?\n\n• English\n• Español\n• Português\n• Français\n\nJust say 'change language to [language]'";
                          }
                        } else if (isFeatureRequest) {
                          // FEATURE REQUEST - Check if details are included
                          console.log('[Telegram Chat ID Capture] 💡 Feature request detected...');
                          
                          if (hasDetails) {
                            // User provided details in the same message - send directly
                            let emailSent = false;
                            try {
                              const { sendFeatureRequest } = await import('./services/featureRequest.js');
                              await sendFeatureRequest(userId, state.profile.name || 'Anonymous', messageText, messageText);
                              emailSent = true;
                              console.log('[Feature Request] ✅ Email sent successfully');
                            } catch (emailError: any) {
                              console.log('[Feature Request] ⚠️ Could not send email:', emailError.message);
                              // Continue to save to database even if email fails
                            }
                            
                            // Always save to database as backup
                            try {
                              const db = kaiaRuntimeForOnboardingCheck.databaseAdapter as any;
                              if (db && db.query) {
                                const { v4: uuidv4 } = await import('uuid');
                                await db.query(
                                  `INSERT INTO feature_requests (id, user_id, user_name, request_text, created_at) VALUES ($1, $2, $3, $4, NOW())`,
                                  [uuidv4(), userId, state.profile.name || 'Anonymous', messageText]
                                );
                                console.log('[Feature Request] ✅ Saved to database');
                              }
                            } catch (e) {
                              console.log('[Feature Request] Could not save to DB:', e);
                            }
                            
                            if (emailSent) {
                              responseText = `Thank you for your suggestion, ${state.profile.name}! 💜\n\n` +
                                `I've sent your request to tech@si3.space:\n"${messageText.substring(0, 200)}${messageText.length > 200 ? '...' : ''}"\n\n` +
                                `The SI<3> team reviews all suggestions. Your feedback helps make me better! 🚀`;
                            } else {
                              responseText = `Thank you for your suggestion, ${state.profile.name}! 💜\n\n` +
                                `I've recorded your request:\n"${messageText.substring(0, 200)}${messageText.length > 200 ? '...' : ''}"\n\n` +
                                `The SI<3> team reviews all suggestions. Your feedback helps make me better! 🚀`;
                            }
                          } else {
                            // User just mentioned feature request without details - ask for details
                            await updateState('AWAITING_FEATURE_DETAILS', {});
                            const langPrompts: Record<string, string> = {
                              en: `Great! I'd love to hear your suggestion. 💡\n\nPlease tell me more about the feature you'd like to see. What would you like me to be able to do?`,
                              es: `¡Genial! Me encantaría escuchar tu sugerencia. 💡\n\nPor favor, cuéntame más sobre la función que te gustaría ver. ¿Qué te gustaría que pudiera hacer?`,
                              pt: `Ótimo! Adoraria ouvir sua sugestão. 💡\n\nPor favor, me conte mais sobre a função que você gostaria de ver. O que você gostaria que eu pudesse fazer?`,
                              fr: `Excellent! J'aimerais entendre votre suggestion. 💡\n\nVeuillez me dire plus sur la fonctionnalité que vous aimeriez voir. Qu'aimeriez-vous que je puisse faire?`
                            };
                            responseText = langPrompts[state.profile.language || 'en'] || langPrompts.en;
                          }
                        } else if (isKnowledgeQuestion) {
                          // ==================== KNOWLEDGE QUESTION - COMING SOON ====================
                          console.log('[Telegram Chat ID Capture] 📚 Knowledge question detected - showing coming soon message');
                          const langResponses: Record<string, string> = {
                            en: `Great question! 🧠\n\nI'm activating my peer-to-peer knowledge-sharing capabilities soon, where you'll be able to learn from other community members who are experts in these topics.\n\nFor now, I'm focused on making meaningful connections within the SI<3> community. Would you like me to find you a match? Just say "find me a match"! 🤝💜`,
                            es: `¡Gran pregunta! 🧠\n\nPronto activaré mis capacidades de intercambio de conocimientos entre pares, donde podrás aprender de otros miembros de la comunidad que son expertos en estos temas.\n\nPor ahora, estoy enfocada en hacer conexiones significativas dentro de la comunidad SI<3>. ¿Te gustaría que te encuentre una conexión? ¡Solo di "encuéntrame una conexión"! 🤝💜`,
                            pt: `Ótima pergunta! 🧠\n\nEm breve ativarei minhas capacidades de compartilhamento de conhecimento entre pares, onde você poderá aprender com outros membros da comunidade que são especialistas nesses tópicos.\n\nPor enquanto, estou focada em fazer conexões significativas dentro da comunidade SI<3>. Gostaria que eu encontrasse uma conexão para você? Basta dizer "encontre uma conexão"! 🤝💜`,
                            fr: `Excellente question! 🧠\n\nJ'activerai bientôt mes capacités de partage de connaissances entre pairs, où vous pourrez apprendre d'autres membres de la communauté qui sont experts dans ces sujets.\n\nPour l'instant, je me concentre sur la création de connexions significatives au sein de la communauté SI<3>. Voulez-vous que je vous trouve une connexion? Dites simplement "trouve-moi une connexion"! 🤝💜`
                          };
                          responseText = langResponses[state.profile.language || 'en'] || langResponses.en;
                        } else {
                          // ==================== GENERAL CHAT (MATCHMAKING FOCUSED) ====================
                          console.log('[Telegram Chat ID Capture] 🤖 Calling OpenAI (matchmaking focused)...');
                          
                          // Build system prompt (matchmaking focused)
                          let systemPrompt = `You are Kaia, the SI<3> community matchmaker assistant. 

USER PROFILE:
- Name: ${state.profile.name}
- Location: ${state.profile.location || 'Not specified'}
- Roles: ${state.profile.roles?.join(', ') || 'Not specified'}
- Interests: ${state.profile.interests?.join(', ') || 'Not specified'}
- Connection Goals: ${state.profile.connectionGoals?.join(', ') || 'Not specified'}
- Language: ${state.profile.language || 'en'}

YOUR CAPABILITIES (MATCHMAKING FOCUSED):
- Find matches for users (they can say "find me a match")
- Show profile (they can say "show my profile" or "my history")
- Take feature suggestions and direct them to tech@si3.space
- Change language (they can say "change language to Spanish")
- Provide help (they can say "help")

IMPORTANT - KNOWLEDGE QUESTIONS:
If users ask educational/knowledge questions (like "what is a DAO", "explain blockchain", "what is DeFi"), 
respond that peer-to-peer knowledge-sharing capabilities will be activated soon, and for now you're focused 
on making great connections within the SI<3> community.

PERSONALITY:
- Be warm, friendly, and helpful
- Use emojis naturally (💜, 🚀, 🤝, 🎉)
- Be encouraging and supportive
- Focus conversations on matchmaking and connections
- Respond in ${state.profile.language === 'es' ? 'Spanish' : state.profile.language === 'pt' ? 'Portuguese' : state.profile.language === 'fr' ? 'French' : 'English'}`;
                          
                          // Build messages array with conversation history
                          const messages: Array<{role: string, content: string}> = [
                            { role: 'system', content: systemPrompt }
                          ];
                          
                          // Add recent conversation history (last 6 messages for context)
                          const recentHistory = conversationHistory.slice(-6);
                          for (const msg of recentHistory) {
                            if (msg.role === 'user' || msg.role === 'assistant') {
                              messages.push({ role: msg.role, content: msg.content });
                            }
                          }
                          
                          // Ensure the last message is the current user message
                          if (messages[messages.length - 1]?.content !== messageText) {
                            messages.push({ role: 'user', content: messageText });
                          }

                          const response = await fetch('https://api.openai.com/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${openaiKey}`
                            },
                            body: JSON.stringify({
                              model: 'gpt-4o-mini',
                              messages: messages,
                              max_tokens: 1000,
                              temperature: 0.7
                            })
                          });
                          
                          if (response.ok) {
                            const data = await response.json();
                            responseText = data.choices?.[0]?.message?.content || "I'm here to help! What would you like to know? 💜";
                            
                            // Save assistant response to history
                            conversationHistory.push({ role: 'assistant', content: responseText, timestamp: Date.now() });
                          } else {
                            responseText = "I'm here to help! What would you like to know? 💜";
                          }
                        }
                        
                        // ==================== SAVE CONVERSATION HISTORY ====================
                        try {
                          await kaiaRuntimeForOnboardingCheck.cacheManager.set(`conversation_${userId}`, conversationHistory);
                        } catch (e) { /* ignore cache errors */ }
                      } else {
                        // Unknown step - use OpenAI
                        console.log('[Telegram Chat ID Capture] 🤖 Unknown step, using OpenAI...');
                        const response = await fetch('https://api.openai.com/v1/chat/completions', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${openaiKey}`
                          },
                          body: JSON.stringify({
                            model: 'gpt-4o-mini',
                            messages: [
                              {
                                role: 'system',
                                content: `You are Kaia, the SI<3> assistant. Be warm, friendly, and helpful. Use emojis naturally (💜, 🚀, 🤝).`
                              },
                              {
                                role: 'user',
                                content: messageText
                              }
                            ],
                            max_tokens: 1000
                          })
                        });
                        
                        if (response.ok) {
                          const data = await response.json();
                          responseText = data.choices?.[0]?.message?.content || "How can I help you? 💜";
                        } else {
                          responseText = "How can I help you? 💜";
                        }
                      }
                      
                      // Send the response
                      if (responseText) {
                        console.log('[Telegram Chat ID Capture] 📤 Sending response:', responseText.substring(0, 100) + '...');
                        await originalSendMessage(chatId, responseText);
                        console.log('[Telegram Chat ID Capture] ✅ Sent fallback response');
                      }
                    } else if (openaiKey) {
                      // No runtime available - just use basic OpenAI
                      console.log('[Telegram Chat ID Capture] 🤖 No runtime, using basic OpenAI...');
                      const response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${openaiKey}`
                        },
                        body: JSON.stringify({
                          model: 'gpt-4o-mini',
                          messages: [
                            {
                              role: 'system',
                              content: `You are Kaia, the SI<3> assistant. Be warm, friendly, and helpful. Use emojis naturally (💜, 🚀, 🤝).`
                            },
                            {
                              role: 'user',
                              content: messageText
                            }
                          ],
                          max_tokens: 1000
                        })
                      });
                      
                      if (response.ok) {
                        const data = await response.json();
                        const reply = data.choices?.[0]?.message?.content || "I'm having trouble processing that. Please try again!";
                        console.log('[Telegram Chat ID Capture] 🤖 OpenAI response:', reply.substring(0, 100) + '...');
                        await originalSendMessage(chatId, reply);
                        console.log('[Telegram Chat ID Capture] ✅ Sent fallback response via direct OpenAI');
                      } else {
                        const errorText = await response.text();
                        console.error('[Telegram Chat ID Capture] ❌ OpenAI fallback failed:', response.status, errorText);
                        await originalSendMessage(chatId, "I'm experiencing some issues right now. Please try again in a moment! 🔧");
                      }
                    } else {
                      console.error('[Telegram Chat ID Capture] ❌ No OpenAI API key for fallback');
                      await originalSendMessage(chatId, "I'm experiencing some issues right now. Please try again in a moment! 🔧");
                    }
                  } catch (handlerErr: any) {
                    console.error('[Kaia Handler] ❌ Handler error:', handlerErr?.message || handlerErr);
                    try {
                      await originalSendMessage(chatId, "I'm experiencing some issues right now. Please try again in a moment! 🔧");
                    } catch (sendErr) {
                      console.error('[Kaia Handler] Could not send error message');
                    }
                  }
              } else {
                console.log('[Kaia Handler] ⚠️ No message text or chat ID, skipping');
              }
            };
            console.log('[Telegram Chat ID Capture] Patched bot.handler to capture chat IDs');
          } else {
            console.log('[Telegram Chat ID Capture] ⚠️ bot.handler not found - messages may not be intercepted');
          }
          
          // Also try patching bot.on() for message events (Telegraf's main event handler)
          // NOTE: We'll patch it but NOT wrap handlers to avoid breaking message processing
          // Just log event registration, don't interfere with handler execution
          if (bot && bot.on) {
            console.log('[Telegram Chat ID Capture] Found bot.on, patching to log event registration (NOT wrapping handlers)...');
            const originalOn = bot.on.bind(bot);
            bot.on = function(event: string, ...handlers: any[]) {
              console.log(`[Telegram Chat ID Capture] 📋 Event registered: ${event}, handlers: ${handlers.length}`);
              
              // For message events, log but don't wrap handlers (wrapping might break message processing)
              if (event === 'message' || event === 'text') {
                console.log(`[Telegram Chat ID Capture] Message event registered - handlers will process messages normally`);
              }
              
              // Call original on() WITHOUT wrapping handlers - let Telegraf handle them normally
              return originalOn.apply(this, [event, ...handlers]);
            };
            console.log('[Telegram Chat ID Capture] Patched bot.on to log event registration (handlers NOT wrapped)');
          } else {
            console.log('[Telegram Chat ID Capture] ⚠️ bot.on not found');
          }
          
          // Patch handleError to log full details and send fallback responses
          if (bot && bot.handleError) {
            console.log('[Telegram Chat ID Capture] Found bot.handleError, patching to log full stack and send fallback responses...');
            const originalHandleError = bot.handleError.bind(bot);
            bot.handleError = async function(error: any, ctx: any) {
              const msg = error?.message || error?.toString?.() || 'unknown error';
              console.error('[Telegram Chat ID Capture] Error in bot.handleError:', msg);
              if (error?.code) console.error('[Telegram Chat ID Capture] Error code:', error.code);
              if (error?.stack) console.error('[Telegram Chat ID Capture] Error stack:', error.stack.substring(0, 2000));
              try {
                const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error));
                console.error('[Telegram Chat ID Capture] Error serialized:', serialized.substring(0, 2000));
              } catch {}
              
              // If we have chat id, try to send a friendly fallback message
              try {
                const chatId = ctx?.chat?.id || ctx?.message?.chat?.id;
                if (chatId) {
                  await bot.telegram.sendMessage(chatId, "I'm experiencing some technical difficulties right now. Please try again in a moment! 🔧");
                  console.log('[Telegram Chat ID Capture] ✅ Sent fallback response from handleError');
                }
              } catch (sendErr: any) {
                console.error('[Telegram Chat ID Capture] Failed to send fallback response from handleError:', sendErr?.message || sendErr);
              }
              
              // Call original handler
              return originalHandleError(error, ctx);
            };
            console.log('[Telegram Chat ID Capture] Patched bot.handleError');
          }
          
          // CRITICAL: Patch ALL Telegram send methods to catch messages from any path
          // The second message might be sent through callback, which uses a different bot instance
          // So we need to patch at the Telegraf class level, not just the instance level
          
          // Patch the Telegraf class itself to intercept ALL sendMessage calls
          // In Telegraf, `telegram` is created on the instance, not the prototype
          // We need to patch the constructor or use a Proxy to intercept instance creation
          try {
            console.log('[Telegram Chat ID Capture] Attempting to patch Telegraf class...');
            const TelegrafModule = await import('telegraf');
            const TelegrafClass = TelegrafModule.Telegraf || TelegrafModule.default;
            console.log('[Telegram Chat ID Capture] TelegrafClass found:', !!TelegrafClass);
            console.log('[Telegram Chat ID Capture] TelegrafClass.prototype:', !!TelegrafClass?.prototype);
            
            // Store original constructor
            const OriginalTelegraf = TelegrafClass;
            const TelegrafAny = TelegrafClass as any;
            
            // Patch the constructor to intercept instance creation
            if (OriginalTelegraf && !TelegrafAny.__patched) {
              console.log('[Telegram Chat ID Capture] ✅ Patching Telegraf constructor to intercept ALL instances...');
              
              // Wrap the constructor
              const PatchedTelegraf = function(this: any, ...args: any[]) {
                const instance = new (OriginalTelegraf as any)(...args);
                
                // Patch telegram.sendMessage on this instance
                if (instance.telegram && instance.telegram.sendMessage) {
                  const originalSendMessage = instance.telegram.sendMessage.bind(instance.telegram);
                  const sendMessageAny = originalSendMessage as any;
                  
                  if (!sendMessageAny.__patched) {
                    instance.telegram.sendMessage = async function(chatId: any, text: string, extra?: any): Promise<any> {
                      const sendTime = Date.now();
                      console.log(`[Telegram Chat ID Capture] ========== sendMessage INTERCEPTED (INSTANCE CREATION) ==========`);
                      console.log(`[Telegram Chat ID Capture] Timestamp: ${sendTime}`);
                      console.log(`[Telegram Chat ID Capture] 📤 sendMessage called - chatId: ${chatId}, text: ${text?.substring(0, 100) || '(empty)'}`);
                      
                      // CRITICAL: Check if this message should be blocked due to recent action execution
                      const { getRoomIdForChatId, checkActionExecutedRecently, getLastAgentMessageTime } = await import('./services/llmResponseInterceptor.js');
                      
                      // Find roomId for this chatId
                      const roomIdToCheck = getRoomIdForChatId(String(chatId));
                      
                      if (roomIdToCheck && text && text.trim()) {
                        // CRITICAL: Check for EXACT duplicate content first
                        const { isDuplicateMessage } = await import('./services/messageDeduplication.js');
                        if (isDuplicateMessage(null as any, roomIdToCheck, text)) {
                          console.log('[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage (INSTANCE CREATION) - EXACT DUPLICATE CONTENT detected');
                          console.log(`[Telegram Chat ID Capture] Blocked duplicate text: ${text.substring(0, 100)}`);
                          return { message_id: 0, date: Date.now(), chat: { id: chatId } };
                        }
                        
                        // Check if action was executed recently
                        // BUT: Allow messages sent within 1 second of action execution - these are likely action handler callbacks
                        const actionWasRecent = checkActionExecutedRecently(roomIdToCheck);
                        if (actionWasRecent) {
                          // Get the action execution timestamp to check how recent it was
                          const { getActionExecutionTime } = await import('./services/llmResponseInterceptor.js');
                          const actionExecutionTime = getActionExecutionTime?.(roomIdToCheck);
                          if (actionExecutionTime) {
                            const elapsed = Date.now() - actionExecutionTime;
                            const ACTION_HANDLER_WINDOW_MS = 1000; // 1 second - action handler callbacks are sent immediately
                            if (elapsed < ACTION_HANDLER_WINDOW_MS) {
                              console.log(`[Telegram Chat ID Capture] ✅ ALLOWING sendMessage (INSTANCE CREATION) - sent ${elapsed}ms after action execution (likely action handler callback)`);
                              // Allow this message - it's likely from an action handler callback
                            } else {
                              console.log('[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage (INSTANCE CREATION) - action was executed recently, preventing duplicate');
                              console.log(`[Telegram Chat ID Capture] Blocked text: ${text.substring(0, 100)}`);
                              return { message_id: 0, date: Date.now(), chat: { id: chatId } };
                            }
                          } else {
                            console.log('[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage (INSTANCE CREATION) - action was executed recently, preventing duplicate');
                            console.log(`[Telegram Chat ID Capture] Blocked text: ${text.substring(0, 100)}`);
                            return { message_id: 0, date: Date.now(), chat: { id: chatId } };
                          }
                        }
                        
                        // Check for rapid consecutive messages
                        const lastAgentMessageTime = getLastAgentMessageTime(roomIdToCheck);
                        if (lastAgentMessageTime) {
                          const elapsed = Date.now() - lastAgentMessageTime;
                          const AGENT_MESSAGE_BLOCK_WINDOW_MS = 10000;
                          if (elapsed < AGENT_MESSAGE_BLOCK_WINDOW_MS) {
                            console.log(`[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage (INSTANCE CREATION) - another agent message was sent ${elapsed}ms ago, preventing duplicate`);
                            console.log(`[Telegram Chat ID Capture] Blocked text: ${text.substring(0, 100)}`);
                            return { message_id: 0, date: Date.now(), chat: { id: chatId } };
                          }
                        }
                        
                        // Record this message as sent
                        const { recordMessageSent } = await import('./services/messageDeduplication.js');
                        recordMessageSent(roomIdToCheck, text);
                      }
                      
                      // Call original method
                      return originalSendMessage.call(this, chatId, text, extra);
                    };
                    (instance.telegram.sendMessage as any).__patched = true;
                  }
                }
                
                return instance;
              };
              
              // Copy prototype
              PatchedTelegraf.prototype = OriginalTelegraf.prototype;
              Object.setPrototypeOf(PatchedTelegraf, OriginalTelegraf);
              
              // Replace the export
              if (TelegrafModule.Telegraf) {
                (TelegrafModule as any).Telegraf = PatchedTelegraf;
              }
              if (TelegrafModule.default) {
                (TelegrafModule as any).default = PatchedTelegraf;
              }
              
              TelegrafAny.__patched = true;
              console.log('[Telegram Chat ID Capture] ✅ Patched Telegraf constructor');
            } else if (TelegrafClass && TelegrafClass.prototype && TelegrafClass.prototype.telegram) {
              const originalTelegramSendMessage = TelegrafClass.prototype.telegram.sendMessage;
              const sendMessageAny = originalTelegramSendMessage as any;
              console.log('[Telegram Chat ID Capture] Original sendMessage exists:', !!originalTelegramSendMessage);
              console.log('[Telegram Chat ID Capture] Already patched?', !!sendMessageAny.__patched);
              
              if (originalTelegramSendMessage && !sendMessageAny.__patched) {
                console.log('[Telegram Chat ID Capture] ✅ Patching Telegraf class prototype to intercept ALL sendMessage calls...');
                (TelegrafClass.prototype.telegram as any).sendMessage = async function(chatId: any, text: string, extra?: any): Promise<any> {
                  const sendTime = Date.now();
                  console.log(`[Telegram Chat ID Capture] ========== sendMessage INTERCEPTED (CLASS LEVEL) ==========`);
                  console.log(`[Telegram Chat ID Capture] Timestamp: ${sendTime}`);
                  console.log(`[Telegram Chat ID Capture] 📤 sendMessage called - chatId: ${chatId}, text: ${text?.substring(0, 50) || '(empty)'}`);
                  
                  // CRITICAL: Check if this message should be blocked due to recent action execution
                  const { getRoomIdForChatId, checkActionExecutedRecently, getLastAgentMessageTime } = await import('./services/llmResponseInterceptor.js');
                  
                  // Find roomId for this chatId
                  const roomIdToCheck = getRoomIdForChatId(String(chatId));
                  console.log(`[Telegram Chat ID Capture] 📤 sendMessage called - chatId: ${chatId}, roomId: ${roomIdToCheck || 'NOT FOUND'}, text: ${text?.substring(0, 100) || '(empty)'}`);
                  
                  if (roomIdToCheck && text && text.trim()) {
                    // CRITICAL: Check for EXACT duplicate content first (most reliable for identical messages)
                    const { isDuplicateMessage } = await import('./services/messageDeduplication.js');
                    if (isDuplicateMessage(null as any, roomIdToCheck, text)) {
                      console.log('[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage (CLASS LEVEL) - EXACT DUPLICATE CONTENT detected');
                      console.log(`[Telegram Chat ID Capture] Blocked duplicate text: ${text.substring(0, 100)}`);
                      console.log(`[Telegram Chat ID Capture] This is likely the same message being sent twice - blocking duplicate`);
                      return { message_id: 0, date: Date.now(), chat: { id: chatId } };
                    }
                    
                    // Check if action was executed recently
                    console.log(`[Telegram Chat ID Capture] 🔍 Checking action execution for roomId: ${roomIdToCheck}`);
                    if (checkActionExecutedRecently(roomIdToCheck)) {
                      console.log('[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage (CLASS LEVEL) - action was executed recently, preventing duplicate');
                      console.log(`[Telegram Chat ID Capture] Blocked text: ${text.substring(0, 100)}`);
                      return { message_id: 0, date: Date.now(), chat: { id: chatId } };
                    }
                    
                    // Check for rapid consecutive messages
                    const lastAgentMessageTime = getLastAgentMessageTime(roomIdToCheck);
                    console.log(`[Telegram Chat ID Capture] 🔍 Checking rapid consecutive message for roomId: ${roomIdToCheck}`);
                    console.log(`[Telegram Chat ID Capture] Last agent message time: ${lastAgentMessageTime || 'NOT FOUND'}`);
                    if (lastAgentMessageTime) {
                      const elapsed = Date.now() - lastAgentMessageTime;
                      const AGENT_MESSAGE_BLOCK_WINDOW_MS = 10000;
                      console.log(`[Telegram Chat ID Capture] 🔍 Checking rapid consecutive message - elapsed: ${elapsed}ms, window: ${AGENT_MESSAGE_BLOCK_WINDOW_MS}ms`);
                      if (elapsed < AGENT_MESSAGE_BLOCK_WINDOW_MS) {
                        console.log(`[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage (CLASS LEVEL) - another agent message was sent ${elapsed}ms ago, preventing duplicate`);
                        console.log(`[Telegram Chat ID Capture] Blocked text: ${text.substring(0, 100)}`);
                        return { message_id: 0, date: Date.now(), chat: { id: chatId } };
                      }
                    }
                    
                    // Record this message as sent (for duplicate detection)
                    const { recordMessageSent } = await import('./services/messageDeduplication.js');
                    recordMessageSent(roomIdToCheck, text);
                    console.log(`[Telegram Chat ID Capture] ✅ Recorded message in deduplication system: ${text.substring(0, 50)}`);
                  }
                  
                  // Call original method
                  return originalTelegramSendMessage.call(this, chatId, text, extra);
                };
                (TelegrafClass.prototype.telegram.sendMessage as any).__patched = true;
                console.log('[Telegram Chat ID Capture] ✅ Patched Telegraf class prototype');
              }
            }
          } catch (error: any) {
            console.error('[Telegram Chat ID Capture] ⚠️ Failed to patch Telegraf class:', error.message);
          }
          
          // Also patch the instance-level sendMessage as a fallback
          if (bot && bot.telegram && bot.telegram.sendMessage) {
            console.log('[Telegram Chat ID Capture] Found bot.telegram.sendMessage, patching instance to block duplicates after action execution...');
            const originalSendMessage = bot.telegram.sendMessage.bind(bot.telegram);
            bot.telegram.sendMessage = async function(chatId: any, text: string, extra?: any) {
              const sendTime = Date.now();
              console.log(`[Telegram Chat ID Capture] ========== sendMessage INTERCEPTED (INSTANCE LEVEL) ==========`);
              console.log(`[Telegram Chat ID Capture] Timestamp: ${sendTime}`);
              console.log(`[Telegram Chat ID Capture] 📤 sendMessage called - chatId: ${chatId}, text: ${text?.substring(0, 50) || '(empty)'}`);
              
              // CRITICAL: Check if this message should be blocked due to recent action execution
              // This catches messages that might bypass createMemory
              const { getRoomIdForChatId, checkActionExecutedRecently, getLastAgentMessageTime } = await import('./services/llmResponseInterceptor.js');
              
              // Find roomId for this chatId
              const roomIdToCheck = getRoomIdForChatId(chatId);
              console.log(`[Telegram Chat ID Capture] 📤 sendMessage called - chatId: ${chatId}, roomId: ${roomIdToCheck || 'NOT FOUND'}, text: ${text?.substring(0, 100) || '(empty)'}`);
              
              if (roomIdToCheck && text && text.trim()) {
                // CRITICAL: Check for EXACT duplicate content first (most reliable for identical messages)
                const { isDuplicateMessage } = await import('./services/messageDeduplication.js');
                if (isDuplicateMessage(null as any, roomIdToCheck, text)) {
                  console.log('[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage (INSTANCE LEVEL) - EXACT DUPLICATE CONTENT detected');
                  console.log(`[Telegram Chat ID Capture] Blocked duplicate text: ${text.substring(0, 100)}`);
                  console.log(`[Telegram Chat ID Capture] This is likely the same message being sent twice - blocking duplicate`);
                  return { message_id: 0, date: Date.now(), chat: { id: chatId } };
                }
                
                // Check if action was executed recently (using 10 second window to match interceptor)
                console.log(`[Telegram Chat ID Capture] 🔍 Checking action execution for roomId: ${roomIdToCheck}`);
                if (checkActionExecutedRecently(roomIdToCheck)) {
                  console.log('[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage (INSTANCE LEVEL) - action was executed recently, preventing duplicate');
                  console.log(`[Telegram Chat ID Capture] Blocked text: ${text.substring(0, 100)}`);
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
                    console.log(`[Telegram Chat ID Capture] 🚫 BLOCKING sendMessage (INSTANCE LEVEL) - another agent message was sent ${elapsed}ms ago (window: ${AGENT_MESSAGE_BLOCK_WINDOW_MS}ms), preventing duplicate`);
                    console.log(`[Telegram Chat ID Capture] Blocked text: ${text.substring(0, 100)}`);
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
                
                // Record this message as sent (for duplicate detection)
                const { recordMessageSent } = await import('./services/messageDeduplication.js');
                recordMessageSent(roomIdToCheck, text);
                console.log(`[Telegram Chat ID Capture] ✅ Recorded message in deduplication system: ${text.substring(0, 50)}`);
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
  
  // ==================== SCHEDULED FOLLOW-UPS SYSTEM ====================
  // Check for due follow-ups every 5 minutes and send reminder messages
  const FOLLOW_UP_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  async function checkAndSendFollowUps() {
    try {
      if (!kaiaRuntimeForOnboardingCheck) {
        console.log('[Follow-Up Scheduler] No runtime available, skipping check');
        return;
      }
      
      const db = kaiaRuntimeForOnboardingCheck.databaseAdapter as any;
      if (!db || !db.query) {
        console.log('[Follow-Up Scheduler] No database adapter, skipping check');
        return;
      }
      
      // Query for due follow-ups
      const result = await db.query(
        `SELECT f.*, m.user_id, m.matched_user_id 
         FROM follow_ups f 
         JOIN matches m ON f.match_id = m.id 
         WHERE f.status = 'pending' AND f.scheduled_for <= NOW()
         LIMIT 10`
      );
      
      if (!result.rows || result.rows.length === 0) {
        console.log('[Follow-Up Scheduler] No due follow-ups');
        return;
      }
      
      console.log(`[Follow-Up Scheduler] Found ${result.rows.length} due follow-ups`);
      
      // Get bot instance for sending messages
      const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!telegramToken) {
        console.log('[Follow-Up Scheduler] No Telegram token, cannot send follow-ups');
        return;
      }
      
      for (const followUp of result.rows) {
        try {
          const userId = followUp.user_id;
          const followUpType = followUp.type;
          
          // Get user's profile for personalization
          let userName = 'friend';
          let userLang = 'en';
          try {
            const cached = await kaiaRuntimeForOnboardingCheck.cacheManager.get(`onboarding_${userId}`);
            if (cached && typeof cached === 'object') {
              const state = cached as { profile?: any };
              userName = state.profile?.name || 'friend';
              userLang = state.profile?.language || 'en';
            }
          } catch (e) { /* use defaults */ }
          
          // Build follow-up message based on type
          let message = '';
          if (followUpType === '3_day_checkin') {
            const messages: Record<string, string> = {
              en: `Hey ${userName}! 👋 It's been 3 days since I connected you with someone. Did you reach out to them? Let me know how it went! 💜\n\nIf you'd like another match, just say "find me a match"!`,
              es: `¡Hola ${userName}! 👋 Han pasado 3 días desde que te conecté con alguien. ¿Te comunicaste con ellos? ¡Cuéntame cómo te fue! 💜\n\n¡Si quieres otra conexión, solo di "encuéntrame una conexión"!`,
              pt: `Olá ${userName}! 👋 Já se passaram 3 dias desde que te conectei com alguém. Você entrou em contato? Me conta como foi! 💜\n\nSe quiser outra conexão, diga "encontre uma conexão para mim"!`,
              fr: `Salut ${userName}! 👋 Ça fait 3 jours que je t'ai connecté avec quelqu'un. As-tu pris contact? Dis-moi comment ça s'est passé! 💜\n\nSi tu veux une autre connexion, dis "trouve-moi une connexion"!`
            };
            message = messages[userLang] || messages.en;
          } else if (followUpType === '7_day_next_match') {
            const messages: Record<string, string> = {
              en: `Hi ${userName}! 🚀 It's been a week since your last match. Ready for a new connection? Say "find me a match" and I'll introduce you to someone new! 💜`,
              es: `¡Hola ${userName}! 🚀 Ha pasado una semana desde tu última conexión. ¿Listo para una nueva? Di "encuéntrame una conexión" y te presentaré a alguien nuevo! 💜`,
              pt: `Olá ${userName}! 🚀 Faz uma semana desde sua última conexão. Pronto para uma nova? Diga "encontre uma conexão" e te apresento alguém novo! 💜`,
              fr: `Salut ${userName}! 🚀 Ça fait une semaine depuis ta dernière connexion. Prêt pour une nouvelle? Dis "trouve-moi une connexion" et je te présente quelqu'un! 💜`
            };
            message = messages[userLang] || messages.en;
          }
          
          if (message) {
            // Send via Telegram API directly
            await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: userId,
                text: message
              })
            });
            
            // Mark follow-up as sent
            await db.query(
              `UPDATE follow_ups SET status = 'sent', sent_at = NOW() WHERE id = $1`,
              [followUp.id]
            );
            
            console.log(`[Follow-Up Scheduler] ✅ Sent ${followUpType} to user ${userId}`);
          }
        } catch (sendErr) {
          console.error('[Follow-Up Scheduler] Error sending follow-up:', sendErr);
          // Mark as failed to avoid infinite retry
          await db.query(
            `UPDATE follow_ups SET status = 'failed' WHERE id = $1`,
            [followUp.id]
          ).catch(() => {});
        }
      }
    } catch (error) {
      console.error('[Follow-Up Scheduler] Error checking follow-ups:', error);
    }
  }
  
  // Start the follow-up scheduler
  console.log('[Follow-Up Scheduler] 📅 Starting scheduled follow-up checker...');
  setInterval(checkAndSendFollowUps, FOLLOW_UP_CHECK_INTERVAL);
  // Run once on startup after a short delay
  setTimeout(checkAndSendFollowUps, 10000);
  
  // Start daily report scheduler
  try {
    const { startDailyReportScheduler } = await import('./services/dailyReport.js');
    startDailyReportScheduler(kaiaRuntimeForOnboardingCheck);
  } catch (error) {
    console.error('[Daily Report] Failed to start daily report scheduler:', error);
  }
}

// Add global error handlers to catch unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  const errorMessage = reason?.message || reason?.toString() || 'Unknown error';
  const errorCode = reason?.code || reason?.response?.error_code || '';
  
  // Check if it's a 409 Conflict error from Telegram
  const is409Conflict = 
    errorCode === 409 ||
    errorMessage.includes('409') ||
    errorMessage.includes('Conflict') ||
    errorMessage.includes('terminated by other getUpdates');
  
  if (is409Conflict) {
    console.error('❌ Unhandled promise rejection: TelegramError: 409: Conflict: terminated by other getUpdates request; make sure that only one bot instance is running');
    console.error('💡 SOLUTION: Stop all other bot instances and restart this one');
    console.error('💡 Or wait 60 seconds and the conflict should resolve automatically');
    console.error('⚠️ This may cause the bot to be unstable');
    // Don't exit - let bot continue (it just won't receive messages)
    return;
  }
  
  // Check if it's a MongoDB/database connection error
  const isMongoError = 
    errorMessage.includes('MongoServerSelectionError') ||
    errorMessage.includes('MongoNetworkError') ||
    errorMessage.includes('ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR') ||
    errorMessage.includes('ReplicaSetNoPrimary') ||
    errorCode === 'ETIMEDOUT' ||
    errorCode === 'ENETUNREACH' ||
    errorMessage.toLowerCase().includes('failed to connect') ||
    errorMessage.toLowerCase().includes('database') ||
    errorMessage.toLowerCase().includes('testconnection') ||
    errorMessage.toLowerCase().includes('addparticipant');
  
  if (isMongoError) {
    console.error('⚠️ Unhandled database/MongoDB error (non-fatal):', errorMessage);
    console.error('⚠️ Bot will continue running but database features may be unavailable');
    // Don't exit - allow bot to continue
    return;
  }
  
  // Check if it's a message handling/sending error (from ElizaOS core)
  // These are often non-critical and can be safely ignored
  const isMessageError = 
    errorMessage.includes('Error handling message') ||
    errorMessage.includes('Error sending message') ||
    errorMessage.toLowerCase().includes('message') && errorMessage.toLowerCase().includes('error');
  
  if (isMessageError) {
    console.error('⚠️ Message processing error (non-fatal):', errorMessage);
    console.error('⚠️ Bot will continue running - this error is likely from ElizaOS core library');
    // Don't exit - allow bot to continue
    return;
  }
  
  // For other errors, log but don't exit
  console.error('❌ Unhandled promise rejection:', reason);
  console.error('⚠️ This may cause the bot to be unstable');
  // Don't exit immediately - let the bot try to recover
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
