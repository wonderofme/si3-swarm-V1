import { Plugin } from '@elizaos/core';
import { featureRequestAction } from './action.js';
import { featureRequestProvider } from './provider.js';

export function createFeatureRequestPlugin(): Plugin {
  return {
    name: 'feature-request',
    description: 'Handles feature requests from users and sends them to tech@si3.space',
    actions: [featureRequestAction],
    providers: [featureRequestProvider],
  };
}

