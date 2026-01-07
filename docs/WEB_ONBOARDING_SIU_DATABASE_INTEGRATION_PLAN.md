# Web Onboarding + SI U Database Integration Plan

## Overview
Perfect the web integration of Kaia as the main onboarding tool for the entire site. Integrate all Telegram onboarding questions into web, save data to SI U MongoDB database, and upgrade analytics system.

---

## Part 1: Onboarding Flow Mapping

### Current Telegram Flow (to be replicated in Web)
```
1. ASK_LANGUAGE → Language selection
2. ASK_NAME → User's name
3. ASK_ENTRY_METHOD → Wallet or Email (NEW for Explorer)
4. ASK_WALLET_CONNECTION → Wallet address (if wallet chosen)
5. ASK_SIU_NAME → SI U name claim (NEW)
6. ASK_EMAIL → Email address
7. ASK_PROFILE_CHOICE → Continue existing or create new
8. ASK_LOCATION → City and country (optional)
9. ASK_ROLE → Professional roles (skip for Explorer tier)
10. ASK_INTERESTS → Learning interests
11. ASK_CONNECTION_GOALS → Connection goals
12. ASK_EVENTS → Conferences/events (optional, skip for Explorer)
13. ASK_SOCIALS → Digital links/socials (optional, skip for Explorer)
14. ASK_TELEGRAM_HANDLE → Telegram handle (skip for Explorer)
15. ASK_GENDER → Diversity research interest (skip for Explorer)
16. ASK_NOTIFICATIONS → Notification preferences
17. CONFIRMATION → Review summary (skip for Explorer)
18. COMPLETED → Welcome message
```

### Web Onboarding Screen Order (Based on Figma)
**Match the visual screens to the conversational flow:**

1. **Landing Page** → Program info cards (informational only)
2. **Entry Method Screen** → Wallet or Email choice (ASK_ENTRY_METHOD)
3. **Wallet Connection Screen** → Connect wallet UI (ASK_WALLET_CONNECTION)
4. **SI U Name Screen** → Name claim input (ASK_SIU_NAME)
5. **Email Screen** → Email input (ASK_EMAIL)
6. **Language Screen** → Language selection (ASK_LANGUAGE)
7. **Name Screen** → Name input (ASK_NAME)
8. **Location Screen** → Location input (ASK_LOCATION)
9. **Interests Screen** → Interests selection (ASK_INTERESTS)
10. **Goals Screen** → Goals selection (ASK_CONNECTION_GOALS)
11. **Notifications Screen** → Notification preferences (ASK_NOTIFICATIONS)
12. **Completion Screen** → Welcome message (COMPLETED)

**Note:** For Explorer tier, skip: Roles, Events, Socials, Telegram, Gender, Confirmation

---

## Part 2: SI U Database Schema Mapping

### Database Location
- **Organization:** SI3 Ecosystem
- **Project:** SI U
- **Cluster:** SIU
- **Collection:** `test-si3Users`

### Field Mapping: Onboarding → SI U Database

| Onboarding Question | UserProfile Field | SI U DB Field | Type | Notes |
|---------------------|-------------------|---------------|------|-------|
| ASK_LANGUAGE | `language` | `language` | String | 'en', 'es', 'pt', 'fr' |
| ASK_NAME | `name` | `username` | String | Use name as username if no SI U name |
| ASK_ENTRY_METHOD | `entryMethod` | `entryMethod` | String | 'wallet' or 'email' |
| ASK_WALLET_CONNECTION | `walletAddress` | `wallet_address` | String | Ethereum address format |
| ASK_SIU_NAME | `siuName` | `username` | String | Format: `name.siu` |
| ASK_EMAIL | `email` | `email` | String | Primary identifier |
| ASK_LOCATION | `location` | `location` | String | City, Country format |
| ASK_ROLE | `roles` | `roles` | Array | ['founder', 'marketing', etc.] |
| ASK_INTERESTS | `interests` | `interests` | Array | Already exists in DB |
| ASK_CONNECTION_GOALS | `connectionGoals` | `connectionGoals` | Array | **NEW FIELD** |
| ASK_EVENTS | `events` | `events` | Array | **NEW FIELD** |
| ASK_SOCIALS | `socials` | `digitalLinks` | Array | Map to existing field |
| ASK_TELEGRAM_HANDLE | `telegramHandle` | `telegramHandle` | String | **NEW FIELD** |
| ASK_GENDER | `diversityResearchInterest` | `diversityResearchInterest` | String | 'Yes', 'No', 'Not sure' |
| ASK_NOTIFICATIONS | `notifications` | `notificationSettings` | Object | Map to existing structure |

### New Fields to Create in SI U Database

**Fields that don't exist in current schema:**
1. `entryMethod` (String) - 'wallet' or 'email'
2. `siuName` (String) - e.g., 'ayoola.siu'
3. `connectionGoals` (Array) - User's connection goals
4. `events` (Array) - Conferences/events user is attending
5. `telegramHandle` (String) - Telegram username
6. `diversityResearchInterest` (String) - 'Yes', 'No', 'Not sure yet'
7. `location` (String) - City, Country
8. `language` (String) - 'en', 'es', 'pt', 'fr'
9. `userTier` (String) - 'explorer' or 'paid'
10. `onboardingCompletedAt` (Date) - When onboarding finished
11. `onboardingSource` (String) - 'telegram' or 'web'

### Existing Fields to Update
- `email` - Already exists
- `roles` - Already exists (array)
- `interests` - Already exists (array)
- `personalValues` - Already exists (array) - **Note:** Not collected in current onboarding, but exists in DB
- `digitalLinks` - Already exists (array) - Map from `socials`
- `notificationSettings` - Already exists (object) - Map from `notifications` string
- `wallet_address` - Already exists (string)
- `username` - Already exists (string) - Use SI U name if available, otherwise use name
- `isVerified` - Already exists (boolean)
- `isWalletVerified` - Already exists (boolean)

---

## Part 3: Database Save Implementation

### 3.1 Create SI U Database Service

**File:** `src/services/siuDatabaseService.ts` (NEW)

