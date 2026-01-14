import { IAgentRuntime } from '@elizaos/core';
import { ConversationContext } from './conversationContextManager.js';
import { localProcessor } from './localProcessor.js';
import { performanceOptimizer } from './performanceOptimizer.js';

/**
 * AI-Based Intent Detector
 * Uses OpenAI to detect complex user intents that local processing can't handle
 * Works in conjunction with LocalProcessor for a hybrid approach
 */

export type IntentType = 
  | 'provide_information'  // User is providing requested info
  | 'ask_question'         // User is asking a question
  | 'go_back'             // User wants to go to previous step
  | 'skip'                // User wants to skip current step
  | 'correction'          // User wants to correct something
  | 'request_match'       // User wants to find a match
  | 'request_knowledge'   // User wants to know "who knows X"
  | 'delete_data'         // User wants to delete their data
  | 'general_chat'        // General conversation
  | 'interruption';       // User is interrupting current task

export interface DetectedIntent {
  type: IntentType;
  confidence: number;
  extractedInfo?: Record<string, any>;
  parameters?: Record<string, any>;
  requiresAction?: boolean;
  message?: string; // Suggested response message
}

export class AIIntentDetector {
  private readonly model = 'gpt-4o-mini';
  private readonly maxTokens = 200;
  private readonly temperature = 0.3; // Lower temperature for more consistent intent detection

  /**
   * Detect user intent using AI (for complex cases)
   * Falls back to local detection for simple cases
   */
  async detectIntent(
    runtime: IAgentRuntime,
    message: string,
    context: ConversationContext
  ): Promise<DetectedIntent> {
    const startTime = Date.now();
    
    // First, try local detection for simple intents
    const localIntent = localProcessor.detectSimpleIntent(message);
    if (localIntent.confidence > 0.8) {
      const responseTime = Date.now() - startTime;
      performanceOptimizer.trackRequest(responseTime);
      return {
        type: this.mapLocalIntentToIntentType(localIntent.type),
        confidence: localIntent.confidence,
        requiresAction: true
      };
    }

    // Check cache for intent
    const cachedIntent = performanceOptimizer.getCachedIntent(message, context);
    if (cachedIntent) {
      const responseTime = Date.now() - startTime;
      performanceOptimizer.trackRequest(responseTime);
      // Validate cached intent is a valid IntentType
      const validIntents: IntentType[] = [
        'provide_information',
        'ask_question',
        'go_back',
        'skip',
        'correction',
        'request_match',
        'request_knowledge',
        'delete_data',
        'general_chat',
        'interruption'
      ];
      const intentType = validIntents.includes(cachedIntent.intent as IntentType)
        ? (cachedIntent.intent as IntentType)
        : 'provide_information'; // Safe fallback
      return {
        type: intentType,
        confidence: cachedIntent.confidence,
        requiresAction: true
      };
    }

    // For complex cases, use AI
    try {
      performanceOptimizer.trackLLMCall();
      const result = await this.detectIntentWithAI(runtime, message, context);
      
      // Cache the result
      performanceOptimizer.cacheIntent(
        message,
        context,
        result.type,
        result.confidence
      );
      
      const responseTime = Date.now() - startTime;
      performanceOptimizer.trackRequest(responseTime);
      return result;
    } catch (error) {
      console.error('[AIIntentDetector] Error detecting intent with AI:', error);
      const responseTime = Date.now() - startTime;
      performanceOptimizer.trackRequest(responseTime);
      // Fallback to local detection result
      return {
        type: this.mapLocalIntentToIntentType(localIntent.type),
        confidence: localIntent.confidence * 0.7, // Lower confidence on fallback
        requiresAction: false
      };
    }
  }

  /**
   * Detect intent using OpenAI API
   */
  private async detectIntentWithAI(
    runtime: IAgentRuntime,
    message: string,
    context: ConversationContext
  ): Promise<DetectedIntent> {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Sanitize message to remove PII
    const sanitizedMessage = localProcessor.sanitizeMessage(message);
    
    // Anonymize context
    const anonymizedContext = this.anonymizeContext(context);

    const prompt = this.buildIntentDetectionPrompt(sanitizedMessage, anonymizedContext);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an intent detection system. Analyze user messages and classify their intent. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    try {
      const result = JSON.parse(content);
      return this.validateAndNormalizeIntent(result);
    } catch (parseError) {
      console.error('[AIIntentDetector] Failed to parse AI response:', parseError);
      throw new Error('Invalid JSON response from AI');
    }
  }

