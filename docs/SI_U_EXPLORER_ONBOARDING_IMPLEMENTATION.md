# SI U Explorer Onboarding Implementation Plan

## Overview
Transform Kaia onboarding to support SI U Explorer flow:
- Entry method: Wallet OR Email (user choice)
- SI U name claiming
- Simplified profile for free tier
- Later: Invite to paid programs (separate process)

## New Flow Structure

### Current Flow:
```
ASK_LANGUAGE → ASK_NAME → ASK_EMAIL → ASK_LOCATION → ASK_ROLE → ASK_INTERESTS → ASK_GOALS → ASK_EVENTS → ASK_SOCIALS → ASK_TELEGRAM → ASK_GENDER → ASK_NOTIFICATIONS → COMPLETED
```

### New Flow:
```
ASK_LANGUAGE → ASK_NAME → ASK_ENTRY_METHOD → 
  [If wallet: ASK_WALLET_CONNECTION → ASK_SIU_NAME → ASK_EMAIL (optional)]
  [If email: ASK_EMAIL → ASK_SIU_NAME]
→ ASK_LOCATION → ASK_INTERESTS → ASK_GOALS → ASK_NOTIFICATIONS → COMPLETED
```

**Simplified for Explorer tier:**
- Skip: Roles, Events, Socials, Telegram, Gender (add later for paid programs)

---

## Implementation Changes

### 1. Type Definitions
**File:** `src/plugins/onboarding/types.ts`

**Add new steps:**
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
  // ... rest
