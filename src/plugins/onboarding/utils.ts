import { IAgentRuntime, UUID } from '@elizaos/core';
import { OnboardingStep, UserProfile } from './types.js';
import { getMessages, LanguageCode } from './translations.js';

const ONBOARDING_MEMORY_TYPE = 'onboarding_state';

/**
 * Resolves the primary userId from any platform userId
 * If a mapping exists, returns the primary userId, otherwise returns the input userId
 */
export async function resolvePrimaryUserId(runtime: IAgentRuntime, userId: UUID): Promise<UUID> {
  try {
    const db = runtime.databaseAdapter as any;
    const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
    const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
    
    if (isMongo && db.getDb) {
      const mongoDb = await db.getDb();
      const mapping = await mongoDb.collection('user_mappings').findOne({ platform_user_id: String(userId) });
      if (mapping && mapping.primary_user_id) {
        return mapping.primary_user_id as UUID;
      }
    } else if (db.query) {
      const result = await db.query(
        `SELECT primary_user_id FROM user_mappings WHERE platform_user_id = $1::text`,
        [String(userId)]
      );
      if (result.rows && result.rows.length > 0 && result.rows[0].primary_user_id) {
        return result.rows[0].primary_user_id as UUID;
      }
    }
  } catch (error) {
    console.error('[Onboarding Utils] Error resolving primary userId:', error);
  }
  
  // No mapping found, return original userId
  return userId;
}

export async function getOnboardingState(runtime: IAgentRuntime, userId: UUID): Promise<{ step: OnboardingStep, profile: UserProfile }> {
  try {
    // First, resolve to primary userId if mapping exists
    const primaryUserId = await resolvePrimaryUserId(runtime, userId);
    
    // Get state using primary userId
    const cached = await runtime.cacheManager.get(`onboarding_${primaryUserId}`);
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
  // Resolve to primary userId if mapping exists
  const primaryUserId = await resolvePrimaryUserId(runtime, userId);
  
  // Get current state using primary userId
  const { profile: currentProfile } = await getOnboardingState(runtime, primaryUserId);
  
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

  // Save to Cache (Primary persistence for state machine) using primary userId
  // CacheManager handles JSON stringification internally
  await runtime.cacheManager.set(`onboarding_${primaryUserId}`, newState as any);
  
  // If this is a different userId (platform userId), also create a reference
  if (primaryUserId !== userId) {
    await runtime.cacheManager.set(`onboarding_${userId}`, {
      step: 'COMPLETED',
      profile: newState.profile,
      primaryUserId: primaryUserId,
      isLinked: true
    } as any);
  }
  
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

export function formatProfileForDisplay(profile: UserProfile, lang: string = 'en'): string {
  const msgs = getMessages(lang as LanguageCode);
  
  // Goal mapping: Convert numbers to actual goal text
  const goalMap: Record<string, string> = {
    '1': 'Startups to invest in',
    '2': 'Investors/grant programs',
    '3': 'Growth tools, strategies, and/or support',
    '4': 'Sales/BD tools, strategies and/or support',
    '5': "Communities and/or DAO's to join",
    '6': 'New job opportunities'
  };
  
  // Helper to ensure we show actual values, not counts or numbers
  const formatArray = (arr: any, isGoals: boolean = false): string => {
    if (!arr) return msgs.SUMMARY_NOT_PROVIDED;
    if (Array.isArray(arr)) {
      if (arr.length === 0) return msgs.SUMMARY_NOT_PROVIDED;
      // Map numbers to text for goals
      if (isGoals) {
        const mapped = arr.map((item: any) => {
          const str = String(item);
          return goalMap[str] || item; // Use mapped value if exists, otherwise use original
        });
        return mapped.join(', ');
      }
      return arr.join(', ');
    }
    // If it's stored as a string/number, map it if it's a goal
    if (isGoals && goalMap[String(arr)]) {
      return goalMap[String(arr)];
    }
    return String(arr);
  };
  
  return `💜 Your Grow3dge Profile:\n\n` +
    `${msgs.SUMMARY_NAME} ${profile.name || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_LOCATION} ${profile.location || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_EMAIL} ${profile.email || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_ROLES} ${formatArray(profile.roles)}\n` +
    `${msgs.SUMMARY_INTERESTS} ${formatArray(profile.interests)}\n` +
    `${msgs.SUMMARY_GOALS} ${formatArray(profile.connectionGoals, true)}\n` +
    `${msgs.SUMMARY_EVENTS} ${formatArray(profile.events)}\n` +
    `${msgs.SUMMARY_SOCIALS} ${formatArray(profile.socials)}\n` +
    `${msgs.SUMMARY_TELEGRAM} ${profile.telegramHandle ? '@' + profile.telegramHandle : msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_DIVERSITY} ${profile.diversityResearchInterest || msgs.SUMMARY_NOT_PROVIDED}\n` +
    `${msgs.SUMMARY_NOTIFICATIONS} ${profile.notifications || msgs.SUMMARY_NOT_PROVIDED}`;
}

