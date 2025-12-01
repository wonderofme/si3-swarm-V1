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

export interface UserProfile {
  name?: string;
  language?: string;
  location?: string;
  roles?: string[];
  interests?: string[];
  connectionGoals?: string[];
  events?: string[];
  socials?: string[];
  telegramHandle?: string;
  gender?: string;
  notifications?: string;
  isConfirmed?: boolean;
}

// Extend the standard State to include our onboarding context
declare module '@elizaos/core' {
  interface State {
    onboardingStep?: OnboardingStep;
    userProfile?: UserProfile;
  }
}


