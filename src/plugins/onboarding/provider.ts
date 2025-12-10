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

// Check if text is a restart command
function isRestartCommand(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  return lower.includes('restart') || 
         lower.includes('pretend this is my first') ||
         lower.includes('start over') ||
         lower.includes('begin again') ||
         lower.includes('can we start') ||
         lower.includes('start the onboarding') ||
         lower.includes('start onboarding all over');
}

// Provider that returns EXACT onboarding messages for LLM to use word-for-word
const actualProviderGet = async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string | null> => {
  const userId = message.userId;
  const rawProfile = await getUserProfile(runtime, userId);
  const profile = rawProfile || {};
  const messageText = message.content.text?.toLowerCase() || '';
  const userText = message.content.text || '';
  
  // CRITICAL: For restart commands, always use English
  const isRestart = isRestartCommand(userText);
  const userLang: LanguageCode = isRestart ? 'en' : (profile.language || 'en');
  const msgs = getMessages(userLang);

  const step = await getOnboardingStep(runtime, userId);
  console.log(`[Onboarding Provider] Current step: ${step}, language: ${userLang}, isRestart: ${isRestart}`);
  
  if (step === 'COMPLETED') {
    const langNames: Record<LanguageCode, string> = {
      en: 'English',
      es: 'Spanish',
      pt: 'Portuguese',
      fr: 'French'
    };
    return `[ONBOARDING STATUS: COMPLETED. User ${profile.name || 'User'} has finished onboarding. Their preferred language is ${langNames[userLang]}. Respond naturally and helpfully in ${langNames[userLang]}.]`;
  }
  
  // Handle restart commands - always use English greeting
  if (isRestart || step === 'NONE') {
    return `[ONBOARDING STEP: ${isRestart ? 'RESTART' : 'NONE'} - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

${msgs.GREETING}

After sending this message, the action handler will update the onboarding state.]`;
  }
  
  // ASK_NAME step
  if (step === 'ASK_NAME') {
    return `[ONBOARDING STEP: ASK_NAME - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

${msgs.GREETING}

After sending this message, wait for the user's response with their name.]`;
  }
  
  // ASK_LANGUAGE step
  if (step === 'ASK_LANGUAGE') {
    return `[ONBOARDING STEP: ASK_LANGUAGE - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

${msgs.LANGUAGE}

After sending this message, wait for the user's response with a number (1-4).]`;
  }
  
  // ASK_LOCATION step
  if (step === 'ASK_LOCATION') {
    return `[ONBOARDING STEP: ASK_LOCATION - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

${msgs.LOCATION}

After sending this message, wait for the user's response with their location or "Next" to skip.]`;
  }
  
  // ASK_ROLE step
  if (step === 'ASK_ROLE') {
    return `[ONBOARDING STEP: ASK_ROLE - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

${msgs.ROLES}

After sending this message, wait for the user's response with role numbers.]`;
  }
  
  // ASK_INTERESTS step
  if (step === 'ASK_INTERESTS') {
    return `[ONBOARDING STEP: ASK_INTERESTS - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

${msgs.INTERESTS}

After sending this message, wait for the user's response with interest numbers.]`;
  }
  
  // ASK_CONNECTION_GOALS step
  if (step === 'ASK_CONNECTION_GOALS') {
    return `[ONBOARDING STEP: ASK_CONNECTION_GOALS - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

${msgs.GOALS}

After sending this message, wait for the user's response with goal numbers.]`;
  }
  
  // ASK_EVENTS step
  if (step === 'ASK_EVENTS') {
    return `[ONBOARDING STEP: ASK_EVENTS - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

${msgs.EVENTS}

After sending this message, wait for the user's response with events or "Next" to skip.]`;
  }
  
  // ASK_SOCIALS step
  if (step === 'ASK_SOCIALS') {
    return `[ONBOARDING STEP: ASK_SOCIALS - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

${msgs.SOCIALS}

After sending this message, wait for the user's response with social links or "Next" to skip.]`;
  }
  
  // ASK_TELEGRAM_HANDLE step
  if (step === 'ASK_TELEGRAM_HANDLE') {
    return `[ONBOARDING STEP: ASK_TELEGRAM_HANDLE - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

${msgs.TELEGRAM}

After sending this message, wait for the user's response with their Telegram handle.]`;
  }
  
  // ASK_GENDER step
  if (step === 'ASK_GENDER') {
    return `[ONBOARDING STEP: ASK_GENDER - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

${msgs.GENDER}

After sending this message, wait for the user's response with gender option or "Next" to skip.]`;
  }
  
  // ASK_NOTIFICATIONS step
  if (step === 'ASK_NOTIFICATIONS') {
    return `[ONBOARDING STEP: ASK_NOTIFICATIONS - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

${msgs.NOTIFICATIONS}

After sending this message, wait for the user's response with notification preference (1-3).]`;
  }
  
  // CONFIRMATION step
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
      return `[ONBOARDING STEP: CONFIRMATION - User confirmed their profile. Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

${msgs.COMPLETION}

After sending this message, the action handler will mark onboarding as COMPLETED.]`;
    } else {
      return `[ONBOARDING STEP: CONFIRMATION - Send this EXACT summary message word-for-word. Do not modify, paraphrase, or add anything:

${summaryText}

After sending this message, wait for the user's response.]`;
    }
  }
  
  return null;
};

export const onboardingProvider: Provider = {
  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string | null> => {
    console.log(`[Onboarding Provider] Provider called - userId: ${message.userId}, roomId: ${message.roomId}, text: ${message.content.text?.substring(0, 50) || '(empty)'}`);
    
    // Skip provider instructions if this is an internal "Onboarding Update" message
    if (message.content.text?.startsWith('Onboarding Update:')) {
      return null;
    }
    
    // NEW APPROACH: Always return exact messages for onboarding steps
    // The LLM will use these exact messages word-for-word
    try {
      return await actualProviderGet(runtime, message, state);
    } catch (error) {
      console.error('[Onboarding Provider] Error:', error);
      return null;
    }
  }
};
