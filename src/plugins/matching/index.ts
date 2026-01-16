import { Plugin } from '@elizaos/core';
import { matchEvaluator } from './evaluator.js';
import { historyEvaluator } from './historyEvaluator.js';
import { findMatchAction } from './action.js';
import { followUpResponseAction } from './followUpHandler.js';
import { showHistoryAction } from './historyAction.js';
import { 
  requestMatchAction, 
  approveMatchRequestAction, 
  rejectMatchRequestAction,
  showPendingRequestsAction 
} from './requestAction.js';

export function createMatchingPlugin(): Plugin {
  return {
    name: 'matching',
    description: 'Connects users based on interests and manages follow-ups.',
    evaluators: [matchEvaluator, historyEvaluator],
    actions: [
      findMatchAction, 
      followUpResponseAction, 
      showHistoryAction,
      requestMatchAction,
      approveMatchRequestAction,
      rejectMatchRequestAction,
      showPendingRequestsAction
    ],
    providers: [],
    services: [],
    clients: []
  };
}


