# Web Onboarding Flow - Complete Explanation

## Overview
The web onboarding is a **conversational flow** where Kaia (the agent) guides users through a series of questions via chat. Users respond in the chat, and Kaia processes their answers and moves to the next step.

---

## Complete Flow Sequence

### **Step 1: Language Selection** (`ASK_LANGUAGE`)
**Kaia asks:**
```
What's your preferred language?

1. English
2. Spanish
3. Portuguese
4. French

Reply with the number (for example: 1)
```

**User responds:** `1` (or "english", "2", etc.)

**What happens:**
- Kaia saves the language choice
- Moves to next step: `ASK_NAME`

---

### **Step 2: Name** (`ASK_NAME`)
**Kaia asks:**
```
Hello! I'm Agent Kaia, created by SI<3>...

Let's get started! What's your preferred name?
```

**User responds:** `John` (or any name)

**What happens:**
- Kaia saves the name
- Moves to next step: `ASK_ENTRY_METHOD`

---

### **Step 3: Entry Method** (`ASK_ENTRY_METHOD`) ⭐ NEW
**Kaia asks:**
```
Welcome to SI U! 🎉 How would you like to sign up?

1. Connect Wallet (Recommended)
2. Continue with Email

Reply with the number (for example: 1)
```

**User responds:** `1` (wallet) or `2` (email)

**What happens:**
- **If wallet (1):** Moves to `ASK_WALLET_CONNECTION`
- **If email (2):** Moves to `ASK_EMAIL`

**Special Response Flag:**
- If user chooses wallet, response includes `requiresWalletConnection: true`
- Frontend should show wallet connection UI

---

### **Step 4A: Wallet Connection** (`ASK_WALLET_CONNECTION`) ⭐ NEW
**Kaia asks:**
```
Great! Please connect your wallet to continue.

Your wallet address will be securely linked to your SI U profile...
[The frontend will display wallet connection options]
```

**What happens:**
- Frontend shows wallet connection modal (MetaMask, Coinbase, etc.)
- User connects wallet
- Frontend sends wallet address to agent: `0x1234...5678`

**Agent validates:**
- ✅ Format: Must be `0x` + 40 hex characters
- ✅ Not already registered (checks database)
- ✅ If valid → Moves to `ASK_SIU_NAME`
- ❌ If invalid → Shows error, stays on this step
- ❌ If already registered → Shows error, goes back to `ASK_ENTRY_METHOD`

**Response includes:**
- `walletConnected: true` when successful
- `onboardingStatus: 'ASK_SIU_NAME'`

---

### **Step 4B: Email Entry** (if user chose email)
**Kaia asks:**
```
To help us connect your profile with your SI<3> Her and/or Grow3dge account, please share the email address you registered with.

What's your email address?
```

**User responds:** `user@example.com`

**What happens:**
- Validates email format
- Checks if email exists in:
  - SI<3> database (for platform detection)
  - Kaia cache (for existing profiles)
- **If email exists:** Moves to `ASK_PROFILE_CHOICE`
- **If new email:** Moves to `ASK_LOCATION`

---

### **Step 5: SI U Name** (`ASK_SIU_NAME`) ⭐ NEW
**Kaia asks:**
```
Now let's claim your SI U name! 🏷️

Your SI U name is your unique identity across the SI<3> ecosystem (e.g., yourname.siu).

What SI U name would you like to claim?

Rules:
• 3-20 characters
• Letters and numbers only
• Not case sensitive

Example: If you type "myname", you'll get myname.siu
```

**User responds:** `myname` (or `myname.siu` - agent auto-adds `.siu`)

**What happens:**
- Validates format (alphanumeric, 3-20 chars)
- Checks availability in database
- **If available:** Claims name, moves to `ASK_EMAIL`
- **If taken:** Shows error, asks for different name
- **If invalid:** Shows validation error

**Response includes:**
- `siuNameClaimed: "myname.siu"` when successful
- `onboardingStatus: 'ASK_EMAIL'`

**User can skip:** Type `Next` to skip SI U name

---

### **Step 6: Email** (`ASK_EMAIL`)
**Kaia asks:**
```
What's your email address?
```

**User responds:** `user@example.com`

**What happens:**
- Validates email format
- Checks for existing profile
- **If exists:** Moves to `ASK_PROFILE_CHOICE`
- **If new:** Moves to `ASK_LOCATION`

---

### **Step 7: Profile Choice** (`ASK_PROFILE_CHOICE`) - Only if email exists
**Kaia asks:**
```
We found an existing Agent Kaia profile connected to this email address.

Would you like to:

1. Continue with your existing profile
2. Create a new profile

Reply with the number (for example: 1)
```

**User responds:** `1` or `2`

**What happens:**
- **If 1:** Links to existing profile, goes to `COMPLETED`
- **If 2:** Creates new profile, goes to `ASK_LOCATION`

---

### **Step 8: Location** (`ASK_LOCATION`)
**Kaia asks:**
```
What's your location (city and country)? 📍 (optional)

To move on to the next question, type 'Next'
```

