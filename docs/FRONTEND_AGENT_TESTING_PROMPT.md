# Frontend Agent Testing Interface - Transformation Prompt

## Overview
Transform your existing frontend test website into a complete agent testing interface that integrates with Kaia's new onboarding flow, wallet connection, SI U name claiming, and full chat functionality.

---

## Core Requirements

### 1. Chat Interface Component
Create a chat widget that:
- **Displays conversation** between user and Kaia
- **Shows typing indicators** when agent is processing
- **Auto-scrolls** to latest message
- **Handles multi-line messages** with proper formatting
- **Shows timestamps** (optional, for testing)
- **Matches SI<3> brand colors** (purple/pink theme)

### 2. API Integration

**Base URL:** `http://localhost:3000` (or your deployed URL)

**Main Chat Endpoint:**
```typescript
POST /api/chat
Headers: {
  'Content-Type': 'application/json',
  'X-API-Key': 'your-api-key' // Optional if API key is configured
}
Body: {
  userId: string,        // Generate unique ID: `web_user_${Date.now()}_${random}`
  message: string,       // User's message
  apiKey?: string        // Optional API key
}
Response: {
  success: boolean,
  response?: string,     // Kaia's message
  userId?: string,       // May change if continuing with existing profile
  primaryUserId?: string, // Original userId if profile linked
  profile?: object,      // Current profile data
  onboardingStatus?: string, // Current step (e.g., 'ASK_ENTRY_METHOD')
  requiresWalletConnection?: boolean, // Show wallet UI
  siuNameClaimed?: string,           // Confirmed SI U name
  walletConnected?: boolean,          // Wallet was connected
  error?: string
}
```

**Helper Endpoints:**
```typescript
// Check SI U name availability
GET /api/siu/name/check?name=yourname
Response: { available: boolean, valid: boolean, formattedName?: string, message?: string }

// Check wallet registration
GET /api/wallet/check?address=0x...
Response: { valid: boolean, registered: boolean, userId?: string, siuName?: string }
```

### 3. State Management

**Track these states:**
```typescript
interface AppState {
  userId: string;                    // Generated on first load
  currentStep: string;               // From onboardingStatus
  messages: Array<{
    role: 'user' | 'agent';
    text: string;
    timestamp: Date;
  }>;
  profile: {
    name?: string;
    email?: string;
    walletAddress?: string;
    siuName?: string;
    entryMethod?: 'wallet' | 'email';
    // ... other fields
  };
  isWaitingForWallet: boolean;       // When requiresWalletConnection = true
  isWaitingForSiuName: boolean;      // When step = ASK_SIU_NAME
  isLoading: boolean;                 // When sending message
}
```

### 4. Wallet Connection Flow

**When `requiresWalletConnection: true` in response:**

1. **Show wallet connection modal/UI**
   - Use Web3Modal, wagmi, or ethers.js
   - Support: MetaMask, Coinbase Wallet, WalletConnect
   - Display connection instructions

2. **After successful connection:**
   ```typescript
   // Get wallet address from provider
   const accounts = await provider.request({ method: 'eth_accounts' });
   const walletAddress = accounts[0];
   
   // Send wallet address to agent
   const response = await fetch('/api/chat', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       userId: state.userId,
       message: walletAddress  // Send address as message
     })
   });
   ```

3. **Handle wallet connection errors:**
   - Invalid format → Show error, allow retry
   - Already registered → Show message, allow email entry
   - Connection failed → Show error, allow retry

### 5. SI U Name Input Flow

**When `onboardingStatus === 'ASK_SIU_NAME'`:**

1. **Show SI U name input form:**
   - Text input with placeholder: "yourname"
   - Real-time validation (alphanumeric, 3-20 chars)
   - "Check Availability" button (optional, calls `/api/siu/name/check`)
   - "Skip" button (sends "Next" message)
   - Display validation errors

2. **On submit:**
   ```typescript
   // Send SI U name to agent
   const response = await fetch('/api/chat', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       userId: state.userId,
       message: siuNameInput  // e.g., "myname" or "myname.siu"
     })
   });
   ```

3. **Handle responses:**
   - `siuNameClaimed` in response → Show success, continue
   - Error message → Show error, allow retry
   - Name taken → Show error, allow new name

### 6. Message Flow