```typescript
import { IAgentRuntime } from '@elizaos/core';
import { getSi3Database } from './si3Database.js';
import { UserProfile } from '../plugins/onboarding/types.js';

export interface SiuUserDocument {
  _id?: any;
  email: string;
  username?: string;
  name?: string;
  language?: string;
  location?: string;
  entryMethod?: 'wallet' | 'email';
  siuName?: string;
  wallet_address?: string;
  isWalletVerified?: boolean;
  walletInfo?: {
    network?: string;
  };
  roles?: string[];
  interests?: string[];
  personalValues?: string[];
  connectionGoals?: string[]; // NEW
  events?: string[]; // NEW
  digitalLinks?: string[];
  telegramHandle?: string; // NEW
  diversityResearchInterest?: string; // NEW
  notificationSettings?: {
    emailUpdates?: boolean;
    sessionReminder?: boolean;
    marketingEmails?: boolean;
    weeklyDigest?: boolean;
    eventAnnouncements?: boolean;
  };
  userTier?: 'explorer' | 'paid';
  onboardingCompletedAt?: Date;
  onboardingSource?: 'telegram' | 'web';
  isVerified?: boolean;
  newsletter?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  lastLogin?: Date;
  profileImage?: string;
  aboutTags?: string[];
  additionalLinks?: string[];
  recentExperiences?: any[];
  versionUpdated?: boolean;
  __v?: number;
}

/**
 * Save or update user profile in SI U database
 */
export async function saveUserToSiuDatabase(
  runtime: IAgentRuntime,
  email: string,
  profile: UserProfile,
  userId: string,
  source: 'telegram' | 'web' = 'web'
): Promise<boolean> {
  try {
    const db = await getSi3Database();
    if (!db) {
      console.error('[SI U Database] Database connection not available');
      return false;
    }

    const collection = db.collection('test-si3Users');
    
    // Map UserProfile to SI U database schema
    const siuDocument: Partial<SiuUserDocument> = {
      email: email.toLowerCase().trim(),
      updatedAt: new Date(),
      lastLogin: new Date(),
      onboardingSource: source,
    };

    // Map basic fields
    if (profile.name) {
      siuDocument.name = profile.name;
      // Use SI U name if available, otherwise use name as username
      siuDocument.username = profile.siuName || profile.name;
    }

    if (profile.siuName) {
      siuDocument.siuName = profile.siuName;
      siuDocument.username = profile.siuName;
    }

    if (profile.language) {
      siuDocument.language = profile.language;
    }

    if (profile.location) {
      siuDocument.location = profile.location;
    }

    if (profile.entryMethod) {
      siuDocument.entryMethod = profile.entryMethod as 'wallet' | 'email';
    }

    if (profile.walletAddress) {
      siuDocument.wallet_address = profile.walletAddress;
      siuDocument.isWalletVerified = true;
      siuDocument.walletInfo = {
        network: 'Mainnet' // Default, can be updated later
      };
    }

    // Map arrays
    if (profile.roles && profile.roles.length > 0) {
      siuDocument.roles = profile.roles;
    }

    if (profile.interests && profile.interests.length > 0) {
      siuDocument.interests = profile.interests;
    }

    if (profile.personalValues && profile.personalValues.length > 0) {
      siuDocument.personalValues = profile.personalValues;
    }

    // NEW: Connection goals
    if (profile.connectionGoals && profile.connectionGoals.length > 0) {
      siuDocument.connectionGoals = profile.connectionGoals;
    }

    // NEW: Events
    if (profile.events && profile.events.length > 0) {
      siuDocument.events = profile.events;
    }

    // Map socials to digitalLinks
    if (profile.socials && profile.socials.length > 0) {
      siuDocument.digitalLinks = profile.socials;
    }

    // NEW: Telegram handle
    if (profile.telegramHandle) {
      siuDocument.telegramHandle = profile.telegramHandle.replace('@', '');
    }

    // NEW: Diversity research interest
    if (profile.diversityResearchInterest) {
      siuDocument.diversityResearchInterest = profile.diversityResearchInterest;
    }

    // Map notifications to notificationSettings object
    if (profile.notifications) {
      const notificationChoice = profile.notifications.toLowerCase();
      siuDocument.notificationSettings = {
        emailUpdates: notificationChoice.includes('yes') || notificationChoice === '1',
        sessionReminder: notificationChoice.includes('yes') || notificationChoice === '1',
        marketingEmails: false, // Default to false
        weeklyDigest: notificationChoice.includes('yes') || notificationChoice === '1',
        eventAnnouncements: notificationChoice.includes('yes') || notificationChoice === '1',
      };
    }

    // User tier
    if (profile.userTier) {
      siuDocument.userTier = profile.userTier;
    } else {
      siuDocument.userTier = 'explorer'; // Default
    }

    // Onboarding completion
    if (profile.onboardingCompletedAt) {
      siuDocument.onboardingCompletedAt = profile.onboardingCompletedAt;
      siuDocument.isVerified = true;
    }

    // Check if user already exists
    const existingUser = await collection.findOne({ 
      email: siuDocument.email 
    });

    if (existingUser) {
      // Update existing user
      await collection.updateOne(
        { email: siuDocument.email },
        { 
          $set: siuDocument,
          $setOnInsert: {
            createdAt: new Date(),
            __v: 0
          }
        }
      );
      console.log(`[SI U Database] ✅ Updated user: ${email}`);
    } else {
      // Create new user
      const newUser: SiuUserDocument = {
        ...siuDocument,
        isVerified: false,
        newsletter: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        aboutTags: [],
        additionalLinks: [],
        recentExperiences: [],
        versionUpdated: true,
        __v: 0
      } as SiuUserDocument;

      await collection.insertOne(newUser);
      console.log(`[SI U Database] ✅ Created new user: ${email}`);
    }

    return true;
  } catch (error: any) {
    console.error('[SI U Database] Error saving user:', error);
    return false;
  }
}

/**
 * Update user profile in SI U database (for profile edits)
 */
export async function updateSiuUserProfile(
  email: string,
  updates: Partial<SiuUserDocument>
): Promise<boolean> {
  try {
    const db = await getSi3Database();
    if (!db) {
      return false;
    }

    const collection = db.collection('test-si3Users');
    
    await collection.updateOne(
      { email: email.toLowerCase().trim() },
      { 
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      }
    );

    console.log(`[SI U Database] ✅ Updated profile for: ${email}`);
    return true;
  } catch (error: any) {
    console.error('[SI U Database] Error updating profile:', error);
    return false;
  }
}

/**
 * Find user in SI U database by email
 */
export async function findSiuUserByEmail(email: string): Promise<SiuUserDocument | null> {
  try {
    const db = await getSi3Database();
    if (!db) {
      return null;
    }

    const collection = db.collection('test-si3Users');
    const user = await collection.findOne({ 
      email: email.toLowerCase().trim() 
    });

    return user as SiuUserDocument | null;
  } catch (error: any) {
    console.error('[SI U Database] Error finding user:', error);
    return null;
  }
}
```

### 3.2 Integrate Database Save into Onboarding Completion

**File:** `src/plugins/onboarding/actions.ts`

**Update COMPLETED handler:**
```typescript
case 'COMPLETED':
  // ... existing completion logic ...
  
  // Save to SI U database
  if (state.profile.email) {
    try {
      const { saveUserToSiuDatabase } = await import('../../services/siuDatabaseService.js');
      const source = message.roomId ? 'telegram' : 'web';
      await saveUserToSiuDatabase(
        runtime,
        state.profile.email,
        state.profile,
        message.userId,
        source
      );
      console.log('[Onboarding] ✅ Saved user to SI U database');
    } catch (error) {
      console.error('[Onboarding] Error saving to SI U database:', error);
      // Don't fail onboarding if DB save fails
    }
  }
  
  break;
```

**File:** `src/services/webChatApi.ts`

**Update COMPLETED handler:**
```typescript
} else if (state.step === 'COMPLETED') {
  // ... existing logic ...
  
  // Save to SI U database
  if (state.profile.email) {
    try {
      const { saveUserToSiuDatabase } = await import('./siuDatabaseService.js');
      await saveUserToSiuDatabase(
        runtime,
        state.profile.email,
        state.profile,
        userId,
        'web'
      );
      console.log('[Web Chat API] ✅ Saved user to SI U database');
    } catch (error) {
      console.error('[Web Chat API] Error saving to SI U database:', error);
    }
  }
}
```

**File:** `src/index.ts` (Telegram handler)

**Update COMPLETED handler:**
```typescript
} else if (state.step === 'COMPLETED') {
  // ... existing logic ...
  
  // Save to SI U database
  if (state.profile.email) {
    try {
      const { saveUserToSiuDatabase } = await import('./services/siuDatabaseService.js');
      await saveUserToSiuDatabase(
        kaiaRuntimeForOnboardingCheck,
        state.profile.email,
        state.profile,
        userId,
        'telegram'
      );
      console.log('[Telegram] ✅ Saved user to SI U database');
    } catch (error) {
      console.error('[Telegram] Error saving to SI U database:', error);
    }
  }
}
```

### 3.3 Update Profile Edit Handlers to Save to SI U Database

**File:** `src/services/webChatApi.ts`

**Update profile edit handler (UPDATING_* steps):**
```typescript
// In the profile edit section (around line 720)
if (state.step.startsWith('UPDATING_')) {
  // ... existing update logic ...
  
  // After updating profile, also save to SI U database
  if (state.profile.email) {
    try {
      const { updateSiuUserProfile } = await import('./siuDatabaseService.js');
      const updates: any = {};
      updates[profileKey] = updateValue;
      await updateSiuUserProfile(state.profile.email, updates);
      console.log('[Web Chat API] ✅ Updated SI U database profile');
    } catch (error) {
      console.error('[Web Chat API] Error updating SI U database:', error);
      // Don't fail the update if DB save fails
    }
  }
}
```

**File:** `src/index.ts` (Telegram handler)

**Update profile edit handler:**
```typescript
// Similar update for Telegram profile edits
// Save to SI U database after profile update
```

---

## Part 4: Add Missing Onboarding Steps to Web

### 4.1 Add New Steps to Types

**File:** `src/plugins/onboarding/types.ts`

```typescript
export type OnboardingStep = 
  | 'NONE'
  | 'ASK_LANGUAGE'
  | 'ASK_NAME'
  | 'ASK_ENTRY_METHOD'      // NEW
  | 'ASK_WALLET_CONNECTION'  // NEW
  | 'ASK_SIU_NAME'          // NEW
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
  // ... update steps
```

**Update UserProfile interface:**
```typescript
export interface UserProfile {
  name?: string;
  language?: LanguageCode;
  location?: string;
  email?: string;
  entryMethod?: 'wallet' | 'email';      // NEW
  walletAddress?: string;                 // NEW
  walletType?: string;                    // NEW
  siuName?: string;                      // NEW
  userTier?: 'explorer' | 'paid';        // NEW
  roles?: string[];
  interests?: string[];
  personalValues?: string[];
  connectionGoals?: string[];
  events?: string[];
  socials?: string[];
  telegramHandle?: string;
  gender?: string;
  notifications?: string;
  diversityResearchInterest?: string;
  isConfirmed?: boolean;
  isEditing?: boolean;
  editingField?: string;
  onboardingCompletedAt?: Date;
  existingUserId?: string;
  existingProfile?: UserProfile;
}
```

