import { MongoClient, Db } from 'mongodb';

/**
 * Service for connecting to and querying the SI<3> database
 * Used to fetch user roles and profile information during onboarding
 */

let si3Client: MongoClient | null = null;
let si3Db: Db | null = null;
let si3ConnectionPromise: Promise<Db> | null = null; // Prevent race conditions

/**
 * Warm up SI<3> database connection (non-blocking)
 * Called on startup to improve first-request performance
 */
export async function warmUpSi3Connection(): Promise<void> {
  if (si3Db) {
    return; // Already connected
  }

  // If connection is already in progress, wait for it
  if (si3ConnectionPromise) {
    try {
      await si3ConnectionPromise;
      return;
    } catch {
      return;
    }
  }

  const connectionString = process.env.SI3_DATABASE_URL;
  if (!connectionString) {
    return; // Not configured, skip
  }

  try {
    console.log('[SI3 Database] 🔥 Warming up connection on startup...');
    const options: any = {
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false,
      retryWrites: true,
      w: 'majority',
      serverSelectionTimeoutMS: 60000,
      connectTimeoutMS: 60000,
      retryReads: true,
      socketTimeoutMS: 60000,
      heartbeatFrequencyMS: 10000,
      maxIdleTimeMS: 30000,
      maxPoolSize: 20,
      minPoolSize: 2,
      waitQueueTimeoutMS: 30000,
    };
    
    si3Client = new MongoClient(connectionString, options);
    
    // Create connection promise to prevent race conditions
    si3ConnectionPromise = (async () => {
      await si3Client!.connect();
      const dbName = extractDbName(connectionString) || 'si3';
      si3Db = si3Client!.db(dbName);
      return si3Db;
    })();
    
    await si3ConnectionPromise;
    si3ConnectionPromise = null; // Clear promise after success
    console.log(`[SI3 Database] ✅ Connection warmed up successfully (database: ${extractDbName(connectionString) || 'si3'})`);
  } catch (error: any) {
    si3ConnectionPromise = null; // Clear promise on failure
    const errorMessage = error?.message || error?.toString() || '';
    const isReplicaSetError = 
      errorMessage.includes('ReplicaSetNoPrimary') ||
      errorMessage.includes('MongoServerSelectionError');
    
    if (isReplicaSetError) {
      console.warn('[SI3 Database] ⚠️ Connection warm-up failed (replica set issue) - will retry on first use');
    } else {
      console.warn('[SI3 Database] ⚠️ Connection warm-up failed - will retry on first use:', errorMessage.substring(0, 200));
    }
    // Reset on failure so getSi3Database can retry
    si3Client = null;
    si3Db = null;
  }
}

/**
 * Get or create connection to SI<3> database
 */
export async function getSi3Database(): Promise<Db | null> {
  const connectionString = process.env.SI3_DATABASE_URL;
  
  if (!connectionString) {
    console.warn('[SI3 Database] SI3_DATABASE_URL not configured - role-based onboarding will be disabled');
    return null;
  }

  if (si3Db) {
    return si3Db;
  }

  // If connection is already in progress (e.g., from warmUpSi3Connection), wait for it
  if (si3ConnectionPromise) {
    try {
      return await si3ConnectionPromise;
    } catch {
      // Connection failed, continue to retry logic below
    }
  }

  // Retry connection with exponential backoff
  const maxRetries = 3;
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[SI3 Database] Connecting to SI<3> database (attempt ${attempt}/${maxRetries})...`);
      
      const options: any = {
        tlsAllowInvalidCertificates: false,
        tlsAllowInvalidHostnames: false,
        retryWrites: true,
        w: 'majority',
        // Increased timeouts for better resilience during Atlas issues
        serverSelectionTimeoutMS: 60000, // 60 seconds (was 30)
        connectTimeoutMS: 60000, // 60 seconds (was 30)
        retryReads: true,
        socketTimeoutMS: 60000, // 60 seconds (was 30)
        heartbeatFrequencyMS: 10000,
        maxIdleTimeMS: 30000,
      maxPoolSize: 20, // Increased from 10 to handle more concurrent operations
      minPoolSize: 2, // Keep minimum connections alive
        waitQueueTimeoutMS: 30000,
      };
      
      si3Client = new MongoClient(connectionString, options);
      
      // Create connection promise to prevent race conditions
      si3ConnectionPromise = (async () => {
        await si3Client!.connect();
        const dbName = extractDbName(connectionString) || 'si3';
        si3Db = si3Client!.db(dbName);
        return si3Db;
      })();
      
      const db = await si3ConnectionPromise;
      si3ConnectionPromise = null; // Clear promise after success
      console.log(`[SI3 Database] Successfully connected to SI<3> database: ${extractDbName(connectionString) || 'si3'}`);
      return db;
    } catch (error: any) {
      si3ConnectionPromise = null; // Clear promise on failure
      lastError = error;
      const errorMessage = error?.message || error?.toString() || '';
      const isReplicaSetError = 
        errorMessage.includes('ReplicaSetNoPrimary') ||
        errorMessage.includes('MongoServerSelectionError');
      
      if (isReplicaSetError && attempt < maxRetries) {
        // Wait before retry with exponential backoff
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
        console.warn(`[SI3 Database] Replica set issue detected, retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // If not a replica set error or last attempt, log and return null
      if (attempt === maxRetries || !isReplicaSetError) {
        console.error('[SI3 Database] Connection error:', error.message);
        console.error('[SI3 Database] Connection string (sanitized):', 
          connectionString.replace(/:[^:@]+@/, ':****@'));
        return null;
      }
    }
  }
  
  // Should never reach here, but just in case
  return null;
}

