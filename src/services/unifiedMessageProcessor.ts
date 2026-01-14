import { IAgentRuntime, Memory, UUID } from '@elizaos/core';
import { conversationContextManager, ConversationContext } from './conversationContextManager.js';
import { localProcessor } from './localProcessor.js';
import { aiIntentDetector, DetectedIntent } from './aiIntentDetector.js';
import { aiInformationExtractor, AIExtractionResult } from './aiInformationExtractor.js';
import { performanceOptimizer } from './performanceOptimizer.js';

/**
 * Unified Message Processing Pipeline
 * Processes all messages through a consistent AI-first pipeline with local processing fallback
 * This replaces rigid rule-based routing with intelligent, context-aware processing
 */

export interface ProcessingResult {
  intent: DetectedIntent;
  extractedData: Record<string, any>;
  context: ConversationContext;
  shouldRouteToHandlers: boolean;
  suggestedResponse?: string;
  metadata?: {
    processingMethod: 'local' | 'ai' | 'hybrid';
    confidence: number;
    responseTime: number;
  };
}

export interface HandlerSelection {
  handlerName: string;
  priority: number;
  shouldExecute: boolean;
  context?: Record<string, any>;
}

/**
 * Unified Message Processor
 * Processes all messages through a consistent pipeline:
 * 1. Get conversation context
 * 2. Detect intent (local + AI)
 * 3. Extract information (local + AI)
 * 4. Update context
 * 5. Select appropriate handlers
 * 6. Return processing result
 */
export class UnifiedMessageProcessor {
  /**
   * Process a message through the unified pipeline
   */
  async processMessage(
    runtime: IAgentRuntime,
    message: Memory,
    expectedFields?: string[]
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const userId = message.userId;
    const text = (message.content.text || '').trim();

    if (!text) {
      return {
        intent: {
          type: 'general_chat',
          confidence: 0,
          requiresAction: false
        },
        extractedData: {},
        context: await conversationContextManager.getContext(runtime, userId),
        shouldRouteToHandlers: false,
        metadata: {
          processingMethod: 'local',
          confidence: 0,
          responseTime: Date.now() - startTime
        }
      };
    }

    // Step 1: Get conversation context
    let context = await conversationContextManager.getContext(runtime, userId);

    // Step 2: Detect intent (Hybrid: Local first, then AI)
    // Note: We detect intent before resuming, so we can make an informed decision
    const intentResult = await this.detectIntent(runtime, text, context);
    const intent = intentResult.intent;
    const usedAIForIntent = intentResult.usedAI;

    // Resume task if it was paused AND user intent indicates continuation
    // (provide_information, correction, or other non-question intents)
    if (context.taskState === 'paused' && 
        intent.type !== 'ask_question' && 
        intent.type !== 'general_chat') {
      await conversationContextManager.resumeTask(runtime, userId);
      context = await conversationContextManager.getContext(runtime, userId);
    }

    // Step 3: Extract information if applicable
    let extractedData: Record<string, any> = {};
    let extractionResult: AIExtractionResult | null = null;
    
    // Extract information for provide_information or correction intents
    if (expectedFields && expectedFields.length > 0 && 
        (intent.type === 'provide_information' || intent.type === 'correction')) {
      extractionResult = await this.extractInformation(
        runtime,
        text,
        expectedFields,
        context
      );
      
      if (extractionResult && extractionResult.confidence > 0.5) {
        extractedData = extractionResult.extracted;
      }
    }

    // Step 4: Update context with extracted data
    if (Object.keys(extractedData).length > 0) {
      await conversationContextManager.updateContext(
        runtime,
        userId,
        {
          extractedData: { ...context.extractedData, ...extractedData }
        },
        context
      );
      
      // Re-fetch context to get updated state
      context = await conversationContextManager.getContext(runtime, userId);
    }

    // Step 5: Add message to conversation history
    await conversationContextManager.addToHistory(runtime, userId, {
      role: 'user',
      message: text,
      timestamp: new Date(),
      extractedInfo: extractedData,
      intent: intent.type
    });
    
    // Re-fetch context to get updated history (for accurate return value)
    context = await conversationContextManager.getContext(runtime, userId);

    // Step 6: Determine if message should route to handlers
    const shouldRouteToHandlers = this.shouldRouteToHandlers(intent, context);

    const responseTime = Date.now() - startTime;
    performanceOptimizer.trackRequest(responseTime);

    return {
      intent,
      extractedData,
      context,
      shouldRouteToHandlers,
      metadata: {
        processingMethod: (usedAIForIntent || extractionResult?.method === 'ai') ? 'ai' : 
                          (extractionResult || usedAIForIntent) ? 'hybrid' : 'local',
        confidence: Math.max(intent.confidence, extractionResult?.confidence || 0),
        responseTime
      }
    };
  }