### 4.2 Add Translations for New Steps

**File:** `src/plugins/onboarding/translations.ts`

Add to Messages interface:
```typescript
export interface Messages {
  // ... existing
  ENTRY_METHOD: string;
  WALLET_CONNECTION: string;
  SIU_NAME: string;
  SIU_NAME_INVALID: string;
  SIU_NAME_TAKEN: string;
  SIU_GUIDANCE: string;
  // ... rest
}
```

Add translations (English example):
```typescript
en: {
  // ... existing
  ENTRY_METHOD: `How would you like to join SI U Explorer?

1. Connect my wallet (create on-chain identity)
2. Use my email (start with web2, upgrade later)

Reply with the number (for example: 1)`,
  
  WALLET_CONNECTION: `Let's connect your wallet to create your on-chain identity.

Please connect your wallet using the button above, then I'll help you claim your SI U name.`,
  
  SIU_NAME: `Now let's claim your SI U name - this will be your on-chain identity!

What would you like your SI U name to be? (e.g., yourname.siu)

Just type the name without the .siu extension, and I'll add it for you.`,
  
  SIU_NAME_INVALID: `That name format isn't valid. SI U names can only contain letters and numbers (e.g., yourname.siu)

Please try again:`,
  
  SIU_NAME_TAKEN: `That name is already taken. Please choose another SI U name:`,
  
  SIU_GUIDANCE: `Welcome to SI U Explorer! 🎉

Here's what you can do:
- Connect with other members
- Explore Web3 resources
- Join community discussions
- Get invited to premium programs (Grow3dge, SI Her Guide, Well-Being)

Ready to complete your profile?`,
  // ... rest
}
```

### 4.3 Update Provider for New Steps

**File:** `src/plugins/onboarding/provider.ts`

Add provider logic for new steps (after ASK_NAME):
```typescript
// ASK_ENTRY_METHOD step
if (step === 'ASK_ENTRY_METHOD') {
  return `[ONBOARDING STEP: ASK_ENTRY_METHOD - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

${msgs.ENTRY_METHOD}

After sending this message, wait for the user's response with a number (1 or 2).]`;
}

// ASK_WALLET_CONNECTION step
if (step === 'ASK_WALLET_CONNECTION') {
  return `[ONBOARDING STEP: ASK_WALLET_CONNECTION - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

${msgs.WALLET_CONNECTION}

The frontend will handle wallet connection. Wait for wallet address confirmation from the frontend.]`;
}

