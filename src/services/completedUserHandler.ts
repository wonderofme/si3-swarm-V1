import { AgentRuntime } from '@elizaos/core';
import { getMessages } from '../plugins/onboarding/translations.js';
import { getOnboardingState, saveOnboardingState } from '../index.js';

/**
 * Process messages from users who have completed onboarding
 * Handles all commands: match requests, profile viewing, updates, feature requests, etc.
 */
export async function processCompletedUserMessage(
  runtime: AgentRuntime,
  userId: string,
  messageText: string,
  chatId: string | number,
  state: { step: string, profile: any },
  sendMessage: (chatId: string | number, text: string) => Promise<any>
): Promise<void> {
  const lowerText = messageText.toLowerCase().trim();
  const msgs = getMessages(state.profile.language || 'en');
  
  // Helper to update state
  const updateState = async (newStep: string, profileUpdate: any = {}) => {
    const newState = {
      step: newStep,
      profile: { ...state.profile, ...profileUpdate }
    };
    await saveOnboardingState(runtime, userId, newState);
    state = newState;
  };
  
  // ==================== CONVERSATION HISTORY ====================
  const MAX_HISTORY_MESSAGES = 10;
  let conversationHistory: Array<{role: string, content: string, timestamp: number}> = [];
  try {
    const historyCache = await runtime.cacheManager.get(`conversation_${userId}`);
    if (historyCache && Array.isArray(historyCache)) {
      conversationHistory = historyCache;
    }
  } catch (e) { /* start fresh */ }
  
  conversationHistory.push({ role: 'user', content: messageText, timestamp: Date.now() });
  if (conversationHistory.length > MAX_HISTORY_MESSAGES * 2) {
    conversationHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES * 2);
  }
  
  // ==================== KNOWLEDGE QUESTION DETECTION ====================
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
  const isHistoryRequest = lowerText === 'profile' || lowerText.includes('history') || lowerText.includes('my profile') || lowerText.includes('my matches') || lowerText.includes('show profile') || lowerText.includes('view profile');
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
  
  let responseText = '';
  
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
    // MATCHING
    console.log('[Completed Handler] 🤝 Processing match request...');
    try {
      const myInterests = state.profile.interests || [];
      const myRoles = state.profile.roles || [];
      
      if (myInterests.length === 0 && myRoles.length === 0) {
        responseText = "I don't have enough info about your interests yet to match you. Try 'restart' to update your profile! 💜";
      } else {
        let candidates: any[] = [];
        
        try {
          const { findMatches } = await import('./matchingEngine.js');
          const db = runtime.databaseAdapter as any;
          
          // Get previous matches to exclude
          let previousMatchIds: string[] = [];
          if (db && db.query) {
            try {
              const prevMatches = await db.query(
                `SELECT matched_user_id FROM matches WHERE user_id = $1`,
                [userId]
              );
              previousMatchIds = (prevMatches.rows || []).map((r: any) => r.matched_user_id);
            } catch (e) { /* no previous matches */ }
          }
          
          const matchCandidates = await findMatches(
            runtime,
            userId,
            state.profile,
            previousMatchIds,
            { minScoreThreshold: 70 }
          );
          
          for (const match of matchCandidates) {
            candidates.push({
              id: match.userId,
              profile: match.profile,
              score: match.score,
              reason: match.icebreaker || match.reason
            });
          }
        } catch (engineErr) {
          console.log('[Matching] Engine failed:', engineErr);
        }
        
        if (candidates.length === 0) {
          try {
            const { sendNoMatchNotification } = await import('./featureRequest.js');
            await sendNoMatchNotification(userId, state.profile, runtime);
          } catch (emailError: any) {
            console.log('[No Match] ⚠️ Could not send email:', emailError.message);
          }
          responseText = "I couldn't find a match within the current pool, but don't worry! 💜\n\nSI<3> will explore potential matches within its broader network and reach out if we find someone great for you.\n\nIn the meantime, feel free to share any specific connection requests with us at members@si3.space. 🚀";
        } else {
          const topMatch = candidates.sort((a, b) => b.score - a.score)[0];
          const matchedUserId = topMatch.id;
          
          // Record match
          try {
            const db = runtime.databaseAdapter as any;
            if (db && db.query) {
              const { v4: uuidv4 } = await import('uuid');
              const matchId = uuidv4();
              await db.query(
                `INSERT INTO matches (id, user_id, matched_user_id, room_id, match_date, status) VALUES ($1, $2, $3, $4, NOW(), 'pending')`,
                [matchId, userId, matchedUserId, chatId.toString()]
              );
              
              const followUpDate = new Date();
              followUpDate.setDate(followUpDate.getDate() + 3);
              await db.query(
                `INSERT INTO follow_ups (id, match_id, user_id, type, scheduled_for, status) VALUES ($1, $2, $3, '3_day_checkin', $4, 'pending')`,
                [uuidv4(), matchId, userId, followUpDate]
              );
            }
          } catch (trackErr) {
            console.log('[Match Tracker] Could not record match:', trackErr);
          }
          
          responseText = `🚀 I found a match for you!\n\n` +
            `Meet ${topMatch.profile.name || 'Anonymous'} from ${topMatch.profile.location || 'Earth'}.\n` +
            `Roles: ${topMatch.profile.roles?.join(', ') || 'Not specified'}\n` +
            `Interests: ${topMatch.profile.interests?.join(', ') || 'Not specified'}\n` +
            (topMatch.profile.telegramHandle ? `Telegram: @${topMatch.profile.telegramHandle}\n` : '') +
            `\n💡 ${topMatch.reason}\n\n` +
            `I've saved this match. I'll check in with you in 3 days to see if you connected! 🤝`;
        }
      }
    } catch (matchErr: any) {
      console.error('[Completed Handler] Match error:', matchErr);
      responseText = "I had trouble finding matches right now. Please try again later! 💜";
    }
  } else if (isHistoryRequest) {
    // PROFILE VIEWING
    console.log('[Completed Handler] 📋 Showing profile...');
    const p = state.profile;
    
    let matchCount = 0;
    let matchList = '';
    try {
      const db = runtime.databaseAdapter as any;
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
    
    const { formatProfileForDisplay } = await import('../plugins/onboarding/utils.js');
    const profileText = formatProfileForDisplay(p, p.language || 'en');
    responseText = profileText +
      `\n\nTotal Matches: ${matchCount}` +
      matchList +
      `\n\n✅ Onboarding: Completed\n\nTo update any field, say "update" or "update [field name]".`;
    
    try {
      const { recordProfileMessageSent } = await import('./llmResponseInterceptor.js');
      if (typeof recordProfileMessageSent === 'function') {
        recordProfileMessageSent(chatId.toString());
      }
    } catch (e) { /* non-critical */ }
  } else if (isUpdateRequest) {
    // PROFILE UPDATE
    console.log('[Completed Handler] ✏️ Update request...');
    const updateMsgs = getMessages(state.profile.language || 'en');
    const updateFields: Record<string, { step: string, prompt: string, number: number }> = {
      'name': { step: 'UPDATING_NAME', prompt: 'What would you like to change your name to?', number: 1 },
      'location': { step: 'UPDATING_LOCATION', prompt: 'What is your new location (city and country)?', number: 2 },
      'roles': { step: 'UPDATING_ROLES', prompt: updateMsgs.ROLES, number: 3 },
      'interests': { step: 'UPDATING_INTERESTS', prompt: updateMsgs.INTERESTS, number: 4 },
      'goals': { step: 'UPDATING_GOALS', prompt: updateMsgs.GOALS, number: 5 },
      'events': { step: 'UPDATING_EVENTS', prompt: 'What events will you be attending? (event name, date, location)', number: 6 },
      'socials': { step: 'UPDATING_SOCIALS', prompt: 'Share your social media links:', number: 7 },
      'telegram': { step: 'UPDATING_TELEGRAM', prompt: 'What is your Telegram handle? (e.g., @username)', number: 8 },
      'diversity': { step: 'UPDATING_DIVERSITY', prompt: 'Would you like to be (anonymously) included within our diversity research?\n\n1. Yes\n2. No\n3. Not sure yet\n\nPlease reply with the number (for example: 1)', number: 9 },
      'notifications': { step: 'UPDATING_NOTIFICATIONS', prompt: updateMsgs.NOTIFICATIONS, number: 10 }
    };
    
    const numberMatch = lowerText.match(/\b([1-9]|10)\b/);
    let fieldToUpdate: string | null = null;
    
    if (numberMatch) {
      const fieldNumber = parseInt(numberMatch[1]);
      const fieldEntry = Object.entries(updateFields).find(([_, info]) => info.number === fieldNumber);
      if (fieldEntry) fieldToUpdate = fieldEntry[0];
    } else {
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
      const updateInfo = updateFields[fieldToUpdate];
      await updateState(updateInfo.step, {});
      responseText = updateInfo.prompt;
    } else {
      await updateState('AWAITING_UPDATE_FIELD', {});
      responseText = `What would you like to update? 📝\n\n` +
        `1. Name\n2. Location\n3. Professional role(s)\n4. Professional interests\n` +
        `5. Professional goals\n6. Events & conferences attending\n7. Personal social and/or digital links\n` +
        `8. Telegram handle\n9. Diversity research interest\n10. Collaboration notifications\n\n` +
        `Just type the field number(s) (e.g. 1, 3).`;
    }
  } else if (isLanguageChange) {
    // LANGUAGE CHANGE
    console.log('[Completed Handler] 🌍 Language change...');
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
    // FEATURE REQUEST
    console.log('[Completed Handler] 💡 Feature request...');
    if (hasDetails) {
      let emailSent = false;
      try {
        const { sendFeatureRequest } = await import('./featureRequest.js');
        await sendFeatureRequest(userId, state.profile.name || 'Anonymous', messageText, messageText);
        emailSent = true;
      } catch (emailError: any) {
        console.log('[Feature Request] ⚠️ Could not send email:', emailError.message);
      }
      
      try {
        const db = runtime.databaseAdapter as any;
        if (db && db.query) {
          const { v4: uuidv4 } = await import('uuid');
          await db.query(
            `INSERT INTO feature_requests (id, user_id, user_name, request_text, created_at) VALUES ($1, $2, $3, $4, NOW())`,
            [uuidv4(), userId, state.profile.name || 'Anonymous', messageText]
          );
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
    // KNOWLEDGE QUESTION
    const langResponses: Record<string, string> = {
      en: `Great question! 🧠\n\nI'm activating my peer-to-peer knowledge-sharing capabilities soon, where you'll be able to learn from other community members who are experts in these topics.\n\nFor now, I'm focused on making meaningful connections within the SI<3> community. Would you like me to find you a match? Just say "find me a match"! 🤝💜`,
      es: `¡Gran pregunta! 🧠\n\nPronto activaré mis capacidades de intercambio de conocimientos entre pares, donde podrás aprender de otros miembros de la comunidad que son expertos en estos temas.\n\nPor ahora, estoy enfocada en hacer conexiones significativas dentro de la comunidad SI<3>. ¿Te gustaría que te encuentre una conexión? ¡Solo di "encuéntrame una conexión"! 🤝💜`,
      pt: `Ótima pergunta! 🧠\n\nEm breve ativarei minhas capacidades de compartilhamento de conhecimento entre pares, onde você poderá aprender com outros membros da comunidade que são especialistas nesses tópicos.\n\nPor enquanto, estou focada em fazer conexões significativas dentro da comunidade SI<3>. Gostaria que eu encontrasse uma conexão para você? Basta dizer "encontre uma conexão"! 🤝💜`,
      fr: `Excellente question! 🧠\n\nJ'activerai bientôt mes capacités de partage de connaissances entre pairs, où vous pourrez apprendre d'autres membres de la communauté qui sont experts dans ces sujets.\n\nPour l'instant, je me concentre sur la création de connexions significatives au sein de la communauté SI<3>. Voulez-vous que je vous trouve une connexion? Dites simplement "trouve-moi une connexion"! 🤝💜`
    };
    responseText = langResponses[state.profile.language || 'en'] || langResponses.en;
  } else {
    // GENERAL CHAT
    console.log('[Completed Handler] 🤖 General chat - using OpenAI...');
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      responseText = "I'm here to help! What would you like to know? 💜";
    } else {
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
      
      const messages: Array<{role: string, content: string}> = [
        { role: 'system', content: systemPrompt }
      ];
      
      const recentHistory = conversationHistory.slice(-6);
      for (const msg of recentHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
      
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
        conversationHistory.push({ role: 'assistant', content: responseText, timestamp: Date.now() });
      } else {
        responseText = "I'm here to help! What would you like to know? 💜";
      }
    }
  }
  
  // Save conversation history
  try {
    await runtime.cacheManager.set(`conversation_${userId}`, conversationHistory);
  } catch (e) { /* ignore cache errors */ }
  
  // Send response
  if (responseText) {
    await sendMessage(chatId, responseText);
  }
}

