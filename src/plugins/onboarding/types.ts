export type OnboardingStep = 
  | 'NONE'
  | 'ASK_LANGUAGE'
  | 'ASK_NAME'
  | 'ASK_ENTRY_METHOD'      // NEW: Wallet vs Email choice
  | 'ASK_WALLET_CONNECTION' // NEW: Wallet connection
  | 'ASK_SIU_NAME'          // NEW: SI U name claim
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
  | 'UPDATING_NOTIFICATIONS'
  | 'UPDATING_SIU_NAME'     // NEW: For editing SI U name
  | 'UPDATING_WALLET';      // NEW: For editing wallet

import { LanguageCode } from './translations.js';

export interface UserProfile {
  name?: string;
  language?: LanguageCode;
  location?: string;
  email?: string;
  // NEW: Entry method and wallet fields
  entryMethod?: 'wallet' | 'email';
  walletAddress?: string;
  walletType?: string;  // 'metamask', 'coinbase', 'walletconnect', etc.
  siuName?: string;     // e.g., 'ayoola.siu'
  userTier?: 'explorer' | 'paid';
  // Existing fields
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
  onboardingStartedAt?: Date;  // NEW: For time-to-completion analytics
  onboardingSource?: 'telegram' | 'web';  // NEW: Track source
  existingUserId?: string; // Used temporarily during ASK_PROFILE_CHOICE
  existingProfile?: UserProfile; // Used temporarily during ASK_PROFILE_CHOICE
  si3Roles?: string[];  // Roles from SI3 database (for platform detection)
}

// Extend the standard State to include our onboarding context
declare module '@elizaos/core' {
  interface State {
    onboardingStep?: OnboardingStep;
    userProfile?: UserProfile;
  }
}