// ASK_SIU_NAME step
if (step === 'ASK_SIU_NAME') {
  return `[ONBOARDING STEP: ASK_SIU_NAME - Send this EXACT message word-for-word. Do not modify, paraphrase, or add anything:

${msgs.SIU_NAME}

After sending this message, wait for the user's response with their desired SI U name.]`;
}
```

### 4.4 Add Step Handlers to Web API

**File:** `src/services/webChatApi.ts`

Add handlers for new steps (after ASK_NAME):
```typescript
} else if (state.step === 'ASK_NAME') {
  const name = messageText.trim();
  // For Explorer tier, go to entry method; for paid tier, go to email
  // Default to Explorer tier for web onboarding
  const userTier = state.profile.userTier || 'explorer';
  if (userTier === 'explorer') {
    await updateState('ASK_ENTRY_METHOD', { name, userTier: 'explorer' });
    responseText = msgs.ENTRY_METHOD;
  } else {
    // Paid tier - skip entry method, go to email
    await updateState('ASK_EMAIL', { name });
    responseText = msgs.EMAIL;
  }
  
} else if (state.step === 'ASK_ENTRY_METHOD') {
  const choice = messageText.trim().toLowerCase();
  if (choice === '1' || choice.includes('wallet')) {
    await updateState('ASK_WALLET_CONNECTION', { entryMethod: 'wallet' });
    responseText = msgs.WALLET_CONNECTION;
    // Return flag for frontend to show wallet connection UI
    return {
      success: true,
      response: responseText,
      requiresWalletConnection: true,
      step: 'ASK_WALLET_CONNECTION'
    };
  } else if (choice === '2' || choice.includes('email')) {
    await updateState('ASK_EMAIL', { entryMethod: 'email' });
    responseText = msgs.EMAIL;
  } else {
    responseText = `${msgs.ENTRY_METHOD}\n\n⚠️ Please reply with 1 or 2`;
  }
  
} else if (state.step === 'ASK_WALLET_CONNECTION') {
  // Check if this is a wallet address from frontend
  if (messageText.startsWith('WALLET_CONNECTED:')) {
    const walletAddress = messageText.replace('WALLET_CONNECTED:', '').trim();
    
    // Validate format
    if (!/^0x[a-fA-F0-9]{40}$/i.test(walletAddress)) {
      responseText = 'Invalid wallet address format. Please try connecting again.';
    } else {
      await updateState('ASK_SIU_NAME', {
        walletAddress: walletAddress,
        entryMethod: 'wallet'
      });
      responseText = msgs.SIU_NAME;
    }
  } else {
    // User typed something - remind them to connect wallet via UI
    responseText = `${msgs.WALLET_CONNECTION}\n\n💡 Please use the "Connect Wallet" button above to connect your wallet.`;
  }
  
} else if (state.step === 'ASK_SIU_NAME') {
  // Validate and format SI U name
  let siuName = messageText.trim()
    .replace('@', '')
    .replace('.siu', '')
    .toLowerCase();
  
  // Validate: alphanumeric only, 3-20 characters
  if (!/^[a-z0-9]+$/.test(siuName)) {
    responseText = `${msgs.SIU_NAME_INVALID}`;
  } else if (siuName.length < 3) {
    responseText = `SI U name must be at least 3 characters. Please try again:`;
  } else if (siuName.length > 20) {
    responseText = `SI U name must be 20 characters or less. Please try again:`;
  } else {
    siuName = siuName + '.siu';
    
    // TODO: Check SI U name availability via API
    // For now, assume available
    
    const profileUpdate: any = { siuName };
    
    // If wallet entry, email is optional - go to language
    if (state.profile?.entryMethod === 'wallet') {
      await updateState('ASK_LANGUAGE', profileUpdate);
      responseText = `${msgs.SIU_GUIDANCE}\n\n${msgs.LANGUAGE}`;
    } else {
      // If email entry, go to email next (if not already provided)
      if (state.profile?.email) {
        await updateState('ASK_LANGUAGE', profileUpdate);
        responseText = `${msgs.SIU_GUIDANCE}\n\n${msgs.LANGUAGE}`;
      } else {
        await updateState('ASK_EMAIL', profileUpdate);
        responseText = msgs.EMAIL;
      }
    }
  }
}
```

### 4.5 Add Step Handlers to Telegram

**File:** `src/index.ts`

Add handlers for new steps (after ASK_NAME handler, around line 1500):
```typescript
} else if (state.step === 'ASK_NAME') {
  const name = messageText.trim();
  // For Explorer tier, go to entry method
  const userTier = state.profile?.userTier || 'explorer';
  if (userTier === 'explorer') {
    await updateState('ASK_ENTRY_METHOD', { name, userTier: 'explorer' });
    responseText = msgs.ENTRY_METHOD;
  } else {
    await updateState('ASK_EMAIL', { name });
    responseText = msgs.EMAIL;
  }
  
} else if (state.step === 'ASK_ENTRY_METHOD') {
  const choice = messageText.trim().toLowerCase();
  if (choice === '1' || choice.includes('wallet')) {
    await updateState('ASK_WALLET_CONNECTION', { entryMethod: 'wallet' });
    responseText = msgs.WALLET_CONNECTION;
  } else if (choice === '2' || choice.includes('email')) {
    await updateState('ASK_EMAIL', { entryMethod: 'email' });
    responseText = msgs.EMAIL;
  } else {
    responseText = `${msgs.ENTRY_METHOD}\n\n⚠️ Please reply with 1 or 2`;
  }
  
} else if (state.step === 'ASK_WALLET_CONNECTION') {
  // User provides wallet address (Telegram doesn't have UI, so they type it)
  const walletAddress = messageText.trim();
  if (!/^0x[a-fA-F0-9]{40}$/i.test(walletAddress)) {
    responseText = `${msgs.WALLET_CONNECTION}\n\n⚠️ Please provide a valid wallet address (0x followed by 40 characters)`;
  } else {
    await updateState('ASK_SIU_NAME', { 
      walletAddress: walletAddress,
      entryMethod: 'wallet'
    });
    responseText = msgs.SIU_NAME;
  }
  
} else if (state.step === 'ASK_SIU_NAME') {
  // Validate and format SI U name
  let siuName = messageText.trim()
    .replace('@', '')
    .replace('.siu', '')
    .toLowerCase();
  
  if (!/^[a-z0-9]+$/.test(siuName)) {
    responseText = `${msgs.SIU_NAME}\n\n⚠️ SI U names can only contain letters and numbers`;
  } else if (siuName.length < 3) {
    responseText = `${msgs.SIU_NAME}\n\n⚠️ SI U name must be at least 3 characters`;
  } else if (siuName.length > 20) {
    responseText = `${msgs.SIU_NAME}\n\n⚠️ SI U name must be 20 characters or less`;
  } else {
    siuName = siuName + '.siu';
    const profileUpdate: any = { siuName };
    
    // If wallet entry, email is optional
    if (state.profile?.entryMethod === 'wallet') {
      await updateState('ASK_LANGUAGE', profileUpdate);
      responseText = `${msgs.SIU_GUIDANCE}\n\n${msgs.LANGUAGE}`;
    } else {
      // If email entry, go to email next (if not already provided)
      if (state.profile?.email) {
        await updateState('ASK_LANGUAGE', profileUpdate);
        responseText = `${msgs.SIU_GUIDANCE}\n\n${msgs.LANGUAGE}`;
      } else {
        await updateState('ASK_EMAIL', profileUpdate);
        responseText = msgs.EMAIL;
      }
    }
  }
}
```

### 4.6 Add Current Step Endpoint

**File:** `src/index.ts`

Add endpoint for frontend to poll current onboarding step (after `/api/chat` route):
```typescript
// GET /api/onboarding/current-step
app.get('/api/onboarding/current-step', async (req, res) => {
  try {
    const { getOnboardingState } = await import('./plugins/onboarding/utils.js');
    const userId = req.query.userId as string;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: userId'
      });
    }
    
    const state = await getOnboardingState(kaiaRuntime, userId as any);
    
    return res.json({
      success: true,
      step: state.step,
      profile: state.profile,
      requiresWalletConnection: state.step === 'ASK_WALLET_CONNECTION',
      requiresSiuNameInput: state.step === 'ASK_SIU_NAME'
    });
  } catch (error: any) {
    console.error('[Current Step API] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get current step'
    });
  }
});
```

### 4.7 Add Wallet Connection Endpoint

**File:** `src/index.ts`

Add endpoint after `/api/chat` route (around line 800):
```typescript
// POST /api/onboarding/wallet-connected
app.post('/api/onboarding/wallet-connected', async (req, res) => {
  try {
    const { processWebChatMessage, validateApiKey } = await import('./services/webChatApi.js');
    
    // Get API key from header or body
    const apiKey = req.headers['x-api-key'] as string || 
                   req.headers['authorization']?.replace('Bearer ', '') || 
                   req.body.apiKey;
    const webApiKey = process.env.WEB_API_KEY;
    
    // Validate API key if configured
    if (webApiKey && webApiKey !== 'disabled') {
      if (!apiKey || !validateApiKey(apiKey)) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or missing API key'
        });
      }
    }
    
    const { userId, walletAddress } = req.body;
    
    if (!userId || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, walletAddress'
      });
    }
    
    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/i.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format'
      });
    }
    
    // Process wallet connection through webChatApi
    const result = await processWebChatMessage(
      kaiaRuntime,
      userId,
      `WALLET_CONNECTED:${walletAddress}`
    );
    
    if (result.success) {
      return res.json({
        success: true,
        walletAddress,
        nextStep: 'ASK_SIU_NAME',
        response: result.response
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to process wallet connection'
      });
    }
    
  } catch (error: any) {
    console.error('[Wallet Connection API] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});
```

### 4.7 Update Explorer Tier Flow Logic

**File:** `src/services/webChatApi.ts`

**Update ASK_NOTIFICATIONS handler to skip CONFIRMATION for Explorer:**
```typescript
} else if (state.step === 'ASK_NOTIFICATIONS') {
  // Save notifications preference and complete (skip CONFIRMATION for Explorer tier)
  let notifications = 'Not sure';
  if (lowerText.includes('1') || lowerText.includes('yes')) notifications = 'Yes';
  else if (lowerText.includes('2') || lowerText.includes('no')) notifications = 'No';
  else if (lowerText.includes('3')) notifications = 'Check later';
  
  const userTier = state.profile.userTier || 'explorer';
  
  if (userTier === 'explorer') {
    // Explorer tier: Skip CONFIRMATION, go directly to COMPLETED
    await updateState('COMPLETED', { 
      notifications, 
      onboardingCompletedAt: new Date(),
      userTier: 'explorer'
    });
    
    // Send completion message with profile
    const { formatProfileForDisplay } = await import('../plugins/onboarding/utils.js');
    const profileText = formatProfileForDisplay(state.profile, state.profile.language || 'en');
    responseText = msgs.COMPLETION + '\n\n' + profileText;
  } else {
    // Paid tier: Go to CONFIRMATION
    await updateState('CONFIRMATION', { notifications });
    responseText = generateConfirmationSummary({ ...state.profile, notifications }, msgs);
  }
}
```

**File:** `src/index.ts` (Telegram handler)

**Update ASK_NOTIFICATIONS handler similarly:**
```typescript
// Same logic - skip CONFIRMATION for Explorer tier
```

---

## Part 5: Analytics System Upgrade

### 5.1 Current Analytics Review

**Current System:**
- File: `src/services/metricsApi.ts`
- Endpoint: `/api/metrics` (GET)
- Metrics tracked:
  - Matches (total, pending, connected, by date)
  - Users (total, started, completed, active)
  - Engagement (feature requests, manual connections, diversity research)
  - Follow-ups (scheduled, sent, response rate)

**Issues:**
1. Only tracks cache-based onboarding (not SI U database)
2. No web vs Telegram breakdown
3. No onboarding step analytics (where users drop off)
4. No SI U-specific metrics (name claims, wallet connections)
5. No time-to-completion metrics
6. Limited filtering/date range support

### 5.2 Enhanced Analytics API

**File:** `src/services/analyticsApi.ts` (NEW or upgrade metricsApi.ts)

```typescript
import { IAgentRuntime } from '@elizaos/core';
import { getSi3Database } from './si3Database.js';

export interface OnboardingAnalytics {
  // Overall stats
  totalStarted: number;
  totalCompleted: number;
  completionRate: number;
  
  // By source
  bySource: {
    telegram: { started: number; completed: number };
    web: { started: number; completed: number };
  };
  
  // By entry method
  byEntryMethod: {
    wallet: number;
    email: number;
  };
  
  // Step drop-off analysis
  stepDropOffs: {
    step: string;
    started: number;
    completed: number;
    dropOffRate: number;
  }[];
  
  // Time metrics
  averageCompletionTime: number; // in minutes
  medianCompletionTime: number;
  
  // SI U specific
  siuNameClaims: number;
  walletConnections: number;
  
  // By date range
  byDate: Array<{
    date: string;
    started: number;
    completed: number;
  }>;
}

export interface UserEngagementAnalytics {
  // Active users
  activeUsers: {
    last7Days: number;
    last30Days: number;
    last90Days: number;
  };
  
  // User growth
  newUsers: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  
  // Platform breakdown
  byPlatform: {
    explorer: number;
    paid: number;
  };
  
  // Geographic distribution
  byLocation: Array<{
    location: string;
    count: number;
  }>;
  
  // Language distribution
  byLanguage: {
    en: number;
    es: number;
    pt: number;
    fr: number;
  };
}

export interface MatchAnalytics {
  totalMatches: number;
  successfulConnections: number;
  connectionRate: number;
  
  bySource: {
    telegram: number;
    web: number;
  };
  
  averageMatchesPerUser: number;
  
  byDate: Array<{
    date: string;
    matches: number;
    connections: number;
  }>;
}

export interface FullAnalytics {
  onboarding: OnboardingAnalytics;
  engagement: UserEngagementAnalytics;
  matches: MatchAnalytics;
  timestamp: string;
}

/**
 * Get comprehensive analytics from both cache and SI U database
 */
export async function getFullAnalytics(
  runtime: IAgentRuntime,
  startDate?: Date,
  endDate?: Date
): Promise<FullAnalytics> {
  const onboarding = await getOnboardingAnalytics(runtime, startDate, endDate);
  const engagement = await getUserEngagementAnalytics(runtime, startDate, endDate);
  const matches = await getMatchAnalytics(runtime, startDate, endDate);
  
  return {
    onboarding,
    engagement,
    matches,
    timestamp: new Date().toISOString()
  };
}

async function getOnboardingAnalytics(
  runtime: IAgentRuntime,
  startDate?: Date,
  endDate?: Date
): Promise<OnboardingAnalytics> {
  // Query both cache and SI U database
  const db = runtime.databaseAdapter as any;
  const siuDb = await getSi3Database();
  
  // Get from cache (in-progress onboarding)
  const cacheStats = await getCacheOnboardingStats(db, startDate, endDate);
  
  // Get from SI U database (completed onboarding)
  const siuStats = await getSiuOnboardingStats(siuDb, startDate, endDate);
  
  // Combine stats
  return {
    totalStarted: cacheStats.started + siuStats.completed,
    totalCompleted: siuStats.completed,
    completionRate: (siuStats.completed / (cacheStats.started + siuStats.completed)) * 100,
    bySource: {
      telegram: {
        started: cacheStats.bySource.telegram + siuStats.bySource.telegram,
        completed: siuStats.bySource.telegram
      },
      web: {
        started: cacheStats.bySource.web + siuStats.bySource.web,
        completed: siuStats.bySource.web
      }
    },
    byEntryMethod: siuStats.byEntryMethod,
    stepDropOffs: cacheStats.stepDropOffs,
    averageCompletionTime: siuStats.averageCompletionTime,
    medianCompletionTime: siuStats.medianCompletionTime,
    siuNameClaims: siuStats.siuNameClaims,
    walletConnections: siuStats.walletConnections,
    byDate: siuStats.byDate
  };
}

async function getCacheOnboardingStats(db: any, startDate?: Date, endDate?: Date) {
  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
  
  if (isMongo && db.getDb) {
    const mongoDb = await db.getDb();
    const cacheCollection = mongoDb.collection('cache');
    
    // Count all users who started onboarding (any cache entry with onboarding_ prefix)
    const started = await cacheCollection.countDocuments({
      key: { $regex: /^onboarding_/ }
    });
    
    // Count by source (telegram vs web) - check if roomId exists (telegram) or not (web)
    // This is approximate - we can't perfectly distinguish without additional metadata
    const allOnboarding = await cacheCollection.find({
      key: { $regex: /^onboarding_/ }
    }).toArray();
    
    let telegramCount = 0;
    let webCount = 0;
    
    for (const doc of allOnboarding) {
      try {
        const value = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;
        // If step is COMPLETED, it's already in SI U database, don't count here
        if (value?.step === 'COMPLETED') continue;
        
        // Approximate: if userId contains 'web_' it's web, otherwise assume telegram
        if (doc.key.includes('web_')) {
          webCount++;
        } else {
          telegramCount++;
        }
      } catch (e) {
        // Skip invalid entries
      }
    }
    
    // Step drop-off analysis
    const stepCounts: { [step: string]: number } = {};
    for (const doc of allOnboarding) {
      try {
        const value = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;
        if (value?.step && value.step !== 'COMPLETED') {
          stepCounts[value.step] = (stepCounts[value.step] || 0) + 1;
        }
      } catch (e) {
        // Skip invalid entries
      }
    }
    
    const stepDropOffs = Object.entries(stepCounts).map(([step, started]) => ({
      step,
      started: started as number,
      completed: 0, // Completed users are in SI U database
      dropOffRate: 100 // All are drop-offs since they're not completed
    }));
    
    return {
      started,
      bySource: { telegram: telegramCount, web: webCount },
      stepDropOffs
    };
  } else {
    // PostgreSQL
    const started = parseInt((await db.query(
      "SELECT COUNT(*) as count FROM cache WHERE key LIKE 'onboarding_%'"
    )).rows[0].count);
    
    // Similar logic for PostgreSQL
    const allOnboarding = await db.query(
      "SELECT key, value FROM cache WHERE key LIKE 'onboarding_%'"
    );
    
    let telegramCount = 0;
    let webCount = 0;
    const stepCounts: { [step: string]: number } = {};
    
    for (const row of allOnboarding.rows) {
      try {
        const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        if (value?.step === 'COMPLETED') continue;
        
        if (row.key.includes('web_')) {
          webCount++;
        } else {
          telegramCount++;
        }
        
        if (value?.step) {
          stepCounts[value.step] = (stepCounts[value.step] || 0) + 1;
        }
      } catch (e) {
        // Skip invalid entries
      }
    }
    
    const stepDropOffs = Object.entries(stepCounts).map(([step, started]) => ({
      step,
      started: started as number,
      completed: 0,
      dropOffRate: 100
    }));
    
    return {
      started,
      bySource: { telegram: telegramCount, web: webCount },
      stepDropOffs
    };
  }
}

async function getSiuOnboardingStats(siuDb: any, startDate?: Date, endDate?: Date) {
  if (!siuDb) {
    return {
      completed: 0,
      bySource: { telegram: 0, web: 0 },
      byEntryMethod: { wallet: 0, email: 0 },
      averageCompletionTime: 0,
      medianCompletionTime: 0,
      siuNameClaims: 0,
      walletConnections: 0,
      byDate: []
    };
  }
  
  const collection = siuDb.collection('test-si3Users');
  
  // Build date filter
  const dateFilter: any = {};
  if (startDate || endDate) {
    dateFilter.onboardingCompletedAt = {};
    if (startDate) dateFilter.onboardingCompletedAt.$gte = startDate;
    if (endDate) dateFilter.onboardingCompletedAt.$lte = endDate;
  }
  
  // Total completed
  const completed = await collection.countDocuments({
    ...dateFilter,
    onboardingCompletedAt: { $exists: true }
  });
  
  // By source
  const bySource = {
    telegram: await collection.countDocuments({
      ...dateFilter,
      onboardingSource: 'telegram',
      onboardingCompletedAt: { $exists: true }
    }),
    web: await collection.countDocuments({
      ...dateFilter,
      onboardingSource: 'web',
      onboardingCompletedAt: { $exists: true }
    })
  };
  
  // By entry method
  const byEntryMethod = {
    wallet: await collection.countDocuments({
      ...dateFilter,
      entryMethod: 'wallet',
      onboardingCompletedAt: { $exists: true }
    }),
    email: await collection.countDocuments({
      ...dateFilter,
      entryMethod: 'email',
      onboardingCompletedAt: { $exists: true }
    })
  };
  
  // SI U name claims
  const siuNameClaims = await collection.countDocuments({
    ...dateFilter,
    siuName: { $exists: true, $ne: null },
    onboardingCompletedAt: { $exists: true }
  });
  
  // Wallet connections
  const walletConnections = await collection.countDocuments({
    ...dateFilter,
    wallet_address: { $exists: true, $ne: null },
    onboardingCompletedAt: { $exists: true }
  });
  
  // By date (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const byDateAggregation = await collection.aggregate([
    {
      $match: {
        onboardingCompletedAt: { $gte: thirtyDaysAgo },
        ...dateFilter
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$onboardingCompletedAt' }
        },
        completed: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]).toArray();
  
  const byDate = byDateAggregation.map((item: any) => ({
    date: item._id,
    completed: item.completed
  }));
  
  // Calculate average completion time (if we track start time)
  // This would require tracking onboarding start time
  
  return {
    completed,
    bySource,
    byEntryMethod,
    averageCompletionTime: 0, // TODO: Calculate from start/end times
    medianCompletionTime: 0, // TODO: Calculate from start/end times
    siuNameClaims,
    walletConnections,
    byDate
  };
}

