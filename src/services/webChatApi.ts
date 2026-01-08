import { AgentRuntime } from '@elizaos/core';
import { getMessages, getPlatformMessages } from '../plugins/onboarding/translations.js';
import { findSi3UserByEmail } from './si3Database.js';
import { saveUserToSiuDatabase, findSiuUserByWallet, isWalletRegistered } from './siuDatabaseService.js';
import { validateSiuName, checkSiuNameAvailability, validateWalletAddress } from './siuNameService.js';

// API key for authentication (should be set in environment)
const API_KEY = process.env.WEB_API_KEY || process.env.JWT_SECRET || 'default-api-key';

export interface ChatRequest {
  userId: string;
  message: string;
  apiKey?: string;
}

export interface ChatResponse {
  success: boolean;
  response?: string;
  userId?: string;
  primaryUserId?: string; // Original userId if continuing with existing profile
  profile?: any;
  onboardingStatus?: string;
  error?: string;
  // NEW: Signals for frontend
  requiresWalletConnection?: boolean; // Tell frontend to show wallet connect modal
  siuNameClaimed?: string; // Confirmed SI U name after claiming
  walletConnected?: boolean; // Confirm wallet was connected
}

/**
 * Validates the API key
 */
export function validateApiKey(providedKey: string | undefined): boolean {
  if (!providedKey) return false;
  return providedKey === API_KEY;
}

/**
 * Parse roles/interests/goals from user input (matches Telegram format: "1,4 and xx")
 */
function parseNumberedList(text: string, numberMap: Record<string, string>): string[] {
  const parts = text.split(/[,\s]+and\s+/i);
  const numbers = parts[0].split(/[,\s]+/).filter(s => /^\d+$/.test(s.trim()));
  const textPart = parts[1] || '';
  const mapped = numbers.map(n => numberMap[n.trim()]).filter(Boolean);
  const textItems = textPart ? [textPart.trim()] : [];
  return [...mapped, ...textItems];
}

/**
 * Generate confirmation summary text (matches Telegram flow)
 * Now includes wallet and SI U name fields
 */
function generateConfirmationSummary(profile: any, msgs: any): string {
  let summary = `${msgs.SUMMARY_TITLE}\n\n` +
    `${msgs.SUMMARY_NAME} ${profile.name || msgs.SUMMARY_NOT_PROVIDED}\n`;
  
  // Add wallet address if present
  if (profile.walletAddress) {
    const shortWallet = `${profile.walletAddress.slice(0, 6)}...${profile.walletAddress.slice(-4)}`;
    summary += `${msgs.SUMMARY_WALLET || 'Wallet:'} ${shortWallet}\n`;
  }
  
  // Add SI U name if present
  if (profile.siuName) {
    summary += `${msgs.SUMMARY_SIU_NAME || 'SI U Name:'} ${profile.siuName}\n`;
  }
  
  summary += `${msgs.SUMMARY_LOCATION} ${profile.location || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_EMAIL} ${profile.email || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_ROLES} ${(profile.roles || []).join(', ') || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_INTERESTS} ${(profile.interests || []).join(', ') || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_GOALS} ${(profile.connectionGoals || []).join(', ') || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_EVENTS} ${(profile.events || []).join(', ') || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_SOCIALS} ${(profile.socials || []).join(', ') || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_TELEGRAM} ${profile.telegramHandle ? '@' + profile.telegramHandle : msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_GENDER} ${profile.gender || msgs.SUMMARY_NOT_PROVIDED}\n` +
    (profile.diversityResearchInterest ? `${msgs.SUMMARY_DIVERSITY} ${profile.diversityResearchInterest}\n` : '') +
    `${msgs.SUMMARY_NOTIFICATIONS} ${profile.notifications || msgs.SUMMARY_NOT_PROVIDED}\n\n` +
    `${msgs.EDIT_NAME}\n` +
    `${msgs.EDIT_LOCATION}\n`;
  
  // Add edit options for wallet and SI U name if applicable
  if (profile.walletAddress) {
    summary += `${msgs.EDIT_WALLET || 'Edit wallet'}\n`;
  }
  if (profile.siuName) {
    summary += `${msgs.EDIT_SIU_NAME || 'Edit SI U name'}\n`;
  }
  
  summary += `${msgs.EDIT_ROLES}\n` +
    `${msgs.EDIT_INTERESTS}\n` +
    `${msgs.EDIT_GOALS}\n` +
    `${msgs.EDIT_EVENTS}\n` +
    `${msgs.EDIT_SOCIALS}\n` +
    `${msgs.EDIT_TELEGRAM}\n` +
    `${msgs.EDIT_GENDER}\n` +
    `${msgs.EDIT_NOTIFICATIONS}\n\n` +
    `${msgs.CONFIRM}`;
  
  return summary;
}

/**
 * Process a chat message from the web API
 * This mirrors the Telegram direct handler logic
 */
