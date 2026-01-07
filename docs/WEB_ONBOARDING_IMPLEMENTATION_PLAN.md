# Web Onboarding Implementation Plan
## Kaia-First Explorer Onboarding

Based on requirements from Kara Howard:
- **Everyone onboards as Explorer first** (free tier)
- **Wallet OR Email entry** (user choice, already set up by Professor)
- **Kaia guides conversationally** through decision tree
- **SI U name claiming** during onboarding
- **Simplified profile** for Explorer tier
- **Later**: Invite to paid programs (separate process)

---

## Flow Overview

### Landing Page → Explorer Onboarding
```
Landing Page (Program Info/Decision Tree)
    ↓
[User clicks "Join as Explorer"]
    ↓
Kaia Chat Widget Appears
    ↓
Kaia: "Welcome! I'm Kaia. Let's get you started..."
    ↓
ASK_ENTRY_METHOD (Wallet or Email?)
    ↓
[If Wallet] → ASK_WALLET_CONNECTION → ASK_SIU_NAME → ASK_EMAIL (optional)
[If Email] → ASK_EMAIL → ASK_SIU_NAME
    ↓
ASK_LANGUAGE → ASK_NAME → ASK_LOCATION → ASK_INTERESTS → ASK_GOALS → ASK_NOTIFICATIONS
    ↓
COMPLETED → Welcome to SI U!
```

**Key Points:**
- Program selection on landing page is **informational only** (decision tree)
- Everyone actually onboards as **Explorer** (free tier)
- Paid programs (SI Her Guide, Grow3dge Org, Well-Being Org) are **invited later**
- Kaia drives the conversation, UI provides visual support

---

## Implementation Breakdown

### Phase 1: Agent Foundation (Backend)

#### 1.1 New Onboarding Steps
**File:** `src/plugins/onboarding/types.ts`

Add new steps:
```typescript
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
  | 'ASK_ROLE'              // Skip for Explorer tier
  | 'ASK_INTERESTS'
  | 'ASK_CONNECTION_GOALS'
  | 'ASK_EVENTS'            // Skip for Explorer tier
  | 'ASK_SOCIALS'           // Skip for Explorer tier
  | 'ASK_TELEGRAM_HANDLE'   // Skip for Explorer tier
  | 'ASK_GENDER'            // Skip for Explorer tier
  | 'ASK_NOTIFICATIONS'
  | 'CONFIRMATION'
  | 'COMPLETED'
  // ... update steps
```

#### 1.2 New Profile Fields
**File:** `src/plugins/onboarding/types.ts`

Add to `UserProfile` interface:
```typescript
export interface UserProfile {
  // ... existing fields
  entryMethod?: 'wallet' | 'email';      // NEW
  walletAddress?: string;                 // NEW
  siuName?: string;                      // NEW
  userTier?: 'explorer' | 'paid';        // NEW (default: 'explorer')
  // ... rest
}
```

#### 1.3 New Translations
**File:** `src/plugins/onboarding/translations.ts`

Add messages for new steps:
```typescript
export interface Messages {
  // ... existing
  ENTRY_METHOD: string;           // "How would you like to join? 1. Connect wallet 2. Use email"
  WALLET_CONNECTION: string;      // "Please connect your wallet to create your on-chain identity..."
  SIU_NAME: string;                // "What would you like your SI U name to be? (e.g., yourname.siu)"
  SIU_NAME_INVALID: string;        // "That name format isn't valid. Please use format: name.siu"
  SIU_NAME_TAKEN: string;          // "That name is already taken. Please choose another."
  // ... rest
}
```

**English translations:**
```typescript
ENTRY_METHOD: `How would you like to join SI U?

