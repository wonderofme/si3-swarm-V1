# Wallet Integration Guide

## Overview
This guide explains how to integrate wallet connection into the Kaia onboarding flow. The frontend handles wallet connection, and the backend receives the wallet address via API.

---

## Architecture

```
Frontend (Web UI)
    ↓
[User clicks "Connect Wallet"]
    ↓
Wallet SDK (wagmi/web3modal) connects to MetaMask/Coinbase/etc.
    ↓
Frontend receives wallet address: "0x1234..."
    ↓
POST /api/onboarding/wallet-connected
    ↓
Backend validates & saves wallet address
    ↓
Agent continues to ASK_SIU_NAME step
```

---

## Part 1: Frontend Implementation

### Option A: Using wagmi + viem (Recommended for React)

**Install dependencies:**
```bash
npm install wagmi viem @tanstack/react-query
# or
yarn add wagmi viem @tanstack/react-query
```

**Setup wagmi config:**
```typescript
// src/lib/wagmi.ts
import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors'

export const config = createConfig({
  chains: [mainnet, sepolia], // Add your chains
  connectors: [
    injected(), // MetaMask
    walletConnect({ projectId: 'YOUR_WALLETCONNECT_PROJECT_ID' }),
    coinbaseWallet({ appName: 'SI<3>' })
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
})
```

**React component:**
```typescript
// src/components/WalletConnection.tsx
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useState, useEffect } from 'react'

interface WalletConnectionProps {
  userId: string
  onWalletConnected: (address: string) => void
}

export function WalletConnection({ userId, onWalletConnected }: WalletConnectionProps) {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // When wallet connects, send to backend
  useEffect(() => {
    if (isConnected && address) {
      handleWalletConnected(address)
    }
  }, [isConnected, address])

  const handleWalletConnected = async (walletAddress: string) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/onboarding/wallet-connected', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '', // If using API key
        },
        body: JSON.stringify({
          userId,
          walletAddress,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Notify parent component
        onWalletConnected(walletAddress)
        // Agent will automatically send SI U name question
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Wallet connection error:', error)
      alert('Failed to connect wallet. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isConnected) {
    return (
      <div>
        <p>Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    )
  }

  return (
    <div>
      <h3>Connect Your Wallet</h3>
      {connectors.map((connector) => (
        <button
          key={connector.id}
          onClick={() => connect({ connector })}
          disabled={isPending || isSubmitting}
        >
          {isPending ? 'Connecting...' : `Connect ${connector.name}`}
        </button>
      ))}
    </div>
  )
}
```

### Option B: Using Web3Modal (Simpler, works with any framework)

**Install:**
```bash
npm install @web3modal/wagmi wagmi viem
```

**Setup:**
```typescript
// src/lib/web3modal.ts
import { createWeb3Modal } from '@web3modal/wagmi/react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './wagmi'

const queryClient = new QueryClient()

createWeb3Modal({
  wagmiConfig: config,
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID',
  enableAnalytics: true,
})

export function Web3Provider({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

**Usage:**
```typescript
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount } from 'wagmi'

function OnboardingPage() {
  const { open } = useWeb3Modal()
  const { address, isConnected } = useAccount()

  const handleConnect = async () => {
    await open()
    // After connection, address will be available
    if (isConnected && address) {
      await sendWalletToBackend(address)
    }
  }

  return <button onClick={handleConnect}>Connect Wallet</button>
}
```

### Option C: Direct ethers.js (No React, vanilla JS)

```typescript
// src/lib/wallet.ts
import { ethers } from 'ethers'

export async function connectWallet(): Promise<string | null> {
  if (typeof window.ethereum !== 'undefined') {
    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })
      
      if (accounts.length > 0) {
        return accounts[0] // Return wallet address
      }
    } catch (error) {
      console.error('Wallet connection error:', error)
      return null
    }
  } else {
    alert('Please install MetaMask or another Web3 wallet')
    return null
  }
}

export async function sendWalletToBackend(
  userId: string,
  walletAddress: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/onboarding/wallet-connected', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        walletAddress,
      }),
    })

    const data = await response.json()
    return data.success
  } catch (error) {
    console.error('Error sending wallet to backend:', error)
    return false
  }
}
```

---

## Part 2: Backend API Endpoint

### Add Wallet Connection Endpoint

**File:** `src/index.ts` (add after `/api/chat` route)

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
    
    // Validate wallet address format (Ethereum: 0x + 40 hex chars)
    if (!/^0x[a-fA-F0-9]{40}$/i.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format'
      });
    }
    
    // Process wallet connection through webChatApi
    // This will update onboarding state and trigger next step
    const result = await processWebChatMessage(
      kaiaRuntime,
      userId,
      `WALLET_CONNECTED:${walletAddress}` // Special message format
    );
    
    if (result.success) {
      return res.json({
        success: true,
        walletAddress,
        nextStep: 'ASK_SIU_NAME',
        message: result.response
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

### Alternative: Direct State Update (More Control)

**File:** `src/services/webChatApi.ts` (add new function)

```typescript
/**
 * Handle wallet connection directly (bypasses chat message)
 */
