import { ICacheAdapter } from '@elizaos/core';
import { createDatabaseAdapter } from './databaseAdapter.js';

/**
 * Database-backed cache adapter that persists state to MongoDB/PostgreSQL
 * This ensures user data survives container restarts/redeployments
 * Uses promise-based mutex to prevent race conditions during initialization
 */
export class DatabaseCacheAdapter implements ICacheAdapter {
  private db: any;
  private localCache = new Map<string, any>(); // In-memory cache for fast reads
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.db = createDatabaseAdapter();
  }

  /**
   * Prevents race conditions by using a Promise mutex.
   * Ensures CREATE TABLE is called exactly once, even with concurrent requests.
   */
  private async ensureInitialized(): Promise<void> {
    // If already initialized (promise exists), return the running promise
    if (this.initializationPromise) return this.initializationPromise;

    // Create a new initialization promise
    this.initializationPromise = (async () => {
      try {
        const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
        
        // Only Postgres needs table creation
        if (databaseType !== 'mongodb' && databaseType !== 'mongo') {
          if (!this.db.query) {
            console.warn('[DatabaseCache] DB adapter missing query method, persistence disabled');
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
        console.log('[DatabaseCache] ✅ Initialized');
      } catch (error) {
        console.error('[DatabaseCache] ⚠️ Initialization error:', error);
        // Reset promise on failure so we can try again
        this.initializationPromise = null; 
      }
    })();

    return this.initializationPromise;
  }

  /**
   * DRY Helper to determine DB type
   */
  private isMongo(): boolean {
    const dbType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
    const isMongoType = dbType === 'mongodb' || dbType === 'mongo';
    // Double check capability to prevent crashes
    return isMongoType && this.db && typeof this.db.getDb === 'function';
  }

  async get(key: string): Promise<any> {
    // Check local cache first for speed
    const cached = this.localCache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    try {
      await this.ensureInitialized();
      let value: any = undefined;

      // Database Fetch
      if (this.isMongo()) {
        const mongoDb = await this.db.getDb();
        const doc = await mongoDb.collection('cache').findOne({ key });
        if (doc) value = doc.value;
      } else {
        // PostgreSQL: Use SQL query
        const res = await this.db.query('SELECT value FROM cache WHERE key = $1', [key]);
        if (res.rows && res.rows.length > 0) {
          value = res.rows[0].value;
        }
      }

      // Parse & Cache Locally
      if (value !== undefined) {
        // Handle double-encoding edge case (if DB has stringified JSON)
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            // Check if it was double-encoded (common in legacy data)
            value = typeof parsed === 'object' ? parsed : value;
          } catch (e) {
            // It was actually just a plain string, keep as is
          }
        }

        // Store in local cache for faster future reads
        this.localCache.set(key, value);
      }

      return value;
    } catch (error) {
      console.error(`[DatabaseCache] Error getting key ${key}:`, error);
      // Fallback: return cached value if we have it, rather than crashing
      return cached !== undefined ? cached : undefined;
    }
  }

  async set(key: string, value: any): Promise<void> {
    // Always update local cache immediately
    this.localCache.set(key, value);

    try {
      await this.ensureInitialized();

      if (this.isMongo()) {
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
        // PostgreSQL: JSONB handles objects natively, but we stringify for safety
        // This ensures compatibility across different PostgreSQL drivers
        const valueStr = JSON.stringify(value);
        await this.db.query(
          `INSERT INTO cache (key, value, updated_at) 
           VALUES ($1, $2::jsonb, NOW()) 
           ON CONFLICT (key) 
           DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
          [key, valueStr]
        );
      }
    } catch (error) {
      console.error(`[DatabaseCache] Error setting key ${key}:`, error);
      // Data is still in local cache, so operation partially succeeded
    }
  }

  async delete(key: string): Promise<void> {
    this.localCache.delete(key);

    try {
      await this.ensureInitialized();

      if (this.isMongo()) {
        const mongoDb = await this.db.getDb();
        await mongoDb.collection('cache').deleteOne({ key });
      } else {
        await this.db.query('DELETE FROM cache WHERE key = $1', [key]);
      }
    } catch (error) {
      console.error(`[DatabaseCache] Error deleting key ${key}:`, error);
    }
  }
}

