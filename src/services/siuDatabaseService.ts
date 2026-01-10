import { IAgentRuntime } from '@elizaos/core';
import { getSi3Database } from './si3Database.js';
import { UserProfile } from '../plugins/onboarding/types.js';

/**
 * SI U Database Service
 * Handles saving and updating user profiles in the SI U MongoDB database
 * Database: SI3 Ecosystem → SI U → SIU cluster → test-si3Users collection
 */

export interface SiuUserDocument {
  _id?: any;
  email: string;
  username?: string;
  name?: string;
  language?: string;
  location?: string;
  gender?: string;
  entryMethod?: 'wallet' | 'email';
  siuName?: string;
  wallet_address?: string;
  isWalletVerified?: boolean;
  walletInfo?: {
    network?: string;
  };
  roles?: string[];
  interests?: string[];
  personalValues?: string[];
  connectionGoals?: string[];
  events?: string[];
  digitalLinks?: string[];
  telegramHandle?: string;
  diversityResearchInterest?: string;
  notificationSettings?: {
    emailUpdates?: boolean;
    sessionReminder?: boolean;
    marketingEmails?: boolean;
    weeklyDigest?: boolean;
    eventAnnouncements?: boolean;
  };
  userTier?: 'explorer' | 'paid';
  onboardingCompletedAt?: Date;
  onboardingStartedAt?: Date;
  onboardingSource?: 'telegram' | 'web' | 'website';
  isVerified?: boolean;
  newsletter?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  lastLogin?: Date;
  profileImage?: string;
  aboutTags?: string[];
  additionalLinks?: string[];
  recentExperiences?: any[];
  versionUpdated?: boolean;
  __v?: number;
  // Website onboarding fields
  entryPoint?: 'onboard' | 'explore' | 'join-si-u';
  web3ExperienceLevel?: 'brand-new' | 'using-but-not-working' | 'working-in-web3';
  roleCategory?: 'marketing-sales-bd' | 'founder-cos-hr' | 'other';
  routedToProgram?: 'si-u-explorer' | 'si-her-guide' | 'grow3dge' | 'well-being';
  privacyPolicyAcknowledged?: boolean;
  siHerFormSubmitted?: boolean;
  siHerPaymentCompleted?: boolean;
  paymentTransactionId?: string;
  paymentDate?: Date;
  grow3dgeFormSubmitted?: boolean;
  wellBeingFormSubmitted?: boolean;
}

/**
 * Map notification string to notificationSettings object
 */
function mapNotificationsToSettings(notifications?: string): SiuUserDocument['notificationSettings'] {
  if (!notifications) return undefined;
  
  const notificationChoice = notifications.toLowerCase();
  const wantsNotifications = notificationChoice.includes('yes') || notificationChoice === '1';
  
  return {
    emailUpdates: wantsNotifications,
    sessionReminder: wantsNotifications,
    marketingEmails: false,
    weeklyDigest: wantsNotifications,
    eventAnnouncements: wantsNotifications,
  };
}

/**
 * Save or update user profile in SI U database
 * Called when onboarding completes
 */
