import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { getOnboardingStep, updateOnboardingStep, getUserProfile } from './utils.js';
import { OnboardingStep } from './types.js';

export const continueOnboardingAction: Action = {
  name: 'CONTINUE_ONBOARDING',
  description: 'Advances the onboarding flow by saving user input and asking the next question.',
  similes: ['NEXT_STEP', 'SAVE_PROFILE', 'ANSWER_ONBOARDING'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const step = await getOnboardingStep(runtime, message.userId);
    return step !== 'COMPLETED';
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    let currentStep = await getOnboardingStep(runtime, message.userId);
    const text = message.content.text;
    const roomId = message.roomId;

    // 1. START -> ASK_NAME
    if (currentStep === 'NONE') {
      // Start the flow
      await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_NAME');
      // For the first step, we can use callback to ensure the greeting is perfect
      if (callback) {
        callback({
          text: "Hola! I'm Agent Kaia, created by SI<3>. I'm your friendly guide to help you navigate Web3. I am able to support you in making meaningful connections and share helpful knowledge and opportunities within our member network. 💜\n\nBy continuing your interactions with Kaia you give your consent to sharing personal data in accordance with the privacy policy. https://si3.space/policy/privacy\n\nTo get started, can you tell me a bit about yourself so I can customize your experience?\n\nWhat's your preferred name?",
          action: 'CONTINUE_ONBOARDING'
        });
      }
      return true;
    }

    // 2. Handle Answers & Advance
    
    let nextStep: OnboardingStep = currentStep;
    // responseText is NO LONGER USED for callbacks in intermediate steps.
    // We rely on the LLM to generate the text.
    // However, we update the state/script flow in the database.

    switch (currentStep) {
      case 'ASK_NAME':
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LANGUAGE', { name: text });
        // Privacy policy is already included in the initial greeting, so no separate message needed
        break;

      case 'ASK_LANGUAGE':
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LOCATION', { language: text });
        break;

      case 'ASK_LOCATION':
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_ROLE', { location: text });
        break;

      case 'ASK_ROLE':
        // Parse multiple selections (e.g., "1, 4" or "1,4 and Developer")
        const roleParts = text.split(/[,\s]+and\s+/i);
        const roleNumbers = roleParts[0].split(/[,\s]+/).filter(s => /^\d+$/.test(s.trim()));
        const roleText = roleParts[1] || '';
        const roles = [...roleNumbers.map(n => {
          const roleMap: Record<string, string> = {
            '1': 'Founder/Builder',
            '2': 'Marketing/BD/Partnerships',
            '3': 'DAO Council Member/Delegate',
            '4': 'Community Leader',
            '5': 'Investor/Grant Program Operator',
            '6': 'Early Web3 Explorer',
            '7': 'Media',
            '8': 'Artist',
            '9': 'Developer',
            '10': 'Other'
          };
          return roleMap[n.trim()];
        }).filter(Boolean), ...(roleText ? [roleText.trim()] : [])];
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_INTERESTS', { roles }); 
        break;

      case 'ASK_INTERESTS':
        // Parse multiple selections (e.g., "2,3" or "2,3 and DevRel")
        const interestParts = text.split(/[,\s]+and\s+/i);
        const interestNumbers = interestParts[0].split(/[,\s]+/).filter(s => /^\d+$/.test(s.trim()));
        const interestText = interestParts[1] || '';
        const interests = [...interestNumbers.map(n => {
          const interestMap: Record<string, string> = {
            '1': 'Web3 Growth Marketing',
            '2': 'Business Development & Partnerships',
            '3': 'Education 3.0',
            '4': 'AI',
            '5': 'Cybersecurity',
            '6': 'DAOs',
            '7': 'Tokenomics',
            '8': 'Fundraising',
            '9': 'Other'
          };
          return interestMap[n.trim()];
        }).filter(Boolean), ...(interestText ? [interestText.trim()] : [])];
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_CONNECTION_GOALS', { interests });
        break;

      case 'ASK_CONNECTION_GOALS':
        // Parse multiple selections
        const goalParts = text.split(/[,\s]+and\s+/i);
        const goalNumbers = goalParts[0].split(/[,\s]+/).filter(s => /^\d+$/.test(s.trim()));
        const goalText = goalParts[1] || '';
        const connectionGoals = [...goalNumbers.map(n => {
          const goalMap: Record<string, string> = {
            '1': 'Startups to invest in',
            '2': 'Investors/grant program operators',
            '3': 'Marketing support',
            '4': 'BD & Partnerships',
            '5': 'Communities and/or DAOs to join',
            '6': 'Other'
          };
          return goalMap[n.trim()];
        }).filter(Boolean), ...(goalText ? [goalText.trim()] : [])];
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_EVENTS', { connectionGoals });
        break;

      case 'ASK_EVENTS':
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_SOCIALS', { events: [text] });
        break;

      case 'ASK_SOCIALS':
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_TELEGRAM_HANDLE', { socials: [text] });
        break;

      case 'ASK_TELEGRAM_HANDLE':
        // Extract Telegram handle (remove @ if present, validate format)
        let telegramHandle = text.trim();
        if (telegramHandle.startsWith('@')) {
          telegramHandle = telegramHandle.substring(1);
        }
        // Basic validation: alphanumeric and underscores, 5-32 chars
        if (telegramHandle && /^[a-zA-Z0-9_]{5,32}$/.test(telegramHandle)) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_GENDER', { telegramHandle });
        } else if (telegramHandle.toLowerCase() === 'skip' || telegramHandle === '') {
          // Allow skipping
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_GENDER', { telegramHandle: undefined });
        } else {
          // Invalid format - ask again
          if (callback) {
            callback({ text: "Please provide a valid Telegram username (e.g., @username or just username). It should be 5-32 characters, letters, numbers, and underscores only. Or type 'skip' to skip this step." });
          }
          return true;
        }
        break;

      case 'ASK_GENDER':
        await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_NOTIFICATIONS', { gender: text });
        break;

      case 'ASK_NOTIFICATIONS':
        await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { notifications: text });
        // Generate summary for confirmation
        const profile = await getUserProfile(runtime, message.userId);
        const summaryText = `Here's your summary. Does it look right?\n\n` +
          `Name: ${profile.name || 'Not provided'}\n` +
          `Language: ${profile.language || 'Not provided'}\n` +
          `Location: ${profile.location || 'Not provided'}\n` +
          `Professional Roles: ${profile.roles?.join(', ') || 'Not provided'}\n` +
          `Learning Goals: ${profile.interests?.join(', ') || 'Not provided'}\n` +
          `Connection Goals: ${profile.connectionGoals?.join(', ') || 'Not provided'}\n` +
          `Conferences Attending: ${profile.events?.join(', ') || 'Not provided'}\n` +
          `Personal Links: ${profile.socials?.join(', ') || 'Not provided'}\n` +
          `Telegram Handle: ${profile.telegramHandle ? '@' + profile.telegramHandle : 'Not provided'}\n` +
          `Gender Info: ${profile.gender || 'Not provided'}\n` +
          `Notifications for Collabs: ${profile.notifications || 'Not provided'}\n\n` +
          `Edit name\n` +
          `Edit location\n` +
          `Edit professional roles\n` +
          `Edit learning Goals\n` +
          `Edit connection Goals\n` +
          `Edit conferences attending\n` +
          `Edit personal links\n` +
          `Edit gender info\n` +
          `Edit notifications for collabs\n\n` +
          `Confirm (check)`;
        
        // We'll let the LLM generate this, but we can also use callback for structured output
        if (callback) {
          callback({ text: summaryText });
        }
        break;

      case 'CONFIRMATION':
        if (text.toLowerCase().includes('confirm') || text.toLowerCase().includes('yes') || text.toLowerCase().includes('check')) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'COMPLETED', { isConfirmed: true });
          if (callback) {
            callback({ text: "Thank you so much for onboarding! To get started, I will match you with members of our network where you both may be a fit for what you are looking for. 🚀" });
          }
        } else if (text.toLowerCase().includes('edit')) {
          // TODO: Implement edit logic (for now, just acknowledge)
          if (callback) {
            callback({ text: "What would you like to edit? Please tell me which field (e.g., 'Edit name' or 'Edit location')." });
          }
        }
        break;
    }

    // NO CALLBACK calls for intermediate steps.
    // We return true, which signals the action was successful.
    // The LLM will generate its own text response based on the updated state (conceptually).
    // WAIT: If we return true and NO callback, does the LLM generate text?
    // In standard Eliza, the loop generates text + action.
    // If we remove the "empty string" constraint, the LLM *will* generate text.
    // We just need to ensure it generates the CORRECT text (the next question).

    return true;
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Start onboarding" }
      },
      {
        user: "Kaia",
        content: { text: "Hola! I'm Kaia...", action: "CONTINUE_ONBOARDING" }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "My name is Alice" }
      },
      {
        user: "Kaia",
        content: { text: "What's your location?", action: "CONTINUE_ONBOARDING" }
      }
    ]
  ]
};
