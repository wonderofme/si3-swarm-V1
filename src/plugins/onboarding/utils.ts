import { IAgentRuntime, UUID } from '@elizaos/core';
import { OnboardingStep, UserProfile } from './types.js';

const ONBOARDING_MEMORY_TYPE = 'onboarding_state';

export async function getOnboardingState(runtime: IAgentRuntime, userId: UUID): Promise<{ step: OnboardingStep, profile: UserProfile }> {
  try {
    const cached = await runtime.cacheManager.get(`onboarding_${userId}`);
    if (cached && typeof cached === 'object') {
      // Ensure profile exists and is an object
      const state = cached as { step?: OnboardingStep, profile?: UserProfile };
      return {
        step: state.step || 'NONE',
        profile: state.profile || {}
      };
    }
  } catch (error) {
    console.error('[Onboarding] Error getting state:', error);
  }
  
  return { step: 'NONE', profile: {} };
}

export async function updateOnboardingStep(
  runtime: IAgentRuntime, 
  userId: UUID, 
  roomId: UUID,
  step: OnboardingStep,
  profileUpdate?: Partial<UserProfile>
) {
  // Get current state
  const { profile: currentProfile } = await getOnboardingState(runtime, userId);
  
  const newState = {
    step,
    profile: {
      ...currentProfile,
      ...profileUpdate
    }
  };

  // Set completion date if completing
  if (step === 'COMPLETED' && !currentProfile.onboardingCompletedAt) {
    newState.profile.onboardingCompletedAt = new Date();
  }

  // Save to Cache (Primary persistence for state machine)
  // CacheManager handles JSON stringification internally
  await runtime.cacheManager.set(`onboarding_${userId}`, newState as any);
  
  // CRITICAL: Update onboarding step cache immediately
  // This ensures the provider gives the correct message to the LLM
  try {
    const { updateOnboardingStepCache } = await import('../../services/llmResponseInterceptor.js');
    if (typeof updateOnboardingStepCache === 'function') {
      updateOnboardingStepCache(userId, step);
      console.log(`[Onboarding Utils] Updated cache for user ${userId} to step: ${step}`);
    }
  } catch (error) {
    console.error('[Onboarding Utils] Error updating cache:', error);
  }
  
  // Also save as a persistent memory log (so we have history)
  // Mark as agent message to prevent it from triggering LLM responses
  await runtime.messageManager.createMemory({
    id: undefined, // auto-gen
    userId: runtime.agentId, // Use agent ID so it's not treated as a user message
    agentId: runtime.agentId,
    roomId: roomId,
    content: {
      text: `Onboarding Update: ${step}`,
      data: newState,
      type: ONBOARDING_MEMORY_TYPE,
      metadata: {
        isInternalUpdate: true,
        actualUserId: userId // Store actual user ID in metadata for reference
      }
    }
  });
}

export async function getUserProfile(runtime: IAgentRuntime, userId: UUID): Promise<UserProfile> {
  const state = await getOnboardingState(runtime, userId);
  return state.profile || {};
}

export async function getOnboardingStep(runtime: IAgentRuntime, userId: UUID): Promise<OnboardingStep> {
  const state = await getOnboardingState(runtime, userId);
  return state.step || 'NONE';
}

