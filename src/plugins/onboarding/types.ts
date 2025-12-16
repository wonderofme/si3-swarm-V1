export type OnboardingStep = 
  | 'NONE'
  | 'ASK_NAME'
  | 'ASK_LANGUAGE'
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
  | 'COMPLETED';

import { LanguageCode } from './translations.js';

export interface UserProfile {
  name?: string;
  language?: LanguageCode;
  location?: string;
  roles?: string[];
  interests?: string[];
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
}

// Extend the standard State to include our onboarding context
declare module '@elizaos/core' {
  interface State {
    onboardingStep?: OnboardingStep;
    userProfile?: UserProfile;
  }
}

