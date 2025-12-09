# Duplicate Message Problem - Explanation

## The Problem

During the onboarding process, the bot sends **duplicate messages** to users. When a user responds to an onboarding question, they receive the same message twice (or sometimes more) within a few seconds.

### Example
```
User: "winnipeg"
Bot: "Great to meet you, Ayoola! 🌟 Now that we know you're from Winnipeg..."
Bot: "Great to meet you, Ayoola! 🌟 Now that we know you're from Winnipeg..." (duplicate)
```

## When It Happens

- **During active onboarding steps** (ASK_NAME, ASK_LANGUAGE, ASK_LOCATION, etc.)
- **After a user responds** to an onboarding question
- **Not during** the CONFIRMATION or COMPLETED steps
- **Not after** onboarding is finished

## Root Cause

The bot has **two separate code paths** that both send messages:

1. **Action Handlers** (intended path):
   - When a user responds during onboarding, an action handler processes the response
   - The action handler sends the next onboarding question
   - This is the **correct** behavior

2. **LLM Generation** (unintended path):
   - ElizaOS (the framework) also passes the user's message to the LLM
   - The LLM generates a response based on the user's input
   - This response gets sent as a message
   - This creates the **duplicate**

### Why Both Paths Execute

ElizaOS's architecture processes every user message through:
1. **Evaluators** - Determine what should happen
2. **Providers** - Give context to the LLM
3. **LLM** - Generates a response
4. **Actions** - Execute specific behaviors

During onboarding, we want **only** the action handler to respond, but the LLM generation path still runs in parallel, causing duplicates.

## What We've Tried

We've attempted over 20 different approaches to fix this:

### Blocking Strategies
- ✅ Return `null` from the provider during onboarding
- ✅ Throw errors in the provider to stop LLM generation
- ✅ Set `skipLLMResponse` flag in state
- ✅ Block messages at the `createMemory` level
- ✅ Block messages at the `sendMessage` level
- ✅ Track action execution and block LLM responses for 10 seconds after

### Detection Strategies
- ✅ Detect exact duplicate content
- ✅ Block rapid consecutive messages (within 10 seconds)
- ✅ Use metadata flags to mark action-handler messages

### Architecture Changes
- ✅ Synchronous caching for faster onboarding step checks
- ✅ Message locks to prevent concurrent sends
- ✅ Direct Telegram API calls from action handlers (bypassing ElizaOS)

## Current State

**Status**: ⚠️ **Partially Resolved** - Duplicates still occur but less frequently

**Current Implementation**:
- Action handlers send messages directly via Telegram API
- Multiple blocking mechanisms at different levels (provider, createMemory, sendMessage)
- Synchronous cache for fast onboarding step detection
- Extensive logging to diagnose when/why duplicates occur

**Remaining Issues**:
- Duplicates still happen occasionally
- Blocking mechanisms aren't 100% effective
- The LLM generation path is difficult to completely disable in ElizaOS

## Technical Details

### Files Involved
- `src/plugins/onboarding/actions.ts` - Action handlers that send messages
- `src/plugins/onboarding/provider.ts` - Provider that tries to block LLM generation
- `src/plugins/onboarding/evaluator.ts` - Evaluator that tracks onboarding state
- `src/services/llmResponseInterceptor.ts` - Intercepts LLM responses
- `src/services/telegramMessageInterceptor.ts` - Intercepts Telegram messages
- `src/index.ts` - Patches ElizaOS and Telegram client methods

### Key Challenge

ElizaOS doesn't provide a built-in way to completely disable LLM generation for specific message types. We're working around this by:
- Patching internal methods at runtime
- Intercepting message creation and sending
- Using multiple layers of blocking logic

## Potential Solutions (Not Yet Tried)

1. **Fork/Modify ElizaOS** - Add native support for disabling LLM during specific flows
2. **Custom Message Router** - Route onboarding messages directly to actions, bypassing LLM entirely
3. **Separate Bot Instance** - Use a dedicated bot instance for onboarding with LLM disabled
4. **Message Queue** - Queue all messages and deduplicate before sending

## Impact

- **User Experience**: Confusing - users see the same message twice
- **Reliability**: Doesn't break functionality, but looks unprofessional
- **Frequency**: Happens on most onboarding interactions, but not 100% of the time