**Send message to agent:**
```typescript
async function sendMessage(userMessage: string) {
  setLoading(true);
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.userId,
        message: userMessage
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Add user message to chat
      addMessage('user', userMessage);
      
      // Add agent response
      if (data.response) {
        addMessage('agent', data.response);
      }
      
      // Update state based on response
      if (data.onboardingStatus) {
        setCurrentStep(data.onboardingStatus);
      }
      
      if (data.profile) {
        updateProfile(data.profile);
      }
      
      // Handle special flags
      if (data.requiresWalletConnection) {
        showWalletConnectionModal();
      }
      
      if (data.siuNameClaimed) {
        showSiuNameSuccess(data.siuNameClaimed);
      }
      
      if (data.walletConnected) {
        showWalletConnectedSuccess();
      }
      
      // Update userId if changed (profile linking)
      if (data.primaryUserId && data.primaryUserId !== state.userId) {
        setUserId(data.primaryUserId);
      }
    } else {
      showError(data.error || 'Failed to send message');
    }
  } catch (error) {
    showError('Network error. Please try again.');
  } finally {
    setLoading(false);
  }
}
```

### 7. UI Components Needed

**1. Chat Widget:**
```typescript
<ChatWidget>
  <MessageList>
    {messages.map(msg => (
      <MessageBubble 
        role={msg.role}
        text={msg.text}
        timestamp={msg.timestamp}
      />
    ))}
  </MessageList>
  <InputArea>
    <TextInput 
      placeholder="Type your message..."
      onSend={sendMessage}
      disabled={isLoading || isWaitingForWallet || isWaitingForSiuName}
    />
    {isLoading && <TypingIndicator />}
  </InputArea>
</ChatWidget>
```

**2. Wallet Connection Modal:**
```typescript
<WalletConnectionModal 
  isOpen={isWaitingForWallet}
  onConnect={handleWalletConnect}
  onClose={() => {/* Allow email entry instead */}}
>
  <h2>Connect Your Wallet</h2>
  <p>Connect your wallet to create your on-chain identity</p>
  <WalletOptions>
    <Button onClick={connectMetaMask}>MetaMask</Button>
    <Button onClick={connectCoinbase}>Coinbase Wallet</Button>
    <Button onClick={connectWalletConnect}>WalletConnect</Button>
  </WalletOptions>
</WalletConnectionModal>
```

**3. SI U Name Input:**
```typescript
<SiuNameInput 
  isOpen={currentStep === 'ASK_SIU_NAME'}
  onSubmit={handleSiuNameSubmit}
  onSkip={() => sendMessage('Next')}
>
  <h2>Claim Your SI U Name</h2>
  <TextInput 
    placeholder="yourname"
    onChange={validateSiuName}
    error={validationError}
  />
  <Button onClick={checkAvailability}>Check Availability</Button>
  <Button onClick={handleSubmit}>Claim Name</Button>
  <Button variant="secondary" onClick={onSkip}>Skip</Button>
</SiuNameInput>
```

**4. Profile Display (Optional, for testing):**
```typescript
<ProfileDisplay profile={state.profile}>
  <h3>Current Profile</h3>
  <p>Name: {profile.name || 'Not set'}</p>
  <p>Email: {profile.email || 'Not set'}</p>
  <p>Wallet: {profile.walletAddress || 'Not set'}</p>
  <p>SI U Name: {profile.siuName || 'Not set'}</p>
  <p>Step: {currentStep}</p>
</ProfileDisplay>
```

### 8. Error Handling

**Handle these scenarios:**
- **Network errors** → Show retry button
- **Invalid input** → Show inline validation errors
- **API errors** → Display error message from response
- **Wallet connection failed** → Allow retry or switch to email
- **SI U name taken** → Show error, allow new name
- **Timeout** → Show timeout message, allow retry

### 9. Testing Features

**Add these for testing:**
- **Step indicator** → Show current onboarding step
- **Profile viewer** → Display current profile data
- **Restart button** → Send "restart" message to reset onboarding
- **Debug panel** → Show API responses, state, errors
- **User ID display** → Show current userId (for debugging)

### 10. Complete Example Flow

```typescript
// 1. Initialize
const userId = `web_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
setUserId(userId);

// 2. Start conversation
sendMessage('Hello'); // Or auto-start with empty message

// 3. Agent responds with ASK_LANGUAGE
// User selects language: sendMessage('1')

