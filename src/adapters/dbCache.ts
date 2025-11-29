import type { ICacheAdapter, UUID } from '@elizaos/core';
import pkg from 'pg';
const { Pool } = pkg;

export class DbCacheAdapter implements ICacheAdapter {
    private pool: pkg.Pool;
    private agentId: UUID;

    constructor(connectionString: string, agentId: UUID) {
        this.pool = new Pool({ connectionString });
        this.agentId = agentId;
    }

    async get(key: string): Promise<string | undefined> {
        const client = await this.pool.connect();
        try {
            const { rows } = await client.query(
                'SELECT "value" FROM "cache" WHERE "key" = $1 AND "agentId" = $2',
                [key, this.agentId]
            );
            if (rows.length > 0) {
                const val = rows[0].value;
                return typeof val === 'object' ? JSON.stringify(val) : String(val);
            }
            return undefined;
        } catch (error) {
            console.error('[DbCacheAdapter] Error getting key:', key, error);
            return undefined;
        } finally {
            client.release();
        }
    }

    async set(key: string, value: string): Promise<void> {
        const client = await this.pool.connect();
        try {
            let valToStore = value;
            try {
                valToStore = JSON.parse(value);
            } catch {}

            await client.query(
                `INSERT INTO "cache" ("key", "agentId", "value", "createdAt")
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT ("key", "agentId")
                 DO UPDATE SET "value" = $3, "createdAt" = NOW()`,
                [key, this.agentId, valToStore]
            );
        } catch (error) {
            console.error('[DbCacheAdapter] Error setting key:', key, error);
        } finally {
            client.release();
        }
    }

    async delete(key: string): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query(
                'DELETE FROM "cache" WHERE "key" = $1 AND "agentId" = $2',
                [key, this.agentId]
            );
        } finally {
            client.release();
        }
    }
}

