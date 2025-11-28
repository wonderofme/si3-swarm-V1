import { Plugin } from '@elizaos/core';
import { onboardingEvaluator } from './evaluator.js';
import { continueOnboardingAction } from './actions.js';

export function createOnboardingPlugin(): Plugin {
  return {
    name: 'onboarding',
    description: 'Handles user onboarding flow state and profile collection.',
    evaluators: [onboardingEvaluator],
    actions: [continueOnboardingAction],
    services: [],
    providers: [],
    clients: []
  };
}

