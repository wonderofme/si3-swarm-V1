import { AgentRuntime } from '@elizaos/core';
import { OnboardingStep, UserProfile } from '../plugins/onboarding/types.js';
import { LanguageCode } from '../plugins/onboarding/translations.js';

/**
 * Pinned ecosystem opportunities that should always be visible
 */
export const PINNED_OPPORTUNITIES = {
  individuals: [
    { name: 'SI U Explorer', id: 'si-u-explorer' },
    { name: 'Si Her Guide', id: 'si-her-guide' }
  ],
  organizations: [
    { name: 'Grow3dge', id: 'grow3dge' },
    { name: 'Well-Being in the Web3 Workplace', id: 'well-being' }
  ]
};

/**
 * Privacy Policy URL
 */
export const PRIVACY_POLICY_URL = 'https://si3.space/privacy-policy'; // Update with actual URL

/**
 * Start website onboarding flow
 */
export async function startWebsiteOnboarding(
  runtime: AgentRuntime,
  userId: string,
  entryPoint: 'onboard' | 'explore' | 'join-si-u' = 'onboard'
): Promise<{ step: OnboardingStep; message: string; opportunities: typeof PINNED_OPPORTUNITIES }> {
  const state = {
    step: 'WEBSITE_WELCOME' as OnboardingStep,
    profile: {
      onboardingSource: 'website' as const,
      entryPoint,
      onboardingStartedAt: new Date()
    } as Partial<UserProfile>
  };

  await runtime.cacheManager.set(`onboarding_${userId}`, state);

  const welcomeMessage = `Welcome to SI<3>! It's great to have you here. I'm Kaia, SI<3>'s agent here to guide you through our ecosystem and opportunities you may be interested in.

To get started, here are our core ecosystem opportunities:

**FOR INDIVIDUALS**
• SI U Explorer
• Si Her Guide

**FOR ORGANIZATIONS**
• Grow3dge
• Well-Being in the Web3 Workplace

I'd love to learn a bit more about you to guide you into SI<3>. I will ask you some questions to learn more about you, and share about our resources that could be of interest to you.

Before we get started, please review our Privacy Policy (${PRIVACY_POLICY_URL}) to understand how this agent utilizes your information, and how we take your privacy seriously.

To continue, press continue.`;

  return {
    step: 'WEBSITE_WELCOME',
    message: welcomeMessage,
    opportunities: PINNED_OPPORTUNITIES
  };
}

/**
 * Handle privacy policy acknowledgment
 */
export async function acknowledgePrivacyPolicy(
  runtime: AgentRuntime,
  userId: string
): Promise<{ step: OnboardingStep; message: string }> {
  const cached = await runtime.cacheManager.get(`onboarding_${userId}`);
  const state = cached as { step: OnboardingStep; profile: Partial<UserProfile> } || {
    step: 'WEBSITE_WELCOME' as OnboardingStep,
    profile: {}
  };

  const updatedProfile = {
    ...state.profile,
    privacyPolicyAcknowledged: true
  };

  await runtime.cacheManager.set(`onboarding_${userId}`, {
    step: 'WEBSITE_LANGUAGE',
    profile: updatedProfile
  });

  const message = `Great! Let's go.

What's your preferred language?

1. English
2. Spanish
3. Portuguese
4. French

Reply with the number (for example: 1)`;

  return {
    step: 'WEBSITE_LANGUAGE',
    message
  };
}

/**
 * Handle language selection and move to Web3 experience question
 */
export async function handleLanguageSelection(
  runtime: AgentRuntime,
  userId: string,
  languageChoice: string
): Promise<{ step: OnboardingStep; message: string }> {
  const languageMap: Record<string, LanguageCode> = {
    '1': 'en',
    '2': 'es',
    '3': 'pt',
    '4': 'fr'
  };

  const language = languageMap[languageChoice] || 'en';

  const cached = await runtime.cacheManager.get(`onboarding_${userId}`);
  const state = cached as { step: OnboardingStep; profile: Partial<UserProfile> } || {
    step: 'WEBSITE_LANGUAGE' as OnboardingStep,
    profile: {}
  };

  const updatedProfile = {
    ...state.profile,
    language
  };

  await runtime.cacheManager.set(`onboarding_${userId}`, {
    step: 'WEBSITE_WEB3_EXPERIENCE',
    profile: updatedProfile
  });

  const message = `What is your level of Web3/emerging tech experience?

1) Brand new and curious
2) Utilizing Web3 (crypto, wallets, etc) but not working in Web3 or emerging tech
3) Working for and/or leading at an emerging tech organization

Reply with the number (for example: 1)`;

  return {
    step: 'WEBSITE_WEB3_EXPERIENCE',
    message
  };
}

