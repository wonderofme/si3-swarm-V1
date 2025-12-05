import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { getOnboardingStep, updateOnboardingStep, getUserProfile } from './utils.js';
import { OnboardingStep, UserProfile } from './types.js';
import { getMessages, parseLanguageCode, LanguageCode } from './translations.js';
import { isDuplicateMessage, recordActionMessageSent } from '../../services/messageDeduplication.js';

// Helper to safely call callback with deduplication
async function safeCallback(
  callback: HandlerCallback | undefined,
  runtime: IAgentRuntime,
  roomId: string | undefined,
  text: string
): Promise<void> {
  if (!callback) return;
  
  if (isDuplicateMessage(runtime, roomId, text)) {
    console.log('[Onboarding Action] Duplicate message detected, skipping:', text.substring(0, 50));
    return;
  }
  
  try {
    await callback({ text });
    // Record that action callback was used - this blocks LLM responses for a short period
    if (roomId) {
      recordActionMessageSent(roomId);
    }
  } catch (error) {
    console.error('[Onboarding Action] Callback error:', error);
  }
}

function generateSummaryText(profile: UserProfile): string {
  const lang = profile.language || 'en';
  const msgs = getMessages(lang);
  return `${msgs.SUMMARY_TITLE}\n\n` +
    `${msgs.SUMMARY_NAME} ${profile.name || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_LOCATION} ${profile.location || msgs.SUMMARY_NOT_PROVIDED}\n` +
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
         lower.includes('start the onboarding');
}

