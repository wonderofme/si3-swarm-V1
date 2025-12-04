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
      return `[ONBOARDING INSTRUCTION: User requested restart. Output EXACTLY this message, nothing else:]

${msgs.GREETING}`;
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
      return `[ONBOARDING INSTRUCTION: New user's first message. Output EXACTLY this message, nothing else:]

${msgs.GREETING}`;
    }
    
    // The step indicates what we were WAITING for. User just provided that info.
    // So we should output the NEXT question.
    const stepToMessage: Record<string, string> = {
      // User just provided their name → ask for language
      'ASK_NAME': `[ONBOARDING INSTRUCTION: User provided their name. Output EXACTLY this message, nothing else:]

${msgs.LANGUAGE}`,

      // User just provided language → ask for location
      'ASK_LANGUAGE': `[ONBOARDING INSTRUCTION: User provided their language. Output EXACTLY this message, nothing else:]

${msgs.LOCATION}`,

      // User just provided location → ask for roles
      'ASK_LOCATION': `[ONBOARDING INSTRUCTION: User provided their location. Output EXACTLY this message, nothing else:]

${msgs.ROLES}`,

      // User just provided roles → ask for interests
      'ASK_ROLE': `[ONBOARDING INSTRUCTION: User provided their roles. Output EXACTLY this message, nothing else:]

${msgs.INTERESTS}`,

      // User just provided interests → ask for connection goals
      'ASK_INTERESTS': `[ONBOARDING INSTRUCTION: User provided their interests. Output EXACTLY this message, nothing else:]

${msgs.GOALS}`,

      // User just provided connection goals → ask for events
      'ASK_CONNECTION_GOALS': `[ONBOARDING INSTRUCTION: User provided their goals. Output EXACTLY this message, nothing else:]

${msgs.EVENTS}`,

      // User just provided events → ask for socials
      'ASK_EVENTS': `[ONBOARDING INSTRUCTION: User provided events. Output EXACTLY this message, nothing else:]

${msgs.SOCIALS}`,

      // User just provided socials → ask for telegram
      'ASK_SOCIALS': `[ONBOARDING INSTRUCTION: User provided socials. Output EXACTLY this message, nothing else:]

${msgs.TELEGRAM}`,

      // User just provided telegram → ask for gender
      'ASK_TELEGRAM_HANDLE': `[ONBOARDING INSTRUCTION: User provided Telegram handle. Output EXACTLY this message, nothing else:]

${msgs.GENDER}`,

      // User just provided gender → ask for notifications
      'ASK_GENDER': `[ONBOARDING INSTRUCTION: User provided gender. Output EXACTLY this message, nothing else:]

${msgs.NOTIFICATIONS}`,

      // User just provided notifications → show summary
      'ASK_NOTIFICATIONS': `[ONBOARDING INSTRUCTION: User provided notification preference. Generate the profile summary with this format:]

${msgs.SUMMARY_TITLE}

${msgs.SUMMARY_NAME} ${profile.name || msgs.SUMMARY_NOT_PROVIDED}
${msgs.SUMMARY_LOCATION} ${profile.location || msgs.SUMMARY_NOT_PROVIDED}
${msgs.SUMMARY_ROLES} ${profile.roles?.join(', ') || msgs.SUMMARY_NOT_PROVIDED}
${msgs.SUMMARY_INTERESTS} ${profile.interests?.join(', ') || msgs.SUMMARY_NOT_PROVIDED}
${msgs.SUMMARY_GOALS} ${profile.connectionGoals?.join(', ') || msgs.SUMMARY_NOT_PROVIDED}
${msgs.SUMMARY_EVENTS} ${profile.events?.join(', ') || msgs.SUMMARY_NOT_PROVIDED}
${msgs.SUMMARY_SOCIALS} ${profile.socials?.join(', ') || msgs.SUMMARY_NOT_PROVIDED}
${msgs.SUMMARY_TELEGRAM} ${profile.telegramHandle ? '@' + profile.telegramHandle : msgs.SUMMARY_NOT_PROVIDED}
${msgs.SUMMARY_GENDER} ${profile.gender || msgs.SUMMARY_NOT_PROVIDED}
${msgs.SUMMARY_NOTIFICATIONS} ${profile.notifications || msgs.SUMMARY_NOT_PROVIDED}

${msgs.EDIT_NAME}
${msgs.EDIT_LOCATION}
${msgs.EDIT_ROLES}
${msgs.EDIT_INTERESTS}
${msgs.EDIT_GOALS}
${msgs.EDIT_EVENTS}
${msgs.EDIT_SOCIALS}
${msgs.EDIT_TELEGRAM}
${msgs.EDIT_GENDER}
${msgs.EDIT_NOTIFICATIONS}

${msgs.CONFIRM}`,

      // User confirmed or edited → show completion or re-ask
      'CONFIRMATION': messageText.includes('confirm') || messageText.includes('yes') || messageText.includes('check') 
        ? `[ONBOARDING INSTRUCTION: User confirmed their profile. Output EXACTLY this message:]

${msgs.COMPLETION}`
        : `[ONBOARDING INSTRUCTION: User wants to edit. Re-ask the appropriate question based on what they want to edit.]`
    };
    
    return stepToMessage[step] || `[ONBOARDING STEP: ${step}. Follow the script for this step.]`;
    } catch (error) {
      console.error('[Onboarding Provider] Error:', error);
      return null;
    }
  }
};