/**
 * Route user based on Web3 experience level
 */
export async function routeByWeb3Experience(
  runtime: AgentRuntime,
  userId: string,
  experienceChoice: string
): Promise<{ step: OnboardingStep; message: string; routedTo?: string }> {
  const cached = await runtime.cacheManager.get(`onboarding_${userId}`);
  const state = cached as { step: OnboardingStep; profile: Partial<UserProfile> } || {
    step: 'WEBSITE_WEB3_EXPERIENCE' as OnboardingStep,
    profile: {}
  };

  const experienceMap: Record<string, 'brand-new' | 'using-but-not-working' | 'working-in-web3'> = {
    '1': 'brand-new',
    '2': 'using-but-not-working',
    '3': 'working-in-web3'
  };

  const experienceLevel = experienceMap[experienceChoice];
  if (!experienceLevel) {
    return {
      step: 'WEBSITE_WEB3_EXPERIENCE',
      message: 'Please reply with 1, 2, or 3.'
    };
  }

  const updatedProfile = {
    ...state.profile,
    web3ExperienceLevel: experienceLevel
  };

  // Route based on experience level
  if (experienceLevel === 'brand-new') {
    // Route to SI U Explorer
    updatedProfile.routedToProgram = 'si-u-explorer';
    await runtime.cacheManager.set(`onboarding_${userId}`, {
      step: 'WEBSITE_ROUTED',
      profile: updatedProfile
    });

    return {
      step: 'WEBSITE_ROUTED',
      message: `Perfect! Based on your experience level, I'll guide you to **SI U Explorer** - our program for those new to Web3 and emerging tech.

Let's continue with your onboarding to SI U Explorer.`,
      routedTo: 'si-u-explorer'
    };
  } else if (experienceLevel === 'using-but-not-working') {
    // Ask about gender for Si Her routing
    updatedProfile.routedToProgram = undefined; // Will be set after gender check
    await runtime.cacheManager.set(`onboarding_${userId}`, {
      step: 'WEBSITE_GENDER_CHECK',
      profile: updatedProfile
    });

    return {
      step: 'WEBSITE_GENDER_CHECK',
      message: `Are you a woman or non-binary emerging tech professional?

1) Yes
2) No

Reply with the number (for example: 1)`
    };
  } else {
    // Working in Web3 - ask about role
    updatedProfile.routedToProgram = undefined; // Will be set after role check
    await runtime.cacheManager.set(`onboarding_${userId}`, {
      step: 'WEBSITE_ROLE_CHECK',
      profile: updatedProfile
    });

    return {
      step: 'WEBSITE_ROLE_CHECK',
      message: `Are you in a marketing, sales, BD or partnerships role?

1) Yes
2) No

Reply with the number (for example: 1)`
    };
  }
}

/**
 * Handle gender check for Si Her routing
 */
export async function handleGenderCheck(
  runtime: AgentRuntime,
  userId: string,
  isWomanOrNonBinary: string
): Promise<{ step: OnboardingStep; message: string; routedTo?: string }> {
  const cached = await runtime.cacheManager.get(`onboarding_${userId}`);
  const state = cached as { step: OnboardingStep; profile: Partial<UserProfile> } || {
    step: 'WEBSITE_GENDER_CHECK' as OnboardingStep,
    profile: {}
  };

  const updatedProfile = {
    ...state.profile,
    gender: isWomanOrNonBinary === '1' ? 'woman-or-non-binary' : 'other'
  };

  if (isWomanOrNonBinary === '1') {
    // Route to Si Her Guide
    updatedProfile.routedToProgram = 'si-her-guide';
    await runtime.cacheManager.set(`onboarding_${userId}`, {
      step: 'WEBSITE_ROUTED',
      profile: updatedProfile
    });

    return {
      step: 'WEBSITE_ROUTED',
      message: `Excellent! I'll guide you to **Si Her Guide** - our program for women and non-binary emerging tech professionals.

Let's continue with your Si Her Guide application.`,
      routedTo: 'si-her-guide'
    };
  } else {
    // Route to SI U Explorer
    updatedProfile.routedToProgram = 'si-u-explorer';
    await runtime.cacheManager.set(`onboarding_${userId}`, {
      step: 'WEBSITE_ROUTED',
      profile: updatedProfile
    });

    return {
      step: 'WEBSITE_ROUTED',
      message: `I'll guide you to **SI U Explorer** - our program for those exploring Web3 and emerging tech.

Let's continue with your onboarding to SI U Explorer.`,
      routedTo: 'si-u-explorer'
    };
  }
}