  /**
   * Build prompt for intent detection
   */
  private buildIntentDetectionPrompt(
    message: string,
    context: Partial<ConversationContext>
  ): string {
    return `Analyze this user message and determine their intent.

Current Context:
- Task: ${context.currentTask || 'unknown'}
- Step: ${context.currentStep || 'none'}
- Waiting for: ${context.pendingFields?.join(', ') || 'nothing'}
- Task State: ${context.taskState || 'active'}

User Message: "${message}"

Intent Types:
- provide_information: User is providing requested information (e.g., "my name is John", "I work at Microsoft")
- ask_question: User is asking a question (e.g., "what is this?", "how does it work?")
- go_back: User wants to go to previous step (e.g., "go back", "previous", "undo")
- skip: User wants to skip current step (e.g., "skip", "next", "pass")
- correction: User wants to correct something (e.g., "that's wrong", "I meant...")
- request_match: User wants to find a match (e.g., "find me a match", "who can help with...")
- request_knowledge: User wants to know who knows something (e.g., "who knows blockchain?", "is there anyone who...")
- delete_data: User wants to delete their data (e.g., "delete my data", "remove my information")
- general_chat: General conversation not related to current task
- interruption: User is interrupting current task with unrelated request

Return JSON with this structure:
{
  "intent": "provide_information" | "ask_question" | "go_back" | "skip" | "correction" | "request_match" | "request_knowledge" | "delete_data" | "general_chat" | "interruption",
  "confidence": 0.0-1.0,
  "extractedInfo": { /* any information extracted from the message, e.g., {"name": "John"} */ },
  "parameters": { /* any additional parameters, e.g., {"field": "name", "value": "John"} */ },
  "requiresAction": true | false,
  "message": "optional suggested response message"
}`;
  }

  /**
   * Anonymize context before sending to AI
   */
  private anonymizeContext(context: ConversationContext): Partial<ConversationContext> {
    return {
      currentTask: context.currentTask,
      currentStep: context.currentStep,
      taskState: context.taskState,
      pendingFields: context.pendingFields,
      // Don't send extractedData (contains PII)
      // Don't send conversationHistory (contains PII)
      canGoBack: context.canGoBack,
      canAskQuestions: context.canAskQuestions,
      interruptionCount: context.interruptionCount
      // Don't send userId
    };
  }

  /**
   * Map local intent type to full intent type
   */
  private mapLocalIntentToIntentType(
    localType: 'go_back' | 'skip' | 'restart' | 'help' | 'question' | 'none'
  ): IntentType {
    switch (localType) {
      case 'go_back':
        return 'go_back';
      case 'skip':
        return 'skip';
      case 'restart':
        return 'general_chat'; // Restart is handled separately
      case 'help':
        return 'ask_question';
      case 'question':
        return 'ask_question';
      case 'none':
        return 'provide_information'; // Default assumption
      default:
        return 'provide_information';
    }
  }

  /**
   * Validate and normalize AI response
   */
  private validateAndNormalizeIntent(result: any): DetectedIntent {
    const validIntents: IntentType[] = [
      'provide_information',
      'ask_question',
      'go_back',
      'skip',
      'correction',
      'request_match',
      'request_knowledge',
      'delete_data',
      'general_chat',
      'interruption'
    ];

    const intent = validIntents.includes(result.intent) 
      ? result.intent as IntentType
      : 'provide_information'; // Default fallback

    const confidence = typeof result.confidence === 'number' 
      ? Math.max(0, Math.min(1, result.confidence))
      : 0.5;

    return {
      type: intent,
      confidence,
      extractedInfo: result.extractedInfo || {},
      parameters: result.parameters || {},
      requiresAction: result.requiresAction ?? true,
      message: result.message
    };
  }
}

// Export singleton instance
export const aiIntentDetector = new AIIntentDetector();

