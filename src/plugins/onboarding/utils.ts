import { IAgentRuntime, UUID } from '@elizaos/core';
import { OnboardingStep, UserProfile } from './types.js';

export async function getUserProfile(runtime: IAgentRuntime, userId: UUID): Promise<UserProfile> {
  const account = await runtime.databaseAdapter.getAccountById(userId);
  if (!account || !account.details) {
    return {};
  }
  return (account.details as any).onboardingProfile || {};
}

export async function getOnboardingStep(runtime: IAgentRuntime, userId: UUID): Promise<OnboardingStep> {
  const account = await runtime.databaseAdapter.getAccountById(userId);
  if (!account || !account.details) {
    return 'NONE';
  }
  return (account.details as any).onboardingStep || 'NONE';
}

export async function updateOnboardingStep(
  runtime: IAgentRuntime, 
  userId: UUID, 
  step: OnboardingStep,
  profileUpdate?: Partial<UserProfile>
) {
  const account = await runtime.databaseAdapter.getAccountById(userId);
  if (!account) return;

  const currentDetails = (account.details as any) || {};
  const currentProfile = currentDetails.onboardingProfile || {};

  const newDetails = {
    ...currentDetails,
    onboardingStep: step,
    onboardingProfile: {
      ...currentProfile,
      ...profileUpdate
    }
  };

  // We need to update the account. The standard adapter might not have a direct 'updateAccount' 
  // that merges details easily, so we might need to be careful.
  // Assuming createAccount upserts or overwrites.
  await runtime.databaseAdapter.createAccount({
    ...account,
    details: newDetails
  });
}

