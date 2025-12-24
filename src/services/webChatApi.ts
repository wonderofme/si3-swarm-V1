import { AgentRuntime } from '@elizaos/core';
import { getMessages } from '../plugins/onboarding/translations.js';
import { findSi3UserByEmail } from './si3Database.js';

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
}

/**
 * Validates the API key
 */
export function validateApiKey(providedKey: string | undefined): boolean {
  if (!providedKey) return false;
  return providedKey === API_KEY;
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
    const msgs = getMessages(state.profile.language || 'en');
    
    // Check for restart commands
    const isRestart = lowerText.includes('restart') || lowerText.includes('start over') || lowerText.includes('begin again');
    const isNext = lowerText === 'next' || lowerText === 'skip';
    
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
      const newMsgs = getMessages(lang);
      responseText = newMsgs.GREETING;
    } else if (state.step === 'ASK_NAME') {
      await updateState('ASK_EMAIL', { name: messageText.trim() });
      responseText = msgs.EMAIL;
    } else if (state.step === 'ASK_EMAIL') {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const emailText = messageText.trim();
      if (!emailRegex.test(emailText)) {
        responseText = `${msgs.EMAIL}\n\n⚠️ Please enter a valid email address (e.g., name@example.com)`;
        return { success: true, response: responseText };
      }
      
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
          console.log(`[Web Chat API] Found SI<3> user with roles: ${si3Roles.join(', ')}`);
        } else {
          console.log(`[Web Chat API] Email ${emailText} not found in SI<3> database`);
        }
      } catch (error: any) {
        console.error('[Web Chat API] Error searching SI<3> database:', error.message);
        // Continue with onboarding even if SI<3> lookup fails
      }
      
      // Check if email exists in Kaia database (could be from Telegram onboarding)
      try {
        const db = runtime.databaseAdapter as any;
        const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
        const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
        
        let existingUser: { userId: string; profile: any } | null = null;
        
        if (isMongo && db.getDb) {
          const mongoDb = await db.getDb();
          const cacheCollection = mongoDb.collection('cache');
          const docs = await cacheCollection.find({
            key: { $regex: /^onboarding_/ }
          }).toArray();
          
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
                break;
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
                break;
              }
            } catch (e) {
              // Skip invalid entries
            }
          }
        }
        
        if (existingUser) {
          // Email exists - ask if they want to continue or recreate
          console.log(`[Web Chat API] Email ${emailText} exists for user ${existingUser.userId}`);
          await updateState('ASK_PROFILE_CHOICE', {
            email: emailText,
            existingUserId: existingUser.userId,
            existingProfile: existingUser.profile,
            roles: si3Roles.length > 0 ? si3Roles : undefined,
            interests: si3Interests.length > 0 ? si3Interests : undefined,
            personalValues: si3PersonalValues.length > 0 ? si3PersonalValues : undefined
          });
          responseText = `${msgs.PROFILE_EXISTS}\n\n${msgs.PROFILE_CHOICE}`;
        } else {
          // Email doesn't exist - continue with onboarding
          // Include roles and interests from SI<3> if found
          const profileUpdate: any = { email: emailText };
          if (si3Roles.length > 0) {
            profileUpdate.roles = si3Roles;
          }
          if (si3Interests.length > 0) {
            profileUpdate.interests = si3Interests;
          }
          if (si3PersonalValues.length > 0) {
            profileUpdate.personalValues = si3PersonalValues;
          }
          
          await updateState('ASK_LOCATION', profileUpdate);
          responseText = msgs.LOCATION;
          if (si3Roles.length > 0) {
            console.log(`[Web Chat API] User roles from SI<3>: ${si3Roles.join(', ')}`);
          }
        }
      } catch (error: any) {
        console.error('[Web Chat API] Error checking email:', error);
        // On error, continue with onboarding
        await updateState('ASK_LOCATION', { email: emailText });
        responseText = msgs.LOCATION;
      }
    } else if (state.step === 'ASK_PROFILE_CHOICE') {
      const choice = messageText.trim();
      const existingUserId = state.profile?.existingUserId;
      const existingProfile = state.profile?.existingProfile;
      
      if (choice === '1' || choice.toLowerCase().includes('continue') || choice.toLowerCase().includes('existing')) {
        // User wants to continue with existing profile
        if (existingUserId && existingProfile) {
          console.log(`[Web Chat API] Loading existing profile from user ${existingUserId}`);
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
    } else if (state.step === 'ASK_LOCATION') {
      const location = isNext ? undefined : messageText.trim();
      await updateState('ASK_ROLE', { location });
      responseText = msgs.ROLES;
    } else if (state.step === 'ASK_ROLE') {
      const roles = messageText.split(',').map((r: string) => r.trim()).filter((r: string) => r);
      await updateState('ASK_INTERESTS', { roles });
      responseText = msgs.INTERESTS;
    } else if (state.step === 'ASK_INTERESTS') {
      const interests = messageText.split(',').map((r: string) => r.trim()).filter((r: string) => r);
      await updateState('ASK_CONNECTION_GOALS', { interests });
      responseText = msgs.GOALS;
    } else if (state.step === 'ASK_CONNECTION_GOALS') {
      const connectionGoals = messageText.split(',').map((r: string) => r.trim()).filter((r: string) => r);
      await updateState('ASK_EVENTS', { connectionGoals });
      responseText = msgs.EVENTS;
    } else if (state.step === 'ASK_EVENTS') {
      const events = isNext ? undefined : messageText.split(',').map((r: string) => r.trim()).filter((r: string) => r);
      await updateState('ASK_SOCIALS', { events });
      responseText = msgs.SOCIALS;
    } else if (state.step === 'ASK_SOCIALS') {
      const socials = isNext ? undefined : messageText.split(',').map((r: string) => r.trim()).filter((r: string) => r);
      await updateState('ASK_TELEGRAM_HANDLE', { socials });
      responseText = msgs.TELEGRAM;
    } else if (state.step === 'ASK_TELEGRAM_HANDLE') {
      const telegramHandle = messageText.trim().replace('@', '');
      await updateState('ASK_GENDER', { telegramHandle });
      responseText = msgs.GENDER;
    } else if (state.step === 'ASK_GENDER') {
      let gender = isNext ? undefined : messageText.trim();
      if (lowerText.includes('1') || lowerText.includes('female')) gender = 'Female';
      else if (lowerText.includes('2') || lowerText.includes('male')) gender = 'Male';
      else if (lowerText.includes('3') || lowerText.includes('non-binary')) gender = 'Non-binary';
      else if (lowerText.includes('4') || lowerText.includes('prefer not')) gender = 'Prefer not to say';
      
      await updateState('ASK_NOTIFICATIONS', { gender });
      responseText = msgs.NOTIFICATIONS;
    } else if (state.step === 'ASK_NOTIFICATIONS') {
      let notifications = 'No';
      if (lowerText.includes('1') || lowerText.includes('yes') || lowerText.includes('daily')) notifications = 'Yes';
      else if (lowerText.includes('2') || lowerText.includes('weekly')) notifications = 'Weekly';
      else if (lowerText.includes('3') || lowerText.includes('no') || lowerText.includes('never')) notifications = 'No';
      
      await updateState('COMPLETED', { notifications });
      
      // Send completion message
      const completionMsg1 = msgs.COMPLETION || `Great! You're all set up, ${state.profile.name}! 🎉`;
      const completionMsg2 = msgs.COMPLETION_2 || `Say "find me a match" to get connected with someone who shares your interests! 🤝💜`;
      responseText = `${completionMsg1}\n\n${completionMsg2}`;
    } else if (state.step === 'COMPLETED') {
      // ==================== COMPLETED USER COMMANDS ====================
      
      // Command detection
      const isMatchRequest = lowerText.includes('match') || lowerText.includes('connect me') || lowerText.includes('find someone') || lowerText.includes('find me') || lowerText.includes('introduce');
      const isHistoryRequest = lowerText.includes('history') || lowerText.includes('my profile') || lowerText.includes('my matches') || lowerText.includes('show profile');
      const isLanguageChange = lowerText.includes('change language') || lowerText.includes('cambiar idioma') || lowerText.includes('mudar idioma') || lowerText.includes('changer de langue');
      const isHelpRequest = lowerText === 'help' || lowerText === '?' || lowerText.includes('what can you do');
      
      // Knowledge question detection
      const knowledgeKeywords = [
        'what is', 'what are', 'explain', 'tell me about', 'how does', 'define',
        'dao', 'defi', 'nft', 'blockchain', 'cryptocurrency', 'crypto', 'web3',
        'smart contract', 'token', 'wallet', 'ethereum', 'bitcoin', 'solana'
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
        // Simplified matching for web API - returns profile info for matching
        const myInterests = state.profile.interests || [];
        const myRoles = state.profile.roles || [];
        
        if (myInterests.length === 0 && myRoles.length === 0) {
          responseText = "I don't have enough info about your interests yet to match you. Try 'restart' to update your profile! 💜";
        } else {
          // Query database for matches
          try {
            const db = runtime.databaseAdapter as any;
            if (db && db.query) {
              let previousMatchIds: string[] = [];
              try {
                const prevMatches = await db.query(
                  `SELECT matched_user_id FROM matches WHERE user_id = $1::text`,
                  [userId]
                );
                previousMatchIds = (prevMatches.rows || []).map((r: any) => r.matched_user_id);
              } catch (e) { /* no previous matches */ }
              
              const res = await db.query(`SELECT key, value FROM cache WHERE key LIKE 'onboarding_%'`);
              let candidates: any[] = [];
              
              for (const row of (res.rows || [])) {
                const otherUserId = row.key.replace('onboarding_', '');
                if (otherUserId === userId) continue;
                if (previousMatchIds.includes(otherUserId)) continue;
                
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
                      commonCount: common.length, 
                      commonInterests: common 
                    });
                  }
                } catch (parseErr) { /* skip */ }
              }
              
              if (candidates.length > 0) {
                candidates.sort((a, b) => b.commonCount - a.commonCount);
                const topMatch = candidates[0];
                
                // Record match
                const { v4: uuidv4 } = await import('uuid');
                await db.query(
                  `INSERT INTO matches (id, user_id, matched_user_id, room_id, match_date, status) VALUES ($1, $2::text, $3::text, $4::text, NOW(), 'pending')`,
                  [uuidv4(), userId, topMatch.id, `web_${userId}`]
                );
                
                responseText = `🎉 I found a great match for you!\n\n` +
                  `Meet ${topMatch.profile.name || 'Anonymous'} from ${topMatch.profile.location || 'Earth'}.\n` +
                  `Roles: ${(topMatch.profile.roles || []).join(', ') || 'Not specified'}\n` +
                  `Interests: ${(topMatch.profile.interests || []).slice(0, 3).join(', ') || 'Not specified'}\n` +
                  `${topMatch.profile.telegramHandle ? `Telegram: @${topMatch.profile.telegramHandle}` : ''}\n\n` +
                  `💡 You both share interests in: ${topMatch.commonInterests.join(', ')}\n\n` +
                  `Reach out and connect! 🤝💜`;
              } else {
                // Send email notification to members@si3.space with user info
                try {
                  const { sendNoMatchNotification } = await import('./featureRequest.js');
                  const profile = state.profile || {};
                  await sendNoMatchNotification(userId, profile, runtime);
                  console.log('[Web Chat No Match] ✅ Sent no-match notification email');
                } catch (emailError: any) {
                  console.log('[Web Chat No Match] ⚠️ Could not send no-match notification email:', emailError.message);
                  // Continue even if email fails
                }
                
                responseText = "I couldn't find a match within the current pool, but don't worry! 💜\n\nSI<3> will explore potential matches within its broader network and reach out if we find someone great for you.\n\nIn the meantime, feel free to share any specific connection requests with us at members@si3.space. 🚀";
              }
            } else {
              responseText = "Matching is currently unavailable. Please try again later! 💜";
            }
          } catch (matchErr) {
            console.error('[Web Chat API] Match error:', matchErr);
            responseText = "I had trouble finding matches. Please try again! 💜";
          }
        }
      } else if (isHistoryRequest) {
        responseText = `📋 Your Grow3dge Profile:\n\n` +
          `Name: ${state.profile.name || 'Not set'}\n` +
          `Location: ${state.profile.location || 'Not set'}\n` +
          `Roles: ${(state.profile.roles || []).join(', ') || 'Not set'}\n` +
          `Interests: ${(state.profile.interests || []).join(', ') || 'Not set'}\n` +
          `Goals: ${(state.profile.connectionGoals || []).join(', ') || 'Not set'}\n` +
          `Telegram: @${state.profile.telegramHandle || 'Not set'}\n` +
          `Language: ${state.profile.language || 'en'}\n\n` +
          `Say "find me a match" to connect with someone! 🤝💜`;
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
      } else {
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

