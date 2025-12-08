import { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';
import { getOnboardingStep, getUserProfile } from './utils.js';
import { getMessages, LanguageCode } from './translations.js';
import { checkActionExecutedRecently } from '../../services/llmResponseInterceptor.js';

export const onboardingProvider: Provider = {
  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string | null> => {
    console.log(`[Onboarding Provider] Provider called - userId: ${message.userId}, roomId: ${message.roomId}, text: ${message.content.text?.substring(0, 50) || '(empty)'}`);
    try {
      const userId = message.userId;
      const step = await getOnboardingStep(runtime, userId);
      console.log(`[Onboarding Provider] Current step: ${step}`);
      const rawProfile = await getUserProfile(runtime, userId);
      // Ensure profile is always an object with safe defaults
      const profile = rawProfile || {};
      const messageText = message.content.text?.toLowerCase() || '';
      const userLang: LanguageCode = profile.language || 'en';
      const msgs = getMessages(userLang);
      
      // Skip provider instructions if this is an internal "Onboarding Update" message
      // These are created by the action handler and shouldn't trigger LLM responses
      if (message.content.text?.startsWith('Onboarding Update:')) {
        return null; // Don't provide instructions for internal state update messages
      }
      
      // CRITICAL FIX: If an action was just executed, return null to prevent LLM from generating a response
      // This prevents duplicate messages after action execution
      if (message.roomId) {
        const actionWasRecent = checkActionExecutedRecently(message.roomId);
        console.log(`[Onboarding Provider] Checking action execution - roomId: ${message.roomId}, actionWasRecent: ${actionWasRecent}`);
        if (actionWasRecent) {
          console.log('[Onboarding Provider] ✅ Action was executed recently, returning null to prevent duplicate LLM response');
          return null; // No instructions = no LLM response
        } else {
          console.log('[Onboarding Provider] ✅ No recent action execution, providing normal instructions');
        }
      } else {
        console.log('[Onboarding Provider] ⚠️ No roomId in message, cannot check action execution');
      }
    
    if (step === 'COMPLETED') {
      const langNames: Record<LanguageCode, string> = {
        en: 'English',
        es: 'Spanish',
        pt: 'Portuguese',
        fr: 'French'
      };
      return `[ONBOARDING STATUS: COMPLETED. User ${profile.name || 'User'} has finished onboarding. Their preferred language is ${langNames[userLang]}. Respond naturally and helpfully in ${langNames[userLang]}.]`;
    }
    
    // CRITICAL: During onboarding, the action handler sends all questions via callback
    // The LLM should NOT generate responses during onboarding steps
    // Throw an error to completely prevent LLM from being called
    if (step !== 'CONFIRMATION' && step !== 'NONE') {
      console.log(`[Onboarding Provider] Step ${step} - throwing error to prevent LLM generation (action handler will send question via callback)`);
      // Throw a special error that prevents LLM generation entirely
      // This is more effective than returning instructions that the LLM ignores
      throw new Error('ONBOARDING_IN_PROGRESS: Action handler will send message, LLM should not respond');
    }
    
    // Provide instructions only for NONE and CONFIRMATION steps
    // All other onboarding steps are handled by action handler callbacks
    if (step === 'NONE') {
      return `[ONBOARDING STEP: NONE - New user starting onboarding. The action handler will send the greeting message. DO NOT send any message - wait for the action handler to send the greeting.]`;
    }
    
    if (step === 'CONFIRMATION') {
      // For CONFIRMATION, the LLM should generate the summary
      const summaryText = `${msgs.SUMMARY_TITLE}\n\n` +
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
      
      if (messageText.includes('confirm') || messageText.includes('yes') || messageText.includes('check')) {
        return `[ONBOARDING STEP: CONFIRMATION - User confirmed their profile. Send this EXACT message (make it natural):

${msgs.COMPLETION}

After sending this message, the action handler will mark onboarding as COMPLETED.]`;
      } else {
        return `[ONBOARDING STEP: CONFIRMATION - Send this EXACT summary message (make it natural but include all information):

${summaryText}

After sending this message, wait for the user's response.]`;
      }
    }
    
    // Should not reach here due to early return above, but just in case
    return null;
    } catch (error) {
      console.error('[Onboarding Provider] Error:', error);
      return null;
    }
  }
};
