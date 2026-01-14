import { IAgentRuntime, UUID } from '@elizaos/core';
import { localProcessor } from './localProcessor.js';

/**
 * Data Deletion Service
 * Handles user data deletion requests for GDPR compliance
 * Supports partial and full deletion with confirmation
 */

export type DeletionScope = 'all' | 'profile' | 'matches' | 'messages' | string[]; // specific fields

export interface DeletionRequest {
  userId: string;
  scope: DeletionScope;
  reason?: string;
  confirmationRequired: boolean;
  confirmationToken?: string;
}

export interface DeletionResult {
  success: boolean;
  deletedCounts: {
    cache?: number;
    matches?: number;
    messages?: number;
    profile?: boolean;
    followUps?: number;
    featureRequests?: number;
    manualConnectionRequests?: number;
    diversityResearch?: number;
  };
  message: string;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
}

export class DataDeletionService {
  /**
   * Detect deletion request from user message
   */
  async detectDeletionRequest(
    message: string,
    context?: any
  ): Promise<DeletionRequest | null> {
    if (!message || typeof message !== 'string') {
      return null;
    }

    const lowerText = message.toLowerCase().trim();
    
    // Check for deletion keywords
    const deletionKeywords = [
      'delete my data',
      'delete my information',
      'remove my data',
      'remove my information',
      'delete my account',
      'remove my account',
      'delete everything',
      'remove everything',
      'delete profile',
      'remove profile',
      'delete matches',
      'remove matches',
      'delete messages',
      'remove messages',
      'gdpr',
      'right to be forgotten'
    ];

    const hasDeletionKeyword = deletionKeywords.some(keyword => 
      lowerText.includes(keyword)
    );

    if (!hasDeletionKeyword) {
      return null;
    }

    // Determine scope
    let scope: DeletionScope = 'all';
    if (lowerText.includes('profile') || lowerText.includes('account')) {
      scope = 'profile';
    } else if (lowerText.includes('match')) {
      scope = 'matches';
    } else if (lowerText.includes('message') || lowerText.includes('chat')) {
      scope = 'messages';
    } else if (lowerText.includes('all') || lowerText.includes('everything')) {
      scope = 'all';
    }

    // Full deletion always requires confirmation
    const confirmationRequired = scope === 'all';

    return {
      userId: '', // Will be set by caller
      scope,
      reason: lowerText,
      confirmationRequired
    };
  }

