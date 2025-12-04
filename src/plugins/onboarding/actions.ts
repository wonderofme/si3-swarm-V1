import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { getOnboardingStep, updateOnboardingStep, getUserProfile } from './utils.js';
import { OnboardingStep, UserProfile } from './types.js';

/**
 * Generate the confirmation summary text
 */
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

// Check for restart commands
function isRestartCommand(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('restart') || 
         lower.includes('pretend this is my first') ||
         lower.includes('start over') ||
         lower.includes('begin again');
}

export const continueOnboardingAction: Action = {
  name: 'CONTINUE_ONBOARDING',
  description: 'Advances the onboarding flow by saving user input and moving to the next step. The LLM generates the actual response messages based on the provider context.',
  similes: ['NEXT_STEP', 'SAVE_PROFILE', 'ANSWER_ONBOARDING', 'EDIT_PROFILE'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const step = await getOnboardingStep(runtime, message.userId);
    return step !== 'COMPLETED';
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    let currentStep = await getOnboardingStep(runtime, message.userId);
    const text = message.content.text;
    const roomId = message.roomId;
    const profile = await getUserProfile(runtime, message.userId);
    const isEditing = profile.isEditing || false;

    // Check for restart commands - reset to NONE so next message triggers fresh greeting
    if (isRestartCommand(text)) {
      await updateOnboardingStep(runtime, message.userId, roomId, 'NONE', {});
      // LLM will see NONE status and generate the greeting
      return true;
    }

    // START -> ASK_NAME (for the NEXT message)
    if (currentStep === 'NONE') {
      await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_NAME');
      // LLM will generate the greeting based on provider context
      return true;
    }

    // Process user input and advance to next step
    switch (currentStep) {
      case 'ASK_NAME':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { name: text, isEditing: false, editingField: undefined });
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LOCATION', { name: text });
        }
        break;

      case 'ASK_LOCATION':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { location: text, isEditing: false, editingField: undefined });
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_ROLE', { location: text });
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
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_INTERESTS', { roles }); 
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
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_CONNECTION_GOALS', { interests });
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
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_EVENTS', { connectionGoals });
        }
        break;

      case 'ASK_EVENTS':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { events: [text], isEditing: false, editingField: undefined });
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_SOCIALS', { events: [text] });
        }
        break;

      case 'ASK_SOCIALS':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { socials: [text], isEditing: false, editingField: undefined });
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_TELEGRAM_HANDLE', { socials: [text] });
        }
        break;

      case 'ASK_TELEGRAM_HANDLE':
        let telegramHandle = text.trim();
        if (telegramHandle.startsWith('@')) telegramHandle = telegramHandle.substring(1);
        
        const handleToSave = (telegramHandle.toLowerCase() === 'skip' || telegramHandle === '') ? undefined : telegramHandle;
        
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { telegramHandle: handleToSave, isEditing: false, editingField: undefined });
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_GENDER', { telegramHandle: handleToSave });
        }
        break;

      case 'ASK_GENDER':
        if (isEditing) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { gender: text, isEditing: false, editingField: undefined });
        } else {
          await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_NOTIFICATIONS', { gender: text });
        }
        break;

      case 'ASK_NOTIFICATIONS':
        await updateOnboardingStep(runtime, message.userId, roomId, 'CONFIRMATION', { notifications: text, isEditing: false, editingField: undefined });
        break;

      case 'CONFIRMATION':
        if (text.toLowerCase().includes('confirm') || text.toLowerCase().includes('yes') || text.toLowerCase().includes('check')) {
          await updateOnboardingStep(runtime, message.userId, roomId, 'COMPLETED', { isConfirmed: true, isEditing: false, editingField: undefined });
        } else if (text.toLowerCase().includes('edit')) {
          const lowerText = text.toLowerCase();
          let editStep: OnboardingStep | null = null;
          let editField: string | undefined = undefined;
          
          if (lowerText.includes('name')) { editStep = 'ASK_NAME'; editField = 'name'; }
          else if (lowerText.includes('location')) { editStep = 'ASK_LOCATION'; editField = 'location'; }
          else if (lowerText.includes('professional') || lowerText.includes('role')) { editStep = 'ASK_ROLE'; editField = 'roles'; }
          else if (lowerText.includes('learning') || lowerText.includes('interest')) { editStep = 'ASK_INTERESTS'; editField = 'interests'; }
          else if (lowerText.includes('connection') || lowerText.includes('goal')) { editStep = 'ASK_CONNECTION_GOALS'; editField = 'connectionGoals'; }
          else if (lowerText.includes('conference') || lowerText.includes('event')) { editStep = 'ASK_EVENTS'; editField = 'events'; }
          else if (lowerText.includes('personal') || lowerText.includes('link') || lowerText.includes('social')) { editStep = 'ASK_SOCIALS'; editField = 'socials'; }
          else if (lowerText.includes('telegram')) { editStep = 'ASK_TELEGRAM_HANDLE'; editField = 'telegramHandle'; }
          else if (lowerText.includes('gender')) { editStep = 'ASK_GENDER'; editField = 'gender'; }
          else if (lowerText.includes('notification') || lowerText.includes('collab')) { editStep = 'ASK_NOTIFICATIONS'; editField = 'notifications'; }
          
          if (editStep) {
            await updateOnboardingStep(runtime, message.userId, roomId, editStep, { isEditing: true, editingField: editField });
          }
        }
        break;
    }

    return true;
  },
  examples: []
};
