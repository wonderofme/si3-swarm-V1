import { ICacheAdapter } from '@elizaos/core';
import { createDatabaseAdapter } from './databaseAdapter.js';

/**
 * Database-backed cache adapter that persists state to MongoDB/PostgreSQL
 * This ensures user data survives container restarts/redeployments
 */
export class DatabaseCacheAdapter implements ICacheAdapter {
  private db: any;
  private localCache = new Map<string, any>(); // In-memory cache for fast reads
  private initialized = false;

  constructor() {
    this.db = createDatabaseAdapter();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Create cache table if it doesn't exist (for PostgreSQL)
      const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
      if (databaseType !== 'mongodb' && databaseType !== 'mongo') {
        await this.db.query(`
          CREATE TABLE IF NOT EXISTS cache (
            key TEXT PRIMARY KEY,
            value JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          )
        `);
      }
      this.initialized = true;
      console.log('[DatabaseCache] ✅ Initialized');
    } catch (error) {
      console.error('[DatabaseCache] ⚠️ Initialization error:', error);
      // Continue anyway - we'll fall back to memory cache
    }
  }

  async get(key: string): Promise<any> {
    // Check local cache first for speed
    if (this.localCache.has(key)) {
      return this.localCache.get(key);
    }

    try {
      await this.ensureInitialized();
      
      const result = await this.db.query(
        `SELECT value FROM cache WHERE key = $1`,
        [key]
      );
      
      if (result.rows && result.rows.length > 0) {
        const value = result.rows[0].value;
        // Parse if it's a string (PostgreSQL returns JSONB as object, but MongoDB might return string)
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        // Store in local cache for faster future reads
        this.localCache.set(key, parsed);
        return parsed;
      }
      
      return undefined;
    } catch (error) {
      console.error(`[DatabaseCache] Error getting key ${key}:`, error);
      // Fall back to local cache
      return this.localCache.get(key);
    }
  }

  async set(key: string, value: any): Promise<void> {
    // Always update local cache immediately
    this.localCache.set(key, value);

    try {
      await this.ensureInitialized();
      
      const valueStr = JSON.stringify(value);
      const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
      
      if (databaseType === 'mongodb' || databaseType === 'mongo') {
        // MongoDB upsert
        await this.db.query(
          `INSERT INTO cache (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, valueStr]
        );
      } else {
        // PostgreSQL upsert
        await this.db.query(
          `INSERT INTO cache (key, value, updated_at) 
           VALUES ($1, $2::jsonb, NOW()) 
           ON CONFLICT (key) 
           DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
          [key, valueStr]
        );
      }
      
      console.log(`[DatabaseCache] ✅ Saved key: ${key}`);
    } catch (error) {
      console.error(`[DatabaseCache] Error setting key ${key}:`, error);
      // Data is still in local cache, so operation partially succeeded
    }
  }

  async delete(key: string): Promise<void> {
    this.localCache.delete(key);

    try {
      await this.ensureInitialized();
      await this.db.query(`DELETE FROM cache WHERE key = $1`, [key]);
      console.log(`[DatabaseCache] ✅ Deleted key: ${key}`);
    } catch (error) {
      console.error(`[DatabaseCache] Error deleting key ${key}:`, error);
    }
  }
}