export async function saveUserToSiuDatabase(
  runtime: IAgentRuntime,
  email: string,
  profile: UserProfile,
  userId: string,
  source: 'telegram' | 'web' | 'website' = 'web'
): Promise<boolean> {
  try {
    const db = await getSi3Database();
    if (!db) {
      console.error('[SI U Database] Database connection not available');
      return false;
    }

    const collection = db.collection('test-si3Users');
    const normalizedEmail = email.toLowerCase().trim();
    
    // Map UserProfile to SI U database schema
    const siuDocument: Partial<SiuUserDocument> = {
      email: normalizedEmail,
      updatedAt: new Date(),
      lastLogin: new Date(),
      onboardingSource: source,
    };

    // Map basic fields
    if (profile.name) {
      siuDocument.name = profile.name;
      siuDocument.username = profile.siuName || profile.name;
    }

    if (profile.siuName) {
      siuDocument.siuName = profile.siuName;
      siuDocument.username = profile.siuName;
    }

    if (profile.language) {
      siuDocument.language = profile.language;
    }

    if (profile.location) {
      siuDocument.location = profile.location;
    }

    if (profile.entryMethod) {
      siuDocument.entryMethod = profile.entryMethod;
    }

    if (profile.walletAddress) {
      siuDocument.wallet_address = profile.walletAddress;
      siuDocument.isWalletVerified = true;
      siuDocument.walletInfo = {
        network: 'Mainnet'
      };
    }

    // Map arrays
    if (profile.roles && profile.roles.length > 0) {
      siuDocument.roles = profile.roles;
    }

    if (profile.interests && profile.interests.length > 0) {
      siuDocument.interests = profile.interests;
    }

    if (profile.personalValues && profile.personalValues.length > 0) {
      siuDocument.personalValues = profile.personalValues;
    }

    if (profile.connectionGoals && profile.connectionGoals.length > 0) {
      siuDocument.connectionGoals = profile.connectionGoals;
    }

    if (profile.events && profile.events.length > 0) {
      siuDocument.events = profile.events;
    }

    // Map socials to digitalLinks
    if (profile.socials && profile.socials.length > 0) {
      siuDocument.digitalLinks = profile.socials;
    }

    if (profile.telegramHandle) {
      siuDocument.telegramHandle = profile.telegramHandle.replace('@', '');
    }

    if (profile.diversityResearchInterest) {
      siuDocument.diversityResearchInterest = profile.diversityResearchInterest;
    }

    // Map notifications
    if (profile.notifications) {
      siuDocument.notificationSettings = mapNotificationsToSettings(profile.notifications);
    }

    // User tier
    siuDocument.userTier = profile.userTier || 'explorer';

    // Onboarding timestamps
    if (profile.onboardingCompletedAt) {
      siuDocument.onboardingCompletedAt = profile.onboardingCompletedAt;
      siuDocument.isVerified = true;
    }

    if (profile.onboardingStartedAt) {
      siuDocument.onboardingStartedAt = profile.onboardingStartedAt;
    }

    // Map website onboarding fields
    if (profile.entryPoint) {
      siuDocument.entryPoint = profile.entryPoint;
    }

    if (profile.web3ExperienceLevel) {
      siuDocument.web3ExperienceLevel = profile.web3ExperienceLevel;
    }

    if (profile.roleCategory) {
      siuDocument.roleCategory = profile.roleCategory;
    }

    if (profile.routedToProgram) {
      siuDocument.routedToProgram = profile.routedToProgram;
    }

    if (profile.privacyPolicyAcknowledged !== undefined) {
      siuDocument.privacyPolicyAcknowledged = profile.privacyPolicyAcknowledged;
    }

    if (profile.siHerFormSubmitted !== undefined) {
      siuDocument.siHerFormSubmitted = profile.siHerFormSubmitted;
    }

    if (profile.siHerPaymentCompleted !== undefined) {
      siuDocument.siHerPaymentCompleted = profile.siHerPaymentCompleted;
    }

    if (profile.grow3dgeFormSubmitted !== undefined) {
      siuDocument.grow3dgeFormSubmitted = profile.grow3dgeFormSubmitted;
    }

    if (profile.wellBeingFormSubmitted !== undefined) {
      siuDocument.wellBeingFormSubmitted = profile.wellBeingFormSubmitted;
    }

    // Payment info (if available from profile)
    if ((profile as any).paymentTransactionId) {
      siuDocument.paymentTransactionId = (profile as any).paymentTransactionId;
    }

    if ((profile as any).paymentDate) {
      siuDocument.paymentDate = (profile as any).paymentDate;
    }

    // Check if user already exists
    const existingUser = await collection.findOne({ 
      email: normalizedEmail 
    });

    if (existingUser) {
      // Update existing user - preserve fields not in our update
      await collection.updateOne(
        { email: normalizedEmail },
        { 
          $set: siuDocument
        }
      );
      console.log(`[SI U Database] ✅ Updated user: ${email}`);
    } else {
      // Create new user with defaults
      const newUser: SiuUserDocument = {
        ...siuDocument,
        isVerified: !!profile.onboardingCompletedAt,
        newsletter: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        aboutTags: [],
        additionalLinks: [],
        recentExperiences: [],
        versionUpdated: true,
        __v: 0
      } as SiuUserDocument;

      await collection.insertOne(newUser);
      console.log(`[SI U Database] ✅ Created new user: ${email}`);
    }

    return true;
  } catch (error: any) {
    console.error('[SI U Database] Error saving user:', error);
    return false;
  }
}

/**
 * Update specific fields in SI U database (for profile edits)
 */
