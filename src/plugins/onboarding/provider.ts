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
    
    if (step === 'COMPLETED') {
      const langNames: Record<LanguageCode, string> = {
        en: 'English',
        es: 'Spanish',
        pt: 'Portuguese',
        fr: 'French'
      };
      return `[ONBOARDING STATUS: COMPLETED. User ${profile.name || 'User'} has finished onboarding. Their preferred language is ${langNames[userLang]}. Respond naturally and helpfully in ${langNames[userLang]}.]`;
    }
    
    // Provide context about onboarding step, but let the AI respond naturally
    const stepContext: Record<string, string> = {
      'NONE': `[ONBOARDING: New user starting onboarding. Welcome them and begin the onboarding process.]`,
      'ASK_NAME': `[ONBOARDING: User provided their name. Continue with the next onboarding question.]`,
      'ASK_LANGUAGE': `[ONBOARDING: User provided their language preference. Continue with the next onboarding question.]`,
      'ASK_LOCATION': `[ONBOARDING: User provided their location. Continue with the next onboarding question.]`,
      'ASK_ROLE': `[ONBOARDING: User provided their roles. Continue with the next onboarding question.]`,
      'ASK_INTERESTS': `[ONBOARDING: User provided their interests. Continue with the next onboarding question.]`,
      'ASK_CONNECTION_GOALS': `[ONBOARDING: User provided their connection goals. Continue with the next onboarding question.]`,
      'ASK_EVENTS': `[ONBOARDING: User provided their events preference. Continue with the next onboarding question.]`,
      'ASK_SOCIALS': `[ONBOARDING: User provided their social links. Continue with the next onboarding question.]`,
      'ASK_TELEGRAM_HANDLE': `[ONBOARDING: User provided their Telegram handle. Continue with the next onboarding question.]`,
      'ASK_GENDER': `[ONBOARDING: User provided their gender. Continue with the next onboarding question.]`,
      'ASK_NOTIFICATIONS': `[ONBOARDING: User provided their notification preference. Show them their profile summary.]`,
      'CONFIRMATION': `[ONBOARDING: User is confirming or editing their profile. Help them complete the process.]`
    };
    
    return stepContext[step] || `[ONBOARDING: Current step is ${step}. Guide the user through onboarding naturally.]`;
    } catch (error) {
      console.error('[Onboarding Provider] Error:', error);
      return null;
    }
  }
};
