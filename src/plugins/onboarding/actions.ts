import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { getOnboardingStep, updateOnboardingStep, getUserProfile } from './utils.js';
import { OnboardingStep, UserProfile } from './types.js';

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

function generateSummaryText(profile: UserProfile): string {
  return `Here's your summary. Does it look right?\n\n` +
    `Name: ${profile.name || 'Not provided'}\n` +
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
    `✅ Confirm`;
}

function isRestartCommand(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('restart') || 
         lower.includes('pretend this is my first') ||
         lower.includes('start over') ||
         lower.includes('begin again');
}

export const continueOnboardingAction: Action = {
  name: 'CONTINUE_ONBOARDING',
  description: 'Handles onboarding flow - sends exact scripted messages via callback.',
  similes: ['NEXT_STEP', 'SAVE_PROFILE', 'ANSWER_ONBOARDING', 'EDIT_PROFILE'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const step = await getOnboardingStep(runtime, message.userId);
    console.log('[Onboarding Action] Validate - step:', step, 'isValid:', step !== 'COMPLETED');
    return step !== 'COMPLETED';
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    console.log('[Onboarding Action] Handler started');
    let currentStep = await getOnboardingStep(runtime, message.userId);
    console.log('[Onboarding Action] Current step:', currentStep);
    const text = message.content.text;
    const roomId = message.roomId;
    const profile = await getUserProfile(runtime, message.userId);
    const isEditing = profile.isEditing || false;
    console.log('[Onboarding Action] Has callback:', !!callback);

    // Check for restart commands
    if (isRestartCommand(text)) {
      console.log('[Onboarding Action] Restart command detected');
      await updateOnboardingStep(runtime, message.userId, roomId, 'NONE', {});
      if (callback) {
        console.log('[Onboarding Action] Sending greeting via callback');
        callback({ text: MESSAGES.GREETING });
      }
      return true;
    }

    // START -> ASK_NAME
    if (currentStep === 'NONE') {
      console.log('[Onboarding Action] Step is NONE, sending greeting');
      await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_NAME');
      if (callback) {
        console.log('[Onboarding Action] Calling callback with greeting');
        callback({ text: MESSAGES.GREETING });
      }
      return true;
    }

    // Process user input and advance to next step
    switch (currentStep) {
      case 'ASK_NAME':
        console.log('[Onboarding Action] Processing ASK_NAME, user said:', text);
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { name: text, isEditing: false, editingField: undefined });
          const updatedProfile1 = await getUserProfile(runtime, message.userId);
          if (callback) callback({ text: generateSummaryText(updatedProfile1) });
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LOCATION', { name: text });
          console.log('[Onboarding Action] Calling callback with LOCATION message');
          if (callback) callback({ text: MESSAGES.LOCATION });
        }
        break;

      case 'ASK_LOCATION':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { location: text, isEditing: false, editingField: undefined });
          const updatedProfile2 = await getUserProfile(runtime, message.userId);
          if (callback) callback({ text: generateSummaryText(updatedProfile2) });
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_ROLE', { location: text });
          if (callback) callback({ text: MESSAGES.ROLES });
        }
        break;

      case 'ASK_ROLE':
        const roleParts = text.split(/[,\s]+and\s+/i);
        const roleNumbers = roleParts[0].split(/[,\s]+/).filter(s => /^\d+$/.test(s.trim()));
        const roleText = roleParts[1] || '';
        const roles = [...roleNumbers.map(n => {
          const roleMap: Record<string, string> = {
            '1': 'Founder/Builder', '2': 'Marketing/BD/Partnerships', '3': 'DAO Council Member/Delegate',
            '4': 'Community Leader', '5': 'Investor/Grant Program Operator', '6': 'Early Web3 Explorer',
            '7': 'Media', '8': 'Artist', '9': 'Developer', '10': 'Other'
          };
          return roleMap[n.trim()];
        }).filter(Boolean), ...(roleText ? [roleText.trim()] : [])];
        
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { roles, isEditing: false, editingField: undefined });
          const updatedProfile3 = await getUserProfile(runtime, message.userId);
          if (callback) callback({ text: generateSummaryText(updatedProfile3) });
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_INTERESTS', { roles }); 
          if (callback) callback({ text: MESSAGES.INTERESTS });
        }
        break;

      case 'ASK_INTERESTS':
        const interestParts = text.split(/[,\s]+and\s+/i);
        const interestNumbers = interestParts[0].split(/[,\s]+/).filter(s => /^\d+$/.test(s.trim()));
        const interestText = interestParts[1] || '';
        const interests = [...interestNumbers.map(n => {
          const interestMap: Record<string, string> = {
            '1': 'Web3 Growth Marketing', '2': 'Business Development & Partnerships', '3': 'Education 3.0',
            '4': 'AI', '5': 'Cybersecurity', '6': 'DAOs', '7': 'Tokenomics', '8': 'Fundraising', '9': 'Other'
          };
          return interestMap[n.trim()];
        }).filter(Boolean), ...(interestText ? [interestText.trim()] : [])];
        
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { interests, isEditing: false, editingField: undefined });
          const updatedProfile4 = await getUserProfile(runtime, message.userId);
          if (callback) callback({ text: generateSummaryText(updatedProfile4) });
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_CONNECTION_GOALS', { interests });
          if (callback) callback({ text: MESSAGES.GOALS });
        }
        break;

      case 'ASK_CONNECTION_GOALS':
        const goalParts = text.split(/[,\s]+and\s+/i);
        const goalNumbers = goalParts[0].split(/[,\s]+/).filter(s => /^\d+$/.test(s.trim()));
        const goalText = goalParts[1] || '';
        const connectionGoals = [...goalNumbers.map(n => {
          const goalMap: Record<string, string> = {
            '1': 'Startups to invest in', '2': 'Investors/grant program operators', '3': 'Marketing support',
            '4': 'BD & Partnerships', '5': 'Communities and/or DAOs to join', '6': 'Other'
          };
          return goalMap[n.trim()];
        }).filter(Boolean), ...(goalText ? [goalText.trim()] : [])];
        
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { connectionGoals, isEditing: false, editingField: undefined });
          const updatedProfile5 = await getUserProfile(runtime, message.userId);
          if (callback) callback({ text: generateSummaryText(updatedProfile5) });
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_EVENTS', { connectionGoals });
          if (callback) callback({ text: MESSAGES.EVENTS });
        }
        break;

      case 'ASK_EVENTS':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { events: [text], isEditing: false, editingField: undefined });
          const updatedProfile6 = await getUserProfile(runtime, message.userId);
          if (callback) callback({ text: generateSummaryText(updatedProfile6) });
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_SOCIALS', { events: [text] });
          if (callback) callback({ text: MESSAGES.SOCIALS });
        }
        break;

      case 'ASK_SOCIALS':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { socials: [text], isEditing: false, editingField: undefined });
          const updatedProfile7 = await getUserProfile(runtime, message.userId);
          if (callback) callback({ text: generateSummaryText(updatedProfile7) });
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_TELEGRAM_HANDLE', { socials: [text] });
          if (callback) callback({ text: MESSAGES.TELEGRAM });
        }
        break;

      case 'ASK_TELEGRAM_HANDLE':
        let telegramHandle = text.trim();
        if (telegramHandle.startsWith('@')) telegramHandle = telegramHandle.substring(1);
        const handleToSave = (telegramHandle.toLowerCase() === 'skip' || telegramHandle === '') ? undefined : telegramHandle;
        
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { telegramHandle: handleToSave, isEditing: false, editingField: undefined });
          const updatedProfile8 = await getUserProfile(runtime, message.userId);
          if (callback) callback({ text: generateSummaryText(updatedProfile8) });
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_GENDER', { telegramHandle: handleToSave });
          if (callback) callback({ text: MESSAGES.GENDER });
        }
        break;

      case 'ASK_GENDER':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { gender: text, isEditing: false, editingField: undefined });
          const updatedProfile9 = await getUserProfile(runtime, message.userId);
          if (callback) callback({ text: generateSummaryText(updatedProfile9) });
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_NOTIFICATIONS', { gender: text });
          if (callback) callback({ text: MESSAGES.NOTIFICATIONS });
        }
        break;

      case 'ASK_NOTIFICATIONS':
        await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { notifications: text, isEditing: false, editingField: undefined });
        const finalProfile = await getUserProfile(runtime, message.userId);
        if (callback) callback({ text: generateSummaryText(finalProfile) });
        break;

      case 'CONFIRMATION':
        if (text.toLowerCase().includes('confirm') || text.toLowerCase().includes('yes') || text.toLowerCase().includes('check')) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'COMPLETED', { isConfirmed: true, isEditing: false, editingField: undefined });
          if (callback) callback({ text: MESSAGES.COMPLETION });
        } else if (text.toLowerCase().includes('edit')) {
          const lowerText = text.toLowerCase();
          let editStep: OnboardingStep | null = null;
          let editField: string | undefined = undefined;
          let editMessage: string = '';
          
          if (lowerText.includes('name')) { editStep = 'ASK_NAME'; editField = 'name'; editMessage = "What's your preferred name?"; }
          else if (lowerText.includes('location')) { editStep = 'ASK_LOCATION'; editField = 'location'; editMessage = MESSAGES.LOCATION; }
          else if (lowerText.includes('professional') || lowerText.includes('role')) { editStep = 'ASK_ROLE'; editField = 'roles'; editMessage = MESSAGES.ROLES; }
          else if (lowerText.includes('learning') || lowerText.includes('interest')) { editStep = 'ASK_INTERESTS'; editField = 'interests'; editMessage = MESSAGES.INTERESTS; }
          else if (lowerText.includes('connection') || lowerText.includes('goal')) { editStep = 'ASK_CONNECTION_GOALS'; editField = 'connectionGoals'; editMessage = MESSAGES.GOALS; }
          else if (lowerText.includes('conference') || lowerText.includes('event')) { editStep = 'ASK_EVENTS'; editField = 'events'; editMessage = MESSAGES.EVENTS; }
          else if (lowerText.includes('personal') || lowerText.includes('link') || lowerText.includes('social')) { editStep = 'ASK_SOCIALS'; editField = 'socials'; editMessage = MESSAGES.SOCIALS; }
          else if (lowerText.includes('telegram')) { editStep = 'ASK_TELEGRAM_HANDLE'; editField = 'telegramHandle'; editMessage = MESSAGES.TELEGRAM; }
          else if (lowerText.includes('gender')) { editStep = 'ASK_GENDER'; editField = 'gender'; editMessage = MESSAGES.GENDER; }
          else if (lowerText.includes('notification') || lowerText.includes('collab')) { editStep = 'ASK_NOTIFICATIONS'; editField = 'notifications'; editMessage = MESSAGES.NOTIFICATIONS; }
          
          if (editStep) {
            await updateOnboardingStep(runtime, message.userId, roomId, editStep, { isEditing: true, editingField: editField });
            if (callback) callback({ text: editMessage });
          } else {
            if (callback) callback({ text: "What would you like to edit? (e.g., 'Edit name' or 'Edit location')" });
          }
        }
        break;
    }

    return true;
  },
  examples: []
};