/**
 * Handle role check for Grow3dge/Well-Being routing
 */
export async function handleRoleCheck(
  runtime: AgentRuntime,
  userId: string,
  isMarketingSalesBD: string
): Promise<{ step: OnboardingStep; message: string; routedTo?: string }> {
  const cached = await runtime.cacheManager.get(`onboarding_${userId}`);
  const state = cached as { step: OnboardingStep; profile: Partial<UserProfile> } || {
    step: 'WEBSITE_ROLE_CHECK' as OnboardingStep,
    profile: {}
  };

  if (isMarketingSalesBD === '1') {
    // Route to Grow3dge
    const updatedProfile = {
      ...state.profile,
      roleCategory: 'marketing-sales-bd' as const,
      routedToProgram: 'grow3dge' as const
    };

    await runtime.cacheManager.set(`onboarding_${userId}`, {
      step: 'WEBSITE_ROUTED',
      profile: updatedProfile
    });

    return {
      step: 'WEBSITE_ROUTED',
      message: `Perfect! I'll guide you to **Grow3dge** - our program for marketing, sales, BD, and partnerships professionals in emerging tech.

Let's continue with your Grow3dge inquiry.`,
      routedTo: 'grow3dge'
    };
  } else {
    // Ask about founder/CoS/HR role
    const updatedProfile = {
      ...state.profile,
      roleCategory: 'other' as const
    };

    await runtime.cacheManager.set(`onboarding_${userId}`, {
      step: 'WEBSITE_ROLE_CHECK_FOUNDER',
      profile: updatedProfile
    });

    return {
      step: 'WEBSITE_ROLE_CHECK_FOUNDER',
      message: `Are you a founder, chief of staff or HR role?

1) Yes
2) No

Reply with the number (for example: 1)`
    };
  }
}

/**
 * Handle founder/CoS/HR role check
 */
export async function handleFounderRoleCheck(
  runtime: AgentRuntime,
  userId: string,
  isFounderCoSHR: string
): Promise<{ step: OnboardingStep; message: string; routedTo?: string }> {
  const cached = await runtime.cacheManager.get(`onboarding_${userId}`);
  const state = cached as { step: OnboardingStep; profile: Partial<UserProfile> } || {
    step: 'WEBSITE_ROLE_CHECK_FOUNDER' as OnboardingStep,
    profile: {}
  };

  const updatedProfile = {
    ...state.profile,
    roleCategory: isFounderCoSHR === '1' ? 'founder-cos-hr' as const : 'other' as const,
    routedToProgram: isFounderCoSHR === '1' ? 'well-being' as const : 'si-u-explorer' as const
  };

  await runtime.cacheManager.set(`onboarding_${userId}`, {
    step: 'WEBSITE_ROUTED',
    profile: updatedProfile
  });

  if (isFounderCoSHR === '1') {
    return {
      step: 'WEBSITE_ROUTED',
      message: `Excellent! I'll guide you to **Well-Being in the Web3 Workplace** - our program for founders, chief of staff, and HR professionals.

Let's continue with your Well-Being inquiry.`,
      routedTo: 'well-being'
    };
  } else {
    return {
      step: 'WEBSITE_ROUTED',
      message: `I'll guide you to **SI U Explorer** - our program for those exploring Web3 and emerging tech.

Let's continue with your onboarding to SI U Explorer.`,
      routedTo: 'si-u-explorer'
    };
  }
}