1. Connect wallet (create on-chain identity)
2. Use email (we'll help you set up later)

Reply with the number (for example: 1)`,

WALLET_CONNECTION: `Great! Let's connect your wallet. This will create your on-chain identity in SI U.

Please connect your wallet using the button below, then I'll help you claim your SI U name.`,

SIU_NAME: `Perfect! Now let's claim your SI U name. This will be your unique on-chain identity.

What would you like your SI U name to be? (e.g., yourname.siu)

Type your desired name below:`,
```

#### 1.4 Action Handlers
**File:** `src/plugins/onboarding/actions.ts`

Add handlers for new steps:

**ASK_ENTRY_METHOD:**
```typescript
case 'ASK_ENTRY_METHOD':
  const entryChoice = text.trim();
  if (entryChoice === '1' || entryChoice.toLowerCase().includes('wallet')) {
    await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_WALLET_CONNECTION', { entryMethod: 'wallet' });
    responseText = msgs.WALLET_CONNECTION;
  } else if (entryChoice === '2' || entryChoice.toLowerCase().includes('email')) {
    await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_EMAIL', { entryMethod: 'email' });
    responseText = msgs.EMAIL;
  } else {
    responseText = msgs.ENTRY_METHOD; // Re-ask
  }
  break;
```

**ASK_WALLET_CONNECTION:**
```typescript
case 'ASK_WALLET_CONNECTION':
  // Frontend will send wallet address via API
  // This handler waits for wallet address from frontend
  // Frontend calls: POST /api/onboarding/wallet-connected
  // Agent receives: { walletAddress: "0x..." }
  // Then moves to ASK_SIU_NAME
  break;
```

**ASK_SIU_NAME:**
```typescript
case 'ASK_SIU_NAME':
  const siuNameInput = text.trim().toLowerCase();
  
  // Validate format: name.siu
  if (!/^[a-z0-9-]+\.siu$/.test(siuNameInput)) {
    responseText = msgs.SIU_NAME_INVALID;
    break;
  }
  
  // Check availability (call SI U API)
  const isAvailable = await checkSiuNameAvailability(siuNameInput);
  if (!isAvailable) {
    responseText = msgs.SIU_NAME_TAKEN;
    break;
  }
  
  // Claim name (call SI U API)
  await claimSiuName(state.profile.walletAddress, siuNameInput);
  
  // Save and continue
  await updateOnboardingStep(runtime, message.userId, roomId, 'ASK_LANGUAGE', { 
    siuName: siuNameInput 
  });
  responseText = msgs.LANGUAGE;
  break;
```

#### 1.5 Provider Updates
**File:** `src/plugins/onboarding/provider.ts`

Add provider logic for new steps:
```typescript
// ASK_ENTRY_METHOD step
if (step === 'ASK_ENTRY_METHOD') {
  return `[ONBOARDING STEP: ASK_ENTRY_METHOD - Send this EXACT message word-for-word:

${msgs.ENTRY_METHOD}

After sending this message, wait for the user's response with a number (1 or 2).]`;
}

// ASK_WALLET_CONNECTION step
if (step === 'ASK_WALLET_CONNECTION') {
  return `[ONBOARDING STEP: ASK_WALLET_CONNECTION - Send this EXACT message word-for-word:

${msgs.WALLET_CONNECTION}

The frontend will handle wallet connection. Wait for wallet address confirmation.]`;
}

// ASK_SIU_NAME step
if (step === 'ASK_SIU_NAME') {
  return `[ONBOARDING STEP: ASK_SIU_NAME - Send this EXACT message word-for-word:

${msgs.SIU_NAME}

After sending this message, wait for the user's response with their desired SI U name.]`;
}
```

#### 1.6 Simplified Explorer Flow
**File:** `src/plugins/onboarding/actions.ts`

Update flow to skip steps for Explorer tier:
```typescript
// After ASK_NOTIFICATIONS, go directly to COMPLETED (skip CONFIRMATION for Explorer)
case 'ASK_NOTIFICATIONS':
  // ... handle notification choice
  await updateOnboardingStep(runtime, message.userId, roomId, 'COMPLETED', { 
    userTier: 'explorer',
    notifications: notificationChoice 
  });
  responseText = msgs.COMPLETION;
  break;
```

**Skip these steps for Explorer tier:**
- `ASK_ROLE` (add later for paid programs)
- `ASK_EVENTS` (add later)
- `ASK_SOCIALS` (add later)
- `ASK_TELEGRAM_HANDLE` (add later)
- `ASK_GENDER` (add later)
- `CONFIRMATION` (simplified - go straight to COMPLETED)

---

### Phase 2: API Endpoints (Backend)

#### 2.1 Wallet Connection Endpoint
**File:** `src/services/webChatApi.ts` (or new file)

```typescript
// POST /api/onboarding/wallet-connected
export async function handleWalletConnected(
  runtime: AgentRuntime,
  userId: string,
  walletAddress: string
): Promise<ChatResponse> {
  // Validate wallet address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return { text: 'Invalid wallet address format.' };
  }
  
  // Get current onboarding state
  const state = await getOnboardingState(runtime, userId);
  
  if (state.step !== 'ASK_WALLET_CONNECTION') {
    return { text: 'Wallet connection not expected at this step.' };
  }
  
  // Update state with wallet address
  await updateOnboardingStep(runtime, userId, null, 'ASK_SIU_NAME', {
    walletAddress: walletAddress
  });
  
  // Return success message (Kaia will send SI U name question)
  return { 
    text: 'Wallet connected successfully!',
    nextStep: 'ASK_SIU_NAME'
  };
}
```

#### 2.2 SI U Name Validation Endpoint
**File:** `src/services/webChatApi.ts`

```typescript
// POST /api/onboarding/validate-siu-name
export async function validateSiuName(
  runtime: AgentRuntime,
  userId: string,
  siuName: string
): Promise<{ available: boolean; message?: string }> {
  // Validate format
  if (!/^[a-z0-9-]+\.siu$/.test(siuName.toLowerCase())) {
    return { available: false, message: 'Invalid format. Use: name.siu' };
  }
  
  // Check availability (call SI U API)
  // TODO: Implement actual SI U API call
  const isAvailable = await checkSiuNameAvailability(siuName);
  
  return { 
    available: isAvailable,
    message: isAvailable ? 'Name available!' : 'Name already taken.' 
  };
}
```

#### 2.3 Current Step Endpoint
**File:** `src/services/webChatApi.ts`

```typescript
// GET /api/onboarding/current-step
export async function getCurrentStep(
  runtime: AgentRuntime,
  userId: string
): Promise<{ step: OnboardingStep; profile: Partial<UserProfile> }> {
  const state = await getOnboardingState(runtime, userId);
  return {
    step: state.step,
    profile: state.profile
  };
}
```

---

### Phase 3: Frontend Integration

#### 3.1 Chat Widget Integration
**Location:** Frontend onboarding pages

```typescript
// Embed Kaia chat widget on each onboarding page
<KaiaChatWidget 
  userId={userId}
  onStepChange={(step) => updateUI(step)}
  onWalletConnect={(address) => sendToAgent(address)}
