export type OnboardingStep = 
  | 'NONE'
  | 'ASK_NAME'
  | 'ASK_LOCATION'
  | 'ASK_ROLE'
  | 'ASK_INTERESTS'
  | 'ASK_CONNECTION_GOALS'
  | 'ASK_EVENTS'
  | 'ASK_SOCIALS'
  | 'ASK_GENDER'
  | 'CONFIRMATION'
  | 'COMPLETED';

export interface UserProfile {
  name?: string;
  location?: string;
  roles?: string[];
  interests?: string[];
  connectionGoals?: string[];
  events?: string[];
  socials?: string[];
  gender?: string;
  isConfirmed?: boolean;
}

// Extend the standard State to include our onboarding context
declare module '@elizaos/core' {
  interface State {
    onboardingStep?: OnboardingStep;
    userProfile?: UserProfile;
  }
}

