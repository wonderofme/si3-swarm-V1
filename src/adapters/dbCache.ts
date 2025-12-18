import { ICacheAdapter, elizaLogger } from '@elizaos/core';
import { createDatabaseAdapter } from './databaseAdapter.js';

interface CacheItem {
  value: any;
  expires: number;
}

/**
 * Database-backed cache adapter that persists state to MongoDB/PostgreSQL
 * Includes in-memory LRU-like caching with TTL for performance.
 * This ensures user data survives container restarts/redeployments
 */
export class DatabaseCacheAdapter implements ICacheAdapter {
  private db: any;
  private localCache = new Map<string, CacheItem>();
  private initializationPromise: Promise<void> | null = null;
  private readonly LOCAL_TTL_MS = 5000; // 5 seconds local cache validity

  constructor() {
    this.db = createDatabaseAdapter();
  }

  private async ensureInitialized(): Promise<void> {
    // If already initialized (promise exists), return it
    if (this.initializationPromise) return this.initializationPromise;

    // Create a new initialization promise (Mutex pattern)
    this.initializationPromise = (async () => {
      try {
        const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
        
        // Only Postgres needs table creation
        if (databaseType !== 'mongodb' && databaseType !== 'mongo') {
          // Check if query method exists
          if (!this.db.query) {
            elizaLogger.warn('[DatabaseCache] DB adapter missing query method, persistence disabled');
            return;
          }

          await this.db.query(`
            CREATE TABLE IF NOT EXISTS cache (
              key TEXT PRIMARY KEY,
              value JSONB,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            )
          `);
        }
        elizaLogger.success('[DatabaseCache] ✅ Initialized');
      } catch (error) {
        elizaLogger.error('[DatabaseCache] ⚠️ Initialization error: ' + (error instanceof Error ? error.message : String(error)));
        // Allow retry on failure
        this.initializationPromise = null; 
      }
    })();

    return this.initializationPromise;
  }

  async get(key: string): Promise<any> {
    // 1. Check local cache validity
    const cached = this.localCache.get(key);
    if (cached && Date.now() < cached.expires) {
      return cached.value;
    }

    try {
      await this.ensureInitialized();
      let value: any = undefined;

      // 2. Database Fetch
      const isMongo = this.isMongo();
      
      if (isMongo) {
        const mongoDb = await this.db.getDb();
        const doc = await mongoDb.collection('cache').findOne({ key });
        if (doc) value = doc.value;
      } else {
        const res = await this.db.query('SELECT value FROM cache WHERE key = $1', [key]);
        if (res.rows.length > 0) value = res.rows[0].value;
      }

      // 3. Parse & Cache Locally
      if (value !== undefined) {
        // Parse if it came back as a string but looks like an object/array
        // This handles legacy data or driver quirks
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            value = parsed;
          } catch (e) {
            // It was actually just a string
          }
        }

        this.localCache.set(key, {
          value,
          expires: Date.now() + this.LOCAL_TTL_MS
        });
      }

      return value;
    } catch (error) {
      elizaLogger.error(`[DatabaseCache] Error getting key ${key}: ` + (error instanceof Error ? error.message : String(error)));
      // Fallback: return expired local cache if we have it, rather than crashing
      return cached ? cached.value : undefined;
    }
  }

  async set(key: string, value: any): Promise<void> {
    // 1. Update local cache immediately
    this.localCache.set(key, {
      value,
      expires: Date.now() + this.LOCAL_TTL_MS
    });

    try {
      await this.ensureInitialized();
      const isMongo = this.isMongo();

      if (isMongo) {
        const mongoDb = await this.db.getDb();
        await mongoDb.collection('cache').updateOne(
          { key },
          { 
            $set: { value, updated_at: new Date() },
            $setOnInsert: { created_at: new Date() }
          },
          { upsert: true }
        );
      } else {
        // For Postgres JSONB, we generally pass the object directly.
        // The driver usually handles stringification for JSONB columns.
        // If using a raw TEXT column, you MUST stringify. 
        // Assuming JSONB based on create table:
        await this.db.query(
          `INSERT INTO cache (key, value, updated_at) 
           VALUES ($1, $2, NOW()) 
           ON CONFLICT (key) 
           DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, value] 
        );
      }
    } catch (error) {
      elizaLogger.error(`[DatabaseCache] Error setting key ${key}: ` + (error instanceof Error ? error.message : String(error)));
    }
  }

  async delete(key: string): Promise<void> {
    this.localCache.delete(key);

    try {
      await this.ensureInitialized();
      const isMongo = this.isMongo();

      if (isMongo) {
        const mongoDb = await this.db.getDb();
        await mongoDb.collection('cache').deleteOne({ key });
      } else {
        await this.db.query('DELETE FROM cache WHERE key = $1', [key]);
      }
    } catch (error) {
      elizaLogger.error(`[DatabaseCache] Error deleting key ${key}: ` + (error instanceof Error ? error.message : String(error)));
    }
  }

  // Helper to determine DB type
  private isMongo(): boolean {
    const dbType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
    const isMongoType = dbType === 'mongodb' || dbType === 'mongo';
    // Double check capability
    return isMongoType && this.db && typeof this.db.getDb === 'function';
  }
}

