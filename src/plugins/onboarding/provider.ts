import { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';
import { getOnboardingStep, getUserProfile } from './utils.js';

// Define exact messages for each step
const MESSAGES = {
  GREETING: `Hola! I'm Agent Kaia, created by SI<3>. I'm your friendly guide to help you navigate Web3. I am here to support you in making meaningful connections and share helpful knowledge and opportunities within our member network. 💜

By continuing your interactions with me, you give your consent to sharing personal data in accordance with our privacy policy. https://si3.space/policy/privacy

Let's get started! What's your preferred name?`,

  LOCATION: `What's your location (city and country)? 📍 (optional)`,

  ROLES: `To be able to match you with members and opportunities, can you tell me a bit about yourself by selecting the options that best describe you? You may select more than one.

1. Founder/Builder
2. Marketing/BD/Partnerships
3. DAO Council Member/Delegate
4. Community Leader
5. Investor/Grant Program Operator
6. Early Web3 Explorer
7. Media
8. Artist
9. Developer
10. Other

Reply with the number before the role (for example: 1, 4). If you have a role that is not listed, type that as text (for example: 1,4 and xx)`,

  INTERESTS: `As I am getting to know you better, can you please share what you are excited to explore in the Grow3dge program? You can select more than one topic.

1. Web3 Growth Marketing
2. Business Development & Partnerships
3. Education 3.0
4. AI
5. Cybersecurity
6. DAO's
7. Tokenomics
8. Fundraising
9. Other

Reply with the number before the topic (for example: 2,3). If you have a topic that is not listed, type that as text (for example: 2,3 and DevRel)`,

  GOALS: `I'd love to help you find the right connections - what are you looking for? 🤝

1. Startups to invest in
2. Investors/grant program operators
3. Marketing support
4. BD & Partnerships
5. Communities and/or DAO's to join
6. Other

Reply with the number before the connection type (for example: 3, 4). If you have a connection type that is not listed, type that as text (for example 3,4 and Cybersecurity).`,

  EVENTS: `I can also share a list of people that are attending the same events and conferences that you are attending! Can you share any events that you will be attending coming up (event name, month, and location)? (optional)`,

  SOCIALS: `Can you share your digital links and/or social media profiles so we can share those with those that you are matched with? (optional)`,

  TELEGRAM: `What's your Telegram handle so matches can reach you? (e.g., @username)`,

  GENDER: `We are an ecosystem that values the inclusion of under-represented groups in Web3. We are engaging in industry-related market research to support these groups in achieving more equitable access to funding, growth and career opportunities.

If you would like to share your gender data (anonymously) within our research, please provide how you identify: (optional)

1. She/Her
2. He/Him
3. They/Them
4. Other`,

  NOTIFICATIONS: `One last thing…would you be interested in receiving notifications for project and mission collaboration opportunities initiated by SI<3> and it's partners? You're also welcome to share your organization's opportunities to broadcast to potentially interested members.

1. Yes!
2. No, thanks
3. Not sure yet, check in with me another time`,

  COMPLETION: `Thank you so much for onboarding! To get started, I will match you with members of our network where you both may be a fit for what you are looking for.`
};

export const onboardingProvider: Provider = {
  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string | null> => {
    const userId = message.userId;
    const step = await getOnboardingStep(runtime, userId);
    const profile = await getUserProfile(runtime, userId);
    const messageText = message.content.text?.toLowerCase() || '';
    
    // Check for restart commands
    if (messageText.includes('restart') || 
        messageText.includes('pretend this is my first') ||
        messageText.includes('start over') ||
        messageText.includes('begin again')) {
      return `[ONBOARDING INSTRUCTION: User requested restart. Output EXACTLY this message, nothing else:]

${MESSAGES.GREETING}`;
    }
    
    if (step === 'COMPLETED') {
      return `[ONBOARDING STATUS: COMPLETED. User ${profile.name || 'User'} has finished onboarding. Respond normally to their questions.]`;
    }
    
    if (step === 'NONE') {
      return `[ONBOARDING INSTRUCTION: New user's first message. Output EXACTLY this message, nothing else:]

${MESSAGES.GREETING}`;
    }
    
    // The step indicates what we were WAITING for. User just provided that info.
    // So we should output the NEXT question.
    const stepToMessage: Record<string, string> = {
      // User just provided their name → ask for location
      'ASK_NAME': `[ONBOARDING INSTRUCTION: User provided their name. Output EXACTLY this message, nothing else:]

${MESSAGES.LOCATION}`,

      // User just provided location → ask for roles
      'ASK_LOCATION': `[ONBOARDING INSTRUCTION: User provided their location. Output EXACTLY this message, nothing else:]

${MESSAGES.ROLES}`,

      // User just provided roles → ask for interests
      'ASK_ROLE': `[ONBOARDING INSTRUCTION: User provided their roles. Output EXACTLY this message, nothing else:]

${MESSAGES.INTERESTS}`,

      // User just provided interests → ask for connection goals
      'ASK_INTERESTS': `[ONBOARDING INSTRUCTION: User provided their interests. Output EXACTLY this message, nothing else:]

${MESSAGES.GOALS}`,

      // User just provided connection goals → ask for events
      'ASK_CONNECTION_GOALS': `[ONBOARDING INSTRUCTION: User provided their goals. Output EXACTLY this message, nothing else:]

${MESSAGES.EVENTS}`,

      // User just provided events → ask for socials
      'ASK_EVENTS': `[ONBOARDING INSTRUCTION: User provided events. Output EXACTLY this message, nothing else:]

${MESSAGES.SOCIALS}`,

      // User just provided socials → ask for telegram
      'ASK_SOCIALS': `[ONBOARDING INSTRUCTION: User provided socials. Output EXACTLY this message, nothing else:]

${MESSAGES.TELEGRAM}`,

      // User just provided telegram → ask for gender
      'ASK_TELEGRAM_HANDLE': `[ONBOARDING INSTRUCTION: User provided Telegram handle. Output EXACTLY this message, nothing else:]

${MESSAGES.GENDER}`,

      // User just provided gender → ask for notifications
      'ASK_GENDER': `[ONBOARDING INSTRUCTION: User provided gender. Output EXACTLY this message, nothing else:]

${MESSAGES.NOTIFICATIONS}`,

      // User just provided notifications → show summary
      'ASK_NOTIFICATIONS': `[ONBOARDING INSTRUCTION: User provided notification preference. Generate the profile summary with this format:]

Here's your summary. Does it look right?

Name: ${profile.name || 'Not provided'}
Location: ${profile.location || 'Not provided'}
Professional Roles: ${profile.roles?.join(', ') || 'Not provided'}
Learning Goals: ${profile.interests?.join(', ') || 'Not provided'}
Connection Goals: ${profile.connectionGoals?.join(', ') || 'Not provided'}
Conferences Attending: ${profile.events?.join(', ') || 'Not provided'}
Personal Links: ${profile.socials?.join(', ') || 'Not provided'}
Telegram Handle: ${profile.telegramHandle ? '@' + profile.telegramHandle : 'Not provided'}
Gender Info: ${profile.gender || 'Not provided'}
Notifications for Collabs: ${profile.notifications || 'Not provided'}

Edit name
Edit location
Edit professional roles
Edit learning Goals
Edit connection Goals
Edit conferences attending
Edit personal links
Edit gender info
Edit notifications for collabs

✅ Confirm`,

      // User confirmed or edited → show completion or re-ask
      'CONFIRMATION': messageText.includes('confirm') || messageText.includes('yes') || messageText.includes('check') 
        ? `[ONBOARDING INSTRUCTION: User confirmed their profile. Output EXACTLY this message:]

${MESSAGES.COMPLETION}`
        : `[ONBOARDING INSTRUCTION: User wants to edit. Re-ask the appropriate question based on what they want to edit.]`
    };
    
    return stepToMessage[step] || `[ONBOARDING STEP: ${step}. Follow the script for this step.]`;
  }
};
