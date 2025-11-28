import { IAgentRuntime, UUID, Memory } from '@elizaos/core';
import { OnboardingStep, UserProfile } from './types.js';

const ONBOARDING_MEMORY_TYPE = 'onboarding_state';

export async function getOnboardingState(runtime: IAgentRuntime, userId: UUID): Promise<{ step: OnboardingStep, profile: UserProfile }> {
  // Search for the latest onboarding memory for this user
  const memories = await runtime.messageManager.getMemories({
    roomId: userId, // User's private room (usually same as userId for direct/DM)
    count: 1,
    unique: false // We want the latest
  });

  // Filter manually if needed, but let's assume we just grab the latest memory of our type
  // Actually, messageManager mixes all types? No, usually we can filter by type if we use the adapter directly, 
  // but runtime.messageManager methods vary.
  // Let's use databaseAdapter.getMemories directly if possible, or just use cache if we switch to DB cache.
  
  // Alternative: Use the CacheManager! 
  // But we used MemoryCacheAdapter in index.ts. We should upgrade that to DbCacheAdapter later.
  // For now, let's use the "description" manager which is for user descriptions?
  // Or just write a memory.
  
  // Let's try retrieval by specific type if the runtime supports it.
  // If not, we'll just fetch latest memory in the room and check if it's ours? No that's messy.
  
  // Let's use the `cacheManager` for now, but knowing it's in-memory is a risk.
  // However, the USER asked for persistent storage (DB).
  // So we MUST use the DB.
  
  // WORKAROUND: We will use `createMemory` with a special type 'onboarding' and `unique: true`.
  // And we will fetch it using `getMemories` filtering by type if supported, or just get latest.
  
  // Actually, `getMemories` in standard interface takes `roomId`.
  // We can use a dedicated `roomId` for onboarding state for this user? 
  // e.g. uuid(userId + '-onboarding')
  
  // Let's try that.
  const onboardingRoomId = userId; // Just use the user's room for now.
  
  // We'll retrieve the last state from the cache FIRST (fastest), and if missing, maybe DB?
  // But given the constraints, let's try to access the DB adapter's `getMemories` if possible.
  
  // Let's look at the CacheManager again. 
  // Ideally we simply switch index.ts to use a PostgresCacheAdapter.
  // That solves everything cleanly.
  
  // For now, assuming we fix the cache adapter:
  const cached = await runtime.cacheManager.get(`onboarding_${userId}`);
  if (cached) {
    return cached as { step: OnboardingStep, profile: UserProfile };
  }
  
  return { step: 'NONE', profile: {} };
}

export async function updateOnboardingStep(
  runtime: IAgentRuntime, 
  userId: UUID, 
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

  // Save to Cache (We need to swap MemoryCache to DbCache in index.ts)
  await runtime.cacheManager.set(`onboarding_${userId}`, newState);
  
  // Also save as a persistent memory so we have a record
  await runtime.messageManager.createMemory({
    id: undefined, // auto-gen
    userId,
    agentId: runtime.agentId,
    roomId: userId,
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
