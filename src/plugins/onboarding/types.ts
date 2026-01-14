export type OnboardingStep = 
  | 'NONE'
  | 'ASK_LANGUAGE'
  | 'ASK_NAME'
  | 'ASK_ENTRY_METHOD'      // NEW: Wallet vs Email choice
  | 'ASK_WALLET_CONNECTION' // NEW: Wallet connection
  | 'ASK_SIU_NAME'          // NEW: SI U name claim
  | 'ASK_EMAIL'
  | 'ASK_PROFILE_CHOICE'
  | 'ASK_LOCATION'  // Keep for editing existing profiles
  | 'ASK_ROLE'
  | 'ASK_COMPANY'      // NEW: Company question
  | 'ASK_TITLE'        // NEW: Title question
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
  | 'UPDATING_WALLET'       // NEW: For editing wallet
  // Website onboarding steps
  | 'WEBSITE_WELCOME'       // NEW: Website welcome with pinned opportunities
  | 'WEBSITE_PRIVACY'       // NEW: Privacy policy acknowledgment
  | 'WEBSITE_LANGUAGE'      // NEW: Language selection for website onboarding
  | 'WEBSITE_WEB3_EXPERIENCE' // NEW: Web3 experience level question
  | 'WEBSITE_GENDER_CHECK'  // NEW: Gender check for Si Her routing
  | 'WEBSITE_ROLE_CHECK'    // NEW: Role check for Grow3dge/Well-Being routing
  | 'WEBSITE_ROLE_CHECK_FOUNDER' // NEW: Founder/CoS/HR role check
  | 'WEBSITE_ROUTED';       // NEW: User has been routed to specific program

import { LanguageCode } from './translations.js';

export interface UserProfile {
  name?: string;
  language?: LanguageCode;
  location?: string;  // Keep for backward compatibility, but no longer collected
  email?: string;
  company?: string;   // NEW: Company name
  title?: string;     // NEW: Job title
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
  onboardingSource?: 'telegram' | 'web' | 'website';  // NEW: Track source
  profileUpdatedAt?: Date;  // NEW: Timestamp when profile was last updated (for background match checker)
  existingUserId?: string; // Used temporarily during ASK_PROFILE_CHOICE
  existingProfile?: UserProfile; // Used temporarily during ASK_PROFILE_CHOICE
  si3Roles?: string[];  // Roles from SI3 database (for platform detection)
  // Website onboarding fields
  entryPoint?: 'onboard' | 'explore' | 'join-si-u';  // NEW: How user entered from website
  web3ExperienceLevel?: 'brand-new' | 'using-but-not-working' | 'working-in-web3';  // NEW: Web3 experience
  roleCategory?: 'marketing-sales-bd' | 'founder-cos-hr' | 'other';  // NEW: Role category for routing
  routedToProgram?: 'si-u-explorer' | 'si-her-guide' | 'grow3dge' | 'well-being';  // NEW: Which program user was routed to
  privacyPolicyAcknowledged?: boolean;  // NEW: Privacy policy acknowledgment
  siHerFormSubmitted?: boolean;  // NEW: Si Her form submission status
  siHerPaymentCompleted?: boolean;  // NEW: Si Her payment status
  paymentTransactionId?: string;  // NEW: Payment transaction ID
  paymentDate?: Date;  // NEW: Payment date
  grow3dgeFormSubmitted?: boolean;  // NEW: Grow3dge form submission status
  wellBeingFormSubmitted?: boolean;  // NEW: Well-Being form submission status
}

// Extend the standard State to include our onboarding context
declare module '@elizaos/core' {
  interface State {
    onboardingStep?: OnboardingStep;
    userProfile?: UserProfile;
  }
}