  /**
   * Detect intent using hybrid approach (local + AI)
   * Returns both the intent and whether AI was used
   */
  private async detectIntent(
    runtime: IAgentRuntime,
    message: string,
    context: ConversationContext
  ): Promise<{ intent: DetectedIntent; usedAI: boolean }> {
    // Try local detection first
    const localIntent = localProcessor.detectSimpleIntent(message);
    
    if (localIntent.confidence > 0.8) {
      // Map local intent to full intent type
      return {
        intent: {
          type: localIntent.type === 'go_back' ? 'go_back' :
                localIntent.type === 'skip' ? 'skip' :
                localIntent.type === 'restart' ? 'general_chat' :
                localIntent.type === 'help' || localIntent.type === 'question' ? 'ask_question' :
                'provide_information',
          confidence: localIntent.confidence,
          requiresAction: true
        },
        usedAI: false
      };
    }

    // Use AI for complex intent detection
    const aiIntent = await aiIntentDetector.detectIntent(runtime, message, context);
    return {
      intent: aiIntent,
      usedAI: true
    };
  }

  /**
   * Extract information using hybrid approach (local + AI)
   */
  private async extractInformation(
    runtime: IAgentRuntime,
    message: string,
    expectedFields: string[],
    context: ConversationContext
  ): Promise<AIExtractionResult | null> {
    // Try local extraction first
    const localExtraction = await localProcessor.extractFromMessage(message, expectedFields);
    
    if (localExtraction.confidence >= 0.7 && localExtraction.isValid) {
      // Local extraction is sufficient - convert to AIExtractionResult format
      const extracted: Record<string, any> = {};
      if (localExtraction.name) extracted.name = localExtraction.name;
      if (localExtraction.email) extracted.email = localExtraction.email;
      if (localExtraction.company) extracted.company = localExtraction.company;
      if (localExtraction.title) extracted.title = localExtraction.title;
      if (localExtraction.language) extracted.language = localExtraction.language;
      if (localExtraction.wallet) extracted.wallet = localExtraction.wallet;
      
      return {
        extracted,
        confidence: localExtraction.confidence,
        missingFields: expectedFields.filter(field => !extracted[field]),
        ambiguousFields: [],
        method: 'hybrid'
      };
    }

    // Use AI for complex extraction
    return await aiInformationExtractor.extractFromMessage(
      runtime,
      message,
      expectedFields,
      context
    );
  }

  /**
   * Determine if message should route to action handlers
   */
  private shouldRouteToHandlers(
    intent: DetectedIntent,
    context: ConversationContext
  ): boolean {
    // Route to handlers if:
    // 1. Intent requires action
    // 2. Intent is not a question (questions are handled by LLM)
    // 3. Task is not paused (unless it's a resume command)
    
    if (!intent.requiresAction) {
      return false;
    }

    if (intent.type === 'ask_question' && context.canAskQuestions) {
      // Questions are handled by LLM, not action handlers
      return false;
    }

    if (context.taskState === 'paused' && 
        intent.type !== 'provide_information' && 
        intent.type !== 'correction') {
      // Only allow information provision or corrections when paused
      return false;
    }

    return true;
  }

  /**
   * Select appropriate handlers based on intent and context
   * @param intent - Detected user intent
   * @param context - Current conversation context
   * @param currentTask - Optional current task override (defaults to context.currentTask)
   */
  selectHandlers(
    intent: DetectedIntent,
    context: ConversationContext,
    currentTask?: string
  ): HandlerSelection[] {
    // Use provided currentTask or fall back to context.currentTask
    const task = currentTask || context.currentTask;
    const handlers: HandlerSelection[] = [];

    // Route based on intent type
    switch (intent.type) {
      case 'go_back':
        if (context.canGoBack && task === 'onboarding') {
          handlers.push({
            handlerName: 'CONTINUE_ONBOARDING',
            priority: 1,
            shouldExecute: true,
            context: { action: 'go_back' }
          });
        }
        break;

      case 'skip':
        if (task === 'onboarding') {
          handlers.push({
            handlerName: 'CONTINUE_ONBOARDING',
            priority: 1,
            shouldExecute: true,
            context: { action: 'skip' }
          });
        }
        break;

      case 'delete_data':
        handlers.push({
          handlerName: 'CONTINUE_ONBOARDING',
          priority: 1,
          shouldExecute: true,
          context: { action: 'delete_data' }
        });
        break;

      case 'request_match':
        handlers.push({
          handlerName: 'FIND_MATCH',
          priority: 1,
          shouldExecute: true
        });
        break;

      case 'provide_information':
      case 'correction':
        // Route to current task handler
        if (task === 'onboarding') {
          handlers.push({
            handlerName: 'CONTINUE_ONBOARDING',
            priority: 1,
            shouldExecute: true,
            context: { action: intent.type === 'correction' ? 'correction' : 'provide_information' }
          });
        } else if (task === 'matching') {
          handlers.push({
            handlerName: 'FIND_MATCH',
            priority: 1,
            shouldExecute: true
          });
        }
        break;

      case 'ask_question':
        // Questions are handled by LLM, but we might want to pause the current task
        if (task !== 'general' && context.canAskQuestions) {
          handlers.push({
            handlerName: 'PAUSE_TASK',
            priority: 0,
            shouldExecute: true,
            context: { reason: 'User asked a question' }
          });
        }
        break;

      default:
        // For other intents, route to general handler or current task handler
        if (task === 'onboarding') {
          handlers.push({
            handlerName: 'CONTINUE_ONBOARDING',
            priority: 2,
            shouldExecute: true
          });
        }
    }

    return handlers.sort((a, b) => a.priority - b.priority);
  }
}

// Export singleton instance
export const unifiedMessageProcessor = new UnifiedMessageProcessor();

