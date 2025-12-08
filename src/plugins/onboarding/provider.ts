import { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';
import { getOnboardingStep, getUserProfile } from './utils.js';
import { getMessages, LanguageCode } from './translations.js';
import { checkActionExecutedRecently, getOnboardingStepFromCache } from '../../services/llmResponseInterceptor.js';

// Custom error class to signal that LLM should not generate during onboarding
class OnboardingInProgressError extends Error {
  constructor(step: string) {
    super(`ONBOARDING_IN_PROGRESS: Step ${step} - Action handler will send message, LLM should not respond`);
    this.name = 'OnboardingInProgressError';
  }
}

// Wrapper provider that checks onboarding state before calling the actual provider
// APPROACH #1.1: Effectively "removes" provider during onboarding by returning null immediately
const actualProviderGet = async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string | null> => {
  const userId = message.userId;
  const rawProfile = await getUserProfile(runtime, userId);
  const profile = rawProfile || {};
  const messageText = message.content.text?.toLowerCase() || '';
  const userLang: LanguageCode = profile.language || 'en';
  const msgs = getMessages(userLang);

  const step = await getOnboardingStep(runtime, userId);
  console.log(`[Onboarding Provider] Current step: ${step}`);
  
  if (step === 'COMPLETED') {
    const langNames: Record<LanguageCode, string> = {
      en: 'English',
      es: 'Spanish',
      pt: 'Portuguese',
      fr: 'French'
    };
    return `[ONBOARDING STATUS: COMPLETED. User ${profile.name || 'User'} has finished onboarding. Their preferred language is ${langNames[userLang]}. Respond naturally and helpfully in ${langNames[userLang]}.]`;
  }
  
  if (step === 'NONE') {
    return `[ONBOARDING STEP: NONE - New user starting onboarding. The action handler will send the greeting message. DO NOT send any message - wait for the action handler to send the greeting.]`;
  }
  
  if (step === 'CONFIRMATION') {
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
  
  return null;
};

export const onboardingProvider: Provider = {
  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string | null> => {
    console.log(`[Onboarding Provider] Provider called - userId: ${message.userId}, roomId: ${message.roomId}, text: ${message.content.text?.substring(0, 50) || '(empty)'}`);
    
    // APPROACH #1.1: Check onboarding step FIRST (synchronously using cache)
    // If user is in active onboarding, return null immediately to prevent provider from being used
    // This effectively "removes" the provider during onboarding
    const userId = message.userId;
    if (userId) {
      // Check cache first (synchronous, fast)
      const cachedStep = getOnboardingStepFromCache(userId);
      if (cachedStep && cachedStep !== 'COMPLETED' && cachedStep !== 'CONFIRMATION' && cachedStep !== 'NONE') {
        console.log(`[Onboarding Provider] 🚫 User in onboarding step ${cachedStep} (from cache) - returning null immediately to prevent LLM generation`);
        return null; // Return null immediately, don't call actual provider
      }
    }
    
    // Skip provider instructions if this is an internal "Onboarding Update" message
    if (message.content.text?.startsWith('Onboarding Update:')) {
      return null;
    }
    
    // CRITICAL FIX: If an action was just executed, return null to prevent LLM from generating a response
    if (message.roomId) {
      const actionWasRecent = checkActionExecutedRecently(message.roomId);
      console.log(`[Onboarding Provider] Checking action execution - roomId: ${message.roomId}, actionWasRecent: ${actionWasRecent}`);
      if (actionWasRecent) {
        console.log('[Onboarding Provider] ✅ Action was executed recently, returning null to prevent duplicate LLM response');
        return null;
      }
    }
    
    try {
      // Double-check with async call (fallback if cache miss)
      const step = await getOnboardingStep(runtime, userId);
      console.log(`[Onboarding Provider] Current step: ${step}`);
      
      if (step && step !== 'COMPLETED' && step !== 'CONFIRMATION' && step !== 'NONE') {
        console.log(`[Onboarding Provider] 🚫 User in onboarding step ${step} (from async check) - returning null to prevent LLM generation`);
        return null; // Return null, don't call actual provider
      }
      
      // Only call actual provider for COMPLETED, CONFIRMATION, or NONE steps
      return await actualProviderGet(runtime, message, state);
    } catch (error) {
      // Re-throw OnboardingInProgressError to prevent LLM generation
      if (error instanceof OnboardingInProgressError) {
        console.log('[Onboarding Provider] Re-throwing OnboardingInProgressError to prevent LLM generation');
        throw error;
      }
      console.error('[Onboarding Provider] Error:', error);
      return null;
    }
  }
};
