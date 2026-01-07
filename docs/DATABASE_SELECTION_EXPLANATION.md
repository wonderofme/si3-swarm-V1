# How the Agent Knows Which Database to Use

## Overview
The agent uses **environment variables** to determine which database type and connection to use. The system supports **multiple databases** for different purposes.

---

## Database Types & Configuration

### 1. **Main Database (Kaia's Primary Database)**
**Purpose:** Stores agent state, cache, matches, feature requests, etc.

**Environment Variables:**
- `DATABASE_TYPE` - Determines database type: `postgres` or `mongodb` (default: `postgres`)
- `DATABASE_URL` - Connection string for the main database

**How It Works:**
```typescript
// In src/adapters/databaseAdapter.ts
const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();

if (databaseType === 'mongodb' || databaseType === 'mongo') {
  return new MongoAdapter(databaseUrl);  // MongoDB
} else {
  return new PostgresDatabaseAdapter({   // PostgreSQL (default)
    connectionString: databaseUrl
  });
}
```

**Usage Throughout Code:**
```typescript
// Every service checks DATABASE_TYPE to determine which adapter to use
const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';

if (isMongo && db.getDb) {
  // Use MongoDB methods
  const mongoDb = await db.getDb();
  const collection = mongoDb.collection('cache');
} else if (db.query) {
  // Use PostgreSQL methods
  await db.query('SELECT * FROM cache WHERE key = $1', [key]);
}
```

---

### 2. **SI<3> Database (External)**
**Purpose:** Fetches user roles to determine platform-specific onboarding questions (Grow3dge vs SI Her)

**Environment Variable:**
- `SI3_DATABASE_URL` - MongoDB connection string for SI<3> database

**How It Works:**
```typescript
// In src/services/si3Database.ts
export async function getSi3Database(): Promise<Db | null> {
  const connectionString = process.env.SI3_DATABASE_URL;
  
  if (!connectionString) {
    console.warn('[SI3 Database] SI3_DATABASE_URL not configured');
    return null;  // Gracefully handles missing config
  }
  
  // Always MongoDB for SI<3> database
  si3Client = new MongoClient(connectionString, options);
  await si3Client.connect();
  si3Db = si3Client.db(dbName);
  return si3Db;
}
```

**Usage:**
- Called during `ASK_EMAIL` step
- Searches `si3Users` collection for user roles
- Used to determine which onboarding questions to show

---

### 3. **SI U Database (External)**
**Purpose:** Stores completed user profiles in the SI U MongoDB database

**Environment Variable:**
- Uses the same `SI3_DATABASE_URL` (same MongoDB cluster, different collection)

**How It Works:**
```typescript
// In src/services/siuDatabaseService.ts
export async function saveUserToSiuDatabase(...) {
  const db = await getSi3Database();  // Uses SI3_DATABASE_URL
  if (!db) {
    return false;  // Gracefully handles missing connection
  }
  
  const collection = db.collection('test-si3Users');  // Different collection
  // Save user profile...
}
```

**Note:** SI U database uses the same connection as SI<3> database but different collections:
- SI<3> uses: `si3Users` collection
- SI U uses: `test-si3Users` collection

---

## Database Selection Logic

### **Step 1: Check Environment Variables**
```typescript
// On startup (src/index.ts)
const db = createDatabaseAdapter();  // Reads DATABASE_TYPE and DATABASE_URL
```

### **Step 2: Create Appropriate Adapter**
```typescript
// src/adapters/databaseAdapter.ts
if (databaseType === 'mongodb' || databaseType === 'mongo') {
  return new MongoAdapter(databaseUrl);  // MongoDB adapter
} else {
  return new PostgresDatabaseAdapter({   // PostgreSQL adapter (default)
    connectionString: databaseUrl
  });
}
```

### **Step 3: Runtime Detection in Services**
Throughout the codebase, services check the database type at runtime:

```typescript
// Example from webChatApi.ts
const db = runtime.databaseAdapter as any;
const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';

if (isMongo && db.getDb) {
  // MongoDB path
  const mongoDb = await db.getDb();
  const cacheCollection = mongoDb.collection('cache');
  const docs = await cacheCollection.find({...}).toArray();
} else if (db.query) {
  // PostgreSQL path
  const result = await db.query('SELECT * FROM cache WHERE key = $1', [key]);
}
```

---

## Database Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Runtime                         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Main Database (DATABASE_URL)                    │  │
│  │  Type: DATABASE_TYPE (postgres/mongodb)          │  │
│  │                                                    │  │
│  │  Collections/Tables:                              │  │
│  │  - cache (onboarding state)                      │  │
│  │  - matches (user matches)                        │  │
│  │  - feature_requests                               │  │
│  │  - user_mappings (cross-platform linking)        │  │
│  │  - follow_ups                                     │  │
│  │  - diversity_research                             │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  SI<3> Database (SI3_DATABASE_URL)                │  │
│  │  Type: Always MongoDB                            │  │
│  │                                                    │  │
│  │  Collections:                                    │  │
│  │  - si3Users (for role detection)                  │  │
│  │  - test-si3Users (SI U user profiles) ⭐         │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Environment Variables Summary

| Variable | Purpose | Default | Example |
|----------|---------|---------|---------|
| `DATABASE_TYPE` | Main database type | `postgres` | `mongodb` or `postgres` |
| `DATABASE_URL` | Main database connection | Required | `postgresql://...` or `mongodb://...` |
| `SI3_DATABASE_URL` | SI<3> & SI U database | Optional | `mongodb+srv://...` |

---

## How Services Determine Database Type

