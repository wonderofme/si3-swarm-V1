import { Plugin } from '@elizaos/core';
import { matchEvaluator } from './evaluator.js';
import { historyEvaluator } from './historyEvaluator.js';
import { findMatchAction } from './action.js';
import { followUpResponseAction } from './followUpHandler.js';
import { showHistoryAction } from './historyAction.js';

export function createMatchingPlugin(): Plugin {
  return {
    name: 'matching',
    description: 'Connects users based on interests.',
    evaluators: [matchEvaluator, historyEvaluator],
    actions: [findMatchAction, followUpResponseAction, showHistoryAction],
    services: [],
    providers: [],
    clients: []
  };
}