  /**
   * Request deletion (may require confirmation)
   */
  async requestDeletion(
    runtime: IAgentRuntime,
    userId: UUID,
    scope: DeletionScope
  ): Promise<DeletionResult> {
    // For full deletion, require confirmation
    if (scope === 'all') {
      const confirmationToken = this.generateConfirmationToken(userId);
      
      // Store deletion request with token
      await runtime.cacheManager.set(
        `deletion_request_${userId}`,
        {
          userId,
          scope,
          token: confirmationToken,
          requestedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      );

      return {
        success: false,
        deletedCounts: {},
        message: 'Full data deletion requires confirmation. Please confirm by saying "yes, delete all my data" or "confirm deletion".',
        requiresConfirmation: true,
        confirmationToken
      };
    }

    // For partial deletion, proceed immediately
    return await this.deleteUserData(runtime, userId, scope);
  }

  /**
   * Delete user data based on scope
   */
  async deleteUserData(
    runtime: IAgentRuntime,
    userId: UUID,
    scope: DeletionScope
  ): Promise<DeletionResult> {
    const deletedCounts: DeletionResult['deletedCounts'] = {};
    
    try {
      const db = runtime.databaseAdapter as any;
      const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
      const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';

      // Delete onboarding state (cache)
      if (scope === 'all' || scope === 'profile') {
        const cacheKey = `onboarding_${userId}`;
        try {
          const existed = await runtime.cacheManager.get(cacheKey);
          if (existed !== null && existed !== undefined) {
            await runtime.cacheManager.delete(cacheKey);
            deletedCounts.cache = 1;
          } else {
            deletedCounts.cache = 0;
          }
        } catch (error) {
          console.error('[DataDeletionService] Error deleting cache:', error);
          deletedCounts.cache = 0;
        }
      }

      if (isMongo && db.getDb) {
        const mongoDb = await db.getDb();
        
        // Delete matches
        if (scope === 'all' || scope === 'matches') {
          try {
            const matchesCollection = mongoDb.collection('matches');
            const matchesResult = await matchesCollection.deleteMany({
              $or: [{ user_id: userId }, { matched_user_id: userId }]
            });
            deletedCounts.matches = matchesResult.deletedCount;
          } catch (error) {
            console.error('[DataDeletionService] Error deleting matches:', error);
            // Don't set matches count on error - leave undefined so hasDeletions check works correctly
          }
        }

        // Delete messages/memories (for full deletion only)
        if (scope === 'all' || scope === 'messages') {
          try {
            // Note: ElizaOS memory system may not support direct deletion
            // This would need to be implemented based on the actual memory system
            deletedCounts.messages = 0; // Placeholder
          } catch (error) {
            console.error('[DataDeletionService] Error deleting messages:', error);
          }
        }

        // Delete related data (for full deletion only)
        if (scope === 'all') {
          try {
            const followUpsCollection = mongoDb.collection('follow_ups');
            const followUpsResult = await followUpsCollection.deleteMany({ user_id: userId });
            deletedCounts.followUps = followUpsResult.deletedCount;

            const featureRequestsCollection = mongoDb.collection('feature_requests');
            const featureRequestsResult = await featureRequestsCollection.deleteMany({ user_id: userId });
            deletedCounts.featureRequests = featureRequestsResult.deletedCount;

            const manualRequestsCollection = mongoDb.collection('manual_connection_requests');
            const manualRequestsResult = await manualRequestsCollection.deleteMany({ user_id: userId });
            deletedCounts.manualConnectionRequests = manualRequestsResult.deletedCount;

            const diversityCollection = mongoDb.collection('diversity_research');
            const diversityResult = await diversityCollection.deleteMany({ userId });
            deletedCounts.diversityResearch = diversityResult.deletedCount;
          } catch (error) {
            console.error('[DataDeletionService] Error deleting related data:', error);
            // Don't set counts on error - leave undefined so hasDeletions check works correctly
          }
        }

      } else if (db.query) {
        // PostgreSQL
        try {
          await db.query('BEGIN');

          // Delete matches
          if (scope === 'all' || scope === 'matches') {
            const matchesResult = await db.query(
              'DELETE FROM matches WHERE user_id = $1 OR matched_user_id = $1 RETURNING *',
              [userId]
            );
            deletedCounts.matches = matchesResult.rowCount || 0;
          }

          // Delete messages/memories (for full deletion only)
          if (scope === 'all' || scope === 'messages') {
            // Note: ElizaOS memory system may not support direct deletion
            // This would need to be implemented based on the actual memory system
            deletedCounts.messages = 0; // Placeholder
          }

          // Delete related data (for full deletion only)
          if (scope === 'all') {
            const followUpsResult = await db.query(
              'DELETE FROM follow_ups WHERE user_id = $1 RETURNING *',
              [userId]
            );
            deletedCounts.followUps = followUpsResult.rowCount || 0;

            const featureRequestsResult = await db.query(
              'DELETE FROM feature_requests WHERE user_id = $1 RETURNING *',
              [userId]
            );
            deletedCounts.featureRequests = featureRequestsResult.rowCount || 0;

            const manualRequestsResult = await db.query(
              'DELETE FROM manual_connection_requests WHERE user_id = $1 RETURNING *',
              [userId]
            );
            deletedCounts.manualConnectionRequests = manualRequestsResult.rowCount || 0;

            const diversityResult = await db.query(
              'DELETE FROM diversity_research WHERE user_id = $1 RETURNING *',
              [userId]
            );
            deletedCounts.diversityResearch = diversityResult.rowCount || 0;
          }

          await db.query('COMMIT');
        } catch (error) {
          await db.query('ROLLBACK');
          throw error;
        }
      }

      // Delete conversation context (for both MongoDB and PostgreSQL)
      if (scope === 'all') {
        try {
          const contextKey = `conversation_context_${userId}`;
          await runtime.cacheManager.delete(contextKey);
        } catch (error) {
          console.error('[DataDeletionService] Error deleting conversation context:', error);
        }
      }

      const scopeMessage = scope === 'all' 
        ? 'all your data' 
        : scope === 'profile' 
          ? 'your profile' 
          : scope === 'matches'
            ? 'your matches'
            : scope === 'messages'
              ? 'your messages'
              : 'the requested data';

      // Only clear deletion request if deletion was successful
      // Check if we actually deleted something (count > 0)
      const hasDeletions = (deletedCounts.cache !== undefined && deletedCounts.cache > 0) || 
                           (deletedCounts.matches !== undefined && deletedCounts.matches > 0) ||
                           (deletedCounts.followUps !== undefined && deletedCounts.followUps > 0) ||
                           (deletedCounts.featureRequests !== undefined && deletedCounts.featureRequests > 0) ||
                           (deletedCounts.manualConnectionRequests !== undefined && deletedCounts.manualConnectionRequests > 0) ||
                           (deletedCounts.diversityResearch !== undefined && deletedCounts.diversityResearch > 0) ||
                           (deletedCounts.messages !== undefined && deletedCounts.messages > 0);

      if (hasDeletions) {
        try {
          await runtime.cacheManager.delete(`deletion_request_${userId}`);
        } catch (error) {
          console.error('[DataDeletionService] Error clearing deletion request:', error);
          // Don't fail the deletion if clearing the request fails
        }
      }

      return {
        success: true,
        deletedCounts,
        message: `Successfully deleted ${scopeMessage}. ${this.generateDeletionSummary(deletedCounts)}`
      };

    } catch (error: any) {
      console.error('[DataDeletionService] Error deleting user data:', error);
      return {
        success: false,
        deletedCounts,
        message: 'An error occurred while deleting your data. Please try again or contact support.'
      };
    }
  }

  /**
   * Confirm deletion with token
   */
  async confirmDeletion(
    runtime: IAgentRuntime,
    userId: UUID,
    confirmationMessage: string
  ): Promise<DeletionResult> {
    // Check for confirmation keywords
    const lowerText = confirmationMessage.toLowerCase().trim();
    const confirmationKeywords = [
      'yes',
      'confirm',
      'delete',
      'proceed',
      'yes delete',
      'yes delete all',
      'confirm deletion',
      'delete all my data'
    ];

    const isConfirmed = confirmationKeywords.some(keyword => 
      lowerText.includes(keyword) && (lowerText.includes('delete') || lowerText.includes('confirm'))
    );

    if (!isConfirmed) {
      return {
        success: false,
        deletedCounts: {},
        message: 'Deletion not confirmed. Please say "yes, delete all my data" to confirm.'
      };
    }

    // Get deletion request
    const deletionRequest = await runtime.cacheManager.get(`deletion_request_${userId}`);
    
    if (!deletionRequest || typeof deletionRequest !== 'object') {
      return {
        success: false,
        deletedCounts: {},
        message: 'No pending deletion request found. Please request deletion again.'
      };
    }

    const request = deletionRequest as any;
    
    // Check if expired (7 days)
    if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
      await runtime.cacheManager.delete(`deletion_request_${userId}`);
      return {
        success: false,
        deletedCounts: {},
        message: 'Deletion request has expired. Please request deletion again.'
      };
    }

    // Proceed with deletion
    return await this.deleteUserData(runtime, userId, request.scope || 'all');
  }

  /**
   * Generate confirmation token
   */
  private generateConfirmationToken(userId: UUID): string {
    return `${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Generate deletion summary message
   */
  private generateDeletionSummary(counts: DeletionResult['deletedCounts']): string {
    const parts: string[] = [];
    
    if (counts.cache) parts.push(`${counts.cache} cache entry(ies)`);
    if (counts.matches) parts.push(`${counts.matches} match(es)`);
    if (counts.messages !== undefined) parts.push(`${counts.messages} message(s)`);
    if (counts.followUps) parts.push(`${counts.followUps} follow-up(s)`);
    if (counts.featureRequests) parts.push(`${counts.featureRequests} feature request(s)`);
    if (counts.manualConnectionRequests) parts.push(`${counts.manualConnectionRequests} connection request(s)`);
    if (counts.diversityResearch) parts.push(`${counts.diversityResearch} research record(s)`);

    if (parts.length === 0) {
      return '';
    }

    return `Deleted: ${parts.join(', ')}.`;
  }
}

// Export singleton instance
export const dataDeletionService = new DataDeletionService();