### **Pattern Used Everywhere:**
```typescript
// 1. Get database adapter from runtime
const db = runtime.databaseAdapter as any;

// 2. Check environment variable
const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';

// 3. Use appropriate methods
if (isMongo && db.getDb) {
  // MongoDB: Use getDb() → collection() → find/insert/update
  const mongoDb = await db.getDb();
  const collection = mongoDb.collection('collectionName');
  const result = await collection.findOne({...});
} else if (db.query) {
  // PostgreSQL: Use query() with SQL
  const result = await db.query('SELECT * FROM table WHERE id = $1', [id]);
}
```

### **Files That Use This Pattern:**
- `src/services/webChatApi.ts` - Web chat handling
- `src/services/analyticsApi.ts` - Analytics queries
- `src/services/matchingEngine.ts` - Matching logic
- `src/services/metricsApi.ts` - Metrics collection
- `src/services/matchTracker.ts` - Match tracking
- `src/services/featureRequest.ts` - Feature requests
- `src/plugins/onboarding/utils.ts` - Onboarding state
- `src/plugins/onboarding/actions.ts` - Onboarding actions
- `src/index.ts` - Telegram handlers
- `src/adapters/dbCache.ts` - Cache adapter

---

## Database Connection Flow

### **On Startup:**
```
1. Read DATABASE_TYPE from environment
2. Read DATABASE_URL from environment
3. Create appropriate adapter (MongoDB or PostgreSQL)
4. Test connection
5. If fails → Log error but continue (non-fatal)
6. Pass adapter to AgentRuntime
```

### **During Runtime:**
```
1. Service needs to query database
2. Gets databaseAdapter from runtime
3. Checks DATABASE_TYPE environment variable
4. Uses appropriate methods:
   - MongoDB: db.getDb() → collection() → MongoDB operations
   - PostgreSQL: db.query() → SQL queries
```

---

## Special Cases

### **1. SI<3> Database (Always MongoDB)**
- Uses `SI3_DATABASE_URL` environment variable
- Always MongoDB (not configurable)
- Separate connection from main database
- Used for:
  - Role detection during onboarding
  - Saving to SI U database (`test-si3Users` collection)

### **2. Graceful Degradation**
- If `SI3_DATABASE_URL` is missing:
  - Role-based onboarding questions disabled
  - SI U database saves fail gracefully
  - Agent continues to work with main database only

- If main database connection fails:
  - Agent logs error but continues
  - Cache-dependent features unavailable
  - Chat still works (uses in-memory state)

### **3. Database Type Detection**
The code checks for database type in two ways:

**Method 1: Environment Variable (Preferred)**
```typescript
const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
```

**Method 2: Adapter Method Detection (Fallback)**
```typescript
if (db.getDb) {
  // Likely MongoDB (has getDb method)
} else if (db.query) {
  // Likely PostgreSQL (has query method)
}
```

---

## Example: Complete Flow

### **Scenario: User sends email during onboarding**

1. **Web API receives message:**
   ```typescript
   // In webChatApi.ts
   const db = runtime.databaseAdapter;  // From runtime
   ```

2. **Check database type:**
   ```typescript
   const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
   const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
   ```

3. **Query for existing email:**
   ```typescript
   if (isMongo && db.getDb) {
     // MongoDB path
     const mongoDb = await db.getDb();
     const cacheCollection = mongoDb.collection('cache');
     const docs = await cacheCollection.find({
       key: { $regex: /^onboarding_/ }
     }).toArray();
   } else if (db.query) {
     // PostgreSQL path
     const result = await db.query(`
       SELECT key, value FROM cache 
       WHERE key LIKE 'onboarding_%'
     `);
   }
   ```

4. **Check SI<3> database for roles:**
   ```typescript
   // Uses separate connection
   const si3Db = await getSi3Database();  // Uses SI3_DATABASE_URL
   if (si3Db) {
     const collection = si3Db.collection('si3Users');
     const user = await collection.findOne({ email: emailText });
     // Get roles for platform detection
   }
   ```

5. **Save to SI U database on completion:**
   ```typescript
   // Uses same SI<3> connection, different collection
   const siuDb = await getSi3Database();  // Uses SI3_DATABASE_URL
   const collection = siuDb.collection('test-si3Users');
   await collection.insertOne(userProfile);
   ```

---

## Configuration Examples

### **PostgreSQL Setup:**
```bash
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://user:pass@host:5432/kaia
SI3_DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/si3
```

### **MongoDB Setup:**
```bash
DATABASE_TYPE=mongodb
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/kaia
SI3_DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/si3
```

### **Minimal Setup (PostgreSQL + SI<3>):**
```bash
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://localhost:5432/kaia
# SI3_DATABASE_URL optional - disables role detection if missing
```

---

## Key Points

1. **Main Database:** Determined by `DATABASE_TYPE` environment variable
2. **SI<3> Database:** Always MongoDB, uses `SI3_DATABASE_URL`
3. **SI U Database:** Same connection as SI<3>, different collection
4. **Runtime Detection:** Services check `DATABASE_TYPE` at runtime
5. **Graceful Degradation:** Missing databases don't crash the agent
6. **Default:** PostgreSQL if `DATABASE_TYPE` not set

---

## Summary

The agent knows which database to use through:
- ✅ **Environment variables** (`DATABASE_TYPE`, `DATABASE_URL`, `SI3_DATABASE_URL`)
- ✅ **Runtime checks** in every service that queries the database
- ✅ **Adapter pattern** that provides a unified interface
- ✅ **Method detection** (checks for `getDb()` for MongoDB or `query()` for PostgreSQL)

The system is **flexible** - you can switch between PostgreSQL and MongoDB by changing one environment variable, and the code automatically adapts!