async function getUserEngagementAnalytics(
  runtime: IAgentRuntime,
  startDate?: Date,
  endDate?: Date
): Promise<UserEngagementAnalytics> {
  const siuDb = await getSi3Database();
  if (!siuDb) {
    return {
      activeUsers: { last7Days: 0, last30Days: 0, last90Days: 0 },
      newUsers: { today: 0, thisWeek: 0, thisMonth: 0 },
      byPlatform: { explorer: 0, paid: 0 },
      byLocation: [],
      byLanguage: { en: 0, es: 0, pt: 0, fr: 0 }
    };
  }
  
  const collection = siuDb.collection('test-si3Users');
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  
  // Active users
  const activeUsers = {
    last7Days: await collection.countDocuments({
      lastLogin: { $gte: weekAgo }
    }),
    last30Days: await collection.countDocuments({
      lastLogin: { $gte: monthAgo }
    }),
    last90Days: await collection.countDocuments({
      lastLogin: { $gte: ninetyDaysAgo }
    })
  };
  
  // New users
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const newUsers = {
    today: await collection.countDocuments({
      createdAt: { $gte: today }
    }),
    thisWeek: await collection.countDocuments({
      createdAt: { $gte: thisWeek }
    }),
    thisMonth: await collection.countDocuments({
      createdAt: { $gte: thisMonth }
    })
  };
  
  // By platform
  const byPlatform = {
    explorer: await collection.countDocuments({ userTier: 'explorer' }),
    paid: await collection.countDocuments({ userTier: 'paid' })
  };
  
  // By location
  const locationAggregation = await collection.aggregate([
    {
      $match: { location: { $exists: true, $ne: null } }
    },
    {
      $group: {
        _id: '$location',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]).toArray();
  
  const byLocation = locationAggregation.map((item: any) => ({
    location: item._id,
    count: item.count
  }));
  
  // By language
  const languageAggregation = await collection.aggregate([
    {
      $match: { language: { $exists: true, $ne: null } }
    },
    {
      $group: {
        _id: '$language',
        count: { $sum: 1 }
      }
    }
  ]).toArray();
  
  const byLanguage = {
    en: 0,
    es: 0,
    pt: 0,
    fr: 0
  };
  
  languageAggregation.forEach((item: any) => {
    if (item._id in byLanguage) {
      byLanguage[item._id as keyof typeof byLanguage] = item.count;
    }
  });
  
  return {
    activeUsers,
    newUsers,
    byPlatform,
    byLocation,
    byLanguage
  };
}

async function getMatchAnalytics(
  runtime: IAgentRuntime,
  startDate?: Date,
  endDate?: Date
): Promise<MatchAnalytics> {
  const db = runtime.databaseAdapter as any;
  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
  
  // Use existing match metrics logic from metricsApi.ts
  // Add source breakdown (telegram vs web) by checking user IDs
  
  if (isMongo && db.getDb) {
    const mongoDb = await db.getDb();
    const matchesCollection = mongoDb.collection('matches');
    
    const totalMatches = await matchesCollection.countDocuments();
    const connected = await matchesCollection.countDocuments({ status: 'connected' });
    const connectionRate = totalMatches > 0 ? (connected / totalMatches) * 100 : 0;
    
    // Get all matches to analyze by source
    const allMatches = await matchesCollection.find({}).toArray();
    let telegramMatches = 0;
    let webMatches = 0;
    
    for (const match of allMatches) {
      // Approximate: if userId contains 'web_' it's web, otherwise assume telegram
      if (match.userId?.includes('web_')) {
        webMatches++;
      } else {
        telegramMatches++;
      }
    }
    
    // Calculate average matches per user
    const uniqueUsers = new Set(allMatches.map((m: any) => m.userId));
    const averageMatchesPerUser = uniqueUsers.size > 0 ? totalMatches / uniqueUsers.size : 0;
    
    // By date (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const byDateAggregation = await matchesCollection.aggregate([
      {
        $match: {
          match_date: { $gte: thirtyDaysAgo },
          ...(startDate || endDate ? {
            match_date: {
              ...(startDate ? { $gte: startDate } : {}),
              ...(endDate ? { $lte: endDate } : {})
            }
          } : {})
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$match_date' }
          },
          matches: { $sum: 1 },
          connections: {
            $sum: { $cond: [{ $eq: ['$status', 'connected'] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    const byDate = byDateAggregation.map((item: any) => ({
      date: item._id,
      matches: item.matches,
      connections: item.connections
    }));
    
    return {
      totalMatches,
      successfulConnections: connected,
      connectionRate,
      bySource: {
        telegram: telegramMatches,
        web: webMatches
      },
      averageMatchesPerUser,
      byDate
    };
  } else {
    // PostgreSQL
    const totalMatches = parseInt((await db.query(
      'SELECT COUNT(*) as count FROM matches'
    )).rows[0].count);
    
    const connected = parseInt((await db.query(
      "SELECT COUNT(*) as count FROM matches WHERE status = 'connected'"
    )).rows[0].count);
    
    const connectionRate = totalMatches > 0 ? (connected / totalMatches) * 100 : 0;
    
    // Get all matches
    const allMatches = await db.query('SELECT user_id, match_date, status FROM matches');
    
    let telegramMatches = 0;
    let webMatches = 0;
    
    for (const row of allMatches.rows) {
      if (row.user_id?.includes('web_')) {
        webMatches++;
      } else {
        telegramMatches++;
      }
    }
    
    // Average matches per user
    const uniqueUsersResult = await db.query(
      'SELECT COUNT(DISTINCT user_id) as count FROM matches'
    );
    const uniqueUsers = parseInt(uniqueUsersResult.rows[0].count);
    const averageMatchesPerUser = uniqueUsers > 0 ? totalMatches / uniqueUsers : 0;
    
    // By date
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const byDateResult = await db.query(`
      SELECT 
        DATE(match_date) as date,
        COUNT(*) as matches,
        COUNT(*) FILTER (WHERE status = 'connected') as connections
      FROM matches
      WHERE match_date >= $1
      ${startDate || endDate ? `AND match_date >= $2 AND match_date <= $3` : ''}
      GROUP BY DATE(match_date)
      ORDER BY date ASC
    `, startDate || endDate 
      ? [thirtyDaysAgo, startDate || thirtyDaysAgo, endDate || new Date()]
      : [thirtyDaysAgo]
    );
    
    const byDate = byDateResult.rows.map((row: any) => ({
      date: row.date.toISOString().split('T')[0],
      matches: parseInt(row.matches),
      connections: parseInt(row.connections)
    }));
    
    return {
      totalMatches,
      successfulConnections: connected,
      connectionRate,
      bySource: {
        telegram: telegramMatches,
        web: webMatches
      },
      averageMatchesPerUser,
      byDate
    };
  }
}
```

### 5.3 Add Analytics Endpoint

**File:** `src/index.ts`

```typescript
// GET /api/analytics
app.get('/api/analytics', async (req, res) => {
  try {
    const { getFullAnalytics } = await import('./services/analyticsApi.js');
    
    // Get date range from query params
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;
    
    const analytics = await getFullAnalytics(kaiaRuntime, startDate, endDate);
    
    return res.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    console.error('[Analytics API] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch analytics'
    });
  }
});

// GET /api/analytics/onboarding
app.get('/api/analytics/onboarding', async (req, res) => {
  // Return just onboarding analytics
  // ...
});

// GET /api/analytics/engagement
app.get('/api/analytics/engagement', async (req, res) => {
  // Return just engagement analytics
  // ...
});

// GET /api/analytics/matches
app.get('/api/analytics/matches', async (req, res) => {
  try {
    const { getMatchAnalytics } = await import('./services/analyticsApi.js');
    
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;
    
    const analytics = await getMatchAnalytics(kaiaRuntime, startDate, endDate);
    
    return res.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    console.error('[Analytics API] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch match analytics'
    });
  }
});
```

**Add API Key Authentication (Optional):**
```typescript
// Middleware for analytics endpoints (if needed)
const analyticsAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string || 
                 req.headers['authorization']?.replace('Bearer ', '');
  const requiredKey = process.env.ANALYTICS_API_KEY;
  
  if (requiredKey && requiredKey !== 'disabled') {
    if (!apiKey || apiKey !== requiredKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or missing analytics API key'
      });
    }
  }
  
  next();
};

// Apply to analytics endpoints
app.get('/api/analytics', analyticsAuth, async (req, res) => { /* ... */ });
app.get('/api/analytics/onboarding', analyticsAuth, async (req, res) => { /* ... */ });
app.get('/api/analytics/engagement', analyticsAuth, async (req, res) => { /* ... */ });
app.get('/api/analytics/matches', analyticsAuth, async (req, res) => { /* ... */ });
```

**Add CORS Configuration:**
```typescript
// Update CORS middleware to allow analytics requests
const corsOrigins = (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: corsOrigins.includes('*') ? true : corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));
```

---

## Part 6: Implementation Order

### Phase 1: Database Integration ✅ COMPLETED
1. ✅ Created `src/services/siuDatabaseService.ts`
2. ✅ Added new fields to `UserProfile` interface in `types.ts`
3. ✅ Integrated database save into completion handlers in `webChatApi.ts`
4. ✅ Created functions: `saveUserToSiuDatabase`, `updateSiuUserProfile`, `findSiuUserByEmail`, `findSiuUserByWallet`, `findSiuUserBySiuName`, `isSiuNameAvailable`, `isWalletRegistered`, `getSiuAnalyticsData`
5. ✅ Handle field mapping (socials → digitalLinks, etc.)

### Phase 2: Add Missing Steps to Web ✅ COMPLETED
1. ✅ Added `ASK_ENTRY_METHOD`, `ASK_WALLET_CONNECTION`, `ASK_SIU_NAME` to `types.ts`
2. ✅ Added translations for all new steps in 4 languages (EN, ES, PT, FR) in `translations.ts`
3. ✅ Added step handlers to `webChatApi.ts`
4. ✅ Created `src/services/siuNameService.ts` for SI U name validation/claiming
5. ✅ Updated `provider.ts` with new step messages
6. ✅ Updated `formatProfileForDisplay` in `utils.ts` to include wallet/SI U name

### Phase 3: Analytics Upgrade ✅ COMPLETED
1. ✅ Created `src/services/analyticsApi.ts` with comprehensive analytics
2. ✅ Added SI U database queries for analytics
3. ✅ Added analytics endpoints: `/api/analytics`, `/api/analytics/quick`
4. ✅ Added SI U name check endpoint: `/api/siu/name/check`
5. ✅ Added wallet check endpoint: `/api/wallet/check`
6. ✅ Implements date range filtering

### Phase 4: Frontend Integration (Awaiting Frontend Developer)
1. ✅ API endpoints ready for integration
2. ⏳ Frontend needs to implement wallet connection UI
3. ⏳ Frontend needs to handle `requiresWalletConnection` flag
4. ⏳ Frontend needs to handle `siuNameClaimed` response
5. ⏳ Sync visual UI with agent state

### Phase 5: Testing & Refinement ✅ CODE COMPLETE
1. ✅ TypeScript compiles without errors
2. ⏳ End-to-end testing (web + telegram) - needs deployment
3. ⏳ Database field validation - needs testing
4. ⏳ Analytics accuracy verification - needs testing
5. ✅ Error handling implemented in all services

---

## Part 7: Testing Checklist

### Database Integration
- [ ] New users created in SI U database
- [ ] Existing users updated correctly
- [ ] All fields mapped correctly
- [ ] New fields created in database
- [ ] No data loss during updates
- [ ] Email case-insensitive matching works

### Onboarding Flow
- [ ] All steps work in web
- [ ] All steps work in Telegram
- [ ] Wallet connection flow works
- [ ] SI U name validation works
- [ ] Explorer tier skips correct steps
- [ ] Profile completion saves to database

### Analytics
- [ ] Analytics query SI U database
- [ ] Source breakdown (web vs telegram) accurate
- [ ] Entry method breakdown accurate
- [ ] Date range filtering works
- [ ] No performance issues with large datasets

---

## Part 8: Additional Considerations

### 8.1 Error Handling

**Database Connection Failures:**
- If SI U database is unavailable, log error but don't fail onboarding
- Cache the profile data and retry save on next interaction
- Show user-friendly message: "Profile saved locally, will sync when database is available"

**Duplicate Email Handling:**
- Check if email exists in SI U database before creating new user
- If exists, update existing user instead of creating duplicate
- Handle case-insensitive email matching

**Wallet Address Validation:**
- Validate format: `0x` + 40 hex characters
- Check for duplicate wallet addresses (one wallet = one account)
- Handle wallet connection failures gracefully

**SI U Name Conflicts:**
- Check name availability before allowing claim
- If taken, suggest alternatives
- Handle race conditions (multiple users claiming same name)

### 8.2 Migration Strategy

**Existing Users:**
- Users who completed onboarding before this update won't be in SI U database
- Option 1: One-time migration script to sync existing cache → SI U database
- Option 2: Lazy migration - sync when user next interacts with bot
- Option 3: Manual migration for important users only

**Migration Script (Optional):**
```typescript
// scripts/migrateToSiuDatabase.ts
// One-time script to migrate existing completed profiles to SI U database
// Run manually after deployment
```

### 8.3 SI U Name API Integration

**File:** `src/services/siuNameService.ts` (NEW)

```typescript
/**
 * Check if SI U name is available
 */
export async function checkSiuNameAvailability(name: string): Promise<boolean> {
  // TODO: Call SI U API
  // GET https://api.siu.space/names/check?name=yourname.siu
  // Return true if available, false if taken
  // For now, return true (assume available)
  return true;
}

/**
 * Claim SI U name
 */
export async function claimSiuName(
  walletAddress: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  // TODO: Call SI U API
  // POST https://api.siu.space/names/claim
  // Body: { walletAddress, name }
  // Return success status
  // For now, return success
  return { success: true };
}
```

**Update ASK_SIU_NAME handler to use this:**
```typescript
// In webChatApi.ts and index.ts
const isAvailable = await checkSiuNameAvailability(siuName);
if (!isAvailable) {
  responseText = msgs.SIU_NAME_TAKEN;
  break;
}

// After validation, claim the name
if (state.profile.walletAddress) {
  const claimResult = await claimSiuName(state.profile.walletAddress, siuName);
  if (!claimResult.success) {
    responseText = `Failed to claim SI U name: ${claimResult.error}. Please try again.`;
    break;
  }
}
```

### 8.4 Explorer Tier Logic

**Where to implement:**
- **webChatApi.ts**: Check `userTier` in each step handler, skip steps if Explorer
- **actions.ts**: Same logic for Telegram
- **provider.ts**: Don't show messages for skipped steps

**Steps to skip for Explorer:**
- `ASK_ROLE` - Skip (no roles for Explorer)
- `ASK_EVENTS` - Skip (optional, not needed for Explorer)
- `ASK_SOCIALS` - Skip (optional, not needed for Explorer)
- `ASK_TELEGRAM_HANDLE` - Skip (not needed for Explorer)
- `ASK_GENDER` - Skip (diversity research not for Explorer)
- `CONFIRMATION` - Skip (go directly to COMPLETED)

**Implementation:**
```typescript
// After ASK_GOALS handler
if (state.step === 'ASK_CONNECTION_GOALS') {
  // ... handle goals ...
  
  const userTier = state.profile.userTier || 'explorer';
  if (userTier === 'explorer') {
    // Skip to notifications
    await updateState('ASK_NOTIFICATIONS', { connectionGoals: goals });
    responseText = msgs.NOTIFICATIONS;
  } else {
    // Paid tier - continue with events
    await updateState('ASK_EVENTS', { connectionGoals: goals });
    responseText = msgs.EVENTS;
  }
}
```

## Part 9: Questions to Resolve

1. **SI U Name API**: What are the exact endpoints for checking name availability and claiming names?
2. **Database Collection**: Confirm collection name is `test-si3Users` (not `si3Users`)?
3. **Field Conflicts**: What if `username` already exists but user wants different SI U name? Overwrite or error?
4. **Analytics Access**: Who should have access to analytics endpoints? API key required?
5. **Error Handling**: Should onboarding fail if database save fails, or continue gracefully? (Plan assumes graceful)
6. **Migration**: Should we migrate existing completed users to SI U database? When?
7. **Wallet Verification**: Do we need to verify wallet ownership via signature, or just accept address?
8. **SI U Name Format**: Are there any restrictions beyond alphanumeric, 3-20 chars?
9. **Explorer vs Paid**: How do users upgrade from Explorer to paid tier? Separate flow?
10. **Profile Updates**: Should profile edits sync to SI U database immediately or batch?
11. **Rate Limiting**: What are acceptable rate limits for each endpoint?
12. **Analytics Access**: Should analytics endpoints require authentication? Who has access?
13. **CORS**: Which origins should be allowed for CORS?
14. **Database Indexes**: Should we create indexes immediately or after testing?
15. **Error Codes**: Do we need standardized error codes for frontend handling?

---

## Notes

- **Database is primary source of truth** for completed profiles
- **Cache is used for in-progress onboarding** only
- **Analytics combines both** cache and database for complete picture
- **New fields are optional** - existing users won't have them
- **Backward compatibility** - existing code should still work
- **Explorer tier is default** - all new web users start as Explorer
- **Wallet connection is web-only** - Telegram users type address manually
- **SI U name validation** - requires API integration (TODO)
- **Profile edits sync to database** - updates happen in real-time
- **Error handling is graceful** - failures don't block user experience

## Part 10: API Response Formats

### 10.1 Chat API Response Structure

**Standard Response:**
```typescript
interface ChatResponse {
  success: boolean;
  response?: string;              // Kaia's message
  userId?: string;
  primaryUserId?: string;         // If continuing with existing profile
  profile?: Partial<UserProfile>; // Current profile data
  onboardingStatus?: string;      // Current step
  error?: string;                 // Error message if failed
  
  // Special flags for frontend
  requiresWalletConnection?: boolean;  // Show wallet UI
  requiresSiuNameInput?: boolean;      // Show SI U name input
  nextStep?: string;                   // Next step hint
}
```

**Example Responses:**

**ASK_ENTRY_METHOD:**
```json
{
  "success": true,
  "response": "How would you like to join SI U Explorer?\n\n1. Connect my wallet...",
  "onboardingStatus": "ASK_ENTRY_METHOD",
  "profile": { "name": "John", "userTier": "explorer" }
}
```

**ASK_WALLET_CONNECTION:**
```json
{
  "success": true,
  "response": "Let's connect your wallet...",
  "onboardingStatus": "ASK_WALLET_CONNECTION",
  "requiresWalletConnection": true,
  "profile": { "entryMethod": "wallet" }
}
```

**ASK_SIU_NAME:**
```json
{
  "success": true,
  "response": "Now let's claim your SI U name...",
  "onboardingStatus": "ASK_SIU_NAME",
  "requiresSiuNameInput": true,
  "profile": { "walletAddress": "0x1234...", "entryMethod": "wallet" }
}
```

**COMPLETED:**
```json
{
  "success": true,
  "response": "Thank you so much for onboarding!\n\n[Profile display]",
  "onboardingStatus": "COMPLETED",
  "profile": { /* full profile */ }
}
```

### 10.2 Current Step Endpoint Response

```typescript
interface CurrentStepResponse {
  success: boolean;
  step: OnboardingStep;
  profile: Partial<UserProfile>;
  requiresWalletConnection?: boolean;
  requiresSiuNameInput?: boolean;
  error?: string;
}
```

### 10.3 Analytics API Response Structure

```typescript
interface AnalyticsResponse {
  success: boolean;
  data: FullAnalytics | OnboardingAnalytics | UserEngagementAnalytics | MatchAnalytics;
  timestamp: string;
  error?: string;
}
```

## Part 11: Database Performance & Indexes

### 11.1 Recommended MongoDB Indexes

**Collection:** `test-si3Users`

```javascript
// Email index (for lookups)
db.test-si3Users.createIndex({ email: 1 }, { unique: true });

// Wallet address index (for lookups)
db.test-si3Users.createIndex({ wallet_address: 1 }, { unique: true, sparse: true });

// SI U name index (for lookups)
db.test-si3Users.createIndex({ siuName: 1 }, { unique: true, sparse: true });

// Onboarding completion date (for analytics)
db.test-si3Users.createIndex({ onboardingCompletedAt: 1 });

// Source and entry method (for analytics)
db.test-si3Users.createIndex({ onboardingSource: 1, entryMethod: 1 });

// User tier (for analytics)
db.test-si3Users.createIndex({ userTier: 1 });

// Last login (for engagement analytics)
db.test-si3Users.createIndex({ lastLogin: -1 });

// Created date (for new user analytics)
db.test-si3Users.createIndex({ createdAt: -1 });

// Compound index for common queries
db.test-si3Users.createIndex({ 
  onboardingSource: 1, 
  userTier: 1, 
  onboardingCompletedAt: 1 
});
```

## Part 12: Validation Rules

### 12.1 Field Validation

**Email:**
- Format: Valid email regex
- Case-insensitive matching
- Required for email entry method
- Optional for wallet entry method

**Wallet Address:**
- Format: `0x` + 40 hexadecimal characters
- Case-insensitive
- Required for wallet entry method
- Must be unique (one wallet = one account)

**SI U Name:**
- Format: Alphanumeric only (a-z, 0-9)
- Length: 3-20 characters (before .siu)
- Must be unique
- Case-insensitive
- Auto-adds `.siu` suffix

**Name:**
- Length: 1-100 characters
- Required

**Location:**
- Format: "City, Country" (optional)
- Length: Max 200 characters

**Language:**
- Values: 'en', 'es', 'pt', 'fr'
- Required

**Roles:**
- Array of strings
- Optional for Explorer tier
- Required for paid tier

**Interests:**
- Array of strings
- Required

**Connection Goals:**
- Array of strings
- Required

**Notifications:**
- Values: 'Yes', 'No', 'Check later'
- Required

## Part 13: Rate Limiting

### 13.1 Add Rate Limiting Middleware

**File:** `src/index.ts`

```typescript
import rateLimit from 'express-rate-limit';

// Rate limiter for chat API
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many requests. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for wallet connection
const walletLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many wallet connection attempts. Please try again later.',
});

