import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { getOnboardingStep, updateOnboardingStep, getUserProfile } from './utils.js';
import { OnboardingStep, UserProfile } from './types.js';
import { getMessages, parseLanguageCode, LanguageCode } from './translations.js';
import { recordMessageSent } from '../../services/messageDeduplication.js';
import { recordActionExecution } from '../../services/llmResponseInterceptor.js';

// Helper to safely call callback - deduplication is handled at memory creation level
// NOTE: We're now using AI-generated messages, so callbacks are only used for restart commands
async function safeCallback(
  callback: HandlerCallback | undefined,
  runtime: IAgentRuntime,
  roomId: string | undefined,
  text: string
): Promise<void> {
  if (!callback) return;
  
  // CRITICAL: During onboarding, the action handler controls the flow
  // We ALWAYS send questions via callback - the LLM is blocked (provider returns null)
  // The interceptor will handle deduplication at the memory creation level
  // We don't check duplicates here - just send the callback
  // The interceptor's isDuplicateMessage will catch true duplicates
  
  try {
    console.log('[Onboarding Action] Sending callback message:', text.substring(0, 50));
    await callback({ text });
    // Don't record here - the interceptor handles recording when memory is created
    // This prevents double-recording
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
        step: 'ASK_NAME' as OnboardingStep, // Set to ASK_NAME so we can send the greeting
        profile: {} as UserProfile
      };
      await runtime.cacheManager.set(`onboarding_${message.userId}`, freshState as any);
      
      // Record action execution immediately after state change
      if (roomId) recordActionExecution(roomId);
      
      // Get fresh messages (will default to English)
      const freshMsgs = getMessages('en');
      console.log('[Onboarding Action] Sending greeting via callback');
      await safeCallback(callback, runtime, roomId, freshMsgs.GREETING);
      return true;
    }

    // START -> ASK_NAME
    if (currentStep === 'NONE') {
      console.log('[Onboarding Action] Step is NONE, updating to ASK_NAME');
      // Check if name already exists, skip to language if it does
      if (profile.name) {
        if (profile.language) {
          // Both name and language exist, skip to location
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LOCATION');
          if (roomId) recordActionExecution(roomId);
          // Send the location question via callback
          await safeCallback(callback, runtime, roomId, msgs.LOCATION);
        } else {
          // Name exists but language doesn't, ask for language
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LANGUAGE');
          if (roomId) recordActionExecution(roomId);
          // Send the language question via callback
          await safeCallback(callback, runtime, roomId, msgs.LANGUAGE);
        }
      } else {
        // No name, start with greeting
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_NAME');
        if (roomId) recordActionExecution(roomId);
        // Send the greeting via callback (it already asks for name)
        console.log('[Onboarding Action] Sending greeting via callback');
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
          if (roomId) recordActionExecution(roomId);
        } else {
          // Check if name already exists (shouldn't happen, but handle gracefully)
          if (profile.name && !text) {
            // Name already exists, skip to language
            if (profile.language) {
              await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LOCATION');
              if (roomId) recordActionExecution(roomId);
            } else {
              await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LANGUAGE');
              if (roomId) recordActionExecution(roomId);
            }
          } else {
            await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LANGUAGE', { name: text });
            if (roomId) recordActionExecution(roomId);
            // Send the language question via callback
            console.log('[Onboarding Action] Sending language question via callback');
            await safeCallback(callback, runtime, roomId, msgs.LANGUAGE);
          }
        }
        break;

      case 'ASK_LANGUAGE':
        console.log('[Onboarding Action] Processing ASK_LANGUAGE, user said:', text);
        // Check if language already exists
        if (profile.language && !text) {
          // Language already exists, skip to location
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LOCATION');
          if (roomId) recordActionExecution(roomId);
          break;
        }
        const langCode = parseLanguageCode(text);
        if (!langCode) {
          // Invalid language selection - stay on ASK_LANGUAGE, AI will ask again
          console.log('[Onboarding Action] Invalid language selection, staying on ASK_LANGUAGE');
          break;
        }
        // Update language and move to location step
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LOCATION', { language: langCode });
        if (roomId) recordActionExecution(roomId);
        // Send the location question via callback
        console.log('[Onboarding Action] Sending location question via callback');
        await safeCallback(callback, runtime, roomId, msgs.LOCATION);
        break;

      case 'ASK_LOCATION':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { location: text, isEditing: false, editingField: undefined });
          if (roomId) recordActionExecution(roomId);
        } else {
          // Handle "next" to skip optional question
          const locationValue = text.toLowerCase().trim() === 'next' ? undefined : text;
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_ROLE', { location: locationValue });
          if (roomId) recordActionExecution(roomId);
          // Send the roles question via callback
          console.log('[Onboarding Action] Sending roles question via callback');
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
          if (roomId) recordActionExecution(roomId);
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_INTERESTS', { roles }); 
          if (roomId) recordActionExecution(roomId);
          // Send the interests question via callback
          console.log('[Onboarding Action] Sending interests question via callback');
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
          if (roomId) recordActionExecution(roomId);
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_CONNECTION_GOALS', { interests });
          if (roomId) recordActionExecution(roomId);
          // Send the goals question via callback
          console.log('[Onboarding Action] Sending goals question via callback');
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
          if (roomId) recordActionExecution(roomId);
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_EVENTS', { connectionGoals });
          if (roomId) recordActionExecution(roomId);
          // Send the events question via callback
          console.log('[Onboarding Action] Sending events question via callback');
          await safeCallback(callback, runtime, roomId, msgs.EVENTS);
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
          // Send the socials question via callback
          console.log('[Onboarding Action] Sending socials question via callback');
          await safeCallback(callback, runtime, roomId, msgs.SOCIALS);
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
          // Send the Telegram question via callback
          console.log('[Onboarding Action] Sending Telegram question via callback');
          await safeCallback(callback, runtime, roomId, msgs.TELEGRAM);
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
          // Send the gender question via callback
          console.log('[Onboarding Action] Sending gender question via callback');
          await safeCallback(callback, runtime, roomId, msgs.GENDER);
        }
        break;

      case 'ASK_GENDER':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { gender: text, isEditing: false, editingField: undefined });
          if (roomId) recordActionExecution(roomId);
        } else {
          // Handle "next" to skip optional question
          const genderValue = text.toLowerCase().trim() === 'next' ? undefined : text;
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_NOTIFICATIONS', { gender: genderValue });
          if (roomId) recordActionExecution(roomId);
          // Send the notifications question via callback
          console.log('[Onboarding Action] Sending notifications question via callback');
          await safeCallback(callback, runtime, roomId, msgs.NOTIFICATIONS);
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
  },
  examples: []
};