export async function handleWalletConnected(
  runtime: AgentRuntime,
  userId: string,
  walletAddress: string
): Promise<ChatResponse> {
  console.log(`[Wallet Connection] Processing wallet for user ${userId}: ${walletAddress.slice(0, 10)}...`);
  
  // Validate wallet address format
  if (!/^0x[a-fA-F0-9]{40}$/i.test(walletAddress)) {
    return {
      success: false,
      error: 'Invalid wallet address format. Must be 0x followed by 40 hexadecimal characters.'
    };
  }
  
  try {
    // Get current onboarding state
    let state: { step: string, profile: any } = { step: 'NONE', profile: {} };
    try {
      const cached = await runtime.cacheManager.get(`onboarding_${userId}`);
      if (cached && typeof cached === 'object') {
        state = cached as { step: string, profile: any };
      }
    } catch (cacheError) {
      console.log('[Wallet Connection] Could not get state from cache:', cacheError);
    }
    
    // Verify we're at the right step
    if (state.step !== 'ASK_WALLET_CONNECTION') {
      return {
        success: false,
        error: `Wallet connection not expected at step: ${state.step}. Current step should be ASK_WALLET_CONNECTION.`
      };
    }
    
    // Update state with wallet address and move to SI U name step
    const { updateOnboardingStep } = await import('../plugins/onboarding/utils.js');
    
    await updateOnboardingStep(
      runtime,
      userId,
      null, // roomId (not needed for web)
      'ASK_SIU_NAME',
      {
        ...state.profile,
        walletAddress: walletAddress,
        entryMethod: 'wallet'
      }
    );
    
    // Get SI U name question message
    const msgs = await getMessages(state.profile.language || 'en');
    
    return {
      success: true,
      response: msgs.SIU_NAME || 'Perfect! Now let\'s claim your SI U name. What would you like your SI U name to be? (e.g., yourname.siu)',
      userId,
      profile: { ...state.profile, walletAddress, entryMethod: 'wallet' },
      onboardingStatus: 'ASK_SIU_NAME'
    };
    
  } catch (error: any) {
    console.error('[Wallet Connection] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to process wallet connection'
    };
  }
}
```

**Then update the endpoint:**
```typescript
// In src/index.ts
app.post('/api/onboarding/wallet-connected', async (req, res) => {
  // ... validation code ...
  
  const { handleWalletConnected } = await import('./services/webChatApi.js');
  const result = await handleWalletConnected(kaiaRuntime, userId, walletAddress);
  
  if (result.success) {
    return res.json(result);
  } else {
    return res.status(400).json(result);
  }
});
```

---

## Part 3: Update Onboarding Flow

### Update webChatApi.ts to Handle Wallet Connection Step

**File:** `src/services/webChatApi.ts`

Add handler for `ASK_WALLET_CONNECTION` step:

```typescript
// In processWebChatMessage function, add after ASK_ENTRY_METHOD handler:

} else if (state.step === 'ASK_WALLET_CONNECTION') {
  // Check if this is a wallet address from frontend
  if (messageText.startsWith('WALLET_CONNECTED:')) {
    const walletAddress = messageText.replace('WALLET_CONNECTED:', '').trim();
    
    // Validate format
    if (!/^0x[a-fA-F0-9]{40}$/i.test(walletAddress)) {
      responseText = 'Invalid wallet address format. Please try connecting again.';
    } else {
      // Update state and move to SI U name
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
}
```

### Update Provider to Show Wallet Connection Message

**File:** `src/plugins/onboarding/provider.ts`

```typescript
// ASK_WALLET_CONNECTION step
if (step === 'ASK_WALLET_CONNECTION') {
  return `[ONBOARDING STEP: ASK_WALLET_CONNECTION - Send this EXACT message word-for-word:

${msgs.WALLET_CONNECTION}

The frontend will handle wallet connection. Wait for wallet address confirmation from the frontend.]`;
}
```

---

## Part 4: Frontend-Backend Communication Flow

### Complete Flow Example

```typescript
// 1. User selects "Connect Wallet" in entry method
// Agent sends: "Great! Let's connect your wallet..."

// 2. Frontend shows wallet connection modal
function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState('ASK_ENTRY_METHOD')
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  
  // Poll agent for current step
  useEffect(() => {
    const pollStep = async () => {
      const response = await fetch(`/api/onboarding/current-step?userId=${userId}`)
      const { step } = await response.json()
      setCurrentStep(step)
    }
    const interval = setInterval(pollStep, 2000)
    return () => clearInterval(interval)
  }, [])
  
  // Show wallet modal when step is ASK_WALLET_CONNECTION
  if (currentStep === 'ASK_WALLET_CONNECTION' && !walletAddress) {
    return (
      <WalletConnectionModal
        onConnect={async (address) => {
          // Send to backend
          const response = await fetch('/api/onboarding/wallet-connected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, walletAddress: address })
          })
          
          if (response.ok) {
            setWalletAddress(address)
            // Agent will automatically send SI U name question
          }
        }}
      />
    )
  }
  
  // Show SI U name input when step is ASK_SIU_NAME
  if (currentStep === 'ASK_SIU_NAME') {
    return <SiuNameInput userId={userId} />
  }
  
  // Show chat widget for other steps
  return <KaiaChatWidget userId={userId} />
}
```

---

## Part 5: Security Considerations

### 1. Wallet Address Validation
- ✅ Format validation: `0x` + 40 hex characters
- ✅ Checksum validation (optional but recommended)
- ✅ Length validation

### 2. Rate Limiting
```typescript
// Add rate limiting to prevent abuse
import rateLimit from 'express-rate-limit'

const walletConnectionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many wallet connection attempts. Please try again later.'
})

app.post('/api/onboarding/wallet-connected', walletConnectionLimiter, async (req, res) => {
  // ... handler code ...
})
```

### 3. Signature Verification (Optional, for extra security)
```typescript
// Verify wallet owns the address by requesting a signature
import { verifyMessage } from 'viem'

const message = `SI<3> Onboarding: ${userId}`
const signature = await wallet.signMessage(message)

// Verify signature on backend
const isValid = await verifyMessage({
  address: walletAddress,
  message,
  signature
})
```

### 4. Duplicate Wallet Check
```typescript
// Check if wallet is already connected to another account
async function checkDuplicateWallet(walletAddress: string): Promise<boolean> {
  // Query database for existing wallet
  const existing = await db.query(
    'SELECT user_id FROM user_profiles WHERE wallet_address = $1',
    [walletAddress]
  )
  return existing.rows.length > 0
}
```

---

## Part 6: Error Handling

### Frontend Error Handling
```typescript
async function connectWallet() {
  try {
    // Connect wallet
    const address = await connectWalletSDK()
    
    // Send to backend
    const response = await fetch('/api/onboarding/wallet-connected', {
      method: 'POST',
      body: JSON.stringify({ userId, walletAddress: address })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Wallet connection failed')
    }
    
    return await response.json()
  } catch (error) {
    if (error.code === 4001) {
      // User rejected connection
      alert('Wallet connection cancelled')
    } else if (error.code === -32002) {
      // Already processing
      alert('Wallet connection already in progress')
    } else {
      alert(`Error: ${error.message}`)
    }
    throw error
  }
}
```

### Backend Error Handling
```typescript
// In handleWalletConnected function
try {
  // ... validation and processing ...
} catch (error) {
  console.error('[Wallet Connection] Error:', error)
  
  // Return user-friendly error
  return {
    success: false,
    error: 'Failed to connect wallet. Please try again or contact support.'
  }
}
```

---

## Testing Checklist

- [ ] Frontend can connect MetaMask
- [ ] Frontend can connect Coinbase Wallet
- [ ] Frontend can connect WalletConnect
- [ ] Wallet address is validated on backend
- [ ] Invalid addresses are rejected
- [ ] State updates correctly after connection
- [ ] Agent sends SI U name question after connection
- [ ] Error messages are user-friendly
- [ ] Rate limiting works
- [ ] Duplicate wallet check works (if implemented)

---

## Next Steps

1. **Choose wallet SDK**: wagmi (React) or ethers.js (vanilla)
2. **Implement frontend component**: Wallet connection modal/button
3. **Add backend endpoint**: `/api/onboarding/wallet-connected`
4. **Update onboarding flow**: Add `ASK_WALLET_CONNECTION` handler
5. **Test end-to-end**: Connect wallet → SI U name → Continue onboarding
6. **Add error handling**: User-friendly error messages
7. **Add security**: Rate limiting, validation, duplicate checks

---

## Questions?

- **Which wallet SDK to use?** → wagmi for React, ethers.js for vanilla JS
- **Do we need signature verification?** → Optional, adds security but complexity
- **What chains to support?** → Start with Ethereum mainnet, add others later
- **How to handle wallet disconnection?** → User can reconnect, state persists