```

**Add new profile fields:**
```typescript
export interface UserProfile {
  // ... existing fields
  entryMethod?: string;      // 'wallet' | 'email'
  walletAddress?: string;    // Connected wallet address
  walletType?: string;       // 'metamask' | 'coinbase' | 'walletconnect'
  siuName?: string;          // e.g., "ayoola.siu"
  // ... rest
}
```

---

### 2. Translations
**File:** `src/plugins/onboarding/translations.ts`

**Add to Messages interface:**
```typescript
export interface Messages {
  // ... existing
  ENTRY_METHOD: string;      // NEW
  WALLET_CONNECTION: string; // NEW
  SIU_NAME: string;          // NEW
  SIU_GUIDANCE: string;      // NEW
  // ... rest
}
```

**Add English translations:**
```typescript
en: {
  // ... existing
  ENTRY_METHOD: `How would you like to join SI U Explorer?

1. Connect my wallet (create on-chain identity)
2. Use my email (start with web2, upgrade later)

Reply with the number (for example: 1)`,
  
  WALLET_CONNECTION: `Let's connect your wallet to create your on-chain identity.

Which wallet do you use?
1. MetaMask
2. Coinbase Wallet
3. WalletConnect

Reply with the number, then follow the prompts to connect.`,
  
  SIU_NAME: `Now let's claim your SI U name - this will be your on-chain identity!

What would you like your SI U name to be? (e.g., yourname.siu)

Just type the name without the .siu extension, and I'll add it for you.`,
  
  SIU_GUIDANCE: `Welcome to SI U Explorer! 🎉

Here's what you can do:
- Connect with other members
- Explore Web3 resources
- Join community discussions
- Get invited to premium programs (Grow3dge, SI Her Guide, Well-Being)

Ready to complete your profile?`,
  
  // Update COMPLETION message
  COMPLETION: `Welcome to SI U Explorer! 🎉

You're now part of the SI<3> community. You can:
- Connect with other members
- Explore Web3 resources
- Get invited to premium programs

Here's your profile:`,
  // ... rest
}
```

**Add Spanish, Portuguese, French translations** (same structure)

---

### 3. Telegram Handler
**File:** `src/index.ts`

**Add new step handlers after ASK_NAME:**

```typescript
} else if (state.step === 'ASK_NAME') {
  const name = messageText.trim();
  await updateState('ASK_ENTRY_METHOD', { name });
  responseText = msgs.ENTRY_METHOD;
  console.log('[Telegram Chat ID Capture] 📋 Name saved:', name);
  
} else if (state.step === 'ASK_ENTRY_METHOD') {
  const choice = messageText.trim().toLowerCase();
  if (choice === '1' || choice.includes('wallet')) {
    await updateState('ASK_WALLET_CONNECTION', { entryMethod: 'wallet' });
    responseText = msgs.WALLET_CONNECTION;
    console.log('[Telegram Chat ID Capture] 📋 Entry method: wallet');
  } else if (choice === '2' || choice.includes('email')) {
    await updateState('ASK_EMAIL', { entryMethod: 'email' });
    responseText = msgs.EMAIL;
    console.log('[Telegram Chat ID Capture] 📋 Entry method: email');
  } else {
    responseText = `${msgs.ENTRY_METHOD}\n\n⚠️ Please reply with 1 or 2`;
  }
  
} else if (state.step === 'ASK_WALLET_CONNECTION') {
  // User confirms wallet connected or provides address
  const walletAddress = messageText.trim();
  // Validate wallet address format (0x... or similar)
  if (walletAddress.length < 10) {
    responseText = `${msgs.WALLET_CONNECTION}\n\n⚠️ Please provide a valid wallet address or confirm connection`;
  } else {
    await updateState('ASK_SIU_NAME', { 
      walletAddress,
      walletType: state.profile?.walletType || 'unknown'
    });
    responseText = msgs.SIU_NAME;
    console.log('[Telegram Chat ID Capture] 📋 Wallet connected:', walletAddress.slice(0, 10) + '...');
  }
  
} else if (state.step === 'ASK_SIU_NAME') {
  // Validate and format SI U name
  let siuName = messageText.trim()
    .replace('@', '')
    .replace('.siu', '')
    .toLowerCase();
  
  // Validate: alphanumeric only
  if (!/^[a-z0-9]+$/.test(siuName)) {
    responseText = `${msgs.SIU_NAME}\n\n⚠️ SI U names can only contain letters and numbers (e.g., yourname.siu)`;
  } else {
    siuName = siuName + '.siu';
    const profileUpdate: any = { siuName };
    
    // If wallet entry, email is optional
    if (state.profile?.entryMethod === 'wallet') {
      await updateState('ASK_LOCATION', profileUpdate);
      responseText = `${msgs.SIU_GUIDANCE}\n\n${msgs.LOCATION}`;
    } else {
      // If email entry, go to email next
      await updateState('ASK_EMAIL', profileUpdate);
      responseText = msgs.EMAIL;
    }
    console.log('[Telegram Chat ID Capture] 📋 SI U name claimed:', siuName);
  }
```

**Update ASK_EMAIL handler:**
- After email, if SI U name not set, go to `ASK_SIU_NAME`
- If SI U name already set, go to `ASK_LOCATION`

**Update flow after ASK_GOALS:**
- Skip to `ASK_NOTIFICATIONS` (skip Events, Socials, Telegram, Gender for Explorer tier)

---

### 4. Web API Handler
**File:** `src/services/webChatApi.ts`

**Add same step handlers as Telegram, plus:**

```typescript
} else if (state.step === 'ASK_WALLET_CONNECTION') {
  // Return special flag for web to trigger wallet connection UI
  return {
    success: true,
    response: msgs.WALLET_CONNECTION,
    requiresWalletConnection: true,  // NEW flag
    walletOptions: ['metamask', 'coinbase', 'walletconnect'],
    step: 'ASK_WALLET_CONNECTION'
  };
  
} else if (state.step === 'ASK_SIU_NAME') {
  // Web can validate SI U name availability via API
  const siuName = messageText.trim().replace('@', '').replace('.siu', '').toLowerCase();
  
  if (!/^[a-z0-9]+$/.test(siuName)) {
    responseText = `${msgs.SIU_NAME}\n\n⚠️ SI U names can only contain letters and numbers`;
    return { success: true, response: responseText };
  }
  
  const fullSiuName = siuName + '.siu';
  // TODO: Check SI U name availability via API call
  
  const profileUpdate: any = { siuName: fullSiuName };
  if (state.profile?.entryMethod === 'wallet') {
    await updateState('ASK_LOCATION', profileUpdate);
    responseText = `${msgs.SIU_GUIDANCE}\n\n${msgs.LOCATION}`;
  } else {
    await updateState('ASK_EMAIL', profileUpdate);
    responseText = msgs.EMAIL;
  }
}
```

---

### 5. Profile Display
**File:** `src/plugins/onboarding/utils.ts`

**Update `formatProfileForDisplay` function:**

```typescript
export function formatProfileForDisplay(profile: UserProfile, lang: string = 'en'): string {
  const msgs = getMessages(lang as LanguageCode);
  const platformMsgs = getPlatformMessages(lang as LanguageCode, profile.roles || []);
  
  // Format wallet address (show first 6 and last 4 chars)
  const formatWallet = (addr: string) => {
    if (!addr) return msgs.SUMMARY_NOT_PROVIDED;
    if (addr.length > 10) {
      return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    }
    return addr;
  };
  
  return `${platformMsgs.PROFILE_TITLE}\n\n` +
    `${msgs.SUMMARY_NAME} ${profile.name || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `Entry Method: ${profile.entryMethod || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `Wallet: ${profile.walletAddress ? formatWallet(profile.walletAddress) : msgs.SUMMARY_NOT_PROVIDED}\n` +
    `SI U Name: ${profile.siuName || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_EMAIL} ${profile.email || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_LOCATION} ${profile.location || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_INTERESTS} ${formatArray(profile.interests)}\n` +
    `${msgs.SUMMARY_GOALS} ${formatArray(profile.connectionGoals, true)}\n` +
    `${msgs.SUMMARY_NOTIFICATIONS} ${profile.notifications || msgs.SUMMARY_NOT_PROVIDED}`;
}
```

---

### 6. Helper Functions

**Add SI U name validation helper:**
```typescript
// In src/plugins/onboarding/utils.ts or new file
export function validateSiuName(name: string): { valid: boolean; formatted: string | null; error?: string } {
  // Remove @ and .siu if present
  let cleaned = name.trim()
    .replace('@', '')
    .replace('.siu', '')
    .toLowerCase();
  
  // Validate: alphanumeric only, 3-20 characters
  if (!/^[a-z0-9]+$/.test(cleaned)) {
    return { 
      valid: false, 
      formatted: null, 
      error: 'SI U names can only contain letters and numbers' 
    };
  }
  
  if (cleaned.length < 3) {
    return { 
      valid: false, 
      formatted: null, 
      error: 'SI U name must be at least 3 characters' 
    };
  }
  
  if (cleaned.length > 20) {
    return { 
      valid: false, 
      formatted: null, 
      error: 'SI U name must be 20 characters or less' 
    };
  }
  
  return { 
    valid: true, 
    formatted: cleaned + '.siu' 
  };
}
```

---

## Testing Checklist

### Path 1: Wallet Entry
- [ ] User selects "1" (wallet)
- [ ] Wallet connection prompt shown
- [ ] User provides wallet address
- [ ] SI U name prompt shown
- [ ] User claims SI U name
- [ ] Email is optional (can skip)
- [ ] Profile questions shown
- [ ] Completion message shows wallet + SI U name

### Path 2: Email Entry
- [ ] User selects "2" (email)
- [ ] Email prompt shown
- [ ] User provides email
- [ ] SI U name prompt shown
- [ ] User claims SI U name
- [ ] Profile questions shown
- [ ] Completion message shows email + SI U name

### Validation
- [ ] Invalid SI U names rejected (special chars, too short, too long)
- [ ] Valid SI U names formatted correctly (.siu added)
- [ ] Wallet address validation works
- [ ] Both paths complete successfully

---

## Files to Modify

1. ✅ `src/plugins/onboarding/types.ts` - Add steps & profile fields
2. ✅ `src/plugins/onboarding/translations.ts` - Add 4 new messages × 4 languages
3. ✅ `src/index.ts` - Add 3 new step handlers, update flow order
4. ✅ `src/services/webChatApi.ts` - Add 3 new step handlers, wallet UI flag
5. ✅ `src/plugins/onboarding/utils.ts` - Update profile display, add validation

---

## Estimated Changes

- **Lines added:** ~300
- **Lines modified:** ~100
- **Files changed:** 5
- **New translations:** 16 (4 messages × 4 languages)

---

## Notes

- **Explorer tier is simplified** - Skip roles, events, socials, telegram, gender
- **Email is optional** if user enters via wallet
- **SI U name validation** happens client-side and server-side
- **Wallet connection** in web requires UI integration (separate frontend work)
- **Paid program invites** happen later (separate process, not in this onboarding)

---

## Future Enhancements

- SI U name availability check (API call)
- Wallet signature verification
- Program invitation flow (after Explorer onboarding)
- Upgrade path from Explorer to paid programs





