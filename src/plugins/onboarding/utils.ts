import { IAgentRuntime, UUID } from '@elizaos/core';
import { OnboardingStep, UserProfile } from './types.js';

const ONBOARDING_MEMORY_TYPE = 'onboarding_state';

export async function getOnboardingState(runtime: IAgentRuntime, userId: UUID): Promise<{ step: OnboardingStep, profile: UserProfile }> {
  try {
    const cached = await runtime.cacheManager.get(`onboarding_${userId}`);
    if (cached) {
      // Cache returns string, need to parse
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return parsed as { step: OnboardingStep, profile: UserProfile };
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
  await runtime.cacheManager.set(`onboarding_${userId}`, JSON.stringify(newState));
  
  // Also save as a persistent memory log (so we have history)
  await runtime.messageManager.createMemory({
    id: undefined, // auto-gen
    userId,
    agentId: runtime.agentId,
    roomId: roomId,
    content: {
      text: `Onboarding Update: ${step}`,
      data: newState,
      type: ONBOARDING_MEMORY_TYPE
    }
  });
}

export async function getUserProfile(runtime: IAgentRuntime, userId: UUID): Promise<UserProfile> {
  const state = await getOnboardingState(runtime, userId);
  return state.profile;
}

export async function getOnboardingStep(runtime: IAgentRuntime, userId: UUID): Promise<OnboardingStep> {
  const state = await getOnboardingState(runtime, userId);
  return state.step;
}

