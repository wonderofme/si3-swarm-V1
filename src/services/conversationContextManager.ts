import { IAgentRuntime, UUID } from '@elizaos/core';
import { OnboardingStep, UserProfile } from '../plugins/onboarding/types.js';

/**
 * Conversation Context Manager
 * Tracks conversation state, current task, user intent, and conversation history
 * This enables the agent to maintain context across interactions and handle interruptions
 */

export type TaskType = 'onboarding' | 'matching' | 'general' | 'editing' | 'question' | 'knowledge_query' | 'data_deletion';
export type TaskState = 'active' | 'paused' | 'interrupted' | 'completed';

export interface ConversationMessage {
  role: 'user' | 'agent';
  message: string;
  timestamp: Date;
  intent?: string;
  extractedInfo?: Record<string, any>;
}

export interface ConversationContext {
  currentTask: TaskType;
  currentStep?: OnboardingStep | string;
  taskState: TaskState;
  pendingFields: string[]; // Fields we're waiting for
  extractedData: Record<string, any>; // Data extracted from conversation
  conversationHistory: ConversationMessage[];
  canGoBack: boolean;
  canAskQuestions: boolean;
  interruptionCount: number;
  lastUpdated: Date;
  userId: UUID;
}

export class ConversationContextManager {
  private cachePrefix = 'conversation_context_';
  private maxHistoryLength = 10; // Keep last 10 messages for context

  /**
   * Get conversation context for a user
   */
  async getContext(runtime: IAgentRuntime, userId: UUID): Promise<ConversationContext> {
    // Resolve primary userId once
    let primaryUserId: UUID;
    try {
      primaryUserId = await this.resolvePrimaryUserId(runtime, userId);
    } catch (error) {
      console.error('[ConversationContextManager] Error resolving primary userId:', error);
      primaryUserId = userId; // Fallback to original userId
    }
    
    try {
      const cacheKey = `${this.cachePrefix}${primaryUserId}`;
      const cached = await runtime.cacheManager.get(cacheKey);
      if (cached && typeof cached === 'object') {
        const context = cached as ConversationContext;
        // Ensure all required fields exist
        return {
          currentTask: context.currentTask || 'general',
          currentStep: context.currentStep,
          taskState: context.taskState || 'active',
          pendingFields: context.pendingFields || [],
          extractedData: context.extractedData || {},
          conversationHistory: context.conversationHistory || [],
          canGoBack: context.canGoBack ?? true,
          canAskQuestions: context.canAskQuestions ?? true,
          interruptionCount: context.interruptionCount || 0,
          lastUpdated: context.lastUpdated || new Date(),
          userId: primaryUserId
        };
      }
    } catch (error) {
      console.error('[ConversationContextManager] Error getting context from cache:', error);
    }

    // Return default context with primary userId
    return this.createDefaultContext(primaryUserId);
  }

  /**
   * Update conversation context
   * Optimized: Accepts optional currentContext to avoid redundant getContext call
   */
  async updateContext(
    runtime: IAgentRuntime,
    userId: UUID,
    updates: Partial<ConversationContext>,
    currentContext?: ConversationContext
  ): Promise<void> {
    try {
      const primaryUserId = await this.resolvePrimaryUserId(runtime, userId);
      const cacheKey = `${this.cachePrefix}${primaryUserId}`;
      
      // Use provided context or fetch if not provided
      // Validate that provided context belongs to the correct user
      const context = (currentContext && currentContext.userId === primaryUserId)
        ? currentContext
        : await this.getContext(runtime, primaryUserId);
      const updatedContext: ConversationContext = {
        ...context,
        ...updates,
        lastUpdated: new Date(),
        userId: primaryUserId
      };

      await runtime.cacheManager.set(cacheKey, updatedContext);
    } catch (error) {
      console.error('[ConversationContextManager] Error updating context:', error);
    }
  }

  /**
   * Add a message to conversation history
   */
  async addToHistory(
    runtime: IAgentRuntime,
    userId: UUID,
    message: ConversationMessage
  ): Promise<void> {
    try {
      const context = await this.getContext(runtime, userId);
      const history = [...context.conversationHistory, message];
      
      // Keep only last N messages
      const trimmedHistory = history.slice(-this.maxHistoryLength);
      
      await this.updateContext(runtime, userId, {
        conversationHistory: trimmedHistory
      });
    } catch (error) {
      console.error('[ConversationContextManager] Error adding to history:', error);
    }
  }

  /**
   * Initialize context from onboarding state
   */
  async initializeFromOnboarding(
    runtime: IAgentRuntime,
    userId: UUID,
    step: OnboardingStep,
    profile: UserProfile
  ): Promise<void> {
    const context = await this.getContext(runtime, userId);
    
    // Determine pending fields based on current step
    const pendingFields = this.getPendingFieldsForStep(step, profile);
    
    // Merge profile data with existing extractedData (don't lose conversation-extracted data)
    const profileData = this.extractDataFromProfile(profile);
    const mergedExtractedData = { ...context.extractedData, ...profileData };
    
    await this.updateContext(runtime, userId, {
      currentTask: 'onboarding',
      currentStep: step,
      taskState: 'active',
      pendingFields,
      extractedData: mergedExtractedData
    });
  }