// 4. Agent asks for name
// User types name: sendMessage('John')

// 5. Agent asks entry method
// User selects: sendMessage('1') // Wallet

// 6. Response has requiresWalletConnection: true
// Show wallet modal, connect, send address

// 7. Agent asks for SI U name
// Show SI U name input, user enters, submit

// 8. Continue through rest of onboarding...

// 9. On completion, show success message
```

---

## Implementation Checklist

- [ ] Create chat widget component
- [ ] Integrate `/api/chat` endpoint
- [ ] Handle `requiresWalletConnection` flag
- [ ] Implement wallet connection UI (MetaMask, Coinbase, WalletConnect)
- [ ] Handle `ASK_SIU_NAME` step with input form
- [ ] Integrate `/api/siu/name/check` for validation
- [ ] Handle `siuNameClaimed` and `walletConnected` responses
- [ ] Add error handling for all scenarios
- [ ] Add loading states and typing indicators
- [ ] Add profile display for testing
- [ ] Add step indicator
- [ ] Add restart/reset functionality
- [ ] Style to match SI<3> brand
- [ ] Test complete onboarding flow
- [ ] Test wallet connection flow
- [ ] Test SI U name claiming
- [ ] Test error scenarios

---

## Quick Start Template

```typescript
// App.tsx (React example)
import { useState, useEffect } from 'react';

function App() {
  const [userId] = useState(() => `web_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [messages, setMessages] = useState([]);
  const [currentStep, setCurrentStep] = useState('NONE');
  const [profile, setProfile] = useState({});
  const [requiresWallet, setRequiresWallet] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (text: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: text })
      });
      const data = await response.json();
      
      if (data.success) {
        setMessages(prev => [...prev, 
          { role: 'user', text },
          { role: 'agent', text: data.response }
        ]);
        if (data.onboardingStatus) setCurrentStep(data.onboardingStatus);
        if (data.profile) setProfile(data.profile);
        if (data.requiresWalletConnection) setRequiresWallet(true);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <ChatWidget 
        messages={messages}
        onSend={sendMessage}
        isLoading={isLoading}
      />
      {requiresWallet && <WalletModal onConnect={(addr) => sendMessage(addr)} />}
      {currentStep === 'ASK_SIU_NAME' && <SiuNameInput onSubmit={(name) => sendMessage(name)} />}
      <ProfileViewer profile={profile} step={currentStep} />
    </div>
  );
}
```

---

## API Response Examples

**Entry Method Response:**
```json
{
  "success": true,
  "response": "Welcome to SI U! 🎉 How would you like to sign up?\n\n1. Connect Wallet (Recommended)\n2. Continue with Email",
  "onboardingStatus": "ASK_ENTRY_METHOD",
  "profile": { "name": "John" }
}
```

**Wallet Connection Response:**
```json
{
  "success": true,
  "response": "Great! Please connect your wallet...",
  "onboardingStatus": "ASK_WALLET_CONNECTION",
  "requiresWalletConnection": true
}
```

**SI U Name Claimed Response:**
```json
{
  "success": true,
  "response": "🎉 Congrats! You've claimed myname.siu!\n\nWhat's your email address?",
  "onboardingStatus": "ASK_EMAIL",
  "siuNameClaimed": "myname.siu",
  "walletConnected": true,
  "profile": { "walletAddress": "0x1234...", "siuName": "myname.siu" }
}
```

---

## Notes

- **User ID:** Generate once on page load, persist in localStorage
- **State Sync:** Poll `/api/onboarding/current-step` every 2-3 seconds (optional)
- **Error Recovery:** Always allow user to retry or restart
- **Mobile:** Ensure chat widget is mobile-responsive
- **Styling:** Match SI<3> purple/pink theme, use modern UI components

---

## Testing Scenarios

1. **Complete Wallet Flow:** Language → Name → Wallet → SI U Name → Email → Complete
2. **Complete Email Flow:** Language → Name → Email → SI U Name → Complete
3. **Wallet Already Registered:** Should show error, allow email entry
4. **SI U Name Taken:** Should show error, allow new name
5. **Invalid Inputs:** Should show validation errors
6. **Network Errors:** Should show retry option
7. **Profile Linking:** If email exists, should link to existing profile

---

This prompt provides everything needed to transform your test website into a complete agent testing interface! 🚀

