import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { getUserProfile, updateOnboardingStep } from './utils.js';
import { parseLanguageCode, getMessages, LanguageCode } from './translations.js';

export const changeLanguageAction: Action = {
  name: 'CHANGE_LANGUAGE',
  description: 'Changes the user\'s preferred language for all future messages.',
  similes: ['switch language', 'change language', 'set language', 'update language'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const text = message.content.text?.toLowerCase() || '';
    const languageKeywords = ['change language', 'switch language', 'set language', 'update language', 'language to', 'idioma', 'langue', 'idioma para'];
    return languageKeywords.some(keyword => text.includes(keyword));
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    const text = message.content.text || '';
    const profile = await getUserProfile(runtime, message.userId);
    const currentLang = profile.language || 'en';
    
    // Try to parse language from the message
    const newLang = parseLanguageCode(text);
    
    if (!newLang) {
      // Couldn't parse, ask user to specify
      const msgs = getMessages(currentLang);
      if (callback) {
        callback({ text: `${msgs.LANGUAGE}\n\nCurrent language: ${currentLang === 'en' ? 'English' : currentLang === 'es' ? 'Spanish' : currentLang === 'pt' ? 'Portuguese' : 'French'}` });
      }
      return true;
    }
    
    if (newLang === currentLang) {
      const msgs = getMessages(currentLang);
      if (callback) {
        callback({ text: `You're already using ${currentLang === 'en' ? 'English' : currentLang === 'es' ? 'Spanish' : currentLang === 'pt' ? 'Portuguese' : 'French'}.` });
      }
      return true;
    }
    
    // Update language in profile
    await updateOnboardingStep(runtime, message.userId, message.roomId, 'COMPLETED', { language: newLang });
    
    // Confirm in the new language
    const newMsgs = getMessages(newLang);
    const langNames: Record<LanguageCode, string> = {
      en: 'English',
      es: 'Spanish',
      pt: 'Portuguese',
      fr: 'French'
    };
    
    if (callback) {
      callback({ text: `Language changed to ${langNames[newLang]}. All future messages will be in ${langNames[newLang]}.` });
    }
    
    return true;
  },
  
  examples: []
};

