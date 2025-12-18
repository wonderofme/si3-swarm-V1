import { AgentRuntime } from '@elizaos/core';
import { getMessages } from '../plugins/onboarding/translations.js';
import { getOnboardingState, saveOnboardingState, checkForNewMatches } from '../index.js';

/**
 * Process onboarding message - handles the entire onboarding state machine
 * This function is extracted from the main handler for better organization and maintainability
 */
export async function processOnboardingMessage(
  runtime: AgentRuntime,
  userId: string,
  messageText: string,
  chatId: string | number,
  sendMessage: (chatId: string | number, text: string) => Promise<any>
): Promise<{ handled: boolean; responseText?: string }> {
  // Get state using abstraction helper
  let state = await getOnboardingState(runtime, userId);
  
  // Helper to update state
  const updateState = async (newStep: string, profileUpdate: any = {}) => {
    const newState = {
      step: newStep,
      profile: { ...state.profile, ...profileUpdate }
    };
    await saveOnboardingState(runtime, userId, newState);
    state = newState;
  };
  
  const lowerText = messageText.toLowerCase().trim();
  const msgs = getMessages(state.profile.language || 'en');
  const isRestart = lowerText.includes('restart') || lowerText.includes('start over') || lowerText.includes('begin again');
  const isNext = lowerText === 'next' || lowerText === 'skip';
  
  let responseText = '';
  
  // Handle onboarding flow
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
    await updateState('ASK_LOCATION', { name: messageText.trim() });
    responseText = msgs.LOCATION;
  } else if (state.step === 'ASK_LOCATION') {
    const location = isNext ? undefined : messageText.trim();
    await updateState('ASK_ROLE', { location });
    responseText = msgs.ROLES;
  } else if (state.step === 'ASK_ROLE') {
    const roleMap: Record<string, string> = {
      '1': 'Founder/Builder', '2': 'Marketing/BD/Partnerships', '3': 'DAO Council Member/Delegate',
      '4': 'Community Leader', '5': 'Investor/Grant Program Operator', '6': 'Early Web3 Explorer',
      '7': 'Media', '8': 'Artist', '9': 'Developer', '10': 'Other'
    };
    const roleInputs = messageText.split(',').map((r: string) => r.trim()).filter((r: string) => r);
    const roles: string[] = [];
    for (const input of roleInputs) {
      if (input.includes(' and ') || input.includes(' and')) {
        const parts = input.split(/ and /i).map((p: string) => p.trim());
        for (const part of parts) {
          if (roleMap[part]) roles.push(roleMap[part]);
          else if (part && !/^\d+$/.test(part)) roles.push(part);
        }
      } else if (roleMap[input]) {
        roles.push(roleMap[input]);
      } else if (input && !/^\d+$/.test(input)) {
        roles.push(input);
      }
    }
    await updateState('ASK_INTERESTS', { roles });
    responseText = msgs.INTERESTS;
  } else if (state.step === 'ASK_INTERESTS') {
    const interestMap: Record<string, string> = {
      '1': 'Web3 Growth Marketing', '2': 'Sales, BD & Partnerships', '3': 'Education 3.0',
      '4': 'AI', '5': 'Cybersecurity', '6': "DAO's", '7': 'Tokenomics', '8': 'Fundraising', '9': 'DeepTech'
    };
    const interestInputs = messageText.split(',').map((r: string) => r.trim()).filter((r: string) => r);
    const interests: string[] = [];
    for (const input of interestInputs) {
      if (input.includes(' and ') || input.includes(' and')) {
        const parts = input.split(/ and /i).map((p: string) => p.trim());
        for (const part of parts) {
          if (interestMap[part]) interests.push(interestMap[part]);
          else if (part && !/^\d+$/.test(part)) interests.push(part);
        }
      } else if (interestMap[input]) {
        interests.push(interestMap[input]);
      } else if (input && !/^\d+$/.test(input)) {
        interests.push(input);
      }
    }
    await updateState('ASK_CONNECTION_GOALS', { interests });
    responseText = msgs.GOALS;
  } else if (state.step === 'ASK_CONNECTION_GOALS') {
    const goalMap: Record<string, string> = {
      '1': 'Startups to invest in', '2': 'Investors/grant programs',
      '3': 'Growth tools, strategies, and/or support', '4': 'Sales/BD tools, strategies and/or support',
      '5': "Communities and/or DAO's to join", '6': 'New job opportunities'
    };
    const goalInputs = messageText.split(',').map((r: string) => r.trim()).filter((r: string) => r);
    const connectionGoals: string[] = [];
    for (const input of goalInputs) {
      if (input.includes(' and ') || input.includes(' and')) {
        const parts = input.split(/ and /i).map((p: string) => p.trim());
        for (const part of parts) {
          if (goalMap[part]) connectionGoals.push(goalMap[part]);
          else if (part && !/^\d+$/.test(part)) connectionGoals.push(part);
        }
      } else if (goalMap[input]) {
        connectionGoals.push(goalMap[input]);
      } else if (input && !/^\d+$/.test(input)) {
        connectionGoals.push(input);
      }
    }
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
    const saidYes = lowerText.includes('yes') || lowerText.includes('sí') || lowerText.includes('sim') || lowerText.includes('oui');
    const saidNo = lowerText.includes('no') && !lowerText.includes('not sure');
    const wantsDiversityResearch = saidYes && !saidNo && !isNext;
    
    let diversityResearchInterest: string | undefined;
    if (wantsDiversityResearch) {
      diversityResearchInterest = 'Yes';
      try {
        const telegramHandle = state.profile.telegramHandle || chatId.toString();
        const db = runtime.databaseAdapter as any;
        if (db && db.getDb) {
          const mongoDb = await db.getDb();
          const diversityCollection = mongoDb.collection('diversity_research');
          const existing = await diversityCollection.findOne({ userId: userId });
          if (!existing) {
            await diversityCollection.insertOne({
              userId: userId,
              telegramHandle: telegramHandle,
              roomId: chatId.toString(),
              interestedAt: new Date(),
              status: 'pending'
            });
          } else {
            await diversityCollection.updateOne(
              { userId: userId },
              { $set: { interestedAt: new Date(), status: 'pending' } }
            );
          }
        }
      } catch (error) {
        console.error('[Diversity Research] Error tracking:', error);
      }
    } else if (saidNo || isNext) {
      diversityResearchInterest = 'No';
      try {
        const db = runtime.databaseAdapter as any;
        if (db && db.getDb) {
          const mongoDb = await db.getDb();
          await mongoDb.collection('diversity_research').deleteOne({ userId: userId });
        }
      } catch (error) {
        console.error('[Diversity Research] Error removing:', error);
      }
    }
    
    let gender: string | undefined;
    if (!isNext && !wantsDiversityResearch && !saidYes) {
      gender = messageText.trim();
    }
    await updateState('ASK_NOTIFICATIONS', { gender, diversityResearchInterest });
    responseText = msgs.NOTIFICATIONS;
  } else if (state.step === 'ASK_NOTIFICATIONS') {
    let notifications = 'Not sure';
    if (lowerText.includes('1') || lowerText.includes('yes')) notifications = 'Yes';
    else if (lowerText.includes('2') || lowerText.includes('no')) notifications = 'No';
    else if (lowerText.includes('3')) notifications = 'Check later';
    
    await updateState('COMPLETED', { notifications, onboardingCompletedAt: new Date() });
    
    const { formatProfileForDisplay } = await import('../plugins/onboarding/utils.js');
    const profileText = formatProfileForDisplay(state.profile, state.profile.language || 'en');
    responseText = msgs.COMPLETION + '\n\n' + profileText;
    
    try {
      const { recordProfileMessageSent } = await import('./llmResponseInterceptor.js');
      if (typeof recordProfileMessageSent === 'function') {
        recordProfileMessageSent(chatId.toString());
      }
    } catch (e) {
      // Non-critical
    }
    
    // Trigger real-time match check
    setTimeout(async () => {
      try {
        await checkForNewMatches(userId, state.profile, chatId, sendMessage);
      } catch (e) {
        console.log('[Match Notification] Error:', e);
      }
    }, 5000);
  } else if (state.step === 'AWAITING_UPDATE_FIELD') {
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
    
    const numberMatch = lowerText.match(/\b([1-9]|10)\b/);
    let matchedField: string | null = null;
    
    if (numberMatch) {
      const fieldNumber = parseInt(numberMatch[1]);
      const fieldEntry = Object.entries(fieldMap).find(([_, info]) => info.number === fieldNumber);
      if (fieldEntry) matchedField = fieldEntry[0];
    } else {
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
        `1. Name\n2. Location\n3. Professional role(s)\n4. Professional interests\n` +
        `5. Professional goals\n6. Events & conferences attending\n7. Personal social and/or digital links\n` +
        `8. Telegram handle\n9. Diversity research interest\n10. Collaboration notifications\n\n` +
        `Just type the field number(s) (e.g. 1, 3).`;
    }
  } else if (state.step.startsWith('UPDATING_')) {
    const fieldBeingUpdated = state.step.replace('UPDATING_', '').toLowerCase();
    let updateValue: any = messageText.trim();
    
    if (['roles', 'interests', 'goals', 'events', 'socials'].includes(fieldBeingUpdated)) {
      updateValue = messageText.split(',').map((s: string) => s.trim()).filter((s: string) => s);
    } else if (fieldBeingUpdated === 'notifications') {
      if (lowerText.includes('1') || lowerText.includes('yes')) updateValue = 'Yes';
      else if (lowerText.includes('2') || lowerText.includes('no')) updateValue = 'No';
      else if (lowerText.includes('3')) updateValue = 'Check later';
    } else if (fieldBeingUpdated === 'diversity') {
      if (lowerText.includes('1') || lowerText.includes('yes')) {
        updateValue = 'Yes';
        try {
          const telegramHandle = state.profile.telegramHandle || chatId.toString();
          const db = runtime.databaseAdapter as any;
          if (db && db.getDb) {
            const mongoDb = await db.getDb();
            const diversityCollection = mongoDb.collection('diversity_research');
            const existing = await diversityCollection.findOne({ userId: userId });
            if (!existing) {
              await diversityCollection.insertOne({
                userId: userId,
                telegramHandle: telegramHandle,
                roomId: chatId.toString(),
                interestedAt: new Date(),
                status: 'pending'
              });
            } else {
              await diversityCollection.updateOne(
                { userId: userId },
                { $set: { interestedAt: new Date(), status: 'pending' } }
              );
            }
          }
        } catch (error) {
          console.error('[Diversity Research] Error:', error);
        }
      } else if (lowerText.includes('2') || lowerText.includes('no')) {
        updateValue = 'No';
        try {
          const db = runtime.databaseAdapter as any;
          if (db && db.getDb) {
            const mongoDb = await db.getDb();
            await mongoDb.collection('diversity_research').deleteOne({ userId: userId });
          }
        } catch (error) {
          console.error('[Diversity Research] Error:', error);
        }
      } else if (lowerText.includes('3') || lowerText.includes('not sure')) {
        updateValue = 'Not sure yet';
      }
    } else if (fieldBeingUpdated === 'telegram') {
      updateValue = messageText.trim().replace('@', '');
    }
    
    const fieldToKey: Record<string, string> = {
      'name': 'name', 'location': 'location', 'roles': 'roles', 'interests': 'interests',
      'goals': 'connectionGoals', 'events': 'events', 'socials': 'socials',
      'telegram': 'telegramHandle', 'diversity': 'diversityResearchInterest', 'notifications': 'notifications'
    };
    
    const profileKey = fieldToKey[fieldBeingUpdated] || fieldBeingUpdated;
    const updateObj: any = {};
    updateObj[profileKey] = updateValue;
    
    await updateState('COMPLETED', updateObj);
    try {
      const updatedCached = await runtime.cacheManager.get(`onboarding_${userId}`);
      if (updatedCached && typeof updatedCached === 'object') {
        state = updatedCached as { step: string, profile: any };
      }
    } catch (e) {
      // State already updated
    }
    responseText = `✅ Your ${fieldBeingUpdated === 'diversity' ? 'diversity research interest' : fieldBeingUpdated} has been updated!\n\nSay "my profile" to see your updated profile! 💜`;
  } else if (state.step === 'AWAITING_FEATURE_DETAILS') {
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
    // COMPLETED state handling is done in the main handler
    // This function only handles onboarding states
    return { handled: false };
  }
  
  // If we have a response, send it and return handled=true
  if (responseText) {
    await sendMessage(chatId, responseText);
    return { handled: true, responseText };
  }
  
  return { handled: false };
}