// Rate limiter for analytics
const analyticsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many analytics requests. Please slow down.',
});

// Apply to routes
app.post('/api/chat', chatLimiter, async (req, res) => { /* ... */ });
app.post('/api/onboarding/wallet-connected', walletLimiter, async (req, res) => { /* ... */ });
app.get('/api/analytics', analyticsLimiter, async (req, res) => { /* ... */ });
```

## Part 14: Error Response Standardization

### 14.1 Standard Error Format

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;        // Error code for frontend handling
  field?: string;       // Field name if validation error
  details?: any;        // Additional error details
}
```

**Error Codes:**
- `VALIDATION_ERROR` - Input validation failed
- `NOT_FOUND` - Resource not found
- `DUPLICATE_ENTRY` - Email/wallet/name already exists
- `DATABASE_ERROR` - Database operation failed
- `AUTH_ERROR` - Authentication failed
- `RATE_LIMIT` - Rate limit exceeded
- `INTERNAL_ERROR` - Internal server error

**Example Error Responses:**

```json
{
  "success": false,
  "error": "Invalid wallet address format",
  "code": "VALIDATION_ERROR",
  "field": "walletAddress"
}
```

```json
{
  "success": false,
  "error": "SI U name already taken",
  "code": "DUPLICATE_ENTRY",
  "field": "siuName"
}
```