**User responds:** `New York, USA` or `Next`

**What happens:**
- Saves location (or undefined if skipped)
- Moves to `ASK_ROLE`

---

### **Step 9: Professional Roles** (`ASK_ROLE`)
**Kaia asks:**
```
To be able to match you with members and opportunities, can you tell me a bit about yourself by selecting the options that best describe you?

1. Founder/Builder
2. Marketing/BD/Partnerships
3. DAO Council Member/Delegate
4. Community Leader
5. Investor/Grant Program Operator
6. Early Web3 Explorer
7. Media
8. Artist
9. Developer
10. Other

Reply with the number (for example: 1, 4). If you have a role that is not listed, type that as text (for example: 1,4 and xx)
```

**User responds:** `1, 4` or `1,4 and Designer`

**What happens:**
- Parses numbers and text
- Maps numbers to role names
- Saves roles array
- Moves to `ASK_INTERESTS`

---

### **Step 10: Interests** (`ASK_INTERESTS`)
**Kaia asks:**
```
As I am getting to know you better, can you please share what you are excited to explore?

1. Web3 Growth Marketing
2. Sales, BD & Partnerships
3. Education 3.0
4. AI
5. Cybersecurity
6. DAO's
7. Tokenomics
8. Fundraising
9. DeepTech

Reply with the number (for example: 2,3). If you have a topic that is not listed, type that as text (for example: 2,3 and DevRel)
```

**User responds:** `2, 3` or `2,3 and Blockchain`

**What happens:**
- Parses and maps interests
- Saves interests array
- Moves to `ASK_CONNECTION_GOALS`

---

### **Step 11: Connection Goals** (`ASK_CONNECTION_GOALS`)
**Kaia asks:**
```
I'd love to help you find the right connections - what are you looking for? 🤝

1. Startups to invest in
2. Investors/grant programs
3. Growth tools, strategies, and/or support
4. Sales/BD tools, strategies and/or support
5. Communities and/or DAO's to join
6. New job opportunities

Reply with the number (for example: 3, 4). If you have a connection type that is not listed, type that as text (for example 3,4 and Cybersecurity).
```

**User responds:** `3, 4` or `3,4 and Mentorship`

**What happens:**
- Parses and maps goals
- Saves connectionGoals array
- Moves to `ASK_EVENTS`

---

### **Step 12: Events** (`ASK_EVENTS`)
**Kaia asks:**
```
I am also able to match you with other SI<3> members that are attending the same events and conferences.

Can you share any events that you will be attending coming up (event name, date, and location)? (optional)

To move on to the next question, type 'Next'
```

**User responds:** `ETH Denver 2024, March 1-5, Denver` or `Next`

**What happens:**
- Saves events array (or undefined if skipped)
- Moves to `ASK_SOCIALS`

---

### **Step 13: Social Links** (`ASK_SOCIALS`)
**Kaia asks:**
```
Can you share your digital links and/or social media profiles so we can share those with your matches? (optional)

To move on to the next question, type 'Next'
```

**User responds:** `twitter.com/username, linkedin.com/in/username` or `Next`

**What happens:**
- Saves socials array (or undefined if skipped)
- Moves to `ASK_TELEGRAM_HANDLE`

---

### **Step 14: Telegram Handle** (`ASK_TELEGRAM_HANDLE`)
**Kaia asks:**
```
What's your Telegram handle so members that you match with can reach you? (e.g., @username)
```

**User responds:** `@username` or `username` or `Next`

**What happens:**
- Removes `@` if present
- Saves telegramHandle (or undefined if skipped)
- Moves to `ASK_GENDER`

---

### **Step 15: Gender & Diversity Research** (`ASK_GENDER`)
**Kaia asks:**
```
We are an ecosystem that values the inclusion of under-represented groups in Web3...

If you would like to be (anonymously) included within our research, please say Yes, Diversity and we will follow up with you soon...

To move on to the next question, type 'Next'
```

**User responds:** 
- Gender: `1` (Female), `2` (Male), `3` (Non-binary), `4` (Prefer not to say)
- Diversity: `Yes, Diversity` (if interested) or `Next`

**What happens:**
- Saves gender
- If user says "Yes, Diversity", tracks in database
- Moves to `ASK_NOTIFICATIONS`

---

### **Step 16: Notifications** (`ASK_NOTIFICATIONS`)
**Kaia asks:**
```
One last thing…would you be interested in receiving notifications for project and mission collaboration opportunities initiated by SI<3> and its ecosystem partners?

1. Yes!
2. No, thanks
3. Not sure yet, check in with me another time

Please reply with the number (for example: 1)
```

**User responds:** `1`, `2`, or `3`

**What happens:**
- Saves notifications preference
- **Moves directly to `COMPLETED`** (no confirmation step for Explorer tier)
- **Saves profile to SI U database** ✅
- Shows completion message with profile summary

---

