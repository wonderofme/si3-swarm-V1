import { PostgresDatabaseAdapter } from '@elizaos/adapter-postgres';
import { MongoAdapter } from './mongoAdapter.js';

/**
 * Database adapter interface that both PostgreSQL and MongoDB adapters must implement
 * Note: This is a compatibility layer - ElizaOS expects IDatabaseAdapter, but we use this
 * to support both PostgreSQL and MongoDB adapters
 */
export interface DatabaseAdapter {
  query(sql: string, params?: any[]): Promise<any>;
  testConnection(): Promise<void | boolean>;
  close?(): Promise<void>;
  // Add other methods that ElizaOS expects
  [key: string]: any;
}

/**
 * Factory function to create the appropriate database adapter based on DATABASE_TYPE
 * @returns DatabaseAdapter instance (PostgreSQL or MongoDB)
 */
export function createDatabaseAdapter(): DatabaseAdapter {
  const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  if (databaseType === 'mongodb' || databaseType === 'mongo') {
    console.log('[Database Adapter] Creating MongoDB adapter');
    return new MongoAdapter(databaseUrl);
  } else {
    console.log('[Database Adapter] Creating PostgreSQL adapter');
    return new PostgresDatabaseAdapter({
      connectionString: databaseUrl
    });
  }
}

