import { ICacheAdapter } from '@elizaos/core';
import pg from 'pg';

export class DbCacheAdapter implements ICacheAdapter {
  private pool: pg.Pool;
  private agentId: string;
  private tableName: string = 'cache';

  constructor(connectionString: string, agentId: string) {
    this.pool = new pg.Pool({ connectionString });
    this.agentId = agentId;
    this.initTable().catch(console.error);
  }

  private async initTable() {
    const client = await this.pool.connect();
    try {
      // Create table with snake_case column names (PostgreSQL convention)
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          key VARCHAR(255) NOT NULL,
          agent_id UUID NOT NULL,
          value JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (key, agent_id)
        );
      `);
      
      // Safely migrate schema using DO block
      await client.query(`
        DO $$ 
        BEGIN 
          -- Rename agentId to agent_id if it exists
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '${this.tableName}' AND column_name = 'agentId') THEN
            ALTER TABLE ${this.tableName} RENAME COLUMN "agentId" TO agent_id;
          END IF;

          -- Add created_at if missing
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '${this.tableName}' AND column_name = 'created_at') THEN
            ALTER TABLE ${this.tableName} ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
          END IF;

          -- Add updated_at if missing
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '${this.tableName}' AND column_name = 'updated_at') THEN
            ALTER TABLE ${this.tableName} ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
          END IF;
        END $$;
      `);

    } catch (error) {
      console.error('Error initializing cache table:', error);
    } finally {
      client.release();
    }
  }

  async get(key: string): Promise<string | undefined> {
    const client = await this.pool.connect();
    try {
      // Try snake_case first, fallback to camelCase if needed
      let res;
      try {
        res = await client.query(
          `SELECT value FROM ${this.tableName} WHERE key = $1 AND agent_id = $2`,
          [key, this.agentId]
        );
      } catch (e: any) {
        // If agent_id doesn't exist, try agentId (camelCase)
        if (e.message?.includes('agent_id')) {
          res = await client.query(
            `SELECT value FROM ${this.tableName} WHERE key = $1 AND "agentId" = $2`,
            [key, this.agentId]
          );
        } else {
          throw e;
        }
      }
      // PostgreSQL JSONB returns objects, but CacheManager expects strings
      // JSON.stringify to return a string that CacheManager can parse
      const value = res.rows[0]?.value;
      return value !== undefined ? JSON.stringify(value) : undefined;
    } catch (error) {
      console.error('Error getting cache key:', key, error);
      return undefined;
    } finally {
      client.release();
    }
  }

  async set(key: string, value: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Try snake_case first, fallback to camelCase if needed
      try {
        await client.query(
          `INSERT INTO ${this.tableName} (key, agent_id, value) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (key, agent_id) 
           DO UPDATE SET value = $3, updated_at = CURRENT_TIMESTAMP`,
          [key, this.agentId, value]
        );
      } catch (e: any) {
        // If agent_id doesn't exist, try agentId (camelCase)
        if (e.message?.includes('agent_id')) {
          await client.query(
            `INSERT INTO ${this.tableName} (key, "agentId", value) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (key, "agentId") 
             DO UPDATE SET value = $3`,
            [key, this.agentId, value]
          );
        } else {
          throw e;
        }
      }
    } catch (error) {
      console.error('Error setting cache key:', key, error);
    } finally {
      client.release();
    }
  }

  async delete(key: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Try snake_case first, fallback to camelCase if needed
      try {
        await client.query(
          `DELETE FROM ${this.tableName} WHERE key = $1 AND agent_id = $2`,
          [key, this.agentId]
        );
      } catch (e: any) {
        // If agent_id doesn't exist, try agentId (camelCase)
        if (e.message?.includes('agent_id')) {
          await client.query(
            `DELETE FROM ${this.tableName} WHERE key = $1 AND "agentId" = $2`,
            [key, this.agentId]
          );
        } else {
          throw e;
        }
      }
    } catch (error) {
      console.error('Error deleting cache key:', key, error);
    } finally {
      client.release();
    }
  }
}

