import { Plugin } from '@elizaos/core';
import { continueOnboardingAction } from './actions.js';
import { onboardingEvaluator } from './evaluator.js';
import { onboardingProvider } from './provider.js';
import { changeLanguageAction } from './languageAction.js';

export function createOnboardingPlugin(): Plugin {
  return {
    name: 'onboarding',
    description: 'Handles user onboarding workflow.',
    actions: [continueOnboardingAction, changeLanguageAction],
    evaluators: [onboardingEvaluator],
    providers: [onboardingProvider],
    services: [],
    clients: []
  };
}

