import { Plugin } from '@elizaos/core';
import { continueOnboardingAction } from './actions.js';
import { onboardingEvaluator } from './evaluator.js';

export function createOnboardingPlugin(): Plugin {
  return {
    name: 'onboarding',
    description: 'Handles user onboarding workflow.',
    actions: [continueOnboardingAction],
    evaluators: [onboardingEvaluator],
    providers: [],
    services: [],
    clients: []
  };
}

