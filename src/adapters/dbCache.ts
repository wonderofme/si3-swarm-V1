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
      
      // If the table exists with camelCase agentId, we need to handle it
      // Check if agentId column exists and migrate if needed
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '${this.tableName}' 
        AND column_name IN ('agentId', 'agent_id')
      `);
      
      const hasAgentId = columnCheck.rows.some((r: any) => r.column_name === 'agentId');
      const hasAgent_id = columnCheck.rows.some((r: any) => r.column_name === 'agent_id');
      
      if (hasAgentId && !hasAgent_id) {
        // Migrate from camelCase to snake_case
        await client.query(`
          ALTER TABLE ${this.tableName} 
          RENAME COLUMN "agentId" TO agent_id;
        `);
      }
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
      return res.rows[0]?.value;
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

