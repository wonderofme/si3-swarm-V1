import { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';
import { getOnboardingStep, getUserProfile } from './utils.js';
import { getMessages, LanguageCode } from './translations.js';

export const onboardingProvider: Provider = {
  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string | null> => {
    try {
      const userId = message.userId;
      const step = await getOnboardingStep(runtime, userId);
      const rawProfile = await getUserProfile(runtime, userId);
      // Ensure profile is always an object with safe defaults
      const profile = rawProfile || {};
      const messageText = message.content.text?.toLowerCase() || '';
      const userLang: LanguageCode = profile.language || 'en';
      const msgs = getMessages(userLang);
    
    // Check for restart commands
    if (messageText.includes('restart') || 
        messageText.includes('pretend this is my first') ||
        messageText.includes('start over') ||
        messageText.includes('begin again')) {
      return `[ONBOARDING INSTRUCTION: User requested restart. Use action CONTINUE_ONBOARDING with empty text \"\". Do NOT output any message text - the action callback sends the greeting.]`;
    }
    
    if (step === 'COMPLETED') {
      const langNames: Record<LanguageCode, string> = {
        en: 'English',
        es: 'Spanish',
        pt: 'Portuguese',
        fr: 'French'
      };
      return `[ONBOARDING STATUS: COMPLETED. User ${profile.name || 'User'} has finished onboarding. Their preferred language is ${langNames[userLang]}. ALWAYS respond to their questions in ${langNames[userLang]}. Do NOT use English unless the user explicitly asks in English.]`;
    }
    
    if (step === 'NONE') {
      return `[ONBOARDING INSTRUCTION: New user's first message. Use action CONTINUE_ONBOARDING with empty text \"\". Do NOT output any message text - the action callback sends the greeting.]`;
    }
    
    // The step indicates what we were WAITING for. User just provided that info.
    // So we should output the NEXT question.
    const stepToMessage: Record<string, string> = {
      // User just provided their name → ask for language
      'ASK_NAME': `[ONBOARDING INSTRUCTION: User provided their name. Use action CONTINUE_ONBOARDING with empty text \"\". Do NOT output any message text - the action callback sends the language question.]`,

      // User just provided language → ask for location
      'ASK_LANGUAGE': `[ONBOARDING INSTRUCTION: User provided their language. Use action CONTINUE_ONBOARDING with empty text \"\". Do NOT output any message text - the action callback sends the location question.]`,

      // User just provided location → ask for roles
      'ASK_LOCATION': `[ONBOARDING INSTRUCTION: User provided their location. Use action CONTINUE_ONBOARDING with empty text \"\". Do NOT output any message text - the action callback sends the roles question.]`,

      // User just provided roles → ask for interests
      'ASK_ROLE': `[ONBOARDING INSTRUCTION: User provided their roles. Use action CONTINUE_ONBOARDING with empty text \"\". Do NOT output any message text - the action callback sends the interests question.]`,

      // User just provided interests → ask for connection goals
      'ASK_INTERESTS': `[ONBOARDING INSTRUCTION: User provided their interests. Use action CONTINUE_ONBOARDING with empty text \"\". Do NOT output any message text - the action callback sends the goals question.]`,

      // User just provided connection goals → ask for events
      'ASK_CONNECTION_GOALS': `[ONBOARDING INSTRUCTION: User provided their goals. Use action CONTINUE_ONBOARDING with empty text \"\". Do NOT output any message text - the action callback sends the events question.]`,

      // User just provided events → ask for socials
      'ASK_EVENTS': `[ONBOARDING INSTRUCTION: User provided events. Use action CONTINUE_ONBOARDING with empty text \"\". Do NOT output any message text - the action callback sends the socials question.]`,

      // User just provided socials → ask for telegram
      'ASK_SOCIALS': `[ONBOARDING INSTRUCTION: User provided socials. Use action CONTINUE_ONBOARDING with empty text \"\". Do NOT output any message text - the action callback sends the telegram question.]`,

      // User just provided telegram → ask for gender
      'ASK_TELEGRAM_HANDLE': `[ONBOARDING INSTRUCTION: User provided Telegram handle. Use action CONTINUE_ONBOARDING with empty text \"\". Do NOT output any message text - the action callback sends the gender question.]`,

      // User just provided gender → ask for notifications
      'ASK_GENDER': `[ONBOARDING INSTRUCTION: User provided gender. Use action CONTINUE_ONBOARDING with empty text \"\". Do NOT output any message text - the action callback sends the notifications question.]`,

      // User just provided notifications → show summary
      'ASK_NOTIFICATIONS': `[ONBOARDING INSTRUCTION: User provided notification preference. Use action CONTINUE_ONBOARDING with empty text \"\". Do NOT output any message text - the action callback sends the summary.]`,

      // User confirmed or edited → show completion or re-ask
      'CONFIRMATION': messageText.includes('confirm') || messageText.includes('yes') || messageText.includes('check') 
        ? `[ONBOARDING INSTRUCTION: User confirmed their profile. Use action CONTINUE_ONBOARDING with empty text \"\". Do NOT output any message text - the action callback sends the completion message.]`
        : `[ONBOARDING INSTRUCTION: User wants to edit. Use action CONTINUE_ONBOARDING with empty text \"\". Do NOT output any message text - the action callback handles the edit.]`
    };
    
    return stepToMessage[step] || `[ONBOARDING STEP: ${step}. Follow the script for this step.]`;
    } catch (error) {
      console.error('[Onboarding Provider] Error:', error);
      return null;
    }
  }
};