## Part 15: Implementation Checklist

### Phase 1: Database Integration
- [ ] Create `siuDatabaseService.ts` with all functions
- [ ] Add new fields to `UserProfile` interface
- [ ] Update `COMPLETED` handlers in webChatApi.ts, index.ts, actions.ts
- [ ] Update profile edit handlers to save to database
- [ ] Test database saves (create/update)
- [ ] Test error handling (database unavailable)
- [ ] Test duplicate email handling

### Phase 2: New Onboarding Steps
- [ ] Add `ASK_ENTRY_METHOD`, `ASK_WALLET_CONNECTION`, `ASK_SIU_NAME` to types.ts
- [ ] Add translations for new steps (4 languages)
- [ ] Update provider.ts with new step messages
- [ ] Add step handlers to webChatApi.ts
- [ ] Add step handlers to index.ts (Telegram)
- [ ] Add wallet connection endpoint to index.ts
- [ ] Test new flow end-to-end (web)
- [ ] Test new flow end-to-end (Telegram)

### Phase 3: Explorer Tier Logic
- [ ] Add `userTier` field to UserProfile
- [ ] Update flow to skip steps for Explorer tier
- [ ] Update ASK_NOTIFICATIONS to skip CONFIRMATION for Explorer
- [ ] Test Explorer flow (should skip: roles, events, socials, telegram, gender, confirmation)
- [ ] Test paid tier flow (should include all steps)