  /**
   * Pause current task (e.g., when user asks a question)
   */
  async pauseTask(
    runtime: IAgentRuntime,
    userId: UUID,
    reason: string
  ): Promise<void> {
    const context = await this.getContext(runtime, userId);
    
    await this.updateContext(runtime, userId, {
      taskState: 'paused',
      interruptionCount: context.interruptionCount + 1
    });
  }

  /**
   * Resume paused task
   */
  async resumeTask(runtime: IAgentRuntime, userId: UUID): Promise<void> {
    await this.updateContext(runtime, userId, {
      taskState: 'active'
    });
  }

  /**
   * Check if task can be resumed
   */
  async canResumeTask(runtime: IAgentRuntime, userId: UUID): Promise<boolean> {
    const context = await this.getContext(runtime, userId);
    return context.taskState === 'paused' || context.taskState === 'interrupted';
  }

  /**
   * Get recent conversation history (last N messages)
   */
  async getRecentHistory(
    runtime: IAgentRuntime,
    userId: UUID,
    limit: number = 5
  ): Promise<ConversationMessage[]> {
    const context = await this.getContext(runtime, userId);
    return context.conversationHistory.slice(-limit);
  }

  /**
   * Clear conversation context (e.g., on restart)
   */
  async clearContext(runtime: IAgentRuntime, userId: UUID): Promise<void> {
    try {
      const primaryUserId = await this.resolvePrimaryUserId(runtime, userId);
      const cacheKey = `${this.cachePrefix}${primaryUserId}`;
      await runtime.cacheManager.delete(cacheKey);
    } catch (error) {
      console.error('[ConversationContextManager] Error clearing context:', error);
    }
  }

  /**
   * Get pending fields for a given onboarding step
   */
  private getPendingFieldsForStep(step: OnboardingStep, profile: UserProfile): string[] {
    const pending: string[] = [];
    
    switch (step) {
      case 'ASK_NAME':
        if (!profile.name) pending.push('name');
        break;
      case 'ASK_LANGUAGE':
        if (!profile.language) pending.push('language');
        break;
      case 'ASK_EMAIL':
        if (!profile.email) pending.push('email');
        break;
      case 'ASK_COMPANY':
        if (!profile.company) pending.push('company');
        break;
      case 'ASK_TITLE':
        if (!profile.title) pending.push('title');
        break;
      case 'ASK_ROLE':
        if (!profile.roles || profile.roles.length === 0) pending.push('roles');
        break;
      case 'ASK_INTERESTS':
        if (!profile.interests || profile.interests.length === 0) pending.push('interests');
        break;
      case 'ASK_CONNECTION_GOALS':
        if (!profile.connectionGoals || profile.connectionGoals.length === 0) pending.push('connectionGoals');
        break;
      case 'ASK_WALLET_CONNECTION':
        if (!profile.walletAddress) pending.push('wallet');
        break;
      // Other steps don't have pending fields or are handled differently
      default:
        // No pending fields for other steps
        break;
    }
    
    return pending;
  }

  /**
   * Extract data from profile for context
   */
  private extractDataFromProfile(profile: UserProfile): Record<string, any> {
    const extracted: Record<string, any> = {};
    
    if (profile.name) extracted.name = profile.name;
    if (profile.language) extracted.language = profile.language;
    if (profile.email) extracted.email = profile.email;
    if (profile.company) extracted.company = profile.company;
    if (profile.title) extracted.title = profile.title;
    if (profile.walletAddress) extracted.wallet = profile.walletAddress;
    if (profile.roles) extracted.roles = profile.roles;
    if (profile.interests) extracted.interests = profile.interests;
    if (profile.connectionGoals) extracted.connectionGoals = profile.connectionGoals;
    
    return extracted;
  }

  /**
   * Create default context
   */
  private createDefaultContext(userId: UUID): ConversationContext {
    return {
      currentTask: 'general',
      taskState: 'active',
      pendingFields: [],
      extractedData: {},
      conversationHistory: [],
      canGoBack: true,
      canAskQuestions: true,
      interruptionCount: 0,
      lastUpdated: new Date(),
      userId
    };
  }

  /**
   * Resolve primary userId (same logic as onboarding utils)
   */
  private async resolvePrimaryUserId(runtime: IAgentRuntime, userId: UUID): Promise<UUID> {
    try {
      const db = runtime.databaseAdapter as any;
      const databaseType = (process.env.DATABASE_TYPE || 'postgres').toLowerCase();
      const isMongo = databaseType === 'mongodb' || databaseType === 'mongo';
      
      if (isMongo && db.getDb) {
        const mongoDb = await db.getDb();
        const mapping = await mongoDb.collection('user_mappings').findOne({ platform_user_id: String(userId) });
        if (mapping && mapping.primary_user_id) {
          return mapping.primary_user_id as UUID;
        }
      } else if (db.query) {
        const result = await db.query(
          `SELECT primary_user_id FROM user_mappings WHERE platform_user_id = $1::text`,
          [String(userId)]
        );
        if (result.rows && result.rows.length > 0 && result.rows[0].primary_user_id) {
          return result.rows[0].primary_user_id as UUID;
        }
      }
    } catch (error) {
      console.error('[ConversationContextManager] Error resolving primary userId:', error);
    }
    
    return userId;
  }
}

// Export singleton instance
export const conversationContextManager = new ConversationContextManager();