export const continueOnboardingAction: Action = {
  name: 'CONTINUE_ONBOARDING',
  description: 'Handles onboarding flow - sends exact scripted messages via callback.',
  similes: ['NEXT_STEP', 'SAVE_PROFILE', 'ANSWER_ONBOARDING', 'EDIT_PROFILE'],
  
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
    let currentStep = await getOnboardingStep(runtime, message.userId);
    console.log('[Onboarding Action] Current step:', currentStep);
    const text = message.content.text;
    const roomId = message.roomId;
    const profile = await getUserProfile(runtime, message.userId);
    const isEditing = profile.isEditing || false;
    console.log('[Onboarding Action] Has callback:', !!callback);
    console.log('[Onboarding Action] roomId:', roomId);
    console.log('[Onboarding Action] userId:', message.userId);

    // Get user's language preference (default to English)
    const userLang: LanguageCode = profile.language || 'en';
    const msgs = getMessages(userLang);

    // Check for restart commands
    if (isRestartCommand(text)) {
      console.log('[Onboarding Action] Restart command detected, resetting onboarding');
      // Clear the entire onboarding state by setting a fresh state
      const freshState = {
        step: 'NONE' as OnboardingStep,
        profile: {} as UserProfile
      };
      await runtime.cacheManager.set(`onboarding_${message.userId}`, freshState as any);
      
      // Get fresh messages (will default to English)
      const freshMsgs = getMessages('en');
      console.log('[Onboarding Action] Sending greeting via callback');
      await safeCallback(callback, runtime, roomId, freshMsgs.GREETING);
      return true;
    }

    // START -> ASK_NAME
    if (currentStep === 'NONE') {
      console.log('[Onboarding Action] Step is NONE, sending greeting');
      // Check if name already exists, skip to language if it does
      if (profile.name) {
        if (profile.language) {
          // Both name and language exist, skip to location
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LOCATION');
          await safeCallback(callback, runtime, roomId, msgs.LOCATION);
        } else {
          // Name exists but language doesn't, ask for language
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LANGUAGE');
          await safeCallback(callback, runtime, roomId, msgs.LANGUAGE);
        }
      } else {
        // No name, start with greeting
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_NAME');
        console.log('[Onboarding Action] Calling callback with greeting');
        console.log('[Onboarding Action] Greeting text:', msgs.GREETING.substring(0, 50) + '...');
        await safeCallback(callback, runtime, roomId, msgs.GREETING);
      }
      return true;
    }

    // Process user input and advance to next step
    switch (currentStep) {
      case 'ASK_NAME':
        console.log('[Onboarding Action] Processing ASK_NAME, user said:', text);
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { name: text, isEditing: false, editingField: undefined });
          const updatedProfile1 = await getUserProfile(runtime, message.userId);
          await safeCallback(callback, runtime, roomId, generateSummaryText(updatedProfile1));
        } else {
          // Check if name already exists (shouldn't happen, but handle gracefully)
          if (profile.name && !text) {
            // Name already exists, skip to language
            if (profile.language) {
              await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LOCATION');
              await safeCallback(callback, runtime, roomId, msgs.LOCATION);
            } else {
              await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LANGUAGE');
              await safeCallback(callback, runtime, roomId, msgs.LANGUAGE);
            }
          } else {
            await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LANGUAGE', { name: text });
            console.log('[Onboarding Action] Calling callback with LANGUAGE message');
            await safeCallback(callback, runtime, roomId, msgs.LANGUAGE);
          }
        }
        break;

      case 'ASK_LANGUAGE':
        console.log('[Onboarding Action] Processing ASK_LANGUAGE, user said:', text);
        // Check if language already exists
        if (profile.language && !text) {
          // Language already exists, skip to location
          const existingLangMsgs = getMessages(profile.language);
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LOCATION');
          await safeCallback(callback, runtime, roomId, existingLangMsgs.LOCATION);
          break;
        }
        const langCode = parseLanguageCode(text);
        if (!langCode) {
          // Invalid language selection, ask again
          await safeCallback(callback, runtime, roomId, msgs.LANGUAGE);
          break;
        }
        // Update language and move to location step
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LOCATION', { language: langCode });
        // Get messages in the selected language
        const selectedLangMsgs = getMessages(langCode);
        await safeCallback(callback, runtime, roomId, selectedLangMsgs.LOCATION);
        break;

      case 'ASK_LOCATION':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { location: text, isEditing: false, editingField: undefined });
          const updatedProfile2 = await getUserProfile(runtime, message.userId);
          await safeCallback(callback, runtime, roomId, generateSummaryText(updatedProfile2));
        } else {
          // Handle "next" to skip optional question
          const locationValue = text.toLowerCase().trim() === 'next' ? undefined : text;
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_ROLE', { location: locationValue });
          await safeCallback(callback, runtime, roomId, msgs.ROLES);
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
          const updatedProfile3 = await getUserProfile(runtime, message.userId);
          await safeCallback(callback, runtime, roomId, generateSummaryText(updatedProfile3));
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_INTERESTS', { roles }); 
          await safeCallback(callback, runtime, roomId, msgs.INTERESTS);
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
          const updatedProfile4 = await getUserProfile(runtime, message.userId);
          await safeCallback(callback, runtime, roomId, generateSummaryText(updatedProfile4));
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_CONNECTION_GOALS', { interests });
          await safeCallback(callback, runtime, roomId, msgs.GOALS);
        }
        break;

      case 'ASK_CONNECTION_GOALS':
        const goalParts = text.split(/[,\s]+and\s+/i);
        const goalNumbers = goalParts[0].split(/[,\s]+/).filter(s => /^\d+$/.test(s.trim()));
        const goalText = goalParts[1] || '';
        const connectionGoals = [...goalNumbers.map(n => {
          const goalMap: Record<string, string> = {
            '1': 'Startups to invest in', '2': 'Investors/grant program operators', '3': 'Marketing support',
            '4': 'BD & Partnerships', '5': 'Communities and/or DAOs to join', '6': 'Other'
          };
          return goalMap[n.trim()];
        }).filter(Boolean), ...(goalText ? [goalText.trim()] : [])];
        
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { connectionGoals, isEditing: false, editingField: undefined });
          const updatedProfile5 = await getUserProfile(runtime, message.userId);
          await safeCallback(callback, runtime, roomId, generateSummaryText(updatedProfile5));
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_EVENTS', { connectionGoals });
          await safeCallback(callback, runtime, roomId, msgs.EVENTS);
        }
        break;

      case 'ASK_EVENTS':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { events: [text], isEditing: false, editingField: undefined });
          const updatedProfile6 = await getUserProfile(runtime, message.userId);
          await safeCallback(callback, runtime, roomId, generateSummaryText(updatedProfile6));
        } else {
          // Handle "next" to skip optional question
          const eventsValue = text.toLowerCase().trim() === 'next' ? [] : [text];
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_SOCIALS', { events: eventsValue });
          await safeCallback(callback, runtime, roomId, msgs.SOCIALS);
        }
        break;

      case 'ASK_SOCIALS':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { socials: [text], isEditing: false, editingField: undefined });
          const updatedProfile7 = await getUserProfile(runtime, message.userId);
          await safeCallback(callback, runtime, roomId, generateSummaryText(updatedProfile7));
        } else {
          // Handle "next" to skip optional question
          const socialsValue = text.toLowerCase().trim() === 'next' ? [] : [text];
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_TELEGRAM_HANDLE', { socials: socialsValue });
          await safeCallback(callback, runtime, roomId, msgs.TELEGRAM);
        }
        break;

      case 'ASK_TELEGRAM_HANDLE':
        let telegramHandle = text.trim();
        if (telegramHandle.startsWith('@')) telegramHandle = telegramHandle.substring(1);
        const handleToSave = (telegramHandle.toLowerCase() === 'skip' || telegramHandle === '') ? undefined : telegramHandle;
        
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { telegramHandle: handleToSave, isEditing: false, editingField: undefined });
          const updatedProfile8 = await getUserProfile(runtime, message.userId);
          await safeCallback(callback, runtime, roomId, generateSummaryText(updatedProfile8));
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_GENDER', { telegramHandle: handleToSave });
          await safeCallback(callback, runtime, roomId, msgs.GENDER);
        }
        break;

      case 'ASK_GENDER':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { gender: text, isEditing: false, editingField: undefined });
          const updatedProfile9 = await getUserProfile(runtime, message.userId);
          await safeCallback(callback, runtime, roomId, generateSummaryText(updatedProfile9));
        } else {
          // Handle "next" to skip optional question
          const genderValue = text.toLowerCase().trim() === 'next' ? undefined : text;
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_NOTIFICATIONS', { gender: genderValue });
          await safeCallback(callback, runtime, roomId, msgs.NOTIFICATIONS);
        }
        break;

      case 'ASK_NOTIFICATIONS':
        await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { notifications: text, isEditing: false, editingField: undefined });
        const finalProfile = await getUserProfile(runtime, message.userId);
        await safeCallback(callback, runtime, roomId, generateSummaryText(finalProfile));
        break;

      case 'CONFIRMATION':
        if (text.toLowerCase().includes('confirm') || text.toLowerCase().includes('yes') || text.toLowerCase().includes('check')) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'COMPLETED', { isConfirmed: true, isEditing: false, editingField: undefined });
          await safeCallback(callback, runtime, roomId, msgs.COMPLETION);
        } else if (text.toLowerCase().includes('edit')) {
          const lowerText = text.toLowerCase();
          let editStep: OnboardingStep | null = null;
          let editField: string | undefined = undefined;
          let editMessage: string = '';
          
          if (lowerText.includes('name')) { editStep = 'ASK_NAME'; editField = 'name'; editMessage = msgs.GREETING.split('\n').pop() || "What's your preferred name?"; }
          else if (lowerText.includes('location')) { editStep = 'ASK_LOCATION'; editField = 'location'; editMessage = msgs.LOCATION; }
          else if (lowerText.includes('professional') || lowerText.includes('role')) { editStep = 'ASK_ROLE'; editField = 'roles'; editMessage = msgs.ROLES; }
          else if (lowerText.includes('learning') || lowerText.includes('interest')) { editStep = 'ASK_INTERESTS'; editField = 'interests'; editMessage = msgs.INTERESTS; }
          else if (lowerText.includes('connection') || lowerText.includes('goal')) { editStep = 'ASK_CONNECTION_GOALS'; editField = 'connectionGoals'; editMessage = msgs.GOALS; }
          else if (lowerText.includes('conference') || lowerText.includes('event')) { editStep = 'ASK_EVENTS'; editField = 'events'; editMessage = msgs.EVENTS; }
          else if (lowerText.includes('personal') || lowerText.includes('link') || lowerText.includes('social')) { editStep = 'ASK_SOCIALS'; editField = 'socials'; editMessage = msgs.SOCIALS; }
          else if (lowerText.includes('telegram')) { editStep = 'ASK_TELEGRAM_HANDLE'; editField = 'telegramHandle'; editMessage = msgs.TELEGRAM; }
          else if (lowerText.includes('gender')) { editStep = 'ASK_GENDER'; editField = 'gender'; editMessage = msgs.GENDER; }
          else if (lowerText.includes('notification') || lowerText.includes('collab')) { editStep = 'ASK_NOTIFICATIONS'; editField = 'notifications'; editMessage = msgs.NOTIFICATIONS; }
          
          if (editStep) {
            await updateOnboardingStep(runtime, message.userId, roomId, editStep, { isEditing: true, editingField: editField });
            await safeCallback(callback, runtime, roomId, editMessage);
          } else {
            await safeCallback(callback, runtime, roomId, msgs.SUMMARY_TITLE); // Fallback message
          }
        }
        break;
    }

    return true;
  },
  examples: []
};