export async function processWebChatMessage(
  runtime: AgentRuntime,
  userId: string,
  messageText: string
): Promise<ChatResponse> {
  console.log(`[Web Chat API] Processing message for user ${userId}: ${messageText.substring(0, 50)}...`);
  
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiKey) {
    return {
      success: false,
      error: 'OpenAI API key not configured'
    };
  }
  
  try {
    // Get state from cache
    let state: { step: string, profile: any } = { step: 'NONE', profile: {} };
    try {
      const cached = await runtime.cacheManager.get(`onboarding_${userId}`);
      if (cached && typeof cached === 'object') {
        state = cached as { step: string, profile: any };
      }
    } catch (cacheErr) {
      console.log('[Web Chat API] Cache read error, using default state');
    }
    
    // Helper to update state
    const updateState = async (newStep: string, profileUpdate: any = {}) => {
      const newState = {
        step: newStep,
        profile: { ...state.profile, ...profileUpdate }
      };
      await runtime.cacheManager.set(`onboarding_${userId}`, newState);
      state = newState;
      console.log('[Web Chat API] Updated state to:', newStep);
    };
    
    let responseText = '';
    const lowerText = messageText.toLowerCase().trim();
    const userLang = state.profile.language || 'en';
    // Use si3Roles (from SI<3> database) for platform detection, not user-entered roles
    const platformRoles = state.profile.si3Roles || [];
    const msgs = getPlatformMessages(userLang, platformRoles);
    
    // Check for restart commands
    const isRestart = lowerText.includes('restart') || lowerText.includes('start over') || lowerText.includes('begin again');
    const isNext = lowerText === 'next' || lowerText === 'skip';
    
    // ==================== FEATURE REQUEST HANDLING ====================
    if (state.step === 'AWAITING_FEATURE_DETAILS') {
      // User is providing feature request details
      try {
        const { sendFeatureRequest } = await import('./featureRequest.js');
        await sendFeatureRequest(userId, state.profile.name || 'Anonymous', messageText, messageText);
        
        // Also save to database as backup
        try {
          const db = runtime.databaseAdapter as any;
          if (db && db.query) {
            const { v4: uuidv4 } = await import('uuid');
            await db.query(
              `INSERT INTO feature_requests (id, user_id, user_name, request_text, created_at) VALUES ($1, $2::text, $3, $4, NOW())`,
              [uuidv4(), userId, state.profile.name || 'Anonymous', messageText]
            );
          } else if (db && db.getDb) {
            const mongoDb = await db.getDb();
            const featureCollection = mongoDb.collection('feature_requests');
            await featureCollection.insertOne({
              userId: userId,
              userName: state.profile.name || 'Anonymous',
              requestText: messageText,
              createdAt: new Date()
            });
          }
        } catch (dbErr) {
          console.log('[Web Chat API] Could not save feature request to DB:', dbErr);
        }
        
        await updateState('COMPLETED', {});
        const langResponses: Record<string, string> = {
          en: "Thank you for your feature request! I've sent it to our team at tech@si3.space. We'll review it and work on adding it soon. 💜",
          es: "¡Gracias por tu solicitud de función! La he enviado a nuestro equipo en tech@si3.space. La revisaremos y trabajaremos en agregarla pronto. 💜",
          pt: "Obrigado pela sua solicitação de recurso! Enviei para nossa equipe em tech@si3.space. Vamos revisá-la e trabalhar para adicioná-la em breve. 💜",
          fr: "Merci pour votre demande de fonctionnalité! Je l'ai envoyée à notre équipe à tech@si3.space. Nous l'examinerons et travaillerons à l'ajouter bientôt. 💜"
        };
        responseText = langResponses[userLang] || langResponses.en;
        return { success: true, response: responseText, userId };
      } catch (error: any) {
        console.error('[Web Chat API] Error sending feature request:', error);
        responseText = "I encountered an issue sending your feature request. Please try again later. 💜";
        return { success: true, response: responseText, userId };
      }
    }
    
    // ==================== ONBOARDING FLOW ====================
    if (isRestart || state.step === 'NONE') {
      await updateState('ASK_LANGUAGE', {});
      responseText = msgs.LANGUAGE || "What's your preferred language?\n\n1. English\n2. Spanish\n3. Portuguese\n4. French\n\nReply with the number (for example: 1)";
    } else if (state.step === 'ASK_LANGUAGE') {
      let lang: 'en' | 'es' | 'pt' | 'fr' = 'en';
      if (lowerText.includes('1') || lowerText.includes('english')) lang = 'en';
      else if (lowerText.includes('2') || lowerText.includes('español') || lowerText.includes('spanish')) lang = 'es';
      else if (lowerText.includes('3') || lowerText.includes('português') || lowerText.includes('portuguese')) lang = 'pt';
      else if (lowerText.includes('4') || lowerText.includes('français') || lowerText.includes('french')) lang = 'fr';
      
      await updateState('ASK_NAME', { language: lang });
      const newMsgs = getPlatformMessages(lang, []);
      responseText = newMsgs.GREETING;
    } else if (state.step === 'ASK_NAME') {
      const isEditing = state.profile.isEditing || false;
      const name = messageText.trim();
      if (isEditing) {
        // If editing, go back to CONFIRMATION
        await updateState('CONFIRMATION', { name, isEditing: false, editingField: undefined });
        responseText = generateConfirmationSummary({ ...state.profile, name }, msgs);
      } else {
        // NEW: Go to entry method selection (wallet vs email)
        await updateState('ASK_ENTRY_METHOD', { name, onboardingStartedAt: new Date() });
        responseText = msgs.ENTRY_METHOD;
      }
    } else if (state.step === 'ASK_ENTRY_METHOD') {
      // NEW: User chooses wallet or email entry
      const choice = messageText.trim();
      
      if (choice === '1' || lowerText.includes('wallet') || lowerText.includes('connect')) {
        // User chose wallet
        await updateState('ASK_WALLET_CONNECTION', { entryMethod: 'wallet' });
        responseText = msgs.WALLET_CONNECTION;
        // Signal frontend to show wallet connection UI
        return {
          success: true,
          response: responseText,
          userId,
          profile: state.profile,
          onboardingStatus: 'ASK_WALLET_CONNECTION',
          requiresWalletConnection: true
        };
      } else if (choice === '2' || lowerText.includes('email') || lowerText.includes('continue')) {
        // User chose email
        await updateState('ASK_EMAIL', { entryMethod: 'email' });
        responseText = msgs.EMAIL;
      } else {
        // Invalid choice - ask again
        responseText = msgs.ENTRY_METHOD;
      }
    } else if (state.step === 'ASK_WALLET_CONNECTION') {
      // NEW: Handle wallet address from frontend
      // Frontend sends wallet address after successful connection
      const walletAddress = messageText.trim();
      
      // Check if user is responding to wallet connection prompts
      // They can choose: 1 = try again (different wallet or retry), 2 = switch to email
      if (lowerText === '1' || 
          lowerText.includes('different wallet') || 
          lowerText.includes('try another') ||
          lowerText.includes('try again') ||
          lowerText.includes('retry')) {
        // User wants to try wallet connection again - ask them to connect again
        // Preserve all profile data including name, entryMethod, etc.
        const preservedProfile = {
          ...state.profile,
          entryMethod: state.profile.entryMethod || 'wallet' // Ensure entryMethod is preserved
        };
        await updateState('ASK_WALLET_CONNECTION', preservedProfile);
        responseText = msgs.WALLET_CONNECTION;
        return {
          success: true,
          response: responseText,
          userId,
          profile: preservedProfile,
          onboardingStatus: 'ASK_WALLET_CONNECTION',
          requiresWalletConnection: true
        };
      }
      
      // Check if user wants to switch to email (after wallet was already registered)
      if (lowerText === '2' || lowerText.includes('email') || lowerText.includes('continue with email')) {
        // User chose to switch to email after wallet failed
        // Preserve all other profile data (name, etc.) but switch entry method
        const preservedProfile = {
          ...state.profile,
          entryMethod: 'email',
          walletAddress: undefined
        };
        await updateState('ASK_EMAIL', preservedProfile);
        responseText = msgs.EMAIL;
        return {
          success: true,
          response: responseText,
          userId,
          profile: preservedProfile,
          onboardingStatus: 'ASK_EMAIL'
        };
      }
      
      // Validate wallet address format (only if it looks like a wallet address)
      // If it's just "1" or "2", we've already handled it above
      // Check if input doesn't look like a wallet address at all
      if (!walletAddress.startsWith('0x') || walletAddress.length < 20) {
        // Doesn't look like a valid wallet address - might be a response to the prompt
        // If we're here and it's not "1" or "2", ask them to connect wallet or switch to email
        responseText = 'Please connect your wallet or choose an option:\n\n' +
          '1. Try a different wallet\n' +
          '2. Continue with email\n\n' +
          'Reply with the number (for example: 1)';
        return {
          success: true,
          response: responseText,
          userId,
          profile: state.profile,
          onboardingStatus: 'ASK_WALLET_CONNECTION',
          requiresWalletConnection: true
        };
      }
      
      // Validate wallet address format
      const walletValidation = validateWalletAddress(walletAddress);
      if (!walletValidation.valid) {
        responseText = (walletValidation.error || 'Invalid wallet address. Please try again.') + 
          '\n\nOr choose an option:\n' +
          '1. Try connecting/entering your wallet again\n' +
          '2. Continue with email\n\n' +
          'Reply with the number (for example: 2)';
        return {
          success: true,
          response: responseText,
          userId,
          profile: state.profile,
          onboardingStatus: 'ASK_WALLET_CONNECTION',
          requiresWalletConnection: true
        };
      }
      
      // Check if wallet is already registered
      try {
        const walletExists = await isWalletRegistered(walletAddress);
        if (walletExists) {
          // Check if this wallet belongs to an existing user with completed onboarding
          const { findSiuUserByWallet } = await import('./siuDatabaseService.js');
          const existingUser = await findSiuUserByWallet(walletAddress);
          
          if (existingUser && existingUser.onboardingCompletedAt) {
            // This wallet belongs to a returning user - recognize them!
            console.log(`[Web Chat API] ✅ Recognized returning user by wallet: ${existingUser.email || walletAddress}`);
            
            // Convert SI U database format to UserProfile format
            // Use stored language, or preserve language from current conversation if already set
            const loadedProfile: any = {
              name: existingUser.name || existingUser.username,
              email: existingUser.email,
              language: existingUser.language || state.profile.language || userLang || 'en',
              location: existingUser.location,
              gender: existingUser.gender,
              entryMethod: 'wallet',
              walletAddress: existingUser.wallet_address || walletAddress,
              siuName: existingUser.siuName || existingUser.username,
              userTier: existingUser.userTier || 'explorer',
              roles: existingUser.roles || [],
              interests: existingUser.interests || [],
              connectionGoals: existingUser.connectionGoals || [],
              events: existingUser.events || [],
              socials: existingUser.digitalLinks || [],
              telegramHandle: existingUser.telegramHandle,
              diversityResearchInterest: existingUser.diversityResearchInterest,
              notifications: existingUser.notificationSettings ? 
                (existingUser.notificationSettings.emailUpdates ? 'Yes' : 'No') : 'Not sure',
              onboardingCompletedAt: existingUser.onboardingCompletedAt,
              onboardingSource: existingUser.onboardingSource || 'web',
              isConfirmed: true
            };
            
            // Load profile into cache and set state to COMPLETED
            await updateState('COMPLETED', loadedProfile);
            
            // Welcome them back
            const welcomeMessages: Record<string, string> = {
              en: `Welcome back, ${loadedProfile.name || 'there'}! 👋\n\nI recognized your wallet address. How can I help you today? 💜\n\nYou can:\n• Say "find me a match" to connect with someone\n• Say "my profile" to view your profile\n• Say "update" to edit your profile\n• Just chat with me!`,
              es: `¡Bienvenido de nuevo, ${loadedProfile.name || 'allí'}! 👋\n\nReconocí tu dirección de billetera. ¿Cómo puedo ayudarte hoy? 💜\n\nPuedes:\n• Di "encuéntrame una conexión" para conectar con alguien\n• Di "mi perfil" para ver tu perfil\n• Di "actualizar" para editar tu perfil\n• ¡Solo chatea conmigo!`,
              pt: `Bem-vindo de volta, ${loadedProfile.name || 'aí'}! 👋\n\nReconheci seu endereço de carteira. Como posso ajudá-lo hoje? 💜\n\nVocê pode:\n• Diga "encontre uma conexão" para conectar com alguém\n• Diga "meu perfil" para ver seu perfil\n• Diga "atualizar" para editar seu perfil\n• Apenas converse comigo!`,
              fr: `Bon retour, ${loadedProfile.name || 'là'}! 👋\n\nJ'ai reconnu votre adresse de portefeuille. Comment puis-je vous aider aujourd'hui? 💜\n\nVous pouvez:\n• Dites "trouvez-moi une connexion" pour vous connecter avec quelqu'un\n• Dites "mon profil" pour voir votre profil\n• Dites "mettre à jour" pour modifier votre profil\n• Discutez simplement avec moi!`
            };
            
            responseText = welcomeMessages[loadedProfile.language || 'en'] || welcomeMessages.en;
            
            return {
              success: true,
              response: responseText,
              userId,
              profile: loadedProfile,
              onboardingStatus: 'COMPLETED',
              walletConnected: true
            };
          } else {
            // Wallet already registered to someone else - offer to try another wallet or switch to email
            // Keep entryMethod as 'wallet' to remember their choice - explicitly preserve it
            const preservedProfile = {
              ...state.profile,
              entryMethod: state.profile.entryMethod || 'wallet' // Ensure entryMethod is preserved
            };
            responseText = msgs.WALLET_ALREADY_REGISTERED + '\n\n' +
              'What would you like to do?\n\n' +
              '1. Try a different wallet\n' +
              '2. Continue with email\n\n' +
              'Reply with the number (for example: 1)';
            // Stay in ASK_WALLET_CONNECTION state but remember they need to choose
            // Explicitly preserve state to ensure entryMethod and other profile data is maintained
            await updateState('ASK_WALLET_CONNECTION', preservedProfile);
            return {
              success: true,
              response: responseText,
              userId,
              profile: preservedProfile,
              onboardingStatus: 'ASK_WALLET_CONNECTION',
              requiresWalletConnection: true
            };
          }
        }
      } catch (err) {
        console.log('[Web Chat API] Could not check wallet registration:', err);
        // Continue anyway - will catch during save
      }
      
      // Wallet connected successfully - proceed to SI U name
      // Preserve all existing profile data including entryMethod
      const connectedMsg = msgs.WALLET_CONNECTED.replace('{walletAddress}', 
        `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`);
      const updatedProfile = { ...state.profile, walletAddress };
      await updateState('ASK_SIU_NAME', updatedProfile);
      responseText = connectedMsg + '\n\n' + msgs.SIU_NAME;
      return {
        success: true,
        response: responseText,
        userId,
        profile: updatedProfile,
        onboardingStatus: 'ASK_SIU_NAME',
        walletConnected: true
      };
    } else if (state.step === 'ASK_SIU_NAME') {
      // NEW: Handle SI U name claiming
      const desiredName = messageText.trim();
      
      // Skip if user wants to skip - preserve all existing profile data
      if (isNext) {
        await updateState('ASK_EMAIL', state.profile);
        responseText = msgs.EMAIL;
        return {
          success: true,
          response: responseText,
          userId,
          profile: state.profile,
          onboardingStatus: 'ASK_EMAIL'
        };
      }
      
      // Validate SI U name format
      const validation = validateSiuName(desiredName);
      if (!validation.valid) {
        responseText = msgs.SIU_NAME_INVALID;
        return {
          success: true,
          response: responseText,
          userId,
          profile: state.profile,
          onboardingStatus: 'ASK_SIU_NAME'
        };
      }
      
      const formattedName = validation.formatted!;
      
      // Check availability
      const availability = await checkSiuNameAvailability(formattedName);
      if (!availability.available) {
        responseText = msgs.SIU_NAME_TAKEN.replace('{siuName}', formattedName);
        return {
          success: true,
          response: responseText,
          userId,
          profile: state.profile,
          onboardingStatus: 'ASK_SIU_NAME'
        };
      }
      
      // Name is available - claim it and proceed
      // Preserve all existing profile data including walletAddress and entryMethod
      const claimedMsg = msgs.SIU_NAME_CLAIMED.replace('{siuName}', formattedName);
      const updatedProfile = { ...state.profile, siuName: formattedName };
      await updateState('ASK_EMAIL', updatedProfile);
      responseText = claimedMsg + '\n\n' + msgs.EMAIL;
      return {
        success: true,
        response: responseText,
        userId,
        profile: updatedProfile,
        onboardingStatus: 'ASK_EMAIL',
        siuNameClaimed: formattedName
      };
    } else if (state.step === 'ASK_EMAIL') {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const emailText = messageText.trim();
      if (!emailRegex.test(emailText)) {
        responseText = `${msgs.EMAIL}\n\n⚠️ Please enter a valid email address (e.g., name@example.com)`;
        return { success: true, response: responseText };
      }
      
      // Check if this email belongs to a returning user with completed onboarding
      try {
        const { findSiuUserByEmail } = await import('./siuDatabaseService.js');
        const existingUser = await findSiuUserByEmail(emailText);
        
        if (existingUser && existingUser.onboardingCompletedAt && !state.profile.isEditing) {
          // This email belongs to a returning user - recognize them!
          console.log(`[Web Chat API] ✅ Recognized returning user by email: ${existingUser.email}`);
          
          // Convert SI U database format to UserProfile format
          // Use stored language, or preserve language from current conversation if already set
          const loadedProfile: any = {
            name: existingUser.name || existingUser.username,
            email: existingUser.email,
            language: existingUser.language || state.profile.language || userLang || 'en',
            location: existingUser.location,
            gender: existingUser.gender,
            entryMethod: existingUser.entryMethod || state.profile.entryMethod || 'email',
            walletAddress: existingUser.wallet_address || state.profile.walletAddress,
            siuName: existingUser.siuName || existingUser.username || state.profile.siuName,
            userTier: existingUser.userTier || 'explorer',
            roles: existingUser.roles || [],
            interests: existingUser.interests || [],
            connectionGoals: existingUser.connectionGoals || [],
            events: existingUser.events || [],
            socials: existingUser.digitalLinks || [],
            telegramHandle: existingUser.telegramHandle,
            diversityResearchInterest: existingUser.diversityResearchInterest,
            notifications: existingUser.notificationSettings ? 
              (existingUser.notificationSettings.emailUpdates ? 'Yes' : 'No') : 'Not sure',
            onboardingCompletedAt: existingUser.onboardingCompletedAt,
            onboardingSource: existingUser.onboardingSource || 'web',
            isConfirmed: true
          };
          
          // Load profile into cache and set state to COMPLETED
          await updateState('COMPLETED', loadedProfile);
          
          // Welcome them back
          const welcomeMessages: Record<string, string> = {
            en: `Welcome back, ${loadedProfile.name || 'there'}! 👋\n\nI recognized your email address. How can I help you today? 💜\n\nYou can:\n• Say "find me a match" to connect with someone\n• Say "my profile" to view your profile\n• Say "update" to edit your profile\n• Just chat with me!`,
            es: `¡Bienvenido de nuevo, ${loadedProfile.name || 'allí'}! 👋\n\nReconocí tu dirección de correo electrónico. ¿Cómo puedo ayudarte hoy? 💜\n\nPuedes:\n• Di "encuéntrame una conexión" para conectar con alguien\n• Di "mi perfil" para ver tu perfil\n• Di "actualizar" para editar tu perfil\n• ¡Solo chatea conmigo!`,
            pt: `Bem-vindo de volta, ${loadedProfile.name || 'aí'}! 👋\n\nReconheci seu endereço de e-mail. Como posso ajudá-lo hoje? 💜\n\nVocê pode:\n• Diga "encontre uma conexão" para conectar com alguém\n• Diga "meu perfil" para ver seu perfil\n• Diga "atualizar" para editar seu perfil\n• Apenas converse comigo!`,
            fr: `Bon retour, ${loadedProfile.name || 'là'}! 👋\n\nJ'ai reconnu votre adresse e-mail. Comment puis-je vous aider aujourd'hui? 💜\n\nVous pouvez:\n• Dites "trouvez-moi une connexion" pour vous connecter avec quelqu'un\n• Dites "mon profil" pour voir votre profil\n• Dites "mettre à jour" pour modifier votre profil\n• Discutez simplement avec moi!`
          };
          
          responseText = welcomeMessages[loadedProfile.language || 'en'] || welcomeMessages.en;
          
          return {
            success: true,
            response: responseText,
            userId,
            profile: loadedProfile,
            onboardingStatus: 'COMPLETED'
          };
        }
      } catch (recognitionError) {
        console.error('[Web Chat API] Error recognizing user by email:', recognitionError);
        // Continue with normal onboarding flow if recognition fails
      }
      
      const isEditing = state.profile.isEditing || false;
      
      // First, check SI<3> database for user roles and profile data
      let si3Roles: string[] = [];
      let si3User: any = null;
      
      try {
        console.log(`[Web Chat API] Checking SI<3> database for user roles...`);
        // Add timeout to prevent hanging
        si3User = await Promise.race([
          findSi3UserByEmail(emailText, 'si3Users', 'email'),
          new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('SI<3> database lookup timeout')), 10000)
          )
        ]).catch((err) => {
          console.error(`[Web Chat API] SI<3> database error/timeout:`, err.message);
          return null;
        });
        
        if (si3User) {
          si3Roles = si3User.roles || [];
          console.log(`[Web Chat API] Found SI<3> user with roles: ${si3Roles.join(', ')}`);
        } else {
          console.log(`[Web Chat API] Email ${emailText} not found in SI<3> database (or timeout)`);
        }
      } catch (error: any) {
        console.error('[Web Chat API] Error searching SI<3> database:', error.message);
        // Continue with onboarding even if SI<3> lookup fails
      }
      
      // Check if this is an SI<3> user who hasn't completed Kaia onboarding
      // (They exist in SI<3> but not in SI U database with completed onboarding)
      if (si3User && !isEditing) {
        try {
          const { findSiuUserByEmail } = await import('./siuDatabaseService.js');
          const siuUser = await findSiuUserByEmail(emailText);
          
          // If they exist in SI<3> but NOT in SI U (or SI U onboarding not completed), pre-fill their data
          if (!siuUser || !siuUser.onboardingCompletedAt) {
            console.log(`[Web Chat API] Found SI<3> user who hasn't completed Kaia onboarding - pre-filling data`);
            
            // Pre-fill profile with SI<3> data
            const preFilledProfile: any = {
              email: emailText,
              name: si3User.name || si3User.username || state.profile.name,
              location: si3User.location || state.profile.location,
              roles: si3User.roles || [],
              interests: si3User.interests || [],
              personalValues: si3User.personalValues || [],
              si3Roles: si3Roles, // Save for platform detection
              entryMethod: state.profile.entryMethod || 'email',
              walletAddress: state.profile.walletAddress, // Preserve wallet if set
              siuName: state.profile.siuName // Preserve SI U name if set
            };
            
            // Determine next step based on what data we already have
            // Skip steps for data we already have from SI<3>
            let nextStep = 'ASK_LOCATION';
            let nextMessage = msgs.LOCATION;
            
            // Check each field in order and skip to the first missing one
            if (!preFilledProfile.location) {
              // Missing location - ask for it
              nextStep = 'ASK_LOCATION';
              nextMessage = msgs.LOCATION;
            } else if (!preFilledProfile.roles || preFilledProfile.roles.length === 0) {
              // Has location but missing roles - ask for roles
              nextStep = 'ASK_ROLE';
              nextMessage = msgs.ROLES;
            } else if (!preFilledProfile.interests || preFilledProfile.interests.length === 0) {
              // Has roles but missing interests - ask for interests
              nextStep = 'ASK_INTERESTS';
              nextMessage = msgs.INTERESTS;
            } else {
              // Has location, roles, AND interests - skip to goals
              nextStep = 'ASK_GOALS';
              nextMessage = msgs.GOALS;
            }
            
            // Update state with pre-filled data
            await updateState(nextStep, preFilledProfile);
            
            // Welcome message recognizing them as SI<3> user
            const welcomeMessages: Record<string, string> = {
              en: `Welcome back! 👋 I recognize you from SI<3>. I've pre-filled some of your information to make this quick.\n\n${nextMessage}`,
              es: `¡Bienvenido de nuevo! 👋 Te reconozco de SI<3>. He prellenado parte de tu información para que sea rápido.\n\n${nextMessage}`,
              pt: `Bem-vindo de volta! 👋 Reconheço você do SI<3>. Preenchi algumas de suas informações para tornar isso rápido.\n\n${nextMessage}`,
              fr: `Bon retour! 👋 Je vous reconnais de SI<3>. J'ai pré-rempli certaines de vos informations pour que ce soit rapide.\n\n${nextMessage}`
            };
            
            responseText = welcomeMessages[userLang] || welcomeMessages.en;
            
            return {
              success: true,
              response: responseText,
              userId,
              profile: preFilledProfile,
              onboardingStatus: nextStep
            };
          }
        } catch (prefillError) {
          console.error('[Web Chat API] Error pre-filling SI<3> user data:', prefillError);
          // Continue with normal onboarding if pre-fill fails
        }
      }
      
      // Check if email exists in Kaia database (could be from Telegram onboarding)
      try {
        console.log(`[Web Chat API] Checking if email ${emailText} exists in Kaia database...`);
        const db = runtime.databaseAdapter as any;
        const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
        const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
        
        let existingUser: { userId: string; profile: any } | null = null;
        
        if (isMongo && db.getDb) {
          console.log(`[Web Chat API] Using MongoDB to check for existing email...`);
          const mongoDb = await db.getDb();
          const cacheCollection = mongoDb.collection('cache');
          
          // Add timeout and limit to prevent hanging
          const docs = await Promise.race([
            cacheCollection.find({
              key: { $regex: /^onboarding_/ }
            }).limit(1000).toArray(), // Limit to prevent huge queries
            new Promise<any[]>((_, reject) => 
              setTimeout(() => reject(new Error('MongoDB query timeout')), 5000)
            )
          ]).catch((err) => {
            console.error(`[Web Chat API] MongoDB query error or timeout:`, err);
            return []; // Return empty array on error/timeout
          });
          
          console.log(`[Web Chat API] Found ${docs.length} onboarding entries to check`);
          
          for (const doc of docs) {
            try {
              const docUserId = doc.key.replace('onboarding_', '');
              // Skip if it's the current user
              if (docUserId === userId) continue;
              
              const value = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;
              const profileEmail = value?.profile?.email || value?.email;
              if (profileEmail && profileEmail.toLowerCase() === emailText.toLowerCase()) {
                existingUser = {
                  userId: docUserId,
                  profile: value.profile || {}
                };
                console.log(`[Web Chat API] Found existing user ${docUserId} with email ${emailText}`);
                break;
              }
            } catch (e) {
              // Skip invalid entries
              console.log(`[Web Chat API] Skipping invalid entry: ${doc.key}`);
            }
          }
        } else if (db.query) {
          console.log(`[Web Chat API] Using PostgreSQL to check for existing email...`);
          const result = await Promise.race([
            db.query(`
              SELECT key, value 
              FROM cache 
              WHERE key LIKE 'onboarding_%'
              LIMIT 1000
            `),
            new Promise<any>((_, reject) => 
              setTimeout(() => reject(new Error('PostgreSQL query timeout')), 5000)
            )
          ]).catch((err) => {
            console.error(`[Web Chat API] PostgreSQL query error or timeout:`, err);
            return { rows: [] }; // Return empty result on error/timeout
          });
          
          console.log(`[Web Chat API] Found ${result.rows?.length || 0} onboarding entries to check`);
          
          for (const row of result.rows || []) {
            try {
              const docUserId = row.key.replace('onboarding_', '');
              // Skip if it's the current user
              if (docUserId === userId) continue;
              
              const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
              const profileEmail = value?.profile?.email || value?.email;
              if (profileEmail && profileEmail.toLowerCase() === emailText.toLowerCase()) {
                existingUser = {
                  userId: docUserId,
                  profile: value.profile || {}
                };
                console.log(`[Web Chat API] Found existing user ${docUserId} with email ${emailText}`);
                break;
              }
            } catch (e) {
              // Skip invalid entries
              console.log(`[Web Chat API] Skipping invalid entry: ${row.key}`);
            }
          }
        }
        
        // Handle editing case first
        if (isEditing) {
          // If editing, go back to CONFIRMATION (skip email existence check)
          await updateState('CONFIRMATION', { email: emailText, isEditing: false, editingField: undefined });
          responseText = generateConfirmationSummary({ ...state.profile, email: emailText }, msgs);
        } else {
          // Check if email exists (only if not editing) - already checked in try block above
          if (existingUser && !state.profile.isEditing) {
            // Email exists - ask if they want to continue or recreate
            console.log(`[Web Chat API] Email ${emailText} exists for user ${existingUser.userId}`);
            await updateState('ASK_PROFILE_CHOICE', {
              email: emailText,
              existingUserId: existingUser.userId,
              existingProfile: existingUser.profile,
              // Only save SI<3> roles for platform detection (Grow3dge vs SI Her)
              // Don't pre-fill interests - user will answer with platform-specific questions
              si3Roles: si3Roles.length > 0 ? si3Roles : undefined
            });
            responseText = `${msgs.PROFILE_EXISTS}\n\n${msgs.PROFILE_CHOICE}`;
            console.log(`[Web Chat API] Set responseText for ASK_PROFILE_CHOICE`);
          } else if (!state.profile.isEditing) {
            // Email doesn't exist - continue with onboarding
            // Only save SI<3> roles for platform detection (Grow3dge vs SI Her)
            // Don't pre-fill interests - user will answer with platform-specific questions
            console.log(`[Web Chat API] Email ${emailText} not found, continuing with new profile`);
            const profileUpdate: any = { email: emailText };
            if (si3Roles.length > 0) {
              // Save SI<3> roles to determine which platform questions to show
              profileUpdate.si3Roles = si3Roles;
            }
            
            await updateState('ASK_LOCATION', profileUpdate);
            responseText = msgs.LOCATION;
          }
        }
      } catch (error: any) {
        console.error('[Web Chat API] Error checking email:', error);
        // On error, continue with onboarding
        if (isEditing) {
          // If editing, go back to CONFIRMATION
          await updateState('CONFIRMATION', { email: emailText, isEditing: false, editingField: undefined });
          responseText = generateConfirmationSummary({ ...state.profile, email: emailText }, msgs);
        } else {
          await updateState('ASK_LOCATION', { email: emailText });
          responseText = msgs.LOCATION;
        }
        console.log(`[Web Chat API] Error occurred, set responseText to ${isEditing ? 'CONFIRMATION' : 'LOCATION'} message`);
      }
    } else if (state.step === 'ASK_LOCATION') {
      const isEditing = state.profile.isEditing || false;
      const location = isNext ? undefined : messageText.trim();
      if (isEditing) {
        // If editing, go back to CONFIRMATION
        await updateState('CONFIRMATION', { location, isEditing: false, editingField: undefined });
        responseText = generateConfirmationSummary({ ...state.profile, location }, msgs);
      } else {
        await updateState('ASK_ROLE', { location });
        responseText = msgs.ROLES;
      }
    } else if (state.step === 'ASK_ROLE') {
      const isEditing = state.profile.isEditing || false;
      // Parse roles like Telegram: "1,4 and xx" -> ['Founder/Builder', 'Community Leader', 'xx']
      const roleMap: Record<string, string> = {
        '1': 'Founder/Builder', '2': 'Marketing/BD/Partnerships', '3': 'DAO Council Member/Delegate',
        '4': 'Community Leader', '5': 'Investor/Grant Program Operator', '6': 'Early Web3 Explorer',
        '7': 'Media', '8': 'Artist', '9': 'Developer', '10': 'Other'
      };
      const roles = parseNumberedList(messageText, roleMap);
      if (isEditing) {
        // If editing, go back to CONFIRMATION
        await updateState('CONFIRMATION', { roles, isEditing: false, editingField: undefined });
        responseText = generateConfirmationSummary({ ...state.profile, roles }, msgs);
      } else {
        await updateState('ASK_INTERESTS', { roles });
        responseText = msgs.INTERESTS;
      }
    } else if (state.step === 'ASK_INTERESTS') {
      const isEditing = state.profile.isEditing || false;
      // Parse interests like Telegram: "2,3 and DevRel" -> ['Business Development & Partnerships', 'Education 3.0', 'DevRel']
      const interestMap: Record<string, string> = {
        '1': 'Web3 Growth Marketing', '2': 'Business Development & Partnerships', '3': 'Education 3.0',
        '4': 'AI', '5': 'Cybersecurity', '6': 'DAOs', '7': 'Tokenomics', '8': 'Fundraising', '9': 'Other'
      };
      const interests = parseNumberedList(messageText, interestMap);
      if (isEditing) {
        // If editing, go back to CONFIRMATION
        await updateState('CONFIRMATION', { interests, isEditing: false, editingField: undefined });
        responseText = generateConfirmationSummary({ ...state.profile, interests }, msgs);
      } else {
        await updateState('ASK_CONNECTION_GOALS', { interests });
        responseText = msgs.GOALS;
      }
    } else if (state.step === 'ASK_CONNECTION_GOALS') {
      const isEditing = state.profile.isEditing || false;
      // Parse goals like Telegram: "3,4 and Cybersecurity" -> ['Growth tools...', 'Sales/BD tools...', 'Cybersecurity']
      const goalMap: Record<string, string> = {
        '1': 'Startups to invest in',
        '2': 'Investors/grant programs',
        '3': 'Growth tools, strategies, and/or support',
        '4': 'Sales/BD tools, strategies and/or support',
        '5': "Communities and/or DAO's to join",
        '6': 'New job opportunities'
      };
      const connectionGoals = parseNumberedList(messageText, goalMap);
      if (isEditing) {
        // If editing, go back to CONFIRMATION
        await updateState('CONFIRMATION', { connectionGoals, isEditing: false, editingField: undefined });
        responseText = generateConfirmationSummary({ ...state.profile, connectionGoals }, msgs);
      } else {
        await updateState('ASK_EVENTS', { connectionGoals });
        responseText = msgs.EVENTS;
      }
    } else if (state.step === 'ASK_EVENTS') {
      const isEditing = state.profile.isEditing || false;
      const events = isNext ? undefined : messageText.split(',').map((r: string) => r.trim()).filter((r: string) => r);
      if (isEditing) {
        // If editing, go back to CONFIRMATION
        await updateState('CONFIRMATION', { events, isEditing: false, editingField: undefined });
        responseText = generateConfirmationSummary({ ...state.profile, events }, msgs);
      } else {
        await updateState('ASK_SOCIALS', { events });
        responseText = msgs.SOCIALS;
      }
    } else if (state.step === 'ASK_SOCIALS') {
      const isEditing = state.profile.isEditing || false;
      const socials = isNext ? undefined : messageText.split(',').map((r: string) => r.trim()).filter((r: string) => r);
      if (isEditing) {
        // If editing, go back to CONFIRMATION
        await updateState('CONFIRMATION', { socials, isEditing: false, editingField: undefined });
        responseText = generateConfirmationSummary({ ...state.profile, socials }, msgs);
      } else {
        await updateState('ASK_TELEGRAM_HANDLE', { socials });
        responseText = msgs.TELEGRAM;
      }
    } else if (state.step === 'ASK_TELEGRAM_HANDLE') {
      const isEditing = state.profile.isEditing || false;
      const telegramHandle = isNext ? undefined : messageText.replace('@', '').trim();
      if (isEditing) {
        // If editing, go back to CONFIRMATION
        await updateState('CONFIRMATION', { telegramHandle, isEditing: false, editingField: undefined });
        responseText = generateConfirmationSummary({ ...state.profile, telegramHandle }, msgs);
      } else {
        await updateState('ASK_GENDER', { telegramHandle });
        responseText = msgs.GENDER;
      }
    } else if (state.step === 'ASK_GENDER') {
      const isEditing = state.profile.isEditing || false;
      
      // Check if user wants to participate in diversity research (matches Telegram)
      const saidYes = lowerText.includes('yes') || lowerText.includes('sí') || lowerText.includes('sim') || lowerText.includes('oui');
      const saidNo = lowerText.includes('no') && !lowerText.includes('not sure');
      const wantsDiversityResearch = saidYes && !saidNo && !isNext && lowerText.includes('diversity');
      
      let diversityResearchInterest: string | undefined;
      if (wantsDiversityResearch) {
        diversityResearchInterest = 'Yes';
        // Track in MongoDB for diversity research (same as Telegram)
        try {
          const db = runtime.databaseAdapter as any;
          if (db && db.getDb) {
            const mongoDb = await db.getDb();
            const diversityCollection = mongoDb.collection('diversity_research');
            const existing = await diversityCollection.findOne({ userId: userId });
            if (!existing) {
              await diversityCollection.insertOne({
                userId: userId,
                email: state.profile.email || null,
                interestedAt: new Date(),
                status: 'pending'
              });
              console.log('[Web Chat API] ✅ Tracked diversity research interest for user:', userId);
            } else {
              await diversityCollection.updateOne(
                { userId: userId },
                { $set: { interestedAt: new Date(), status: 'pending' } }
              );
              console.log('[Web Chat API] ✅ Updated diversity research interest');
            }
          }
        } catch (error) {
          console.error('[Web Chat API] Error tracking diversity research interest:', error);
          // Don't fail the flow if tracking fails
        }
      } else if (saidNo && !isNext) {
        diversityResearchInterest = 'No';
        // Remove from diversity research tracking if they said No
        try {
          const db = runtime.databaseAdapter as any;
          if (db && db.getDb) {
            const mongoDb = await db.getDb();
            const diversityCollection = mongoDb.collection('diversity_research');
            await diversityCollection.deleteOne({ userId: userId });
            console.log('[Web Chat API] ✅ Removed from diversity research tracking');
          }
        } catch (error) {
          console.error('[Web Chat API] Error removing from tracking:', error);
        }
      }
      
      let gender = isNext ? undefined : messageText.trim();
      if (lowerText.includes('1') || lowerText.includes('female')) gender = 'Female';
      else if (lowerText.includes('2') || lowerText.includes('male')) gender = 'Male';
      else if (lowerText.includes('3') || lowerText.includes('non-binary')) gender = 'Non-binary';
      else if (lowerText.includes('4') || lowerText.includes('prefer not')) gender = 'Prefer not to say';
      
      if (isEditing) {
        // If editing, go back to CONFIRMATION
        await updateState('CONFIRMATION', { gender, diversityResearchInterest, isEditing: false, editingField: undefined });
        responseText = generateConfirmationSummary({ ...state.profile, gender, diversityResearchInterest }, msgs);
      } else {
        await updateState('ASK_NOTIFICATIONS', { gender, diversityResearchInterest });
        responseText = msgs.NOTIFICATIONS;
      }
    } else if (state.step === 'ASK_NOTIFICATIONS') {
      // Save notifications preference and complete (matches Telegram - goes directly to COMPLETED, no CONFIRMATION)
      let notifications = 'Not sure';
      if (lowerText.includes('1') || lowerText.includes('yes')) notifications = 'Yes';
      else if (lowerText.includes('2') || lowerText.includes('no')) notifications = 'No';
      else if (lowerText.includes('3')) notifications = 'Check later';
      
      const completedProfile = {
        ...state.profile,
        notifications,
        onboardingCompletedAt: new Date(),
        onboardingSource: 'web' as const,
        userTier: 'explorer' as const  // Default all users to explorer tier
      };
      
      await updateState('COMPLETED', completedProfile);
      
      // NEW: Save to SI U database
      try {
        if (completedProfile.email) {
          const saved = await saveUserToSiuDatabase(
            runtime,
            completedProfile.email,
            completedProfile,
            userId,
            'web'
          );
          if (saved) {
            console.log(`[Web Chat API] ✅ Saved user ${completedProfile.email} to SI U database`);
          } else {
            console.error(`[Web Chat API] ❌ Failed to save user to SI U database`);
          }
        }
      } catch (siuError) {
        console.error('[Web Chat API] Error saving to SI U database:', siuError);
        // Continue even if SI U save fails - we have the cache
      }
      
      // Send completion message with profile (matches Telegram exactly)
      const { formatProfileForDisplay } = await import('../plugins/onboarding/utils.js');
      const profileText = formatProfileForDisplay(completedProfile, completedProfile.language || 'en');
      
      // NEW: Automatically check for matches and suggest them
      let matchSuggestion = '';
      try {
        const { findMatches } = await import('./matchingEngine.js');
        const matchCandidates = await findMatches(
          runtime,
          userId,
          completedProfile,
          [],
          { minScoreThreshold: 55 } // Lower threshold for automatic suggestions
        );
        
        if (matchCandidates.length > 0) {
          const topMatch = matchCandidates[0];
          const matchMessages: Record<string, string> = {
            en: `\n\n🎯 Great news! I found ${matchCandidates.length} potential match${matchCandidates.length > 1 ? 'es' : ''} for you!\n\nWould you like me to introduce you to ${topMatch.profile.name || 'someone'}? Just say "yes" or "find me a match"! 💜`,
            es: `\n\n🎯 ¡Excelentes noticias! ¡Encontré ${matchCandidates.length} conexión${matchCandidates.length > 1 ? 'es' : ''} potencial${matchCandidates.length > 1 ? 'es' : ''} para ti!\n\n¿Te gustaría que te presente a ${topMatch.profile.name || 'alguien'}? ¡Solo di "sí" o "encuéntrame una conexión"! 💜`,
            pt: `\n\n🎯 Ótimas notícias! Encontrei ${matchCandidates.length} conexão${matchCandidates.length > 1 ? 'ões' : ''} potencial${matchCandidates.length > 1 ? 'is' : ''} para você!\n\nGostaria que eu te apresente ${topMatch.profile.name || 'alguém'}? Basta dizer "sim" ou "encontre uma conexão"! 💜`,
            fr: `\n\n🎯 Excellente nouvelle! J'ai trouvé ${matchCandidates.length} connexion${matchCandidates.length > 1 ? 's' : ''} potentielle${matchCandidates.length > 1 ? 's' : ''} pour vous!\n\nVoulez-vous que je vous présente ${topMatch.profile.name || "quelqu'un"}? Dites simplement "oui" ou "trouvez-moi une connexion"! 💜`
          };
          matchSuggestion = matchMessages[completedProfile.language || 'en'] || matchMessages.en;
        }
      } catch (matchErr) {
        console.error('[Web Chat API] Error checking for matches after onboarding:', matchErr);
        // Don't fail onboarding if match check fails
      }
      
      responseText = msgs.COMPLETION + '\n\n' + profileText + matchSuggestion;
    } else if (state.step === 'AWAITING_UPDATE_FIELD') {
      // User is choosing which field to update (matches Telegram)
      const updateFields: Record<string, { step: string, prompt: string, number: number }> = {
        'name': { step: 'UPDATING_NAME', prompt: 'What would you like to change your name to?', number: 1 },
        'location': { step: 'UPDATING_LOCATION', prompt: 'What is your new location (city and country)?', number: 2 },
        'wallet': { step: 'UPDATING_WALLET', prompt: 'Please enter your new wallet address (0x...):', number: 3 },
        'siuName': { step: 'UPDATING_SIU_NAME', prompt: msgs.SIU_NAME || 'What SI U name would you like to claim? (e.g., yourname.siu)', number: 4 },
        'roles': { step: 'UPDATING_ROLES', prompt: msgs.ROLES, number: 5 },
        'interests': { step: 'UPDATING_INTERESTS', prompt: msgs.INTERESTS, number: 6 },
        'goals': { step: 'UPDATING_GOALS', prompt: msgs.GOALS, number: 7 },
        'events': { step: 'UPDATING_EVENTS', prompt: 'What events will you be attending? (event name, date, location)', number: 8 },
        'socials': { step: 'UPDATING_SOCIALS', prompt: 'Share your social media links:', number: 9 },
        'telegram': { step: 'UPDATING_TELEGRAM', prompt: 'What is your Telegram handle? (e.g., @username)', number: 10 },
        'diversity': { step: 'UPDATING_DIVERSITY', prompt: 'Would you like to be (anonymously) included within our diversity research?\n\n1. Yes\n2. No\n3. Not sure yet\n\nPlease reply with the number (for example: 1)', number: 11 },
        'notifications': { step: 'UPDATING_NOTIFICATIONS', prompt: msgs.NOTIFICATIONS, number: 12 }
      };
      
      // Check for number input (1-12)
      const numberMatch = lowerText.match(/\b([1-9]|1[0-2])\b/);
      let fieldToUpdate: string | null = null;
      
      if (numberMatch) {
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
              (field === 'wallet' && lowerText.includes('wallet')) ||
              (field === 'siuName' && (lowerText.includes('siu') || lowerText.includes('username'))) ||
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
        const updateInfo = updateFields[fieldToUpdate];
        await updateState(updateInfo.step, {});
        responseText = updateInfo.prompt;
      } else {
        // Invalid - show list again
        responseText = `What would you like to update? 📝\n\n` +
          `1. Name\n` +
          `2. Location\n` +
          `3. Wallet address\n` +
          `4. SI U name\n` +
          `5. Professional role(s)\n` +
          `6. Professional interests\n` +
          `7. Professional goals\n` +
          `8. Events & conferences attending\n` +
          `9. Personal social and/or digital links\n` +
          `10. Telegram handle\n` +
          `11. Diversity research interest\n` +
          `12. Collaboration notifications\n\n` +
          `Just type the field number(s) (e.g. 1, 3).`;
      }
    } else if (state.step === 'UPDATING_WALLET') {
      // Handle wallet update
      const newWalletAddress = messageText.trim();
      const walletValidation = validateWalletAddress(newWalletAddress);
      
      if (!walletValidation.valid) {
        responseText = walletValidation.error || 'Invalid wallet address. Please enter a valid Ethereum address (0x...):';
      } else {
        // Check if wallet is already registered (by someone else)
        try {
          const walletExists = await isWalletRegistered(newWalletAddress);
          if (walletExists) {
            const existingUser = await findSiuUserByWallet(newWalletAddress);
            if (existingUser && existingUser.email !== state.profile.email) {
              responseText = 'This wallet address is already registered with another account. Please use a different wallet address.';
              return { success: true, response: responseText, userId, profile: state.profile, onboardingStatus: 'UPDATING_WALLET' };
            }
          }
        } catch (err) {
          console.log('[Web Chat API] Could not check wallet registration:', err);
        }
        
        // Update the profile
        const { updateOnboardingStep } = await import('../plugins/onboarding/utils.js');
        const updatedProfile = { ...state.profile, walletAddress: newWalletAddress };
        await updateOnboardingStep(runtime, userId as any, userId as any, 'COMPLETED', updatedProfile);
        await updateState('COMPLETED', updatedProfile);
        
        // Also update SI U database
        if (state.profile.email) {
          try {
            const { updateSiuUserProfile } = await import('./siuDatabaseService.js');
            await updateSiuUserProfile(state.profile.email, { wallet_address: newWalletAddress, isWalletVerified: true });
          } catch (err) {
            console.error('[Web Chat API] Error updating SI U database:', err);
          }
        }
        
        responseText = `✅ Your wallet address has been updated!\n\nSay "my profile" to see your updated profile! 💜`;
      }
    } else if (state.step === 'UPDATING_SIU_NAME') {
      // Handle SI U name update
      const validation = validateSiuName(messageText);
      
      if (!validation.valid) {
        responseText = validation.error || 'Invalid SI U name. Please try again:';
      } else {
        const formattedName = validation.formatted!;
        
        // Check availability
        const availability = await checkSiuNameAvailability(formattedName);
        if (!availability.available) {
          responseText = `${formattedName} is already taken. Please choose a different name:`;
        } else {
          // Update the profile
          const { updateOnboardingStep } = await import('../plugins/onboarding/utils.js');
          const updatedProfile = { ...state.profile, siuName: formattedName };
          await updateOnboardingStep(runtime, userId as any, userId as any, 'COMPLETED', updatedProfile);
          await updateState('COMPLETED', updatedProfile);
          
          // Also update SI U database
          if (state.profile.email) {
            try {
              const { updateSiuUserProfile } = await import('./siuDatabaseService.js');
              await updateSiuUserProfile(state.profile.email, { siuName: formattedName, username: formattedName });
            } catch (err) {
              console.error('[Web Chat API] Error updating SI U database:', err);
            }
          }
          
          responseText = `🎉 Your SI U name has been updated to ${formattedName}!\n\nSay "my profile" to see your updated profile! 💜`;
        }
      }
    } else if (state.step.startsWith('UPDATING_')) {
      // Handle update for specific field (matches Telegram)
      const fieldBeingUpdated = state.step.replace('UPDATING_', '').toLowerCase();
      let updateValue: any = messageText.trim();
      
      // Parse based on field type
      if (['roles', 'interests', 'goals', 'events', 'socials'].includes(fieldBeingUpdated)) {
        if (fieldBeingUpdated === 'roles') {
          const roleMap: Record<string, string> = {
            '1': 'Founder/Builder', '2': 'Marketing/BD/Partnerships', '3': 'DAO Council Member/Delegate',
            '4': 'Community Leader', '5': 'Investor/Grant Program Operator', '6': 'Early Web3 Explorer',
            '7': 'Media', '8': 'Artist', '9': 'Developer', '10': 'Other'
          };
          updateValue = parseNumberedList(messageText, roleMap);
        } else if (fieldBeingUpdated === 'interests') {
          const interestMap: Record<string, string> = {
            '1': 'Web3 Growth Marketing', '2': 'Business Development & Partnerships', '3': 'Education 3.0',
            '4': 'AI', '5': 'Cybersecurity', '6': 'DAOs', '7': 'Tokenomics', '8': 'Fundraising', '9': 'Other'
          };
          updateValue = parseNumberedList(messageText, interestMap);
        } else if (fieldBeingUpdated === 'goals') {
          const goalMap: Record<string, string> = {
            '1': 'Startups to invest in',
            '2': 'Investors/grant programs',
            '3': 'Growth tools, strategies, and/or support',
            '4': 'Sales/BD tools, strategies and/or support',
            '5': "Communities and/or DAO's to join",
            '6': 'New job opportunities'
          };
          updateValue = parseNumberedList(messageText, goalMap);
        } else {
          updateValue = messageText.split(',').map((s: string) => s.trim()).filter((s: string) => s);
        }
      } else if (fieldBeingUpdated === 'notifications') {
        if (lowerText.includes('1') || lowerText.includes('yes')) updateValue = 'Yes';
        else if (lowerText.includes('2') || lowerText.includes('no')) updateValue = 'No';
        else if (lowerText.includes('3')) updateValue = 'Check later';
      } else if (fieldBeingUpdated === 'diversity') {
        // Handle diversity research interest
        if (lowerText.includes('1') || lowerText.includes('yes')) {
          updateValue = 'Yes';
          // Track in MongoDB for diversity research
          try {
            const db = runtime.databaseAdapter as any;
            if (db && db.getDb) {
              const mongoDb = await db.getDb();
              const diversityCollection = mongoDb.collection('diversity_research');
              const existing = await diversityCollection.findOne({ userId: userId });
              if (!existing) {
                await diversityCollection.insertOne({
                  userId: userId,
                  email: state.profile.email || null,
                  interestedAt: new Date(),
                  status: 'pending'
                });
                console.log('[Web Chat API] ✅ Tracked diversity research interest for user:', userId);
              } else {
                await diversityCollection.updateOne(
                  { userId: userId },
                  { $set: { interestedAt: new Date(), status: 'pending' } }
                );
                console.log('[Web Chat API] ✅ Updated diversity research interest');
              }
            }
          } catch (error) {
            console.error('[Web Chat API] Error tracking diversity research interest:', error);
          }
        } else if (lowerText.includes('2') || lowerText.includes('no')) {
          updateValue = 'No';
          // Remove from diversity research tracking
          try {
            const db = runtime.databaseAdapter as any;
            if (db && db.getDb) {
              const mongoDb = await db.getDb();
              const diversityCollection = mongoDb.collection('diversity_research');
              await diversityCollection.deleteOne({ userId: userId });
              console.log('[Web Chat API] ✅ Removed from diversity research tracking');
            }
          } catch (error) {
            console.error('[Web Chat API] Error removing from tracking:', error);
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
      
      const profileKey = fieldToKey[fieldBeingUpdated];
      if (profileKey) {
        // Update the profile
        const { updateOnboardingStep } = await import('../plugins/onboarding/utils.js');
        const updatedProfile = { ...state.profile, [profileKey]: updateValue };
        await updateOnboardingStep(
          runtime,
          userId as any,
          userId as any,
          'COMPLETED',
          updatedProfile
        );
        await updateState('COMPLETED', updatedProfile);
        
        const displayField = fieldBeingUpdated === 'diversity' ? 'diversity research interest' : fieldBeingUpdated;
        const langResponses: Record<string, string> = {
          en: `✅ Your ${displayField} has been updated!\n\nSay "my profile" to see your updated profile! 💜`,
          es: `✅ ¡Tu ${displayField} ha sido actualizado!\n\nDi "mi perfil" para ver tu perfil actualizado! 💜`,
          pt: `✅ Seu ${displayField} foi atualizado!\n\nDiga "meu perfil" para ver seu perfil atualizado! 💜`,
          fr: `✅ Votre ${displayField} a été mis à jour!\n\nDites "mon profil" pour voir votre profil mis à jour! 💜`
        };
        responseText = langResponses[userLang] || langResponses.en;
      } else {
        responseText = "I couldn't update that field. Please try again.";
      }
    } else if (state.step === 'ASK_PROFILE_CHOICE') {
      const choice = messageText.trim();
      const existingUserId = state.profile?.existingUserId;
      const existingProfile = state.profile?.existingProfile;
      
      if (choice === '1' || choice.toLowerCase().includes('continue') || choice.toLowerCase().includes('existing')) {
        // User wants to continue with existing profile
        if (existingUserId && existingProfile) {
          console.log(`[Web Chat API] Loading existing profile from user ${existingUserId}`);
          console.log(`[Web Chat API] Linking web userId ${userId} to original userId ${existingUserId}`);
          
          // Create mapping from web userId to original userId (matches Telegram behavior)
          try {
            const db = runtime.databaseAdapter as any;
            const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
            const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
            
            if (isMongo && db.getDb) {
              const mongoDb = await db.getDb();
              await mongoDb.collection('user_mappings').updateOne(
                { platform_user_id: userId },
                { 
                  $set: { 
                    primary_user_id: existingUserId,
                    platform: 'web',
                    updated_at: new Date()
                  },
                  $setOnInsert: {
                    created_at: new Date()
                  }
                },
                { upsert: true }
              );
              console.log(`[Web Chat API] ✅ Created user mapping: ${userId} → ${existingUserId}`);
            } else if (db.query) {
              await db.query(
                `INSERT INTO user_mappings (platform_user_id, primary_user_id, platform, created_at, updated_at)
                 VALUES ($1::text, $2::text, 'web', NOW(), NOW())
                 ON CONFLICT (platform_user_id) DO UPDATE SET primary_user_id = $2::text, updated_at = NOW()`,
                [userId, existingUserId]
              );
              console.log(`[Web Chat API] ✅ Created user mapping: ${userId} → ${existingUserId}`);
            }
          } catch (mappingError) {
            console.error('[Web Chat API] Error creating user mapping:', mappingError);
            // Continue even if mapping fails - profile linking still works via returned userId
          }
          
          const { formatProfileForDisplay } = await import('../plugins/onboarding/utils.js');
          
          // IMPORTANT: Use the original userId, not the current one
          // Update the profile under the original userId
          const { updateOnboardingStep } = await import('../plugins/onboarding/utils.js');
          await updateOnboardingStep(
            runtime,
            existingUserId as any,
            existingUserId as any, // Use original userId as roomId too
            'COMPLETED',
            {
              ...existingProfile,
              email: state.profile?.email, // Keep the email they just entered
              onboardingCompletedAt: existingProfile.onboardingCompletedAt || new Date()
            }
          );
          
          const profileDisplay = formatProfileForDisplay({ ...existingProfile, email: state.profile?.email }, state.profile?.language || 'en');
          responseText = `${msgs.COMPLETION}\n\n${profileDisplay}`;
          
          // Return the original userId so client can use it for all future requests
          return {
            success: true,
            response: responseText,
            userId: existingUserId, // Return original userId
            primaryUserId: existingUserId, // Also return as primaryUserId for clarity
            profile: { ...existingProfile, email: state.profile?.email },
            onboardingStatus: 'COMPLETED'
          };
        } else {
          // Fallback: continue with current profile
          await updateState('ASK_LOCATION', {});
          responseText = msgs.LOCATION;
        }
      } else if (choice === '2' || choice.toLowerCase().includes('new') || choice.toLowerCase().includes('recreate')) {
        // User wants to create a new profile
        await updateState('ASK_LOCATION', {});
        responseText = msgs.LOCATION;
      } else {
        // Invalid choice - ask again
        responseText = `${msgs.PROFILE_EXISTS}\n\n${msgs.PROFILE_CHOICE}`;
      }
    } else if (state.step === 'CONFIRMATION') {
      // Handle confirmation step - matches Telegram flow exactly
      if (lowerText.includes('confirm') || lowerText.includes('yes') || lowerText.includes('check')) {
        // User confirmed - mark as completed and show profile
        const { formatProfileForDisplay } = await import('../plugins/onboarding/utils.js');
        const { updateOnboardingStep } = await import('../plugins/onboarding/utils.js');
        
        // Use updateOnboardingStep for consistency with Telegram
        await updateOnboardingStep(
          runtime,
          userId as any,
          userId as any, // Use userId as roomId for web
          'COMPLETED',
          {
            ...state.profile,
            isConfirmed: true,
            onboardingCompletedAt: new Date()
          }
        );
        
        // Update local state
        await updateState('COMPLETED', { isConfirmed: true, onboardingCompletedAt: new Date() });
        
        // Show completion message with formatted profile (matches Telegram)
        const profileDisplay = formatProfileForDisplay(state.profile, userLang);
        responseText = `${msgs.COMPLETION}\n\n${profileDisplay}`;
      } else if (lowerText.includes('edit')) {
        // Handle profile editing - matches Telegram flow
        const lower = lowerText;
        let editStep: string | null = null;
        let editField: string | undefined = undefined;
        
        if (lower.includes('name')) { editStep = 'ASK_NAME'; editField = 'name'; }
        else if (lower.includes('location')) { editStep = 'ASK_LOCATION'; editField = 'location'; }
        else if (lower.includes('email')) { editStep = 'ASK_EMAIL'; editField = 'email'; }
        else if (lower.includes('professional') || lower.includes('role')) { editStep = 'ASK_ROLE'; editField = 'roles'; }
        else if (lower.includes('learning') || lower.includes('interest')) { editStep = 'ASK_INTERESTS'; editField = 'interests'; }
        else if (lower.includes('connection') || lower.includes('goal')) { editStep = 'ASK_CONNECTION_GOALS'; editField = 'connectionGoals'; }
        else if (lower.includes('conference') || lower.includes('event')) { editStep = 'ASK_EVENTS'; editField = 'events'; }
        else if (lower.includes('personal') || lower.includes('link') || lower.includes('social')) { editStep = 'ASK_SOCIALS'; editField = 'socials'; }
        else if (lower.includes('telegram')) { editStep = 'ASK_TELEGRAM_HANDLE'; editField = 'telegramHandle'; }
        else if (lower.includes('gender')) { editStep = 'ASK_GENDER'; editField = 'gender'; }
        else if (lower.includes('notification') || lower.includes('collab')) { editStep = 'ASK_NOTIFICATIONS'; editField = 'notifications'; }
        
        if (editStep) {
          await updateState(editStep, { isEditing: true, editingField: editField });
          // Get the appropriate message for the edit step
          const editMsgs = getPlatformMessages(userLang, platformRoles);
          if (editStep === 'ASK_NAME') responseText = editMsgs.GREETING;
          else if (editStep === 'ASK_LOCATION') responseText = editMsgs.LOCATION;
          else if (editStep === 'ASK_EMAIL') responseText = editMsgs.EMAIL;
          else if (editStep === 'ASK_ROLE') responseText = editMsgs.ROLES;
          else if (editStep === 'ASK_INTERESTS') responseText = editMsgs.INTERESTS;
          else if (editStep === 'ASK_CONNECTION_GOALS') responseText = editMsgs.GOALS;
          else if (editStep === 'ASK_EVENTS') responseText = editMsgs.EVENTS;
          else if (editStep === 'ASK_SOCIALS') responseText = editMsgs.SOCIALS;
          else if (editStep === 'ASK_TELEGRAM_HANDLE') responseText = editMsgs.TELEGRAM;
          else if (editStep === 'ASK_GENDER') responseText = editMsgs.GENDER;
          else if (editStep === 'ASK_NOTIFICATIONS') responseText = editMsgs.NOTIFICATIONS;
        } else {
          // Invalid edit field - show confirmation again
          responseText = generateConfirmationSummary(state.profile, msgs);
        }
      } else {
        // User input doesn't match confirm/edit - show confirmation again
        responseText = generateConfirmationSummary(state.profile, msgs);
      }
    } else if (state.step === 'COMPLETED') {
      // ==================== COMPLETED USER COMMANDS ====================
      
      // Command detection
      const isMatchRequest = lowerText.includes('match') || lowerText.includes('connect me') || lowerText.includes('find someone') || lowerText.includes('find me') || lowerText.includes('introduce');
      const isHistoryRequest = lowerText === 'profile' || lowerText.includes('history') || lowerText.includes('my profile') || lowerText.includes('my matches') || lowerText.includes('show profile') || lowerText.includes('view profile');
      const isLanguageChange = lowerText.includes('change language') || lowerText.includes('cambiar idioma') || lowerText.includes('mudar idioma') || lowerText.includes('changer de langue');
      const isHelpRequest = lowerText === 'help' || lowerText === '?' || lowerText.includes('what can you do');
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
        lowerText.includes('change profile') ||
        // NEW: Natural language correction phrases
        lowerText.includes('correction') ||
        lowerText.includes('i want to make a correction') ||
        lowerText.includes('i need to correct') ||
        lowerText.includes('i need to fix') ||
        lowerText.includes('i want to fix') ||
        lowerText.includes('fix my') ||
        lowerText.includes('fix my profile') ||
        lowerText.includes('wrong information') ||
        lowerText.includes('that\'s wrong') ||
        lowerText.includes('that is wrong') ||
        lowerText.includes('i made a mistake') ||
        lowerText.includes('i need to change') ||
        lowerText.includes('i want to change') ||
        lowerText.includes('change something') ||
        lowerText.includes('update something') ||
        lowerText.includes('correct my') ||
        lowerText.includes('correct this') ||
        lowerText.includes('fix this') ||
        lowerText.includes('change this') ||
        lowerText.includes('update this') ||
        lowerText.includes('modify my') ||
        lowerText.includes('revise my') ||
        lowerText.includes('amend my') ||
        lowerText.includes('adjust my') ||
        lowerText.includes('i need to update') ||
        lowerText.includes('i want to update') ||
        lowerText.includes('i need to edit') ||
        lowerText.includes('i want to edit') ||
        lowerText.includes('can i change') ||
        lowerText.includes('can i update') ||
        lowerText.includes('can i edit') ||
        lowerText.includes('can i fix') ||
        lowerText.includes('can i correct');
      
      // Feature request detection (matches Telegram)
      const isFeatureRequest = lowerText.includes('feature request') || lowerText.includes('suggest a feature') || 
        lowerText.includes('i would like') || lowerText.includes('can you') || lowerText.includes('could you') ||
        (lowerText.includes('feature') && (lowerText.includes('want') || lowerText.includes('like') || lowerText.includes('suggest')));
      const hasFeatureDetails = messageText.length > 30 || 
        lowerText.includes('can you') || lowerText.includes('could you') || 
        lowerText.includes('i would like') || lowerText.includes('i want') ||
        lowerText.includes('it should') || lowerText.includes('it would be');
      
      // Knowledge question detection
      const knowledgeKeywords = [
        'what is', 'what are', 'explain', 'tell me about', 'how does', 'define',
        'dao', 'defi', 'nft', 'blockchain', 'cryptocurrency', 'crypto', 'web3',
        'smart contract', 'token', 'wallet', 'ethereum', 'bitcoin', 'solana',
        'proof of stake', 'proof of work', 'mining', 'staking', 'yield', 'liquidity'
      ];
      const isKnowledgeQuestion = knowledgeKeywords.some(k => lowerText.includes(k)) && 
        !lowerText.includes('match') && !lowerText.includes('profile') && !lowerText.includes('update');
      
      if (isHelpRequest) {
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
        // ==================== MATCHING WITH TRACKING (matches Telegram exactly) ====================
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
              const db = runtime.databaseAdapter as any;
              if (db && db.query) {
                // Use new weighted matching engine
                try {
                  const { findMatches } = await import('./matchingEngine.js');
                  
                  // Get previous matches to exclude (matches Telegram exactly)
                  let previousMatchIds: string[] = [];
                  try {
                    const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
                    const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
                    
                    if (isMongo && db.getDb) {
                      const mongoDb = await db.getDb();
                      const prevMatches = await mongoDb.collection('matches').find({ user_id: userId }).toArray();
                      previousMatchIds = prevMatches.map((m: any) => m.matched_user_id);
                    } else {
                      const prevMatches = await db.query(
                        `SELECT matched_user_id FROM matches WHERE user_id = $1::text`,
                        [userId]
                      );
                      previousMatchIds = (prevMatches.rows || []).map((r: any) => r.matched_user_id);
                    }
                  } catch (e) { 
                    console.log('[Manual Match] Could not get previous matches:', e);
                  }
                  
                  console.log('[Manual Match] 🔍 Calling matching engine...');
                  const matchCandidates = await findMatches(
                    runtime,
                    userId,
                    state.profile,
                    previousMatchIds,
                    { minScoreThreshold: 55 } // Lower threshold for manual requests to increase matches
                  );
                  console.log(`[Manual Match] Matching engine returned ${matchCandidates.length} candidate(s)`);
                  
                  // Convert to old format for compatibility
                  for (const match of matchCandidates) {
                    candidates.push({
                      id: match.userId,
                      profile: match.profile,
                      score: match.score,
                      reason: match.icebreaker || match.reason
                    });
                  }
                } catch (engineErr) {
                  console.log('[Matching] New engine failed, using fallback:', engineErr);
                  // Fallback to simple matching if engine fails
                  // Get previous matches for fallback
                  let fallbackPreviousMatchIds: string[] = [];
                  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
                  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
                  
                  try {
                    if (isMongo && db.getDb) {
                      const mongoDb = await db.getDb();
                      const prevMatches = await mongoDb.collection('matches').find({ user_id: userId }).toArray();
                      fallbackPreviousMatchIds = prevMatches.map((m: any) => m.matched_user_id);
                    } else {
                      const prevMatches = await db.query(
                        `SELECT matched_user_id FROM matches WHERE user_id = $1::text`,
                        [userId]
                      );
                      fallbackPreviousMatchIds = (prevMatches.rows || []).map((r: any) => r.matched_user_id);
                    }
                  } catch (e) { 
                    console.log('[Manual Match Fallback] Could not get previous matches:', e);
                  }
                  
                  // Fallback: simple interest-based matching
                  const cacheCollection = isMongo && db.getDb ? (await db.getDb()).collection('cache') : null;
                  const allKeys = isMongo && cacheCollection
                    ? await cacheCollection.find({ key: { $regex: /^onboarding_/ } }).toArray()
                    : (await db.query(`SELECT key FROM cache WHERE key LIKE 'onboarding_%'`)).rows || [];
                  
                  for (const keyDoc of allKeys) {
                    try {
                      const key = isMongo ? keyDoc.key : keyDoc.key;
                      const otherUserId = key.replace('onboarding_', '');
                      if (otherUserId === userId || fallbackPreviousMatchIds.includes(otherUserId)) continue;
                      
                      const otherState = isMongo 
                        ? (typeof keyDoc.value === 'string' ? JSON.parse(keyDoc.value) : keyDoc.value)
                        : (typeof keyDoc.value === 'string' ? JSON.parse(keyDoc.value) : keyDoc.value);
                      
                      if (!otherState || otherState.step !== 'COMPLETED' || !otherState.profile) continue;
                      
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
              }
            } catch (dbErr) {
              console.log('[Web Chat API] Database query error:', dbErr);
            }
            
            if (candidates.length === 0) {
              // Send email notification to members@si3.space with user info
              try {
                const { sendNoMatchNotification } = await import('./featureRequest.js');
                await sendNoMatchNotification(userId, state.profile, runtime);
                console.log('[No Match] ✅ Sent no-match notification email');
              } catch (emailError: any) {
                console.log('[No Match] ⚠️ Could not send no-match notification email:', emailError.message);
                // Continue even if email fails
              }
              
              responseText = "I couldn't find a match within the current pool, but don't worry! 💜\n\nSI<3> will explore potential matches within its broader network and reach out if we find someone great for you.\n\nIn the meantime, feel free to share any specific connection requests with us at members@si3.space. 🚀";
            } else {
              const topMatch = candidates.sort((a, b) => b.score - a.score)[0];
              matchedUserId = topMatch.id;
              
              // ==================== RECORD MATCH IN DATABASE (matches Telegram exactly) ====================
              try {
                const { v4: uuidv4 } = await import('uuid');
                const matchId = uuidv4();
                const db = runtime.databaseAdapter as any;
                if (db) {
                  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
                  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
                  const matchDate = new Date();
                  
                  if (isMongo && db.getDb) {
                    const mongoDb = await db.getDb();
                    // Record the match
                    await mongoDb.collection('matches').insertOne({
                      id: matchId,
                      user_id: userId,
                      matched_user_id: matchedUserId,
                      room_id: `web_${userId}`,
                      match_date: matchDate,
                      status: 'pending'
                    });
                    
                    // Schedule 3-day follow-up
                    const followUpDate = new Date();
                    followUpDate.setDate(followUpDate.getDate() + 3);
                    await mongoDb.collection('follow_ups').insertOne({
                      id: uuidv4(),
                      match_id: matchId,
                      user_id: userId,
                      type: '3_day_checkin',
                      scheduled_for: followUpDate,
                      status: 'pending'
                    });
                  } else if (db.query) {
                    // Record the match (PostgreSQL)
                    await db.query(
                      `INSERT INTO matches (id, user_id, matched_user_id, room_id, match_date, status) VALUES ($1, $2::text, $3::text, $4::text, NOW(), 'pending')`,
                      [matchId, userId, matchedUserId, `web_${userId}`]
                    );
                    
                    // Schedule 3-day follow-up
                    const followUpDate = new Date();
                    followUpDate.setDate(followUpDate.getDate() + 3);
                    await db.query(
                      `INSERT INTO follow_ups (id, match_id, user_id, type, scheduled_for, status) VALUES ($1, $2, $3::text, '3_day_checkin', $4, 'pending')`,
                      [uuidv4(), matchId, userId, followUpDate]
                    );
                  }
                  console.log('[Match Tracker] ✅ Match recorded and follow-up scheduled');
                }
              } catch (trackErr) {
                console.log('[Match Tracker] Could not record match:', trackErr);
              }
              
              // Use icebreaker if available, otherwise use reason
              const matchMessage = topMatch.reason.includes('Shared interests') 
                ? topMatch.reason 
                : topMatch.reason; // Will be replaced with icebreaker from engine
              
              // Determine platform for matched user
              const matchRoles = topMatch.profile.roles || [];
              const matchIsGrow3dge = matchRoles.includes('partner');
              const matchIsSiHer = matchRoles.includes('team');
              const matchHasBoth = matchIsGrow3dge && matchIsSiHer;
              
              let platformText = '';
              if (matchHasBoth) {
                platformText = 'Platform: SI Her & Grow3dge Member\n';
              } else if (matchIsGrow3dge) {
                platformText = 'Platform: Grow3dge Member\n';
              } else if (matchIsSiHer) {
                platformText = 'Platform: SI Her Member\n';
              }
              
              responseText = `🚀 I found a match for you!\n\n` +
                `Meet ${topMatch.profile.name || 'Anonymous'} from ${topMatch.profile.location || 'Earth'}.\n` +
                (platformText ? `${platformText}` : '') +
                `Roles: ${topMatch.profile.roles?.join(', ') || 'Not specified'}\n` +
                `Interests: ${topMatch.profile.interests?.join(', ') || 'Not specified'}\n` +
                (topMatch.profile.telegramHandle ? `Telegram: @${topMatch.profile.telegramHandle}\n` : '') +
                `\n💡 ${matchMessage}\n\n` +
                `I've saved this match. I'll check in with you in 3 days to see if you connected! 🤝`;
            }
          }
        } catch (matchErr: any) {
          console.error('[Web Chat API] Match error:', matchErr);
          responseText = "I had trouble finding matches right now. Please try again later! 💜";
        }
      } else if (isHistoryRequest) {
        // ==================== PROFILE WITH MATCH HISTORY (matches Telegram) ====================
        const p = state.profile;
        
        // Fetch match history
        let matchCount = 0;
        let matchList = '';
        try {
          const db = runtime.databaseAdapter as any;
          if (db) {
            const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
            const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
            
            let matches: any[] = [];
            if (isMongo && db.getDb) {
              const mongoDb = await db.getDb();
              matches = await mongoDb.collection('matches')
                .find({ user_id: userId })
                .sort({ match_date: -1 })
                .limit(5)
                .toArray();
              matchCount = matches.length;
            } else if (db.query) {
              const matchRes = await db.query(
                `SELECT * FROM matches WHERE user_id = $1::text ORDER BY match_date DESC LIMIT 5`,
                [userId]
              );
              matches = matchRes.rows || [];
              matchCount = matches.length;
            }
            
            if (matchCount > 0) {
              matchList = '\n\nRecent Matches:\n';
              for (const match of matches) {
                const statusEmoji = match.status === 'connected' ? '✅' : match.status === 'not_interested' ? '❌' : '⏳';
                const date = new Date(match.match_date).toLocaleDateString();
                matchList += `${statusEmoji} ${date} - ${match.status}\n`;
              }
            }
          }
        } catch (e) { 
          console.log('[Profile History] Could not fetch matches:', e);
        }
        
        // Use formatProfileForDisplay to ensure actual values are shown
        const { formatProfileForDisplay } = await import('../plugins/onboarding/utils.js');
        const profileText = formatProfileForDisplay(p, p.language || 'en');
        responseText = profileText +
          `\n\nTotal Matches: ${matchCount}` +
          matchList +
          `\n\n✅ Onboarding: Completed\n\nTo update any field, say "update" or "update [field name]".`;
      } else if (isLanguageChange) {
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
      } else if (isKnowledgeQuestion) {
        const langResponses: Record<string, string> = {
          en: `Great question! 🧠\n\nI'm activating my peer-to-peer knowledge-sharing capabilities soon, where you'll be able to learn from other community members who are experts in these topics.\n\nFor now, I'm focused on making meaningful connections within the SI<3> community. Would you like me to find you a match? Just say "find me a match"! 🤝💜`,
          es: `¡Gran pregunta! 🧠\n\nPronto activaré mis capacidades de intercambio de conocimientos entre pares, donde podrás aprender de otros miembros de la comunidad que son expertos en estos temas.\n\nPor ahora, estoy enfocada en hacer conexiones significativas dentro de la comunidad SI<3>. ¿Te gustaría que te encuentre una conexión? ¡Solo di "encuéntrame una conexión"! 🤝💜`,
          pt: `Ótima pergunta! 🧠\n\nEm breve ativarei minhas capacidades de compartilhamento de conhecimento entre pares, onde você poderá aprender com outros membros da comunidade que são especialistas nesses tópicos.\n\nPor enquanto, estou focada em fazer conexões significativas dentro da comunidade SI<3>. Gostaria que eu encontrasse uma conexão para você? Basta dizer "encontre uma conexão"! 🤝💜`,
          fr: `Excellente question! 🧠\n\nJ'activerai bientôt mes capacités de partage de connaissances entre pairs, où vous pourrez apprendre d'autres membres de la communauté qui sont experts dans ces sujets.\n\nPour l'instant, je me concentre sur la création de connexions significatives au sein de la communauté SI<3>. Voulez-vous que je vous trouve une connexion? Dites simplement "trouve-moi une connexion"! 🤝💜`
        };
        responseText = langResponses[state.profile.language || 'en'] || langResponses.en;
      } else if (isUpdateRequest) {
        // ==================== PROFILE UPDATE FEATURE (matches Telegram) ====================
        const updateFields: Record<string, { step: string, prompt: string, number: number }> = {
          'name': { step: 'UPDATING_NAME', prompt: 'What would you like to change your name to?', number: 1 },
          'location': { step: 'UPDATING_LOCATION', prompt: 'What is your new location (city and country)?', number: 2 },
          'wallet': { step: 'UPDATING_WALLET', prompt: 'Please enter your new wallet address (0x...):', number: 3 },
          'siuName': { step: 'UPDATING_SIU_NAME', prompt: msgs.SIU_NAME || 'What SI U name would you like to claim? (e.g., yourname.siu)', number: 4 },
          'roles': { step: 'UPDATING_ROLES', prompt: msgs.ROLES, number: 5 },
          'interests': { step: 'UPDATING_INTERESTS', prompt: msgs.INTERESTS, number: 6 },
          'goals': { step: 'UPDATING_GOALS', prompt: msgs.GOALS, number: 7 },
          'events': { step: 'UPDATING_EVENTS', prompt: 'What events will you be attending? (event name, date, location)', number: 8 },
          'socials': { step: 'UPDATING_SOCIALS', prompt: 'Share your social media links:', number: 9 },
          'telegram': { step: 'UPDATING_TELEGRAM', prompt: 'What is your Telegram handle? (e.g., @username)', number: 10 },
          'diversity': { step: 'UPDATING_DIVERSITY', prompt: 'Would you like to be (anonymously) included within our diversity research?\n\n1. Yes\n2. No\n3. Not sure yet\n\nPlease reply with the number (for example: 1)', number: 11 },
          'notifications': { step: 'UPDATING_NOTIFICATIONS', prompt: msgs.NOTIFICATIONS, number: 12 }
        };
        
        // Check for number input (1-12)
        const numberMatch = lowerText.match(/\b([1-9]|1[0-2])\b/);
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
                (field === 'wallet' && lowerText.includes('wallet')) ||
                (field === 'siuName' && (lowerText.includes('siu') || lowerText.includes('username'))) ||
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
            `3. Wallet address\n` +
            `4. SI U name\n` +
            `5. Professional role(s)\n` +
            `6. Professional interests\n` +
            `7. Professional goals\n` +
            `8. Events & conferences attending\n` +
            `9. Personal social and/or digital links\n` +
            `10. Telegram handle\n` +
            `11. Diversity research interest\n` +
            `12. Collaboration notifications\n\n` +
            `Just type the field number(s) (e.g. 1, 3).`;
        }
      } else if (isFeatureRequest) {
        // Feature request handling (matches Telegram)
        if (hasFeatureDetails) {
          // User provided details in the same message - send directly
          try {
            const { sendFeatureRequest } = await import('./featureRequest.js');
            await sendFeatureRequest(userId, state.profile.name || 'Anonymous', messageText, messageText);
            
            // Also save to database
            try {
              const db = runtime.databaseAdapter as any;
              if (db && db.query) {
                const { v4: uuidv4 } = await import('uuid');
                await db.query(
                  `INSERT INTO feature_requests (id, user_id, user_name, request_text, created_at) VALUES ($1, $2::text, $3, $4, NOW())`,
                  [uuidv4(), userId, state.profile.name || 'Anonymous', messageText]
                );
              } else if (db && db.getDb) {
                const mongoDb = await db.getDb();
                const featureCollection = mongoDb.collection('feature_requests');
                await featureCollection.insertOne({
                  userId: userId,
                  userName: state.profile.name || 'Anonymous',
                  requestText: messageText,
                  createdAt: new Date()
                });
              }
            } catch (dbErr) {
              console.log('[Web Chat API] Could not save feature request to DB:', dbErr);
            }
            
            // Check if email was sent successfully
            let emailSent = false;
            try {
              // Email sending is already done above, check if it succeeded
              emailSent = true; // Assume success if no error was thrown
            } catch (e) {
              emailSent = false;
            }
            
            if (emailSent) {
              responseText = `Thank you for your suggestion, ${state.profile.name || 'Anonymous'}! 💜\n\n` +
                `I've sent your request to tech@si3.space:\n"${messageText.substring(0, 200)}${messageText.length > 200 ? '...' : ''}"\n\n` +
                `The SI<3> team reviews all suggestions. Your feedback helps make me better! 🚀`;
            } else {
              responseText = `Thank you for your suggestion, ${state.profile.name || 'Anonymous'}! 💜\n\n` +
                `I've recorded your request:\n"${messageText.substring(0, 200)}${messageText.length > 200 ? '...' : ''}"\n\n` +
                `The SI<3> team reviews all suggestions. Your feedback helps make me better! 🚀`;
            }
          } catch (error: any) {
            console.error('[Web Chat API] Error sending feature request:', error);
            responseText = "I encountered an issue sending your feature request. Please try again later. 💜";
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
      } else {
        // NEW: Proactive match suggestion for general chat
        // If user hasn't requested a match recently, suggest it occasionally
        const shouldSuggestMatch = Math.random() < 0.15; // 15% chance to suggest matches
        if (shouldSuggestMatch && !lowerText.includes('match') && !lowerText.includes('profile') && !lowerText.includes('update')) {
          try {
            const { findMatches } = await import('./matchingEngine.js');
            
            // Get previous matches to exclude
            let previousMatchIds: string[] = [];
            try {
              const db = runtime.databaseAdapter as any;
              const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
              const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
              
              if (isMongo && db.getDb) {
                const mongoDb = await db.getDb();
                const prevMatches = await mongoDb.collection('matches').find({ user_id: userId }).toArray();
                previousMatchIds = prevMatches.map((m: any) => m.matched_user_id);
              } else if (db.query) {
                const prevMatches = await db.query(
                  `SELECT matched_user_id FROM matches WHERE user_id = $1::text`,
                  [userId]
                );
                previousMatchIds = (prevMatches.rows || []).map((r: any) => r.matched_user_id);
              }
            } catch (e) { 
              console.log('[Proactive Match] Could not get previous matches:', e);
            }
            
            const matchCandidates = await findMatches(
              runtime,
              userId,
              state.profile,
              previousMatchIds,
              { minScoreThreshold: 55 } // Lower threshold for proactive suggestions
            );
            
            if (matchCandidates.length > 0) {
              const suggestionMessages: Record<string, string> = {
                en: `By the way, I found ${matchCandidates.length} potential match${matchCandidates.length > 1 ? 'es' : ''} for you! Would you like me to introduce you? Just say "yes" or "find me a match"! 💜`,
                es: `Por cierto, ¡encontré ${matchCandidates.length} conexión${matchCandidates.length > 1 ? 'es' : ''} potencial${matchCandidates.length > 1 ? 'es' : ''} para ti! ¿Te gustaría que te presente? ¡Solo di "sí" o "encuéntrame una conexión"! 💜`,
                pt: `A propósito, encontrei ${matchCandidates.length} conexão${matchCandidates.length > 1 ? 'ões' : ''} potencial${matchCandidates.length > 1 ? 'is' : ''} para você! Gostaria que eu te apresente? Basta dizer "sim" ou "encontre uma conexão"! 💜`,
                fr: `Au fait, j'ai trouvé ${matchCandidates.length} connexion${matchCandidates.length > 1 ? 's' : ''} potentielle${matchCandidates.length > 1 ? 's' : ''} pour vous! Voulez-vous que je vous présente? Dites simplement "oui" ou "trouvez-moi une connexion"! 💜`
              };
              
              responseText = suggestionMessages[userLang] || suggestionMessages.en;
              return {
                success: true,
                response: responseText,
                userId,
                profile: state.profile,
                onboardingStatus: 'COMPLETED'
              };
            }
          } catch (proactiveErr) {
            console.error('[Web Chat API] Error in proactive match suggestion:', proactiveErr);
            // Fall through to normal chat
          }
        }
        
        // General chat - use OpenAI
        const systemPrompt = `You are Kaia, the SI<3> community matchmaker assistant. 

USER PROFILE:
- Name: ${state.profile.name}
- Location: ${state.profile.location || 'Not specified'}
- Roles: ${(state.profile.roles || []).join(', ') || 'Not specified'}
- Interests: ${(state.profile.interests || []).join(', ') || 'Not specified'}
- Connection Goals: ${(state.profile.connectionGoals || []).join(', ') || 'Not specified'}
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

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: messageText }
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
    } else {
      // Unknown state - restart onboarding
      await updateState('ASK_LANGUAGE', {});
      responseText = msgs.LANGUAGE || "What's your preferred language?\n\n1. English\n2. Spanish\n3. Portuguese\n4. French\n\nReply with the number (for example: 1)";
    }
    
    return {
      success: true,
      response: responseText,
      userId,
      profile: state.profile,
      onboardingStatus: state.step
    };
    
  } catch (error: any) {
    console.error('[Web Chat API] Error:', error);
    return {
      success: false,
      error: error.message || 'An error occurred processing your message'
    };
  }
}

