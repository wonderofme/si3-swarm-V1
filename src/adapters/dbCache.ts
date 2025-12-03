import { ICacheAdapter } from '@elizaos/core';
import pg from 'pg';

export class DbCacheAdapter implements ICacheAdapter {
  private pool: pg.Pool;
  private agentId: string;
  private tableName: string = 'cache';

  constructor(connectionString: string, agentId: string) {
    this.pool = new pg.Pool({ connectionString });
    this.agentId = agentId;
  }

  async get(key: string): Promise<string | undefined> {
    const client = await this.pool.connect();
    try {
      const res = await client.query(
        `SELECT value FROM ${this.tableName} WHERE key = $1 AND agent_id = $2`,
        [key, this.agentId]
      );
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
      await client.query(
        `INSERT INTO ${this.tableName} (key, agent_id, value) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (key, agent_id) 
         DO UPDATE SET value = $3`,
        [key, this.agentId, value]
      );
    } catch (error) {
      console.error('Error setting cache key:', key, error);
    } finally {
      client.release();
    }
  }

  async delete(key: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `DELETE FROM ${this.tableName} WHERE key = $1 AND agent_id = $2`,
        [key, this.agentId]
      );
    } catch (error) {
      console.error('Error deleting cache key:', key, error);
    } finally {
      client.release();
    }
  }
}

