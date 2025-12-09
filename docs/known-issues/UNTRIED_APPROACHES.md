# Untried Approaches to Fix Duplicate Messages

## What We've Tried (Summary)
1. ✅ Provider returning "DO NOT RESPOND" instructions
2. ✅ Provider returning null
3. ✅ Action execution tracking and blocking (10s window)
4. ✅ Exact duplicate content detection
5. ✅ Rapid consecutive message blocking (10s window)
6. ✅ Metadata flags (fromActionHandler: true)
7. ✅ Timing windows (1s, 2s, 5s, 10s)
8. ✅ sendMessage patcher blocking
9. ✅ createMemory interceptor blocking
10. ✅ suppressInitialMessage flag (set but may not be working)
11. ✅ Blocking LLM responses after action execution
12. ✅ Action handler execution tracking to prevent duplicates
13. ✅ Metadata tunneling via registry (v183 - reverted)
14. ✅ Force-execution of actions (v185 - reverted)
15. ✅ Enhanced provider JSON format instructions (v183 - reverted)
16. ✅ Block LLM responses at Telegram API level during onboarding (v191)
17. ✅ Global Message Lock - acquire/release during action execution (v192)
18. ✅ Action handler sends directly via Telegram API (v186-v192)
19. ✅ Action handler creates memory with empty text (v186-v192)
20. ✅ v194: #1.3 Throw Error in Provider - FAILED (blocked action handler execution)
21. ✅ v195: #3.3 Make Action Silent (No Callback) - FAILED (still duplicates)
22. ✅ v196: Synchronous onboarding step cache - FAILED (still duplicates)
23. ✅ v197: Enhanced sendMessage patcher with cache - FAILED (still duplicates)
24. 🔄 v198: Diagnostic logging for message reception - IN PROGRESS

## What We HAVEN'T Tried

### Category 1: Completely Disable LLM During Onboarding

**1.1: Remove Provider During Onboarding**
- **Description**: Don't register the provider at all during onboarding steps
- **Implementation**: Conditionally register/unregister provider based on onboarding state
- **Pros**: LLM never gets called, no chance of duplicate
- **Cons**: Need to handle registration dynamically
- **Files**: `src/index.ts` (where providers are registered)

**1.2: Use Evaluator to Prevent LLM Generation** ✅ TRIED (v199)
- **Description**: Create a `shouldRespond` evaluator that returns `false` during onboarding
- **Implementation**: Evaluator sets `skipLLMResponse: true` in state during onboarding, provider checks this flag
- **Pros**: Uses ElizaOS's built-in mechanism, evaluator runs before provider
- **Cons**: Need to verify ElizaOS respects this flag
- **Files**: `src/plugins/onboarding/evaluator.ts`, `src/plugins/onboarding/provider.ts`
- **Status**: IN PROGRESS - Testing

**1.3: Throw Error in Provider to Stop LLM** ✅ TRIED (v194)
- **Description**: Make provider throw an error during onboarding to prevent LLM call
- **Implementation**: `throw new Error("Onboarding in progress")` in provider
- **Pros**: Simple, might stop LLM generation
- **Cons**: Could break error handling, might cause crashes
- **Files**: `src/plugins/onboarding/provider.ts`
- **Status**: FAILED - Error blocked action handler execution, preventing all messages

### Category 2: Patch ElizaOS Core Methods