/**
 * Extract database name from MongoDB connection string
 */
function extractDbName(connectionString: string): string | null {
  const match = connectionString.match(/\/([^/?]+)(\?|$)/);
  return match ? match[1] : null;
}

/**
 * Search for a user in SI<3> database by email
 * Returns user data including roles if found
 * 
 * @param email - Email address to search for
 * @param collectionName - Name of the collection to search (default: 'users')
 * @param emailField - Name of the email field in the document (default: 'email')
 * @returns User document with roles, or null if not found
 */
export async function findSi3UserByEmail(
  email: string,
  collectionName: string = 'si3Users',
  emailField: string = 'email'
): Promise<{ email: string; roles?: string[]; username?: string; interests?: string[]; personalValues?: string[]; [key: string]: any } | null> {
  const db = await getSi3Database();
  
  if (!db) {
    return null;
  }

  try {
    const collection = db.collection(collectionName);
    
    // Case-insensitive email search
    const query: any = {};
    query[emailField] = { $regex: new RegExp(`^${email}$`, 'i') };
    
    const user = await collection.findOne(query);
    
    if (user) {
      console.log(`[SI3 Database] Found user with email ${email} in collection ${collectionName}`);
      return user as any;
    }
    
    console.log(`[SI3 Database] No user found with email ${email} in collection ${collectionName}`);
    return null;
  } catch (error: any) {
    console.error(`[SI3 Database] Error searching for user by email:`, error.message);
    return null;
  }
}

/**
 * Role to Platform Mapping
 * - "team" role = SI Her member
 * - "partner" role = Grow3dge member
 */
export const ROLE_TO_PLATFORM: Record<string, string> = {
  'team': 'SI Her',
  'partner': 'Grow3dge'
};

/**
 * Get platform membership from roles
 * Returns the primary platform based on roles
 */
export function getPlatformFromRoles(roles: string[]): string | null {
  // Check for platform-specific roles
  if (roles.includes('team')) {
    return 'SI Her';
  }
  if (roles.includes('partner')) {
    return 'Grow3dge';
  }
  // User might have both roles
  if (roles.includes('team') && roles.includes('partner')) {
    return 'SI Her & Grow3dge';
  }
  return null;
}

/**
 * Check if user is SI Her member
 */
export function isSiHerMember(roles: string[]): boolean {
  return roles.includes('team');
}

/**
 * Check if user is Grow3dge member
 */
export function isGrow3dgeMember(roles: string[]): boolean {
  return roles.includes('partner');
}

/**
 * Close SI<3> database connection
 */
export async function closeSi3Connection(): Promise<void> {
  if (si3Client) {
    await si3Client.close();
    si3Client = null;
    si3Db = null;
    console.log('[SI3 Database] Connection closed');
  }
}

