import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { DatabaseAdapter } from './databaseAdapter.js';

/**
 * MongoDB adapter that implements the same interface as PostgresDatabaseAdapter
 * Converts SQL-like queries to MongoDB operations
 */
export class MongoAdapter implements DatabaseAdapter {
  private client: MongoClient;
  private db: Db | null = null;
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
    this.client = new MongoClient(connectionString);
  }

  /**
   * Get or create database connection
   * Made public for vector search operations
   */
  async getDb(): Promise<Db> {
    if (!this.db) {
      await this.client.connect();
      // Extract database name from connection string or use default
      const dbName = this.extractDbName(this.connectionString) || 'kaia';
      this.db = this.client.db(dbName);
    }
    return this.db;
  }

  /**
   * Extract database name from MongoDB connection string
   */
  private extractDbName(connectionString: string): string | null {
    // mongodb://host:port/dbname or mongodb+srv://user:pass@host/dbname
    const match = connectionString.match(/\/([^/?]+)(\?|$)/);
    return match ? match[1] : null;
  }

  /**
   * Convert SQL query to MongoDB operation
   * Supports basic SQL patterns: SELECT, INSERT, UPDATE, DELETE
   */
  async query(sql: string, params: any[] = []): Promise<any> {
    const db = await this.getDb();
    const sqlUpper = sql.trim().toUpperCase();

    try {
      // Handle SELECT queries
      if (sqlUpper.startsWith('SELECT')) {
        return await this.handleSelect(sql, params, db);
      }

      // Handle INSERT queries
      if (sqlUpper.startsWith('INSERT')) {
        return await this.handleInsert(sql, params, db);
      }

      // Handle UPDATE queries
      if (sqlUpper.startsWith('UPDATE')) {
        return await this.handleUpdate(sql, params, db);
      }

      // Handle DELETE queries
      if (sqlUpper.startsWith('DELETE')) {
        return await this.handleDelete(sql, params, db);
      }

      // Handle CREATE TABLE (for migrations)
      if (sqlUpper.startsWith('CREATE TABLE')) {
        return await this.handleCreateTable(sql, db);
      }

      // Handle ALTER TABLE (for migrations)
      if (sqlUpper.startsWith('ALTER TABLE')) {
        return await this.handleAlterTable(sql, db);
      }

      // Handle CREATE INDEX
      if (sqlUpper.startsWith('CREATE INDEX')) {
        return await this.handleCreateIndex(sql, db);
      }

      // Handle DO blocks (PostgreSQL-specific, skip for MongoDB)
      if (sqlUpper.startsWith('DO $$')) {
        console.log('[MongoDB Adapter] Skipping PostgreSQL DO block');
        return { rows: [] };
      }

      // Default: try to execute as-is (might be a custom query)
      console.warn('[MongoDB Adapter] Unhandled query type, attempting raw execution:', sql.substring(0, 100));
      return { rows: [] };
    } catch (error: any) {
      console.error('[MongoDB Adapter] Query error:', error);
      throw error;
    }
  }

  /**
   * Handle SELECT queries
   */
  private async handleSelect(sql: string, params: any[], db: Db): Promise<any> {
    // Parse SELECT query (simplified parser)
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (!tableMatch) {
      throw new Error('Could not parse table name from SELECT query');
    }

    const tableName = tableMatch[1];
    const collection = db.collection(tableName);

    // Build MongoDB filter from WHERE clause
    let filter: any = {};
    if (sql.includes('WHERE')) {
      filter = this.parseWhereClause(sql, params);
    }

    // Build projection (SELECT fields)
    let projection: any = {};
    const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
    if (selectMatch && !selectMatch[1].includes('*')) {
      const fields = selectMatch[1].split(',').map(f => f.trim().replace(/"/g, ''));
      fields.forEach(field => {
        // Handle snake_case to camelCase conversion
        const camelField = this.snakeToCamel(field);
        projection[camelField] = 1;
      });
    }

    // Handle ORDER BY
    let sort: any = {};
    const orderMatch = sql.match(/ORDER BY\s+(\w+)\s+(ASC|DESC)?/i);
    if (orderMatch) {
      const sortField = this.snakeToCamel(orderMatch[1]);
      sort[sortField] = orderMatch[2]?.toUpperCase() === 'DESC' ? -1 : 1;
    }

    // Handle LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1]) : undefined;

    // Execute query
    let cursor = collection.find(filter);
    if (Object.keys(projection).length > 0) {
      cursor = cursor.project(projection);
    }
    if (Object.keys(sort).length > 0) {
      cursor = cursor.sort(sort);
    }
    if (limit) {
      cursor = cursor.limit(limit);
    }

    const results = await cursor.toArray();

    // Convert MongoDB documents to PostgreSQL-like format
    return {
      rows: results.map(doc => this.convertDocToRow(doc))
    };
  }

  /**
   * Handle INSERT queries
   */
  private async handleInsert(sql: string, params: any[], db: Db): Promise<any> {
    const tableMatch = sql.match(/INTO\s+(\w+)/i);
    if (!tableMatch) {
      throw new Error('Could not parse table name from INSERT query');
    }

    const tableName = tableMatch[1];
    const collection = db.collection(tableName);

    // Parse column names and values
    const columnsMatch = sql.match(/\(([^)]+)\)/);
    const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/);

    if (!columnsMatch || !valuesMatch) {
      throw new Error('Could not parse INSERT query');
    }

    const columns = columnsMatch[1].split(',').map(c => c.trim().replace(/"/g, ''));
    const values = this.parseValues(valuesMatch[1], params);

    // Build document
    const doc: any = {};
    columns.forEach((col, idx) => {
      const camelCol = this.snakeToCamel(col);
      let value = values[idx];

      // Handle special values
      if (value === 'NOW()' || value === 'CURRENT_TIMESTAMP') {
        value = new Date();
      } else if (value === 'gen_random_uuid()' || value === 'uuid_generate_v4()') {
        value = this.generateUUID();
      } else if (typeof value === 'string' && value.startsWith('$')) {
        // Parameter placeholder
        const paramIdx = parseInt(value.substring(1)) - 1;
        value = params[paramIdx];
      }

      doc[camelCol] = value;
    });

    // Insert document
    const result = await collection.insertOne(doc);

    return {
      rows: [{ id: result.insertedId.toString() }],
      rowCount: 1
    };
  }

  /**
   * Handle UPDATE queries
   */
  private async handleUpdate(sql: string, params: any[], db: Db): Promise<any> {
    const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
    if (!tableMatch) {
      throw new Error('Could not parse table name from UPDATE query');
    }

    const tableName = tableMatch[1];
    const collection = db.collection(tableName);

    // Parse SET clause
    const setMatch = sql.match(/SET\s+(.+?)(?:\s+WHERE|$)/i);
    if (!setMatch) {
      throw new Error('Could not parse SET clause from UPDATE query');
    }

    const updateDoc: any = {};
    const setClause = setMatch[1];
    const assignments = setClause.split(',').map(a => a.trim());

    assignments.forEach(assignment => {
      const [field, value] = assignment.split('=').map(s => s.trim());
      const camelField = this.snakeToCamel(field);
      let updateValue = value;

      // Handle special values
      if (value === 'NOW()' || value === 'CURRENT_TIMESTAMP') {
        updateValue = new Date().toISOString();
      } else if (typeof value === 'string' && value.startsWith('$')) {
        const paramIdx = parseInt(value.substring(1)) - 1;
        updateValue = params[paramIdx];
      }

      updateDoc[camelField] = updateValue;
    });

    // Parse WHERE clause
    let filter: any = {};
    if (sql.includes('WHERE')) {
      filter = this.parseWhereClause(sql, params);
    }

    // Execute update
    const result = await collection.updateMany(filter, { $set: updateDoc });

    return {
      rows: [],
      rowCount: result.modifiedCount
    };
  }

  /**
   * Handle DELETE queries
   */
  private async handleDelete(sql: string, params: any[], db: Db): Promise<any> {
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (!tableMatch) {
      throw new Error('Could not parse table name from DELETE query');
    }

    const tableName = tableMatch[1];
    const collection = db.collection(tableName);

    // Parse WHERE clause
    let filter: any = {};
    if (sql.includes('WHERE')) {
      filter = this.parseWhereClause(sql, params);
    }

    // Execute delete
    const result = await collection.deleteMany(filter);

    return {
      rows: [],
      rowCount: result.deletedCount
    };
  }

  /**
   * Handle CREATE TABLE (creates collection)
   */
  private async handleCreateTable(sql: string, db: Db): Promise<any> {
    const tableMatch = sql.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
    if (!tableMatch) {
      throw new Error('Could not parse table name from CREATE TABLE query');
    }

    const tableName = tableMatch[1];
    const collection = db.collection(tableName);

    // Collections are created automatically in MongoDB, just verify it exists
    await collection.findOne({});

    return { rows: [] };
  }

  /**
   * Handle ALTER TABLE (MongoDB doesn't need this, but we'll log it)
   */
  private async handleAlterTable(sql: string, db: Db): Promise<any> {
    console.log('[MongoDB Adapter] ALTER TABLE not needed in MongoDB (schema-less)');
    return { rows: [] };
  }

  /**
   * Handle CREATE INDEX
   */
  private async handleCreateIndex(sql: string, db: Db): Promise<any> {
    const indexMatch = sql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?(\w+)\s+ON\s+(\w+)\s*\(([^)]+)\)/i);
    if (!indexMatch) {
      console.warn('[MongoDB Adapter] Could not parse CREATE INDEX query');
      return { rows: [] };
    }

    const indexName = indexMatch[1];
    const tableName = indexMatch[2];
    const fields = indexMatch[3].split(',').map(f => f.trim().replace(/"/g, ''));

    const collection = db.collection(tableName);
    const indexSpec: any = {};

    fields.forEach(field => {
      const camelField = this.snakeToCamel(field);
      indexSpec[camelField] = 1;
    });

    try {
      await collection.createIndex(indexSpec, { name: indexName, unique: sql.includes('UNIQUE') });
      console.log(`[MongoDB Adapter] Created index ${indexName} on ${tableName}`);
    } catch (error: any) {
      // Index might already exist, which is fine
      if (!error.message?.includes('already exists')) {
        console.warn(`[MongoDB Adapter] Index creation warning:`, error.message);
      }
    }

    return { rows: [] };
  }

  /**
   * Parse WHERE clause and convert to MongoDB filter
   */
  private parseWhereClause(sql: string, params: any[]): any {
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/i);
    if (!whereMatch) {
      return {};
    }

    const whereClause = whereMatch[1];
    const filter: any = {};

    // Handle simple WHERE conditions (e.g., "field = $1", "field <= $2")
    const conditions = whereClause.split(/\s+AND\s+/i);

    conditions.forEach(condition => {
      condition = condition.trim();
      
      // Match patterns like "field = $1", "field <= $2", "field IS NOT NULL"
      const eqMatch = condition.match(/(\w+)\s*=\s*\$(\d+)/);
      const neMatch = condition.match(/(\w+)\s*!=\s*\$(\d+)/);
      const leMatch = condition.match(/(\w+)\s*<=\s*\$(\d+)/);
      const geMatch = condition.match(/(\w+)\s*>=\s*\$(\d+)/);
      const ltMatch = condition.match(/(\w+)\s*<\s*\$(\d+)/);
      const gtMatch = condition.match(/(\w+)\s*>\s*\$(\d+)/);
      const isNotNullMatch = condition.match(/(\w+)\s+IS NOT NULL/i);
      const isNullMatch = condition.match(/(\w+)\s+IS NULL/i);
      const likeMatch = condition.match(/(\w+)\s+LIKE\s+['"](.+)['"]/i);

      if (eqMatch) {
        const field = this.snakeToCamel(eqMatch[1]);
        const paramIdx = parseInt(eqMatch[2]) - 1;
        filter[field] = params[paramIdx];
      } else if (neMatch) {
        const field = this.snakeToCamel(neMatch[1]);
        const paramIdx = parseInt(neMatch[2]) - 1;
        filter[field] = { $ne: params[paramIdx] };
      } else if (leMatch) {
        const field = this.snakeToCamel(leMatch[1]);
        const paramIdx = parseInt(leMatch[2]) - 1;
        filter[field] = { $lte: params[paramIdx] };
      } else if (geMatch) {
        const field = this.snakeToCamel(geMatch[1]);
        const paramIdx = parseInt(geMatch[2]) - 1;
        filter[field] = { $gte: params[paramIdx] };
      } else if (ltMatch) {
        const field = this.snakeToCamel(ltMatch[1]);
        const paramIdx = parseInt(ltMatch[2]) - 1;
        filter[field] = { $lt: params[paramIdx] };
      } else if (gtMatch) {
        const field = this.snakeToCamel(gtMatch[1]);
        const paramIdx = parseInt(gtMatch[2]) - 1;
        filter[field] = { $gt: params[paramIdx] };
      } else if (isNotNullMatch) {
        const field = this.snakeToCamel(isNotNullMatch[1]);
        filter[field] = { $ne: null };
      } else if (isNullMatch) {
        const field = this.snakeToCamel(isNullMatch[1]);
        filter[field] = null;
      } else if (likeMatch) {
        const field = this.snakeToCamel(likeMatch[1]);
        const pattern = likeMatch[2];
        // Convert SQL LIKE pattern to MongoDB regex
        // % = .*, _ = .
        const regexPattern = pattern.replace(/%/g, '.*').replace(/_/g, '.');
        filter[field] = { $regex: regexPattern, $options: 'i' };
      }
    });

    return filter;
  }

  /**
   * Parse VALUES clause
   */
  private parseValues(valuesStr: string, params: any[]): any[] {
    const values = valuesStr.split(',').map(v => v.trim());
    return values.map(val => {
      if (val.startsWith('$')) {
        const paramIdx = parseInt(val.substring(1)) - 1;
        return params[paramIdx];
      }
      return val;
    });
  }

  /**
   * Convert snake_case to camelCase
   */
  private snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Convert camelCase to snake_case
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Convert MongoDB document to PostgreSQL-like row format
   */
  private convertDocToRow(doc: any): any {
    const row: any = {};
    for (const [key, value] of Object.entries(doc)) {
      // Convert camelCase back to snake_case for compatibility
      const snakeKey = this.camelToSnake(key);
      row[snakeKey] = value;
      // Also keep camelCase for flexibility
      row[key] = value;
    }
    return row;
  }

  /**
   * Generate UUID (for compatibility with PostgreSQL)
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<void> {
    try {
      const db = await this.getDb();
      await db.admin().ping();
      console.log('[MongoDB Adapter] Connection test successful');
    } catch (error: any) {
      console.error('[MongoDB Adapter] Connection test failed:', error);
      throw new Error(`Failed to connect to MongoDB: ${error.message}`);
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.db = null;
    }
  }
}