### Phase 4: Analytics Upgrade
- [ ] Create `analyticsApi.ts` with all functions
- [ ] Implement `getCacheOnboardingStats`
- [ ] Implement `getSiuOnboardingStats`
- [ ] Implement `getUserEngagementAnalytics`
- [ ] Implement `getMatchAnalytics`
- [ ] Add analytics endpoints to index.ts
- [ ] Test analytics accuracy
- [ ] Test date range filtering

### Phase 5: SI U Name Integration
- [ ] Create `siuNameService.ts`
- [ ] Implement name availability check
- [ ] Implement name claiming
- [ ] Integrate into ASK_SIU_NAME handlers
- [ ] Test name validation
- [ ] Test name claiming

### Phase 6: API Endpoints & Infrastructure
- [ ] Add current step endpoint (`/api/onboarding/current-step`)
- [ ] Add wallet connection endpoint (`/api/onboarding/wallet-connected`)
- [ ] Add analytics endpoints (`/api/analytics/*`)
- [ ] Add rate limiting middleware
- [ ] Add CORS configuration
- [ ] Add API key authentication (if needed)
- [ ] Standardize error response format
- [ ] Test all endpoints

### Phase 7: Database Optimization
- [ ] Create MongoDB indexes for performance
- [ ] Test query performance with indexes
- [ ] Optimize slow queries
- [ ] Set up database connection pooling

### Phase 8: Testing & Refinement
- [ ] End-to-end testing (web + telegram)
- [ ] Database field validation
- [ ] Analytics accuracy verification
- [ ] Error handling testing
- [ ] Performance testing
- [ ] Edge case testing (duplicate emails, wallet addresses, etc.)
- [ ] Rate limiting testing
- [ ] CORS testing
- [ ] API response format validation
- [ ] Frontend integration testing

