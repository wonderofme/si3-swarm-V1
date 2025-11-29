import { Plugin } from '@elizaos/core';
import { matchEvaluator } from './evaluator.js';
import { findMatchAction } from './action.js';

export function createMatchingPlugin(): Plugin {
  return {
    name: 'matching',
    description: 'Connects users based on interests.',
    evaluators: [matchEvaluator],
    actions: [findMatchAction],
    services: [],
    providers: [],
    clients: []
  };
}