export async function updateSiuUserProfile(
  email: string,
  updates: Partial<SiuUserDocument>
): Promise<boolean> {
  try {
    const db = await getSi3Database();
    if (!db) {
      console.error('[SI U Database] Database connection not available');
      return false;
    }

    const collection = db.collection('test-si3Users');
    const normalizedEmail = email.toLowerCase().trim();
    
    const result = await collection.updateOne(
      { email: normalizedEmail },
      { 
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      console.log(`[SI U Database] User not found for update: ${email}`);
      return false;
    }

    console.log(`[SI U Database] ✅ Updated profile for: ${email}`);
    return true;
  } catch (error: any) {
    console.error('[SI U Database] Error updating profile:', error);
    return false;
  }
}

/**
 * Find user in SI U database by email
 */
export async function findSiuUserByEmail(email: string): Promise<SiuUserDocument | null> {
  try {
    const db = await getSi3Database();
    if (!db) {
      return null;
    }

    const collection = db.collection('test-si3Users');
    const user = await collection.findOne({ 
      email: email.toLowerCase().trim() 
    });

    return user as SiuUserDocument | null;
  } catch (error: any) {
    console.error('[SI U Database] Error finding user:', error);
    return null;
  }
}

/**
 * Find user in SI U database by wallet address
 */
export async function findSiuUserByWallet(walletAddress: string): Promise<SiuUserDocument | null> {
  try {
    const db = await getSi3Database();
    if (!db) {
      return null;
    }

    const collection = db.collection('test-si3Users');
    const user = await collection.findOne({ 
      wallet_address: walletAddress.toLowerCase().trim() 
    });

    return user as SiuUserDocument | null;
  } catch (error: any) {
    console.error('[SI U Database] Error finding user by wallet:', error);
    return null;
  }
}

/**
 * Find user in SI U database by SI U name
 */
export async function findSiuUserBySiuName(siuName: string): Promise<SiuUserDocument | null> {
  try {
    const db = await getSi3Database();
    if (!db) {
      return null;
    }

    const collection = db.collection('test-si3Users');
    const user = await collection.findOne({ 
      siuName: siuName.toLowerCase().trim() 
    });

    return user as SiuUserDocument | null;
  } catch (error: any) {
    console.error('[SI U Database] Error finding user by SI U name:', error);
    return null;
  }
}

/**
 * Check if SI U name is available
 */
export async function isSiuNameAvailable(siuName: string): Promise<boolean> {
  const existingUser = await findSiuUserBySiuName(siuName);
  return !existingUser;
}

/**
 * Check if wallet address is already registered
 */
export async function isWalletRegistered(walletAddress: string): Promise<boolean> {
  const existingUser = await findSiuUserByWallet(walletAddress);
  return !!existingUser;
}

/**
 * Get analytics data from SI U database
 */
export async function getSiuAnalyticsData(
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalUsers: number;
  bySource: { telegram: number; web: number };
  byEntryMethod: { wallet: number; email: number };
  byTier: { explorer: number; paid: number };
  siuNameClaims: number;
  walletConnections: number;
  recentCompletions: Array<{ date: string; count: number }>;
}> {
  try {
    const db = await getSi3Database();
    if (!db) {
      return {
        totalUsers: 0,
        bySource: { telegram: 0, web: 0 },
        byEntryMethod: { wallet: 0, email: 0 },
        byTier: { explorer: 0, paid: 0 },
        siuNameClaims: 0,
        walletConnections: 0,
        recentCompletions: []
      };
    }

    const collection = db.collection('test-si3Users');

    // Build date filter
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.onboardingCompletedAt = {};
      if (startDate) dateFilter.onboardingCompletedAt.$gte = startDate;
      if (endDate) dateFilter.onboardingCompletedAt.$lte = endDate;
    }

    // Total completed users
    const totalUsers = await collection.countDocuments({
      ...dateFilter,
      onboardingCompletedAt: { $exists: true }
    });

    // By source
    const bySource = {
      telegram: await collection.countDocuments({
        ...dateFilter,
        onboardingSource: 'telegram',
        onboardingCompletedAt: { $exists: true }
      }),
      web: await collection.countDocuments({
        ...dateFilter,
        onboardingSource: 'web',
        onboardingCompletedAt: { $exists: true }
      })
    };

    // By entry method
    const byEntryMethod = {
      wallet: await collection.countDocuments({
        ...dateFilter,
        entryMethod: 'wallet',
        onboardingCompletedAt: { $exists: true }
      }),
      email: await collection.countDocuments({
        ...dateFilter,
        entryMethod: 'email',
        onboardingCompletedAt: { $exists: true }
      })
    };

    // By tier
    const byTier = {
      explorer: await collection.countDocuments({
        ...dateFilter,
        userTier: 'explorer',
        onboardingCompletedAt: { $exists: true }
      }),
      paid: await collection.countDocuments({
        ...dateFilter,
        userTier: 'paid',
        onboardingCompletedAt: { $exists: true }
      })
    };

    // SI U name claims
    const siuNameClaims = await collection.countDocuments({
      ...dateFilter,
      siuName: { $exists: true, $ne: null },
      onboardingCompletedAt: { $exists: true }
    });

    // Wallet connections
    const walletConnections = await collection.countDocuments({
      ...dateFilter,
      wallet_address: { $exists: true, $ne: null },
      onboardingCompletedAt: { $exists: true }
    });

    // Recent completions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentAggregation = await collection.aggregate([
      {
        $match: {
          onboardingCompletedAt: { $gte: thirtyDaysAgo },
          ...(startDate || endDate ? dateFilter : {})
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$onboardingCompletedAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();

    const recentCompletions = recentAggregation.map((item: any) => ({
      date: item._id,
      count: item.count
    }));

    return {
      totalUsers,
      bySource,
      byEntryMethod,
      byTier,
      siuNameClaims,
      walletConnections,
      recentCompletions
    };
  } catch (error: any) {
    console.error('[SI U Database] Error getting analytics:', error);
    return {
      totalUsers: 0,
      bySource: { telegram: 0, web: 0 },
      byEntryMethod: { wallet: 0, email: 0 },
      byTier: { explorer: 0, paid: 0 },
      siuNameClaims: 0,
      walletConnections: 0,
      recentCompletions: []
    };
  }
}