**2.1: Patch runtime.processMessage**
- **Description**: Intercept the main message processing method
- **Implementation**: Patch `runtime.processMessage` to skip LLM during onboarding
- **Pros**: Catches all message processing
- **Cons**: Method might not exist or be accessible
- **Files**: `src/services/llmResponseInterceptor.ts` (we tried but processMessage wasn't found)
- **Note**: We saw `telegramRestartHandler.ts` tries to patch this but it's not available

**2.2: Patch runtime.generateMessageResponse**
- **Description**: Intercept the LLM generation method directly
- **Implementation**: Find and patch `generateMessageResponse` or similar
- **Pros**: Directly prevents LLM calls
- **Cons**: Need to find the exact method name
- **Files**: Need to search ElizaOS core

**2.3: Patch runtime.completion.generateText**
- **Description**: Patch the completion service's generateText method
- **Implementation**: `runtime.completion.generateText = async () => { return { text: '', action: 'CONTINUE_ONBOARDING' } }`
- **Pros**: Directly blocks LLM generation
- **Cons**: We tried this but `runtime.completion` doesn't exist
- **Files**: `src/services/llmResponseInterceptor.ts` (we tried, method not found)

**2.4: Patch runtime.useModel or runtime.model**
- **Description**: Intercept the model usage method
- **Implementation**: Patch `runtime.useModel` or `runtime.model.generate`
- **Pros**: Catches all model calls
- **Cons**: Need to find the exact method
- **Files**: Need to search runtime structure

### Category 3: Modify Action Structure

**3.1: Make Action Return Empty Response Immediately**
- **Description**: Action handler returns empty text immediately, before callback
- **Implementation**: Action handler returns `{ text: '', action: 'CONTINUE_ONBOARDING' }`
- **Pros**: Might prevent LLM from generating
- **Cons**: Need to verify action return value is used
- **Files**: `src/plugins/onboarding/actions.ts`

**3.2: Use IGNORE Action Pattern**
- **Description**: Force LLM to select IGNORE action during onboarding
- **Implementation**: Provider instructs LLM to use IGNORE action
- **Pros**: Uses built-in ElizaOS pattern
- **Cons**: IGNORE might prevent other actions too
- **Files**: `src/plugins/onboarding/provider.ts`

**3.3: Make Action Silent (No Callback)** ✅ TRIED (v195)
- **Description**: Action handler doesn't use callback, sends directly via Telegram API only
- **Implementation**: Remove all `safeCallback` calls, send directly via Telegram
- **Pros**: Bypasses ElizaOS message flow entirely
- **Cons**: Loses integration with ElizaOS memory system
- **Files**: `src/plugins/onboarding/actions.ts`
- **Status**: FAILED - Still had duplicates, LLM still generating responses

**3.4: Use Composite Action Pattern**
- **Description**: Create a composite action that includes IGNORE behavior
- **Implementation**: Action that both ignores LLM response and executes handler
- **Pros**: Combines multiple approaches
- **Cons**: Complex, might not be supported
- **Files**: `src/plugins/onboarding/actions.ts`

### Category 4: Message Queue/Throttle System

**4.1: Implement Message Queue with Priority**
- **Description**: Queue all messages, action handler messages get priority
- **Implementation**: Create a queue system that processes action handler messages first
- **Pros**: Guarantees order
- **Cons**: Complex, might delay messages
- **Files**: New file `src/services/messageQueue.ts`

**4.2: Global Message Lock** ✅ TRIED (v192)
- **Description**: Lock that prevents any message from sending until action handler completes
- **Implementation**: Acquire lock when action executes, release after callback
- **Pros**: Simple, guarantees no race condition
- **Cons**: Might block legitimate messages
- **Files**: `src/services/llmResponseInterceptor.ts`
- **Status**: Implemented in v192 - testing in progress

**4.3: Debounce/Throttle LLM Responses**
- **Description**: Throttle LLM response generation to prevent rapid duplicates
- **Implementation**: Track last LLM response time, block if too soon
- **Pros**: Simple
- **Cons**: We already do this with rapid consecutive blocking
- **Files**: Already implemented but could be enhanced

### Category 5: State-Based Locking

**5.1: Add Lock Flag to Onboarding State**
- **Description**: Add `isProcessing: true` flag to onboarding state
- **Implementation**: Set flag when action executes, clear after callback
- **Pros**: State-based, persistent
- **Cons**: Need to ensure flag is cleared
- **Files**: `src/plugins/onboarding/types.ts`, `src/plugins/onboarding/utils.ts`

**5.2: Database-Level Locking**
- **Description**: Use database transactions/locks to prevent concurrent processing
- **Implementation**: Lock user record during action execution
- **Pros**: Prevents all concurrent access
- **Cons**: Complex, might cause deadlocks
- **Files**: `src/plugins/onboarding/utils.ts`

### Category 6: Character/Model Configuration

**6.1: Change Model During Onboarding**
- **Description**: Use a different model (or no model) during onboarding
- **Implementation**: Switch to a model that's better at following instructions
- **Pros**: Might follow JSON format better
- **Cons**: Requires model switching logic
- **Files**: `src/index.ts` (runtime configuration)

**6.2: Modify Character System Prompt More Aggressively**
- **Description**: Make system prompt even more explicit about not responding
- **Implementation**: Add stronger language in character.json
- **Pros**: Simple
- **Cons**: We've tried this, LLM still ignores
- **Files**: `characters/kaia.character.json`

**6.3: Use Different Model Settings**
- **Description**: Change temperature, max_tokens, or other model parameters
- **Implementation**: Lower temperature to make model more deterministic
- **Pros**: Might follow instructions better
- **Cons**: Might make responses less natural
- **Files**: Runtime configuration

### Category 7: Custom Message Handler

**7.1: Bypass ElizaOS Message Flow Entirely**
- **Description**: Create custom handler that processes onboarding messages directly
- **Implementation**: Intercept at Telegram client level, handle onboarding separately
- **Pros**: Complete control
- **Cons**: Loses all ElizaOS features
- **Files**: New file `src/services/customOnboardingHandler.ts`

**7.2: Custom Telegram Client Wrapper**
- **Description**: Wrap Telegram client to intercept and handle onboarding messages
- **Implementation**: Create wrapper that processes onboarding before ElizaOS
- **Pros**: Clean separation
- **Cons**: Complex, might break other features
- **Files**: New file `src/services/onboardingTelegramWrapper.ts`

### Category 8: Action Handler Modifications

**8.1: Action Handler Sends Immediately, No Callback** ✅ PARTIALLY TRIED (v186-v192)
- **Description**: Action handler sends message directly via Telegram API, doesn't use callback
- **Implementation**: Remove callback usage, send directly
- **Pros**: Bypasses ElizaOS message creation
- **Cons**: Messages won't be in memory
- **Files**: `src/plugins/onboarding/actions.ts`
- **Status**: We send directly via Telegram API but still create empty memory for logging

**8.2: Action Handler Creates Memory with Empty Text** ✅ TRIED (v186-v192)
- **Description**: Action handler creates memory with empty text, sends via Telegram separately
- **Implementation**: `callback({ text: '' })` then send via Telegram API
- **Pros**: Memory created but not sent by ElizaOS
- **Cons**: Still creates memory
- **Files**: `src/plugins/onboarding/actions.ts`
- **Status**: Implemented - we create empty memory after sending directly

**8.3: Action Handler Returns Early to Prevent Follow-up**
- **Description**: Action handler returns a special value to prevent ElizaOS follow-up
- **Implementation**: Return `{ stopProcessing: true }` or similar
- **Pros**: Simple
- **Cons**: Need to verify ElizaOS respects this
- **Files**: `src/plugins/onboarding/actions.ts`

### Category 9: Provider Modifications

**9.1: Provider Returns Special Token**
- **Description**: Provider returns a special token that triggers action but prevents LLM response
- **Implementation**: Return `"[ACTION_ONLY: CONTINUE_ONBOARDING]"` or similar
- **Pros**: Uses existing provider system
- **Cons**: Need to verify ElizaOS handles this
- **Files**: `src/plugins/onboarding/provider.ts`

**9.2: Provider Throws Special Error**
- **Description**: Provider throws a custom error that action handler catches
- **Implementation**: `throw new OnboardingActionError('CONTINUE_ONBOARDING')`
- **Pros**: Might stop LLM generation
- **Cons**: Error handling complexity
- **Files**: `src/plugins/onboarding/provider.ts`

**9.3: Provider Returns Empty String**
- **Description**: Provider returns empty string instead of null
- **Implementation**: `return ''` instead of `return null`
- **Pros**: Simple
- **Cons**: We've tried null, might not work
- **Files**: `src/plugins/onboarding/provider.ts`

### Category 10: Intercept at Different Levels

**10.1: Patch Telegram Client's Message Handler**
- **Description**: Intercept messages at the Telegram client level before ElizaOS processes
- **Implementation**: Patch `client.on('message')` or similar
- **Pros**: Catches messages before ElizaOS
- **Cons**: Need to find the right handler
- **Files**: `src/index.ts` (Telegram client setup)

**10.2: Patch ElizaOS Client Interface**
- **Description**: Patch the client interface methods
- **Implementation**: Patch `TelegramClientInterface.start` or message processing methods
- **Pros**: Catches at client level
- **Cons**: Complex, might break client
- **Files**: `src/index.ts`

**10.3: Use Webhooks Instead of Polling**
- **Description**: Switch from polling to webhooks for better control
- **Implementation**: Configure Telegram webhooks
- **Pros**: More control over message flow
- **Cons**: Requires webhook setup, might not help
- **Files**: Telegram client configuration

### Category 11: Timing/Ordering Fixes

**11.1: Delay Action Handler Execution**
- **Description**: Add small delay to action handler to ensure LLM response is processed first
- **Implementation**: `setTimeout(() => { executeAction() }, 100)`
- **Pros**: Simple
- **Cons**: Race condition still exists, just delayed
- **Files**: `src/plugins/onboarding/actions.ts`

**11.2: Delay LLM Response**
- **Description**: Add delay to LLM response processing
- **Implementation**: Intercept and delay LLM response creation
- **Pros**: Might allow action handler to send first
- **Cons**: Makes bot feel slow
- **Files**: `src/services/llmResponseInterceptor.ts`

**11.3: Sequential Processing Lock**
- **Description**: Process messages sequentially, one at a time per user
- **Implementation**: Queue messages per user, process one at a time
- **Pros**: Guarantees order
- **Cons**: Might slow down bot
- **Files**: New file `src/services/sequentialProcessor.ts`

### Category 12: Configuration/Architecture Changes

**12.1: Disable "Small Model" Follow-up**
- **Description**: Disable the small model follow-up generation that happens after actions
- **Implementation**: Find where small model is called and disable it
- **Pros**: Directly addresses the duplicate
- **Cons**: Need to find where it's called
- **Files**: Need to search ElizaOS core

**12.2: Modify Action Execution Flow**
- **Description**: Change when/how actions are executed relative to LLM
- **Implementation**: Execute actions before LLM generation
- **Pros**: Action sends first
- **Cons**: Need to modify ElizaOS core flow
- **Files**: ElizaOS core (might not be possible)

**12.3: Use Different Action Type**
- **Description**: Use a different action type that doesn't trigger LLM follow-up
- **Implementation**: Research ElizaOS action types
- **Pros**: Might be built-in solution
- **Cons**: Need to research action types
- **Files**: `src/plugins/onboarding/actions.ts`

## Most Promising Untried Approaches

Based on the problem, these seem most likely to work:

1. **#1.2: Use Evaluator to Prevent LLM Generation** - Uses built-in ElizaOS mechanism
2. **#3.3: Make Action Silent (No Callback)** - Bypasses ElizaOS message flow
3. **#4.2: Global Message Lock** - Simple, guarantees no race condition
4. **#8.1: Action Handler Sends Immediately** - Direct Telegram API, no callback
5. **#12.1: Disable "Small Model" Follow-up** - Directly addresses the duplicate source

## Decision Framework: When to Move to Next Approach

**Move to next approach if:**
1. ✅ Current approach has been tested with real user messages
2. ✅ Logs show the approach is working (blocking is happening) but duplicates still occur
3. ✅ OR logs show the approach is NOT working (blocking not happening)
4. ✅ We've tried at least 2-3 variations of the current approach

**Continue debugging current approach if:**
1. ⏳ Logs show blocking is working but we need to refine timing/windows
2. ⏳ New issue discovered (e.g., messages not being received) that needs fixing first
3. ⏳ Approach shows promise but needs minor adjustments

## Current Status (v198)

**v198 Status**: 🔄 IN PROGRESS - Diagnostic logging added
- **Issue**: Messages not being received from Telegram
- **Action**: Added diagnostic logging to see if handlers are being called
- **Next Step**: Wait for v198 logs to determine:
  - If messages ARE being received → Continue with duplicate fix
  - If messages are NOT being received → Fix message reception first

## Next Approaches to Try (Priority Order)

1. **#1.2: Use Evaluator to Prevent LLM Generation** - Most promising, uses built-in mechanism
2. **#1.1: Remove Provider During Onboarding** - Completely disables LLM during onboarding
3. **#12.1: Disable "Small Model" Follow-up** - Directly addresses the duplicate source (evaluate step)

## Recommendation

**After v198 logs are reviewed:**
- If messages ARE received but duplicates persist → Try **#1.2 (Evaluator shouldRespond)**
- If messages are NOT received → Fix message reception first, then continue with duplicate fixes

