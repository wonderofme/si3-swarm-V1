import type { Plugin } from '@elizaos/core';
import { routerEvaluator } from './evaluator.js';
import { querySubAgentAction } from './action.js';

export function createRouterPlugin(): Plugin {
  return {
    name: 'router',
    description: 'Routes queries to sub-agents (MoonDAO/SI3)',
    actions: [querySubAgentAction],
    evaluators: [routerEvaluator],
    providers: [],
    services: [],
    clients: []
  };
}