/>
```

**Features:**
- Always visible during onboarding
- Can be minimized but not hidden
- Shows typing indicators
- Syncs with onboarding state

#### 3.2 State Synchronization
**Location:** Frontend state management

```typescript
// Poll agent for current step
useEffect(() => {
  const pollStep = async () => {
    const { step, profile } = await fetch('/api/onboarding/current-step');
    setCurrentStep(step);
    updateUI(step);
  };
  
  const interval = setInterval(pollStep, 2000); // Poll every 2 seconds
  return () => clearInterval(interval);
}, []);
```

#### 3.3 Visual UI Components

**Landing Page:**
- Program cards (informational only)
- "Join as Explorer" button → Triggers Kaia chat widget
- Kaia greets and asks entry method

**Wallet Connection:**
- Modal triggered by Kaia's message
- Wallet buttons (MetaMask, Coinbase, WalletConnect, etc.)
- On connect → Send address to agent via API
- Agent confirms and asks for SI U name

**SI U Name Input:**
- Form triggered by Kaia's message
- Input field with ".siu" suffix
- Real-time validation (format check)
- On submit → Send to agent
- Agent validates availability and claims

**Profile Questions:**
- Visual cards/forms as support
- Kaia asks conversationally
- User can type in chat or fill form
- Forms sync with agent state

---

### Phase 4: SI U Integration

#### 4.1 SI U Name Validation Helper
**File:** `src/services/siuService.ts` (new file)

```typescript
export async function checkSiuNameAvailability(name: string): Promise<boolean> {
  // TODO: Call SI U API to check name availability
  // Example: GET https://api.siu.space/names/check?name=yourname.siu
  const response = await fetch(`${SIU_API_URL}/names/check?name=${name}`);
  const data = await response.json();
  return data.available;
}

