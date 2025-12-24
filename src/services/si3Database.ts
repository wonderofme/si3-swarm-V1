import { MongoClient, Db } from 'mongodb';

/**
 * Service for connecting to and querying the SI<3> database
 * Used to fetch user roles and profile information during onboarding
 */

let si3Client: MongoClient | null = null;
let si3Db: Db | null = null;

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

  try {
    console.log('[SI3 Database] Connecting to SI<3> database...');
    
    const options: any = {
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false,
      retryWrites: true,
      w: 'majority',
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      retryReads: true,
      socketTimeoutMS: 30000,
    };
    
    si3Client = new MongoClient(connectionString, options);
    await si3Client.connect();
    
    // Extract database name from connection string or use default
    const dbName = extractDbName(connectionString) || 'si3';
    si3Db = si3Client.db(dbName);
    
    console.log(`[SI3 Database] Successfully connected to SI<3> database: ${dbName}`);
    return si3Db;
  } catch (error: any) {
    console.error('[SI3 Database] Connection error:', error.message);
    console.error('[SI3 Database] Connection string (sanitized):', 
      connectionString.replace(/:[^:@]+@/, ':****@'));
    return null;
  }
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

