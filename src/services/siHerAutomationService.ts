/**
 * Si Her Automation Service
 * Automates onboarding tasks after Si Her payment completion:
 * - Add to Loops email newsletter
 * - Send Telegram group invitation
 * - Save to SI U database
 */

import { AgentRuntime } from '@elizaos/core';
import { addToLoopsNewsletter } from './loopsEmailService.js';
import { getTelegramGroupInviteForUser } from './telegramGroupService.js';
import { saveUserToSiuDatabase } from './siuDatabaseService.js';

/**
 * Automate Si Her member onboarding after payment
 */
export async function automateSiHerOnboarding(
  runtime: AgentRuntime,
  userId: string,
  email: string
): Promise<{
  success: boolean;
  loopsAdded?: boolean;
  telegramInvite?: string;
  siuSaved?: boolean;
  errors?: string[];
}> {
  const errors: string[] = [];
  let loopsAdded = false;
  let telegramInvite: string | undefined;
  let siuSaved = false;

  // Get user profile
  let profile: any = {};
  try {
    const cached = await runtime.cacheManager.get(`onboarding_${userId}`);
    const state = cached as { step: string; profile: any } || { step: 'NONE', profile: {} };
    profile = state.profile || {};
    
    // Ensure payment fields are available
    if (profile.paymentTransactionId && !profile.paymentDate) {
      profile.paymentDate = new Date();
    }
  } catch (error) {
    console.error('[Si Her Automation] Error getting user profile:', error);
    errors.push('Failed to get user profile');
  }

  const name = profile.name || email.split('@')[0];
  const firstName = name.split(' ')[0];
  const lastName = name.split(' ').slice(1).join(' ') || '';

  // 1. Add to Loops email newsletter
  try {
    const loopsResult = await addToLoopsNewsletter({
      email,
      firstName,
      lastName,
      userId,
      source: 'si-her-onboarding',
      userGroup: 'si-her-member'
    });

    if (loopsResult.success) {
      loopsAdded = true;
      console.log('[Si Her Automation] ✅ Added to Loops newsletter:', email);
    } else {
      errors.push(`Loops: ${loopsResult.error || 'Unknown error'}`);
    }
  } catch (error: any) {
    console.error('[Si Her Automation] Error adding to Loops:', error);
    errors.push(`Loops: ${error.message || 'Unknown error'}`);
  }

  // 2. Get Telegram group invitation
  try {
    const telegramResult = await getTelegramGroupInviteForUser(userId, email);
    if (telegramResult.success && telegramResult.inviteLink) {
      telegramInvite = telegramResult.inviteLink;
      console.log('[Si Her Automation] ✅ Generated Telegram invite link');
      
      // TODO: Send invite link via email or store for frontend to display
      // For now, we'll return it in the response
    } else {
      errors.push(`Telegram: ${telegramResult.error || 'Failed to get invite link'}`);
    }
  } catch (error: any) {
    console.error('[Si Her Automation] Error getting Telegram invite:', error);
    errors.push(`Telegram: ${error.message || 'Unknown error'}`);
  }

    // 3. Save to SI U database
    try {
      const siuProfile = {
        ...profile,
        email,
        name,
        onboardingSource: 'website' as const,
        routedToProgram: 'si-her-guide' as const,
        userTier: 'paid' as const,
        onboardingCompletedAt: new Date(),
        // Include payment info if available
        paymentTransactionId: profile.paymentTransactionId,
        paymentDate: profile.paymentDate
      };

      await saveUserToSiuDatabase(runtime, email, siuProfile, userId, 'website');
    siuSaved = true;
    console.log('[Si Her Automation] ✅ Saved to SI U database');
  } catch (error: any) {
    console.error('[Si Her Automation] Error saving to SI U database:', error);
    errors.push(`SI U: ${error.message || 'Unknown error'}`);
  }

  return {
    success: errors.length === 0,
    loopsAdded,
    telegramInvite,
    siuSaved,
    errors: errors.length > 0 ? errors : undefined
  };
}