export async function claimSiuName(walletAddress: string, name: string): Promise<boolean> {
  // TODO: Call SI U API to claim name
  // Example: POST https://api.siu.space/names/claim
  const response = await fetch(`${SIU_API_URL}/names/claim`, {
    method: 'POST',
    body: JSON.stringify({ walletAddress, name })
  });
  return response.ok;
}
```

**Note:** Need to coordinate with Professor on SI U API endpoints and authentication.

---

## Implementation Order

### Week 1: Agent Foundation
1. ✅ Add new onboarding steps to types
2. ✅ Add new profile fields
3. ✅ Add translations for new steps
4. ✅ Create action handlers for ASK_ENTRY_METHOD, ASK_WALLET_CONNECTION, ASK_SIU_NAME
5. ✅ Update provider to handle new steps
6. ✅ Simplify Explorer flow (skip unnecessary steps)

### Week 2: API Integration
1. ✅ Create wallet connection endpoint
2. ✅ Create SI U name validation endpoint
3. ✅ Create current step polling endpoint
4. ✅ Update Web Chat API to handle new steps
5. ✅ Test API endpoints

### Week 3: Frontend Integration
1. ✅ Embed chat widget on onboarding pages
2. ✅ Implement state synchronization
3. ✅ Create wallet connection UI
4. ✅ Create SI U name input UI
5. ✅ Wire up visual components to agent

### Week 4: SI U Integration & Testing
1. ✅ Coordinate with Professor on SI U API
2. ✅ Implement SI U name validation
3. ✅ Implement SI U name claiming
4. ✅ End-to-end testing
5. ✅ Error handling and edge cases

---

## Design Requirements

### Chat Widget
- Colors: Match purple/pink theme from onboarding screens
- Fonts: Modern, readable sans-serif
- Layout: Bottom-right or side panel
- Button styles: Rounded, purple primary buttons
- Typography: Clear message bubbles

### Onboarding Pages
- Wallet connection modal: Match existing design
- SI U name input: Match existing form style
- Profile question forms: Visual support cards
- Progress indicator: Show current step

### Message Display
- Chat bubbles: User (right) vs Kaia (left)
- Link styling: Underlined, purple
- Typography: Consistent with brand

---

## Questions to Resolve

1. **SI U API**: What are the exact endpoints for name validation and claiming?
2. **Wallet Connection**: Does frontend handle all wallet logic, or does agent need wallet SDK?
3. **Name Format**: Are there any restrictions on SI U name format beyond `name.siu`?
4. **Error Handling**: What happens if wallet connection fails? SI U name is taken?
5. **Mobile**: How should chat widget work on mobile devices?
6. **Copy**: Need final copy/messaging from Kara for all new steps

---

## Next Steps

1. **Wait for copy** from Kara (as mentioned in conversation)
2. **Coordinate with Professor** on SI U API endpoints
3. **Get design assets** for chat widget and onboarding UI
4. **Start with Phase 1** (Agent Foundation) once copy is ready

---

## Notes

- **Program Selection**: Landing page cards are informational/decision tree only. Everyone onboards as Explorer.
- **Paid Programs**: Invite to SI Her Guide, Grow3dge Org, Well-Being Org happens later (separate process).
- **Simplified Profile**: Explorer tier skips roles, events, socials, telegram, gender questions.
- **Kaia-First**: Agent drives conversation, UI provides visual support.
- **State Sync**: Frontend polls agent state to show/hide UI elements.




