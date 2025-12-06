import { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';
import { getOnboardingStep, getUserProfile } from './utils.js';
import { getMessages, LanguageCode } from './translations.js';
import { checkActionExecutedRecently } from '../../services/llmResponseInterceptor.js';

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
      
      // Skip provider instructions if this is an internal "Onboarding Update" message
      // These are created by the action handler and shouldn't trigger LLM responses
      if (message.content.text?.startsWith('Onboarding Update:')) {
        return null; // Don't provide instructions for internal state update messages
      }
      
      // CRITICAL FIX: If an action was just executed, return null to prevent LLM from generating a response
      // This prevents duplicate messages after action execution
      if (message.roomId && checkActionExecutedRecently(message.roomId)) {
        console.log('[Onboarding Provider] Action was executed recently, returning null to prevent duplicate LLM response');
        return null; // No instructions = no LLM response
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
    
    // Provide the exact message the AI should send at each onboarding step
    // The AI will generate this message naturally but should match the content and flow
    // IMPORTANT: Only provide instructions if this is a user message, not if action just updated state
    const stepMessages: Record<string, string> = {
      'NONE': `[ONBOARDING STEP: NONE - New user starting onboarding. Send this EXACT message (you can make it natural but include all the key information):

${msgs.GREETING}

After sending this message, the action handler will update the state to ASK_NAME. DO NOT send another message after the action updates state - wait for the user's next message.]`,

      'ASK_NAME': `[ONBOARDING STEP: ASK_NAME - User just provided their name "${message.content.text}". The action handler will update the state to ASK_LANGUAGE. 

IMPORTANT: The action handler has already updated the state. You should have already sent the language question in your previous response. DO NOT send another message now - wait for the user's response to the language question.]`,

      'ASK_LANGUAGE': `[ONBOARDING STEP: ASK_LANGUAGE - User just provided their language preference "${message.content.text}". The action handler will update the state to ASK_LOCATION.

IMPORTANT: The action handler has already updated the state. You should have already sent the location question in your previous response. DO NOT send another message now - wait for the user's response to the location question.]`,

      'ASK_LOCATION': `[ONBOARDING STEP: ASK_LOCATION - User just provided their location. The action handler will update the state. Now send this EXACT message (make it natural but include all key information):

${msgs.ROLES}

After sending this message, the action handler will update the state to ASK_ROLE.]`,

      'ASK_ROLE': `[ONBOARDING STEP: ASK_ROLE - User just provided their roles. The action handler will update the state. Now send this EXACT message (make it natural but include all key information):

${msgs.INTERESTS}

After sending this message, the action handler will update the state to ASK_INTERESTS.]`,

      'ASK_INTERESTS': `[ONBOARDING STEP: ASK_INTERESTS - User just provided their interests. The action handler will update the state. Now send this EXACT message (make it natural but include all key information):

${msgs.GOALS}

After sending this message, the action handler will update the state to ASK_CONNECTION_GOALS.]`,

      'ASK_CONNECTION_GOALS': `[ONBOARDING STEP: ASK_CONNECTION_GOALS - User just provided their connection goals. The action handler will update the state. Now send this EXACT message (make it natural but include all key information):

${msgs.EVENTS}

After sending this message, the action handler will update the state to ASK_EVENTS.]`,

      'ASK_EVENTS': `[ONBOARDING STEP: ASK_EVENTS - User just provided their events preference. The action handler will update the state. Now send this EXACT message (make it natural but include all key information):

${msgs.SOCIALS}

After sending this message, the action handler will update the state to ASK_SOCIALS.]`,

      'ASK_SOCIALS': `[ONBOARDING STEP: ASK_SOCIALS - User just provided their social links. The action handler will update the state. Now send this EXACT message (make it natural but include all key information):

${msgs.TELEGRAM}

After sending this message, the action handler will update the state to ASK_TELEGRAM_HANDLE.]`,

      'ASK_TELEGRAM_HANDLE': `[ONBOARDING STEP: ASK_TELEGRAM_HANDLE - User just provided their Telegram handle. The action handler will update the state. Now send this EXACT message (make it natural but include all key information):

${msgs.GENDER}

After sending this message, the action handler will update the state to ASK_GENDER.]`,

      'ASK_GENDER': `[ONBOARDING STEP: ASK_GENDER - User just provided their gender. The action handler will update the state. Now send this EXACT message (make it natural but include all key information):

${msgs.NOTIFICATIONS}

After sending this message, the action handler will update the state to ASK_NOTIFICATIONS.]`,

      'ASK_NOTIFICATIONS': `[ONBOARDING STEP: ASK_NOTIFICATIONS - User just provided their notification preference. The action handler will update the state. Now send this EXACT message (make it natural but include all key information):

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

${msgs.CONFIRM}

After sending this message, the action handler will update the state to CONFIRMATION.]`,

      'CONFIRMATION': messageText.includes('confirm') || messageText.includes('yes') || messageText.includes('check')
        ? `[ONBOARDING STEP: CONFIRMATION - User confirmed their profile. Send this EXACT message (make it natural):

${msgs.COMPLETION}

After sending this message, the action handler will mark onboarding as COMPLETED.]`
        : `[ONBOARDING STEP: CONFIRMATION - User wants to edit their profile. The action handler will handle the edit and update the state accordingly.]`
    };
    
    return stepMessages[step] || `[ONBOARDING: Current step is ${step}. Guide the user through onboarding naturally.]`;
    } catch (error) {
      console.error('[Onboarding Provider] Error:', error);
      return null;
    }
  }
};
