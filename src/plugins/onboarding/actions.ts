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

    // 1. START -> ASK_NAME
    if (currentStep === 'NONE') {
      // Start the flow
      await updateOnboardingStep(runtime, message.userId, 'ASK_NAME');
      if (callback) {
        callback({
          text: "Hola! I’m Agent Kaia, created by SI<3>... (Privacy Policy consent)... What’s your preferred name? (no emoji needed)"
        });
      }
      return true;
    }

    // 2. Handle Answers & Advance
    // Logic: Save current answer -> Move to next step -> Ask next question
    
    let nextStep: OnboardingStep = currentStep;
    let responseText = '';

    switch (currentStep) {
      case 'ASK_NAME':
        await updateOnboardingStep(runtime, message.userId, 'ASK_LOCATION', { name: text });
        responseText = "What’s your location (city and country)? 📍";
        break;

      case 'ASK_LOCATION':
        await updateOnboardingStep(runtime, message.userId, 'ASK_ROLE', { location: text });
        responseText = "To be able to match you... select options:\n1. Founder/Builder\n2. Marketing/BD\n3. DAO Council\n4. Community Leader\n5. Investor\n6. Other\nReply with numbers (e.g., 1, 4).";
        break;

      case 'ASK_ROLE':
        await updateOnboardingStep(runtime, message.userId, 'ASK_INTERESTS', { roles: [text] }); // TODO: Parse numbers
        responseText = "What are you excited to explore in Grow3dge?\n1. Web3 Growth\n2. BD\n3. Education 3.0\n4. AI\n5. Cybersecurity\n6. DAOs\n7. Tokenomics\n8. Fundraising\nReply with numbers.";
        break;

      case 'ASK_INTERESTS':
        await updateOnboardingStep(runtime, message.userId, 'ASK_CONNECTION_GOALS', { interests: [text] });
        responseText = "I’d love to help you find connections. What are you looking for? 🤝\n1. Startups to invest in\n2. Investors\n3. Marketing support\n4. BD\n5. Communities\n6. Other";
        break;

      case 'ASK_CONNECTION_GOALS':
        await updateOnboardingStep(runtime, message.userId, 'ASK_EVENTS', { connectionGoals: [text] });
        responseText = "Can you share any events you will be attending coming up (event name, month, location)?";
        break;

      case 'ASK_EVENTS':
        await updateOnboardingStep(runtime, message.userId, 'ASK_SOCIALS', { events: [text] });
        responseText = "Can you share your digital links and/or social media profiles?";
        break;

      case 'ASK_SOCIALS':
        await updateOnboardingStep(runtime, message.userId, 'ASK_GENDER', { socials: [text] });
        responseText = "If you would like to share your gender data (anonymously) for research:\nShe/Her, He/Him, They/Them, Other (or skip).";
        break;

      case 'ASK_GENDER':
        await updateOnboardingStep(runtime, message.userId, 'CONFIRMATION', { gender: text });
        const profile = await getUserProfile(runtime, message.userId);
        responseText = `Here’s your summary:\nName: ${profile.name}\nLoc: ${profile.location}\nRoles: ${profile.roles}\nInterests: ${profile.interests}\nLooking for: ${profile.connectionGoals}\nEvents: ${profile.events}\nSocials: ${profile.socials}\nGender: ${text}\n\nDoes this look right? (Reply 'Confirm' or 'Edit')`;
        break;

      case 'CONFIRMATION':
        if (text.toLowerCase().includes('confirm') || text.toLowerCase().includes('yes')) {
          await updateOnboardingStep(runtime, message.userId, 'COMPLETED', { isConfirmed: true });
          responseText = "Thanks for onboarding - I’ll match you with people who fit your interests. 🚀";
        } else {
          responseText = "What would you like to edit? (Note: Editing logic to be implemented)";
        }
        break;
    }

    if (callback && responseText) {
      callback({ text: responseText });
    }

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

