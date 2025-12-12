import { Plugin } from '@elizaos/core';
import { knowledgeProvider } from './provider.js';

export function createKnowledgePlugin(): Plugin {
  return {
    name: 'knowledge',
    description: 'Provides SI<3> knowledge base context for questions about SI<3> ecosystem',
    providers: [knowledgeProvider],
  };
}

