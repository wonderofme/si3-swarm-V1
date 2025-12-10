import { ICacheAdapter } from '@elizaos/core';

export class MemoryCacheAdapter implements ICacheAdapter {
  private cache = new Map<string, any>();

  async get(key: string): Promise<any> {
    return this.cache.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    this.cache.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }
}

