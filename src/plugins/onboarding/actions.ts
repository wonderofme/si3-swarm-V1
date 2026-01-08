import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { getOnboardingStep, updateOnboardingStep, getUserProfile, formatProfileForDisplay } from './utils.js';
import { OnboardingStep, UserProfile } from './types.js';
import { getMessages, parseLanguageCode, LanguageCode } from './translations.js';
import { recordMessageSent } from '../../services/messageDeduplication.js';
import { recordActionExecution, getChatIdForRoomId } from '../../services/llmResponseInterceptor.js';
import { findSi3UserByEmail } from '../../services/si3Database.js';

// Helper function to check if email exists in the database
async function findUserByEmail(runtime: IAgentRuntime, email: string): Promise<{ userId: string; profile: any } | null> {
  try {
    const db = runtime.databaseAdapter as any;
    const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
    const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
    
    if (isMongo && db.getDb) {
      const mongoDb = await db.getDb();
      const cacheCollection = mongoDb.collection('cache');
      const docs = await cacheCollection.find({
        key: { $regex: /^onboarding_/ }
      }).toArray();
      
      for (const doc of docs) {
        try {
          const value = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;
          const profileEmail = value?.profile?.email || value?.email;
          if (profileEmail && profileEmail.toLowerCase() === email.toLowerCase()) {
            return {
              userId: doc.key.replace('onboarding_', ''),
              profile: value.profile || {}
            };
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
    } else if (db.query) {
      const result = await db.query(`
        SELECT key, value 
        FROM cache 
        WHERE key LIKE 'onboarding_%'
      `);
      
      for (const row of result.rows) {
        try {
          const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
          const profileEmail = value?.profile?.email || value?.email;
          if (profileEmail && profileEmail.toLowerCase() === email.toLowerCase()) {
            return {
              userId: row.key.replace('onboarding_', ''),
              profile: value.profile || {}
            };
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
    }
  } catch (error) {
    console.error('[Onboarding Action] Error finding user by email:', error);
  }
  
  return null;
}

// APPROACH #8.1: Send messages directly via Telegram API instead of using callbacks
// This bypasses ElizaOS's message flow entirely, preventing duplicate messages
async function sendDirectTelegramMessage(
  runtime: IAgentRuntime,
  roomId: string | undefined,
  userId: string | undefined,
  text: string
): Promise<void> {
  if (!roomId || !text || !text.trim()) {
    console.log('[Onboarding Action] ⚠️ Cannot send direct message - missing roomId or text');
    return;
  }
  
  try {
    // Get Telegram chat ID from roomId using the interceptor's mapping
    let telegramChatId = getChatIdForRoomId(roomId);
    
    if (!telegramChatId) {
      // Try to get from global map (set by Telegram client interceptor)
      const globalMap = (global as any).__telegramChatIdMap;
      if (globalMap && globalMap.size > 0) {
        // The global map stores messageText -> chatId, so we need to find the most recent one
        // This is a fallback - ideally we should have the mapping from roomId
        console.log('[Onboarding Action] ⚠️ Chat ID not in roomId mapping, trying global map (fallback)');
      }
      
      // Last resort: try to query database for the user's most recent Telegram message
      if (!telegramChatId && userId) {
        try {
          const adapter = runtime.databaseAdapter as any;
          const result = await adapter.query(
            `SELECT "roomId" FROM memories 
             WHERE "userId" = $1 
             AND content->>'source' = 'telegram'
             AND "roomId"::text ~ '^[0-9]+$'
             ORDER BY "createdAt" DESC 
             LIMIT 1`,
            [userId]
          );
          
          if (result.rows && result.rows.length > 0) {
            const foundChatId = result.rows[0].roomId;
            if (foundChatId && /^\d+$/.test(foundChatId)) {
              telegramChatId = foundChatId;
              console.log('[Onboarding Action] ✅ Found Telegram chat ID from database:', telegramChatId);
            }
          }
        } catch (error) {
          console.error('[Onboarding Action] Error querying for chat ID:', error);
        }
      }
    }
    
    if (!telegramChatId) {
      console.log('[Onboarding Action] ⚠️ Could not find Telegram chat ID for roomId:', roomId);
      console.log('[Onboarding Action] Falling back to callback method');
      return; // Will fall back to callback if available
    }
    
    // Send directly via Telegram API
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('[Onboarding Action] ⚠️ TELEGRAM_BOT_TOKEN not found, cannot send direct message');
      return;
    }
    
    console.log('[Onboarding Action] 📤 Sending message directly via Telegram API to chat:', telegramChatId);
    console.log('[Onboarding Action] Message:', text.substring(0, 50));
    
    const Telegraf = (await import('telegraf')).Telegraf;
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    
    await bot.telegram.sendMessage(telegramChatId, text);
    console.log('[Onboarding Action] ✅ Successfully sent message directly via Telegram API');
    
    // Record in deduplication system
    recordMessageSent(roomId, text);
    
    // Also create memory with empty text so it's logged but not sent again
    // This maintains the memory trail without causing duplicates
    if (roomId) {
      await runtime.messageManager.createMemory({
        id: undefined,
        userId: runtime.agentId,
        agentId: runtime.agentId,
        roomId: roomId as any, // Type assertion needed because roomId might not match UUID format exactly
        content: {
          text: '', // Empty text prevents ElizaOS from sending again
          source: 'telegram',
          metadata: {
            fromActionHandler: true,
            sentViaDirectAPI: true,
            originalText: text,
            timestamp: Date.now()
          }
        }
      });
    }
    
  } catch (error: any) {
    console.error('[Onboarding Action] ❌ Error sending direct Telegram message:', error);
    console.error('[Onboarding Action] Error message:', error.message);
    console.error('[Onboarding Action] Error code:', error.code);
    
    // Check if it's a MongoDB/database error - don't throw, just log
    const isMongoError = 
      error.message?.includes('MongoServerSelectionError') ||
      error.message?.includes('MongoNetworkError') ||
      error.message?.includes('ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR') ||
      error.message?.includes('ReplicaSetNoPrimary') ||
      error.message?.includes('database');
    
    if (isMongoError) {
      console.log('[Onboarding Action] ⚠️ Database/MongoDB error - not throwing to prevent cascading failures');
      return; // Don't throw, just return
    }
    
    // For other errors, log but don't throw to prevent cascading failures
    console.error('[Onboarding Action] ⚠️ Non-database error - logging but not throwing to prevent cascading failures');
    return; // Don't throw, just return
  }
}

// APPROACH #3.3: Make Action Silent (No Callback) - Send ONLY via Telegram API
// This completely bypasses ElizaOS message flow to prevent duplicates
async function safeCallback(
  callback: HandlerCallback | undefined,
  runtime: IAgentRuntime,
  roomId: string | undefined,
  userId: string | undefined,
  text: string
): Promise<void> {
  // APPROACH #3.3: Send ONLY via Telegram API, never use callback
  // This bypasses ElizaOS message creation entirely
  try {
    await sendDirectTelegramMessage(runtime, roomId, userId, text);
    console.log('[Onboarding Action] ✅ Sent via direct Telegram API (no callback used)');
    return; // Success, never use callback
  } catch (error) {
    console.error('[Onboarding Action] ❌ Direct send failed, NOT using callback:', error);
    // Do NOT fall back to callback - this would create duplicates
    // If direct send fails, we just log the error
    throw error;
  }
}

function generateSummaryText(profile: UserProfile): string {
  const lang = profile.language || 'en';
  const msgs = getMessages(lang);
  return `${msgs.SUMMARY_TITLE}\n\n` +
    `${msgs.SUMMARY_NAME} ${profile.name || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_LOCATION} ${profile.location || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_EMAIL} ${profile.email || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_ROLES} ${profile.roles?.join(', ') || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_INTERESTS} ${profile.interests?.join(', ') || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_GOALS} ${profile.connectionGoals?.join(', ') || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_EVENTS} ${profile.events?.join(', ') || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_SOCIALS} ${profile.socials?.join(', ') || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_TELEGRAM} ${profile.telegramHandle ? '@' + profile.telegramHandle : msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_GENDER} ${profile.gender || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_NOTIFICATIONS} ${profile.notifications || msgs.SUMMARY_NOT_PROVIDED}\n\n` +
    `${msgs.EDIT_NAME}\n` +
    `${msgs.EDIT_LOCATION}\n` +
    `${msgs.EDIT_ROLES}\n` +
    `${msgs.EDIT_INTERESTS}\n` +
    `${msgs.EDIT_GOALS}\n` +
    `${msgs.EDIT_EVENTS}\n` +
    `${msgs.EDIT_SOCIALS}\n` +
    `${msgs.EDIT_TELEGRAM}\n` +
    `${msgs.EDIT_GENDER}\n` +
    `${msgs.EDIT_NOTIFICATIONS}\n\n` +
    `${msgs.CONFIRM}`;
}

function isRestartCommand(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('restart') || 
         lower.includes('pretend this is my first') ||
         lower.includes('start over') ||
         lower.includes('begin again') ||
         lower.includes('can we start') ||
         lower.includes('start the onboarding') ||
         lower.includes('start onboarding all over');
}

export const continueOnboardingAction: Action = {
  name: 'CONTINUE_ONBOARDING',
  description: 'Handles onboarding flow - sends exact scripted messages via callback.',
  similes: ['NEXT_STEP', 'SAVE_PROFILE', 'ANSWER_ONBOARDING', 'EDIT_PROFILE'],
  // CRITICAL FIX: Prevent LLM from sending initial message before action executes
  // This prevents the "double message" where LLM1 speaks and Action speaks
  suppressInitialMessage: true,
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const step = await getOnboardingStep(runtime, message.userId);
    const text = (message.content.text || '').trim();
    
    // Always allow if restart command is detected (even if COMPLETED)
    if (isRestartCommand(text)) {
      console.log('[Onboarding Action] Validate - restart command detected:', text, '- allowing action');
      return true;
    }
    
    // Allow if not completed, or if user is editing
    const profile = await getUserProfile(runtime, message.userId);
    const isValid = step !== 'COMPLETED' || profile.isEditing === true;
    console.log('[Onboarding Action] Validate - step:', step, 'isEditing:', profile.isEditing, 'isValid:', isValid, 'text:', text.substring(0, 50));
    return isValid;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    console.log('[Onboarding Action] Handler started');
    
    // CRITICAL: Acquire message lock to prevent LLM from sending messages during action execution
    const roomId = message.roomId;
    if (roomId) {
      const { acquireMessageLock, releaseMessageLock } = await import('../../services/llmResponseInterceptor.js');
      acquireMessageLock(roomId);
      console.log('[Onboarding Action] 🔒 Acquired message lock');
    }
    
    try {
      let currentStep = await getOnboardingStep(runtime, message.userId);
      console.log('[Onboarding Action] Current step:', currentStep);
      const text = message.content.text;
      const profile = await getUserProfile(runtime, message.userId);
      const isEditing = profile.isEditing || false;
      console.log('[Onboarding Action] Has callback:', !!callback);
      console.log('[Onboarding Action] roomId:', roomId);
      console.log('[Onboarding Action] userId:', message.userId);

    // Get user's language preference (default to English)
    const userLang: LanguageCode = profile.language || 'en';
    const msgs = getMessages(userLang);

    // Check for restart commands - MUST be checked BEFORE getting userLang
    // to ensure we always use English on restart
    if (isRestartCommand(text)) {
      console.log('[Onboarding Action] Restart command detected, resetting onboarding');
      // Clear the entire onboarding state by setting a fresh state
      const freshState = {
        step: 'ASK_NAME' as OnboardingStep, // Set to ASK_NAME so LLM can send the greeting
        profile: {} as UserProfile // Clear all profile data including language
      };
      await runtime.cacheManager.set(`onboarding_${message.userId}`, freshState as any);
      
      // CRITICAL: Update onboarding step cache immediately to ASK_NAME
      // This ensures the provider gives the correct message to the LLM
      const { updateOnboardingStepCache } = await import('../../services/llmResponseInterceptor.js');
      if (typeof updateOnboardingStepCache === 'function') {
        updateOnboardingStepCache(message.userId, 'ASK_NAME');
      }
      
      // Record action execution immediately after state change
      if (roomId) recordActionExecution(roomId);
      
      // NEW APPROACH: Don't send message via callback - LLM will send it based on provider instructions
      console.log('[Onboarding Action] State updated to ASK_NAME - LLM will send greeting via provider');
      return true;
    }

    // START -> ASK_LANGUAGE (new flow: Language first)
    if (currentStep === 'NONE') {
      console.log('[Onboarding Action] Step is NONE, updating to ASK_LANGUAGE');
      // Check what fields already exist
      if (profile.language) {
        if (profile.name) {
          if (profile.email) {
            // All initial fields exist, check if we need to continue onboarding
            if (profile.roles && profile.roles.length > 0) {
              // Profile is mostly complete, skip to confirmation or next step
              await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_ROLE');
              if (roomId) recordActionExecution(roomId);
              console.log('[Onboarding Action] State updated to ASK_ROLE - LLM will send message via provider');
            } else {
              // Missing roles, continue from there
              await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_ROLE');
              if (roomId) recordActionExecution(roomId);
              console.log('[Onboarding Action] State updated to ASK_ROLE - LLM will send message via provider');
            }
          } else {
            // Missing email, ask for it
            await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_EMAIL');
            if (roomId) recordActionExecution(roomId);
            console.log('[Onboarding Action] State updated to ASK_EMAIL - LLM will send message via provider');
          }
        } else {
          // Missing name, ask for it
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_NAME');
          if (roomId) recordActionExecution(roomId);
          console.log('[Onboarding Action] State updated to ASK_NAME - LLM will send message via provider');
        }
      } else {
        // No language, start with language question
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LANGUAGE');
        if (roomId) recordActionExecution(roomId);
        // LLM will send the language question via provider
        console.log('[Onboarding Action] State updated to ASK_LANGUAGE - LLM will send message via provider');
      }
      return true;
    }

    // Process user input and advance to next step
    switch (currentStep) {
      case 'ASK_LANGUAGE':
        console.log('[Onboarding Action] Processing ASK_LANGUAGE, user said:', text);
        const langCode = parseLanguageCode(text);
        if (!langCode) {
          // Invalid language selection - stay on ASK_LANGUAGE, AI will ask again
          console.log('[Onboarding Action] Invalid language selection, staying on ASK_LANGUAGE');
          break;
        }
        // Update language and move to name step (new flow: Language → Name → Email)
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_NAME', { language: langCode });
        if (roomId) recordActionExecution(roomId);
        // LLM will send the name question via provider
        console.log('[Onboarding Action] State updated to ASK_NAME - LLM will send message via provider');
        break;

      case 'ASK_NAME':
        console.log('[Onboarding Action] Processing ASK_NAME, user said:', text);
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { name: text, isEditing: false, editingField: undefined });
          if (roomId) recordActionExecution(roomId);
        } else {
          // Save name and move to email step (new flow: Name → Email)
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_EMAIL', { name: text });
          if (roomId) recordActionExecution(roomId);
          // LLM will send the email question via provider
          console.log('[Onboarding Action] State updated to ASK_EMAIL - LLM will send message via provider');
        }
        break;

      case 'ASK_LOCATION':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { location: text, isEditing: false, editingField: undefined });
          if (roomId) recordActionExecution(roomId);
        } else {
          // Handle "next" to skip optional question
          const locationValue = text.toLowerCase().trim() === 'next' ? undefined : text;
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_EMAIL', { location: locationValue });
          if (roomId) recordActionExecution(roomId);
          // LLM will send the email question via provider
          console.log('[Onboarding Action] State updated to ASK_EMAIL - LLM will send message via provider');
        }
        break;

      case 'ASK_EMAIL':
        console.log('[Onboarding Action] Processing ASK_EMAIL, user said:', text);
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emailText = text.trim();
        
        if (!emailRegex.test(emailText)) {
          // Invalid email format - ask again
          console.log('[Onboarding Action] Invalid email format, asking again');
          await sendDirectTelegramMessage(
            runtime,
            roomId,
            message.userId,
            `${msgs.EMAIL}\n\n⚠️ Please enter a valid email address (e.g., name@example.com)`
          );
          if (roomId) recordActionExecution(roomId);
          return true;
        }
        
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { email: emailText, isEditing: false, editingField: undefined });
          if (roomId) recordActionExecution(roomId);
        } else {
          // First, check SI<3> database for user roles
          let si3User = null;
          let si3Roles: string[] = [];
          let si3Interests: string[] = [];
          let si3PersonalValues: string[] = [];
          
          try {
            si3User = await findSi3UserByEmail(emailText, 'si3Users', 'email');
            if (si3User) {
              si3Roles = si3User.roles || [];
              si3Interests = si3User.interests || [];
              si3PersonalValues = si3User.personalValues || [];
              console.log(`[Onboarding Action] Found SI<3> user with roles: ${si3Roles.join(', ')}`);
            } else {
              console.log(`[Onboarding Action] Email ${emailText} not found in SI<3> database`);
            }
          } catch (error: any) {
            console.error('[Onboarding Action] Error searching SI<3> database:', error.message);
            // Continue with onboarding even if SI<3> lookup fails
          }
          
          // INTENTION: 
          // 1. If user completed Kaia onboarding (in SI U database) -> grant Telegram access
          // 2. If user is SI<3> member but hasn't done Kaia onboarding -> pre-fill and continue in Telegram
          // 3. If not found anywhere -> direct to web onboarding
          
          // Check SI U database first (where completed Kaia users are saved)
          let siuUser = null;
          try {
            const { findSiuUserByEmail } = await import('../../services/siuDatabaseService.js');
            siuUser = await findSiuUserByEmail(emailText);
            
            if (siuUser && siuUser.onboardingCompletedAt) {
              // User completed Kaia onboarding - load their profile and grant Telegram access
              console.log(`[Onboarding Action] ✅ Found user in SI U database who completed Kaia onboarding: ${emailText}`);
              
              // Convert SI U database format to UserProfile format
              const loadedProfile: any = {
                name: siuUser.name || siuUser.username,
                email: siuUser.email,
                language: siuUser.language || 'en',
                location: siuUser.location,
                gender: siuUser.gender,
                entryMethod: siuUser.entryMethod || 'email',
                walletAddress: siuUser.wallet_address,
                siuName: siuUser.siuName || siuUser.username,
                userTier: siuUser.userTier || 'explorer',
                roles: siuUser.roles || [],
                interests: siuUser.interests || [],
                connectionGoals: siuUser.connectionGoals || [],
                events: siuUser.events || [],
                socials: siuUser.digitalLinks || [],
                telegramHandle: siuUser.telegramHandle,
                diversityResearchInterest: siuUser.diversityResearchInterest,
                notifications: siuUser.notificationSettings ? 
                  (siuUser.notificationSettings.emailUpdates ? 'Yes' : 'No') : 'Not sure',
                onboardingCompletedAt: siuUser.onboardingCompletedAt,
                onboardingSource: siuUser.onboardingSource || 'web',
                isConfirmed: true
              };
              
              // Load profile into cache and set state to COMPLETED
              await updateOnboardingStep(runtime, message.userId, roomId, 'COMPLETED', loadedProfile);
              
              // Welcome them to Telegram
              const welcomeMessages: Record<string, string> = {
                en: `Welcome to Telegram, ${loadedProfile.name || 'there'}! 👋\n\nI recognized your email from your Kaia onboarding. You're all set to use me here on Telegram! 💜\n\nYou can:\n• Say "find me a match" to connect with someone\n• Say "my profile" to view your profile\n• Say "update" to edit your profile\n• Just chat with me!`,
                es: `¡Bienvenido a Telegram, ${loadedProfile.name || 'allí'}! 👋\n\nReconocí tu correo electrónico de tu registro en Kaia. ¡Ya estás listo para usarme aquí en Telegram! 💜\n\nPuedes:\n• Di "encuéntrame una conexión" para conectar con alguien\n• Di "mi perfil" para ver tu perfil\n• Di "actualizar" para editar tu perfil\n• ¡Solo chatea conmigo!`,
                pt: `Bem-vindo ao Telegram, ${loadedProfile.name || 'aí'}! 👋\n\nReconheci seu e-mail do seu registro no Kaia. Você está pronto para me usar aqui no Telegram! 💜\n\nVocê pode:\n• Diga "encontre uma conexão" para conectar com alguém\n• Diga "meu perfil" para ver seu perfil\n• Diga "atualizar" para editar seu perfil\n• Apenas converse comigo!`,
                fr: `Bienvenue sur Telegram, ${loadedProfile.name || 'là'}! 👋\n\nJ'ai reconnu votre e-mail de votre inscription Kaia. Vous êtes prêt à m'utiliser ici sur Telegram! 💜\n\nVous pouvez:\n• Dites "trouvez-moi une connexion" pour vous connecter avec quelqu'un\n• Dites "mon profil" pour voir votre profil\n• Dites "mettre à jour" pour modifier votre profil\n• Discutez simplement avec moi!`
              };
              
              await sendDirectTelegramMessage(
                runtime,
                roomId,
                message.userId,
                welcomeMessages[loadedProfile.language || 'en'] || welcomeMessages.en
              );
              if (roomId) recordActionExecution(roomId);
              console.log('[Onboarding Action] ✅ Loaded Kaia user profile - Telegram access granted');
              return true;
            }
          } catch (siuError) {
            console.error('[Onboarding Action] Error checking SI U database:', siuError);
            // Continue to check SI<3> database
          }
          
          // Check if user is SI<3> member but hasn't completed Kaia onboarding
          // siuUser will be null if not found, or will exist but onboardingCompletedAt will be falsy if not completed
          if (si3User && (!siuUser || !siuUser.onboardingCompletedAt)) {
            // User is SI<3> member - pre-fill their data and continue onboarding in Telegram
            console.log(`[Onboarding Action] Found SI<3> member who hasn't completed Kaia onboarding - pre-filling and continuing in Telegram`);
            
            // Pre-fill profile with SI<3> data
            const preFilledProfile: any = {
              email: emailText,
              name: si3User.name || si3User.username || profile.name,
              location: si3User.location || profile.location,
              roles: si3Roles.length > 0 ? si3Roles : (si3User.roles || []),
              interests: si3Interests.length > 0 ? si3Interests : (si3User.interests || []),
              personalValues: si3PersonalValues.length > 0 ? si3PersonalValues : (si3User.personalValues || []),
              si3Roles: si3Roles, // Save for platform detection
              onboardingSource: 'telegram' // Track that they're completing via Telegram
            };
            
            // Determine next step based on what we have
            // Skip steps for data we already have from SI<3>
            let nextStep: OnboardingStep = 'ASK_LOCATION';
            
            if (preFilledProfile.location) {
              // We have location, skip to roles
              nextStep = 'ASK_ROLE';
            }
            
            // If we have roles from SI<3>, we can pre-fill them but still ask to confirm/add more
            if (preFilledProfile.roles && preFilledProfile.roles.length > 0) {
              // We have roles, but we'll still ask to confirm/add more
              // The roles question will show their existing roles
            }
            
            // Update state with pre-filled data
            await updateOnboardingStep(runtime, message.userId, roomId, nextStep, preFilledProfile);
            if (roomId) recordActionExecution(roomId);
            
            // Welcome message recognizing them as SI<3> member
            const welcomeMessages: Record<string, string> = {
              en: `Welcome back! 👋 I recognize you from SI<3>. I've pre-filled some of your information to make this quick.\n\nLet's continue with your Kaia onboarding!`,
              es: `¡Bienvenido de nuevo! 👋 Te reconozco de SI<3>. He prellenado parte de tu información para que sea rápido.\n\n¡Continuemos con tu registro en Kaia!`,
              pt: `Bem-vindo de volta! 👋 Reconheço você do SI<3>. Preenchi algumas de suas informações para tornar isso rápido.\n\nVamos continuar com seu registro no Kaia!`,
              fr: `Bon retour! 👋 Je vous reconnais de SI<3>. J'ai pré-rempli certaines de vos informations pour que ce soit rapide.\n\nContinuons avec votre inscription Kaia!`
            };
            
            await sendDirectTelegramMessage(
              runtime,
              roomId,
              message.userId,
              welcomeMessages[userLang] || welcomeMessages.en
            );
            console.log('[Onboarding Action] ✅ Pre-filled SI<3> member data - continuing onboarding in Telegram');
            // LLM will send the next question via provider
            return true;
          }
          
          // Check if email already exists in Kaia cache (fallback for edge cases)
          const existingUser = await findUserByEmail(runtime, emailText);
          
          if (existingUser && existingUser.userId !== message.userId) {
            // Email exists in cache for a different user - ask if they want to continue
            console.log(`[Onboarding Action] Email ${emailText} exists in cache for user ${existingUser.userId}`);
            await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_PROFILE_CHOICE', { 
              email: emailText,
              existingUserId: existingUser.userId,
              existingProfile: existingUser.profile,
              roles: si3Roles.length > 0 ? si3Roles : undefined,
              interests: si3Interests.length > 0 ? si3Interests : undefined,
              personalValues: si3PersonalValues.length > 0 ? si3PersonalValues : undefined
            });
            if (roomId) recordActionExecution(roomId);
            console.log('[Onboarding Action] State updated to ASK_PROFILE_CHOICE - LLM will send message via provider');
          } else {
            // User not found in SI U or SI<3> - direct them to web onboarding
            const redirectMessages: Record<string, string> = {
              en: `Hi! 👋\n\nTo use me on Telegram, you'll need to complete onboarding first.\n\nPlease visit our web platform to create your profile, then come back here to Telegram!\n\nOnce you've completed onboarding, I'll recognize you by your email and you'll have full access here. 💜`,
              es: `¡Hola! 👋\n\nPara usarme en Telegram, primero necesitas completar el registro.\n\nPor favor visita nuestra plataforma web para crear tu perfil, ¡luego regresa aquí a Telegram!\n\nUna vez que hayas completado el registro, te reconoceré por tu correo electrónico y tendrás acceso completo aquí. 💜`,
              pt: `Olá! 👋\n\nPara me usar no Telegram, você precisará completar o registro primeiro.\n\nPor favor, visite nossa plataforma web para criar seu perfil, depois volte aqui para o Telegram!\n\nDepois de completar o registro, eu te reconhecerei pelo seu e-mail e você terá acesso completo aqui. 💜`,
              fr: `Bonjour! 👋\n\nPour m'utiliser sur Telegram, vous devez d'abord compléter l'inscription.\n\nVeuillez visiter notre plateforme web pour créer votre profil, puis revenez ici sur Telegram!\n\nUne fois que vous aurez complété l'inscription, je vous reconnaîtrai par votre e-mail et vous aurez un accès complet ici. 💜`
            };
            
            await sendDirectTelegramMessage(
              runtime,
              roomId,
              message.userId,
              redirectMessages[userLang] || redirectMessages.en
            );
            if (roomId) recordActionExecution(roomId);
            console.log('[Onboarding Action] ⚠️ User not found in SI U or SI<3> database - directing to web onboarding');
            // Don't continue onboarding - they need to complete on web first
            return true;
          }
        }
        break;

      case 'ASK_PROFILE_CHOICE':
        console.log('[Onboarding Action] Processing ASK_PROFILE_CHOICE, user said:', text);
        const choice = text.trim();
        
        if (choice === '1' || choice.toLowerCase().includes('continue') || choice.toLowerCase().includes('existing')) {
          // User wants to continue with existing profile
          const existingUserId = (profile as any).existingUserId;
          const existingProfile = (profile as any).existingProfile;
          
          if (existingUserId && existingProfile) {
            // Use the original userId, not the current one
            // Create a mapping from current userId to original userId
            console.log(`[Onboarding Action] Linking Telegram userId ${message.userId} to original userId ${existingUserId}`);
            
            // Store mapping: current userId -> original userId
            const db = runtime.databaseAdapter as any;
            const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
            const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
            
            try {
              if (isMongo && db.getDb) {
                const mongoDb = await db.getDb();
                await mongoDb.collection('user_mappings').updateOne(
                  { platform_user_id: message.userId },
                  { 
                    $set: { 
                      primary_user_id: existingUserId,
                      platform: 'telegram',
                      updated_at: new Date()
                    },
                    $setOnInsert: {
                      created_at: new Date()
                    }
                  },
                  { upsert: true }
                );
              } else if (db.query) {
                await db.query(
                  `INSERT INTO user_mappings (platform_user_id, primary_user_id, platform, created_at, updated_at)
                   VALUES ($1::text, $2::text, 'telegram', NOW(), NOW())
                   ON CONFLICT (platform_user_id) DO UPDATE SET primary_user_id = $2::text, updated_at = NOW()`,
                  [message.userId, existingUserId]
                );
              }
            } catch (mappingError) {
              console.error('[Onboarding Action] Error creating user mapping:', mappingError);
              // Continue anyway - mapping is optional
            }
            
            // Load the existing profile (it's already under the original userId)
            // For Telegram, we'll use the mapping to find the profile
            // But also create a reference under the Telegram userId for quick access
            const { getOnboardingState } = await import('./utils.js');
            const originalState = await getOnboardingState(runtime, existingUserId as any);
            
            // Merge SI<3> roles/interests if available (from profile stored during ASK_EMAIL)
            const si3Roles = (profile as any).roles || [];
            const si3Interests = (profile as any).interests || [];
            const si3PersonalValues = (profile as any).personalValues || [];
            
            // Merge roles: combine existing with SI<3> roles (avoid duplicates)
            const mergedRoles = [...new Set([
              ...(existingProfile.roles || []),
              ...(originalState.profile.roles || []),
              ...si3Roles
            ])];
            
            // Merge interests: combine existing with SI<3> interests (avoid duplicates)
            const mergedInterests = [...new Set([
              ...(existingProfile.interests || []),
              ...(originalState.profile.interests || []),
              ...si3Interests
            ])];
            
            // Merge personal values: combine existing with SI<3> values (avoid duplicates)
            const mergedPersonalValues = [...new Set([
              ...(existingProfile.personalValues || []),
              ...(originalState.profile.personalValues || []),
              ...si3PersonalValues
            ])];
            
            // Update the profile under the original userId with the email and merged data
            const mergedProfile = {
              ...originalState.profile,
              ...existingProfile,
              email: profile.email, // Keep the email they just entered
              roles: mergedRoles.length > 0 ? mergedRoles : undefined,
              interests: mergedInterests.length > 0 ? mergedInterests : undefined,
              personalValues: mergedPersonalValues.length > 0 ? mergedPersonalValues : undefined,
              onboardingCompletedAt: existingProfile.onboardingCompletedAt || originalState.profile.onboardingCompletedAt || new Date()
            };
            
            await updateOnboardingStep(runtime, existingUserId as any, roomId, 'COMPLETED', mergedProfile);
            
            // Also create a reference under Telegram userId pointing to original
            await runtime.cacheManager.set(`onboarding_${message.userId}`, {
              step: 'COMPLETED',
              profile: mergedProfile,
              primaryUserId: existingUserId, // Store reference to primary userId
              isLinked: true
            } as any);
            
            if (roomId) recordActionExecution(roomId);
            
            // Send confirmation message
            const profileDisplay = formatProfileForDisplay({ ...existingProfile, email: profile.email }, userLang);
            await sendDirectTelegramMessage(
              runtime,
              roomId,
              message.userId,
              `${msgs.COMPLETION}\n\n${profileDisplay}`
            );
            console.log('[Onboarding Action] Loaded existing profile - user can now use the bot');
          } else {
            // Fallback: continue with current profile
            await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LOCATION');
            if (roomId) recordActionExecution(roomId);
            console.log('[Onboarding Action] State updated to ASK_LOCATION - LLM will send message via provider');
          }
        } else if (choice === '2' || choice.toLowerCase().includes('new') || choice.toLowerCase().includes('recreate')) {
          // User wants to create a new profile - continue from location
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LOCATION');
          if (roomId) recordActionExecution(roomId);
          // LLM will send the location question via provider
          console.log('[Onboarding Action] State updated to ASK_LOCATION - LLM will send message via provider');
        } else {
          // Invalid choice - ask again
          console.log('[Onboarding Action] Invalid profile choice, asking again');
          await sendDirectTelegramMessage(
            runtime,
            roomId,
            message.userId,
            `${msgs.PROFILE_EXISTS}\n\n${msgs.PROFILE_CHOICE}`
          );
          if (roomId) recordActionExecution(roomId);
        }
        break;

      case 'ASK_ROLE':
        const roleParts = text.split(/[,\s]+and\s+/i);
        const roleNumbers = roleParts[0].split(/[,\s]+/).filter(s => /^\d+$/.test(s.trim()));
        const roleText = roleParts[1] || '';
        const roles = [...roleNumbers.map(n => {
          const roleMap: Record<string, string> = {
            '1': 'Founder/Builder', '2': 'Marketing/BD/Partnerships', '3': 'DAO Council Member/Delegate',
            '4': 'Community Leader', '5': 'Investor/Grant Program Operator', '6': 'Early Web3 Explorer',
            '7': 'Media', '8': 'Artist', '9': 'Developer', '10': 'Other'
          };
          return roleMap[n.trim()];
        }).filter(Boolean), ...(roleText ? [roleText.trim()] : [])];
        
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { roles, isEditing: false, editingField: undefined });
          if (roomId) recordActionExecution(roomId);
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_INTERESTS', { roles }); 
          if (roomId) recordActionExecution(roomId);
          // LLM will send the interests question via provider
          console.log('[Onboarding Action] State updated to ASK_INTERESTS - LLM will send message via provider');
        }
        break;

      case 'ASK_INTERESTS':
        const interestParts = text.split(/[,\s]+and\s+/i);
        const interestNumbers = interestParts[0].split(/[,\s]+/).filter(s => /^\d+$/.test(s.trim()));
        const interestText = interestParts[1] || '';
        const interests = [...interestNumbers.map(n => {
          const interestMap: Record<string, string> = {
            '1': 'Web3 Growth Marketing', '2': 'Business Development & Partnerships', '3': 'Education 3.0',
            '4': 'AI', '5': 'Cybersecurity', '6': 'DAOs', '7': 'Tokenomics', '8': 'Fundraising', '9': 'Other'
          };
          return interestMap[n.trim()];
        }).filter(Boolean), ...(interestText ? [interestText.trim()] : [])];
        
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { interests, isEditing: false, editingField: undefined });
          if (roomId) recordActionExecution(roomId);
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_CONNECTION_GOALS', { interests });
          if (roomId) recordActionExecution(roomId);
          // LLM will send the goals question via provider
          console.log('[Onboarding Action] State updated to ASK_CONNECTION_GOALS - LLM will send message via provider');
        }
        break;

      case 'ASK_CONNECTION_GOALS':
        const goalParts = text.split(/[,\s]+and\s+/i);
        const goalNumbers = goalParts[0].split(/[,\s]+/).filter(s => /^\d+$/.test(s.trim()));
        const goalText = goalParts[1] || '';
        const connectionGoals = [...goalNumbers.map(n => {
          const goalMap: Record<string, string> = {
            '1': 'Startups to invest in',
            '2': 'Investors/grant programs',
            '3': 'Growth tools, strategies, and/or support',
            '4': 'Sales/BD tools, strategies and/or support',
            '5': "Communities and/or DAO's to join",
            '6': 'New job opportunities'
          };
          return goalMap[n.trim()];
        }).filter(Boolean), ...(goalText ? [goalText.trim()] : [])];
        
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { connectionGoals, isEditing: false, editingField: undefined });
          if (roomId) recordActionExecution(roomId);
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_EVENTS', { connectionGoals }); 
          if (roomId) recordActionExecution(roomId);
          // LLM will send the events question via provider
          console.log('[Onboarding Action] State updated to ASK_EVENTS - LLM will send message via provider');
        }
        break;

      case 'ASK_EVENTS':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { events: [text], isEditing: false, editingField: undefined });
          if (roomId) recordActionExecution(roomId);
        } else {
          // Handle "next" to skip optional question
          const eventsValue = text.toLowerCase().trim() === 'next' ? [] : [text];
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_SOCIALS', { events: eventsValue });
          if (roomId) recordActionExecution(roomId);
          // LLM will send the socials question via provider
          console.log('[Onboarding Action] State updated to ASK_SOCIALS - LLM will send message via provider');
        }
        break;

      case 'ASK_SOCIALS':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { socials: [text], isEditing: false, editingField: undefined });
          if (roomId) recordActionExecution(roomId);
        } else {
          // Handle "next" to skip optional question
          const socialsValue = text.toLowerCase().trim() === 'next' ? [] : [text];
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_TELEGRAM_HANDLE', { socials: socialsValue });
          if (roomId) recordActionExecution(roomId);
          // LLM will send the Telegram question via provider
          console.log('[Onboarding Action] State updated to ASK_TELEGRAM_HANDLE - LLM will send message via provider');
        }
        break;

      case 'ASK_TELEGRAM_HANDLE':
        let telegramHandle = text.trim();
        if (telegramHandle.startsWith('@')) telegramHandle = telegramHandle.substring(1);
        const handleToSave = (telegramHandle.toLowerCase() === 'skip' || telegramHandle === '') ? undefined : telegramHandle;
        
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { telegramHandle: handleToSave, isEditing: false, editingField: undefined });
          if (roomId) recordActionExecution(roomId);
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_GENDER', { telegramHandle: handleToSave });
          if (roomId) recordActionExecution(roomId);
          // LLM will send the gender question via provider
          console.log('[Onboarding Action] State updated to ASK_GENDER - LLM will send message via provider');
        }
        break;

      case 'ASK_GENDER':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { gender: text, isEditing: false, editingField: undefined });
          if (roomId) recordActionExecution(roomId);
        } else {
          // Check if user wants to participate in diversity research
          const lowerText = text.toLowerCase().trim();
          const saidYes = lowerText.includes('yes') || lowerText.includes('sí') || lowerText.includes('sim') || lowerText.includes('oui');
          const saidNo = lowerText.includes('no') && !lowerText.includes('not sure');
          const isNext = lowerText === 'next';
          const wantsDiversityResearch = saidYes && !saidNo && !isNext;
          
          let diversityResearchInterest: string | undefined;
          if (wantsDiversityResearch) {
            diversityResearchInterest = 'Yes';
            // Track Telegram handle for diversity research
            try {
              const profile = await getUserProfile(runtime, message.userId);
              const telegramHandle = profile.telegramHandle || roomId?.toString() || message.userId;
              
              // Save to MongoDB collection for diversity research tracking
              const db = runtime.databaseAdapter as any;
              if (db && db.getDb) {
                const mongoDb = await db.getDb();
                const diversityCollection = mongoDb.collection('diversity_research');
                // Check if already exists
                const existing = await diversityCollection.findOne({ userId: message.userId });
                if (!existing) {
                  await diversityCollection.insertOne({
                    userId: message.userId,
                    telegramHandle: telegramHandle,
                    roomId: roomId,
                    interestedAt: new Date(),
                    status: 'pending'
                  });
                  console.log('[Diversity Research] ✅ Tracked Telegram handle for diversity research:', telegramHandle);
                } else {
                  // Update existing record
                  await diversityCollection.updateOne(
                    { userId: message.userId },
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
            diversityResearchInterest = 'No';
            // Remove from diversity research tracking if they said No
            try {
              const db = runtime.databaseAdapter as any;
              if (db && db.getDb) {
                const mongoDb = await db.getDb();
                const diversityCollection = mongoDb.collection('diversity_research');
                await diversityCollection.deleteOne({ userId: message.userId });
                console.log('[Diversity Research] ✅ Removed from diversity research tracking');
              }
            } catch (error) {
              console.error('[Diversity Research] Error removing from tracking:', error);
            }
          }
          
          // Handle "next" to skip optional question
          const genderValue = isNext ? undefined : (wantsDiversityResearch ? undefined : text);
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_NOTIFICATIONS', { gender: genderValue, diversityResearchInterest });
          if (roomId) recordActionExecution(roomId);
          // LLM will send the notifications question via provider
          console.log('[Onboarding Action] State updated to ASK_NOTIFICATIONS - LLM will send message via provider');
        }
        break;

      case 'ASK_NOTIFICATIONS':
        await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { notifications: text, isEditing: false, editingField: undefined });
        if (roomId) recordActionExecution(roomId);
        console.log('[Onboarding Action] Updated state to CONFIRMATION - AI will generate summary');
        break;

      case 'CONFIRMATION':
        if (text.toLowerCase().includes('confirm') || text.toLowerCase().includes('yes') || text.toLowerCase().includes('check')) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'COMPLETED', { isConfirmed: true, isEditing: false, editingField: undefined });
          if (roomId) recordActionExecution(roomId);
          console.log('[Onboarding Action] Updated state to COMPLETED - AI will generate completion message');
        } else if (text.toLowerCase().includes('edit')) {
          const lowerText = text.toLowerCase();
          let editStep: OnboardingStep | null = null;
          let editField: string | undefined = undefined;
          
          if (lowerText.includes('name')) { editStep = 'ASK_NAME'; editField = 'name'; }
          else if (lowerText.includes('location')) { editStep = 'ASK_LOCATION'; editField = 'location'; }
          else if (lowerText.includes('email')) { editStep = 'ASK_EMAIL'; editField = 'email'; }
          else if (lowerText.includes('professional') || lowerText.includes('role')) { editStep = 'ASK_ROLE'; editField = 'roles'; }
          else if (lowerText.includes('learning') || lowerText.includes('interest')) { editStep = 'ASK_INTERESTS'; editField = 'interests'; }
          else if (lowerText.includes('connection') || lowerText.includes('goal')) { editStep = 'ASK_CONNECTION_GOALS'; editField = 'connectionGoals'; }
          else if (lowerText.includes('conference') || lowerText.includes('event')) { editStep = 'ASK_EVENTS'; editField = 'events'; }
          else if (lowerText.includes('personal') || lowerText.includes('link') || lowerText.includes('social')) { editStep = 'ASK_SOCIALS'; editField = 'socials'; }
          else if (lowerText.includes('telegram')) { editStep = 'ASK_TELEGRAM_HANDLE'; editField = 'telegramHandle'; }
          else if (lowerText.includes('gender')) { editStep = 'ASK_GENDER'; editField = 'gender'; }
          else if (lowerText.includes('notification') || lowerText.includes('collab')) { editStep = 'ASK_NOTIFICATIONS'; editField = 'notifications'; }
          
          if (editStep) {
            await updateOnboardingStep(runtime, message.userId, roomId, editStep, { isEditing: true, editingField: editField });
            if (roomId) recordActionExecution(roomId);
            console.log(`[Onboarding Action] Updated state to ${editStep} for editing - AI will generate edit question`);
          } else {
            // No edit field matched, but action still executed - record it to prevent duplicate LLM response
            if (roomId) recordActionExecution(roomId);
          }
        } else {
          // User input doesn't match confirm/edit, but action handler executed
          // Record action execution to prevent duplicate LLM response from "No action found" follow-up
          if (roomId) recordActionExecution(roomId);
          console.log('[Onboarding Action] CONFIRMATION step - action executed but no state change, recording to prevent duplicate');
        }
        break;
    }

    // Note: Action execution is now recorded immediately after each updateOnboardingStep call
    // This ensures it's recorded as soon as state changes, before ElizaOS can generate follow-up response
    
    // CRITICAL FIX: Manual State Synchronization (Research-based fix)
    // The evaluate step receives stale state because the action's output isn't in recentMemories
    // By manually updating state.recentMemories, we prevent the "Amnesia Bug" where the
    // evaluate step thinks the user's request is still unanswered
    if (state && state.recentMemories && Array.isArray(state.recentMemories)) {
      // Get the last agent message from recent memories to understand what was just sent
      // If the AI already generated a response, we need to ensure it's in the state
      const recentMemories = state.recentMemories as Memory[];
      const lastAgentMemory = recentMemories
        .slice()
        .reverse()
        .find((m: Memory) => m.userId === runtime.agentId);
      
      // If there's a recent agent message, ensure it's at the end of recentMemories
      // This prevents the evaluate step from seeing stale state
      if (lastAgentMemory) {
        // Remove any duplicates
        const filtered = recentMemories.filter((m: Memory) => 
          !(m.userId === runtime.agentId && 
            m.content.text === lastAgentMemory.content.text &&
            m.createdAt === lastAgentMemory.createdAt)
        );
        // Add it back at the end
        filtered.push(lastAgentMemory);
        state.recentMemories = filtered;
        console.log('[Onboarding Action] ✅ Manually synchronized state.recentMemories to prevent evaluate step amnesia');
      }
    }
    
    return true;
    } finally {
      // CRITICAL: Always release message lock when action handler completes
      if (roomId) {
        const { releaseMessageLock } = await import('../../services/llmResponseInterceptor.js');
        releaseMessageLock(roomId);
        console.log('[Onboarding Action] 🔓 Released message lock');
      }
    }
  },
  examples: []
};
