export type OnboardingStep = 
  | 'NONE'
  | 'ASK_LANGUAGE'
  | 'ASK_NAME'
  | 'ASK_EMAIL'
  | 'ASK_PROFILE_CHOICE'
  | 'ASK_LOCATION'
  | 'ASK_ROLE'
  | 'ASK_INTERESTS'
  | 'ASK_CONNECTION_GOALS'
  | 'ASK_EVENTS'
  | 'ASK_SOCIALS'
  | 'ASK_TELEGRAM_HANDLE'
  | 'ASK_GENDER'
  | 'ASK_NOTIFICATIONS'
  | 'CONFIRMATION'
  | 'COMPLETED'
  | 'AWAITING_UPDATE_FIELD'
  | 'AWAITING_FEATURE_DETAILS'
  | 'UPDATING_NAME'
  | 'UPDATING_LOCATION'
  | 'UPDATING_EMAIL'
  | 'UPDATING_ROLES'
  | 'UPDATING_INTERESTS'
  | 'UPDATING_GOALS'
  | 'UPDATING_EVENTS'
  | 'UPDATING_SOCIALS'
  | 'UPDATING_TELEGRAM'
  | 'UPDATING_DIVERSITY'
  | 'UPDATING_NOTIFICATIONS';

import { LanguageCode } from './translations.js';

export interface UserProfile {
  name?: string;
  language?: LanguageCode;
  location?: string;
  email?: string;
  roles?: string[];
  interests?: string[];
  personalValues?: string[];
  connectionGoals?: string[];
  events?: string[];
  socials?: string[];
  telegramHandle?: string;
  gender?: string;
  notifications?: string;
  diversityResearchInterest?: string; // 'Yes', 'No', 'Not sure yet'
  isConfirmed?: boolean;
  isEditing?: boolean;
  editingField?: string;
  onboardingCompletedAt?: Date;
  existingUserId?: string; // Used temporarily during ASK_PROFILE_CHOICE
  existingProfile?: UserProfile; // Used temporarily during ASK_PROFILE_CHOICE
}

// Extend the standard State to include our onboarding context
declare module '@elizaos/core' {
  interface State {
    onboardingStep?: OnboardingStep;
    userProfile?: UserProfile;
  }
}