### **Step 17: Completed** (`COMPLETED`)
**Kaia responds:**
```
Thank you so much for onboarding! 

💜 Your Grow3dge Profile:

Name: John
Wallet: 0x1234...5678
SI U Name: myname.siu
Location: New York, USA
Email: user@example.com
Roles: Founder/Builder, Community Leader
Interests: Sales, BD & Partnerships, Education 3.0
Goals: Growth tools, strategies, and/or support, Sales/BD tools...
Events: ETH Denver 2024
Socials: twitter.com/username
Telegram: @username
Diversity: Not provided
Notifications: Yes

✅ Onboarding: Completed

To update any field, say "update" or "update [field name]".
```

**What happens:**
- Profile is saved to SI U MongoDB database
- User can now use commands like:
  - `"find me a match"` - Get matched with other users
  - `"my profile"` - View profile
  - `"update"` - Edit profile fields
  - `"change language"` - Switch language

---

## Two Main Paths

### **Path A: Wallet Entry** (Recommended)
```
Language → Name → Entry Method (1) → Wallet Connection → SI U Name → Email → Location → Roles → Interests → Goals → Events → Socials → Telegram → Gender → Notifications → Completed
```

### **Path B: Email Entry**
```
Language → Name → Entry Method (2) → Email → [Profile Choice if exists] → Location → Roles → Interests → Goals → Events → Socials → Telegram → Gender → Notifications → Completed
```

**Note:** SI U name can be claimed after email entry too, but it's optional.

---

## Special Features

### **1. Wallet Connection**
- Frontend handles wallet connection (MetaMask, Coinbase, WalletConnect)
- Frontend sends wallet address to agent
- Agent validates and checks for duplicates
- If valid → Proceeds to SI U name

### **2. SI U Name Claiming**
- User types name (e.g., `myname`)
- Agent validates format (alphanumeric, 3-20 chars)
- Agent checks availability in database
- If available → Claims it (adds `.siu` suffix)
- If taken → Shows error, asks for new name
- Can be skipped with `Next`

### **3. Profile Linking**
- If email exists in Kaia database
- Agent asks: Continue existing or create new?
- If continue → Links web userId to original userId
- Profile data is preserved

### **4. Platform Detection**
- Agent checks SI<3> database for user roles
- If user has `partner` role → Shows Grow3dge-specific questions
- If user has `team` role → Shows SI Her-specific questions
- If both or neither → Shows generic SI<3> questions

### **5. Database Saving**
- On completion, profile is saved to:
  - **Cache** (for immediate access)
  - **SI U MongoDB database** (`test-si3Users` collection)
- All fields are mapped correctly
- New fields created if needed

---

## Response Format

Every chat response includes:

```typescript
{
  success: boolean,
  response: string,              // Kaia's message
  userId: string,                // Current user ID
  primaryUserId?: string,        // If profile linked
  profile: object,               // Current profile data
  onboardingStatus: string,      // Current step
  requiresWalletConnection?: boolean,  // Show wallet UI
  siuNameClaimed?: string,       // Confirmed SI U name
  walletConnected?: boolean,     // Wallet was connected
  error?: string                 // Error message
}
```

---

## User Input Formats

### **Numbered Lists:**
- Single: `1`
- Multiple: `1, 4`
- With text: `1, 4 and Designer`

### **Skipping Optional Questions:**
- Type `Next` or `skip`

### **Email Format:**
- Must be valid: `user@example.com`

### **Wallet Address:**
- Must be: `0x` + 40 hex characters
- Example: `0x1234567890123456789012345678901234567890`

### **SI U Name:**
- Format: `myname` (agent adds `.siu`)
- Or: `myname.siu` (agent removes `.siu` and re-adds)
- Rules: 3-20 chars, alphanumeric only

---

## Error Handling

### **Invalid Input:**
- Agent shows error message
- Stays on same step
- Asks user to try again

### **Wallet Already Registered:**
- Shows error: "This wallet address is already registered..."
- Goes back to entry method choice
- User can try different wallet or use email

### **SI U Name Taken:**
- Shows error: "Sorry, myname.siu is already taken..."
- Stays on SI U name step
- User can try different name

### **Email Already Exists:**
- Shows profile choice prompt
- User can continue existing or create new

### **Network Errors:**
- Agent continues with cached data
- Database save happens in background
- User experience is not blocked

---

## After Onboarding

Once completed, users can:

1. **Find Matches:** `"find me a match"` or `"connect me"`
2. **View Profile:** `"my profile"` or `"profile"`
3. **Update Profile:** `"update"` or `"update [field]"`
4. **Change Language:** `"change language to Spanish"`
5. **Get Help:** `"help"`
6. **Request Features:** `"I would like..."` or `"can you..."`

---

## Summary

The web onboarding is a **conversational, step-by-step process** where:
- ✅ Kaia asks questions in chat
- ✅ User responds in chat
- ✅ Kaia processes and moves to next step
- ✅ Frontend shows special UI for wallet/SI U name
- ✅ All data is saved to SI U database on completion
- ✅ User can update profile anytime after completion

The flow is **flexible** - users can skip optional questions, and the agent handles errors gracefully while maintaining the conversation flow.

