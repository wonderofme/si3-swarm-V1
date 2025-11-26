import type { Plugin } from '@elizaos/core';

// Temporary stub router plugin so the codebase compiles cleanly
// We can later reintroduce custom actions/evaluators using the current ElizaOS Handler/Validator API.
export function createRouterPlugin(): Plugin {
  return {
    name: 'router',
    description: 'Router plugin (stubbed; no custom behavior yet).',
    actions: [],
    evaluators: [],
    providers: [],
    services: [],
    clients: []
  };
}

