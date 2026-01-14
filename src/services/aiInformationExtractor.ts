import { IAgentRuntime } from '@elizaos/core';
import { ConversationContext } from './conversationContextManager.js';
import { localProcessor } from './localProcessor.js';
import { LocalExtractionResult } from './localProcessor.js';
import { performanceOptimizer } from './performanceOptimizer.js';

/**
 * AI-Based Information Extractor
 * Uses OpenAI to extract structured data from natural language when local extraction isn't sufficient
 * Works in conjunction with LocalProcessor for a hybrid approach
 */

export interface AIExtractionResult {
  extracted: Record<string, any>;
  confidence: number;
  missingFields: string[];
  ambiguousFields: string[];
  method: 'ai' | 'hybrid';
}

export class AIInformationExtractor {
  private readonly model = 'gpt-4o-mini';
  private readonly maxTokens = 300;
  private readonly temperature = 0.2; // Low temperature for consistent extraction

  /**
   * Extract information from message using AI (for complex cases)
   * Should be called when local extraction confidence is low or incomplete
   */
  async extractFromMessage(
    runtime: IAgentRuntime,
    message: string,
    expectedFields: string[],
    context: ConversationContext
  ): Promise<AIExtractionResult> {
    const startTime = Date.now();
    
    if (!expectedFields || expectedFields.length === 0) {
      const responseTime = Date.now() - startTime;
      performanceOptimizer.trackRequest(responseTime);
      return {
        extracted: {},
        confidence: 0,
        missingFields: [],
        ambiguousFields: [],
        method: 'ai'
      };
    }

    // Check cache for extraction
    const cachedExtraction = performanceOptimizer.getCachedExtraction(message, context);
    if (cachedExtraction && cachedExtraction.confidence > 0.7) {
      const responseTime = Date.now() - startTime;
      performanceOptimizer.trackRequest(responseTime);
      // Check if cached extraction has the fields we need
      const hasRequiredFields = expectedFields.every(field => 
        cachedExtraction.extracted[field] !== undefined
      );
      
      if (hasRequiredFields) {
        // All required fields are present, so missingFields is empty
        return {
          extracted: cachedExtraction.extracted,
          confidence: cachedExtraction.confidence,
          missingFields: [], // All fields present since hasRequiredFields is true
          ambiguousFields: [],
          method: 'ai'
        };
      }
    }

    try {
      performanceOptimizer.trackLLMCall();
      const result = await this.extractWithAI(runtime, message, expectedFields, context);
      
      // Cache the result if confidence is high enough
      if (result.confidence > 0.7) {
        performanceOptimizer.cacheExtraction(
          message,
          context,
          result.extracted,
          result.confidence
        );
      }
      
      const responseTime = Date.now() - startTime;
      performanceOptimizer.trackRequest(responseTime);
      return result;
    } catch (error) {
      console.error('[AIInformationExtractor] Error extracting with AI:', error);
      const responseTime = Date.now() - startTime;
      performanceOptimizer.trackRequest(responseTime);
      return {
        extracted: {},
        confidence: 0,
        missingFields: expectedFields,
        ambiguousFields: [],
        method: 'ai'
      };
    }
  }

  /**
   * Extract information using OpenAI API
   */
  private async extractWithAI(
    runtime: IAgentRuntime,
    message: string,
    expectedFields: string[],
    context: ConversationContext
  ): Promise<AIExtractionResult> {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Sanitize message to remove PII
    const sanitizedMessage = localProcessor.sanitizeMessage(message);
    
    // Anonymize context
    const anonymizedContext = this.anonymizeContext(context);

    const prompt = this.buildExtractionPrompt(sanitizedMessage, expectedFields, anonymizedContext);

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
            content: 'You are an information extraction system. Extract structured data from user messages. Return only valid JSON.'
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
      return this.validateAndNormalizeExtraction(result, expectedFields);
    } catch (parseError) {
      console.error('[AIInformationExtractor] Failed to parse AI response:', parseError);
      throw new Error('Invalid JSON response from AI');
    }
  }

  /**
   * Build prompt for information extraction
   */
  private buildExtractionPrompt(
    message: string,
    expectedFields: string[],
    context: Partial<ConversationContext>
  ): string {
    const fieldDescriptions: Record<string, string> = {
      name: 'Full name (e.g., "John Doe", "Jane Smith")',
      email: 'Email address (e.g., "john@example.com")',
      company: 'Company name (e.g., "Microsoft", "Uniswap")',
      title: 'Job title (e.g., "Developer", "Head of Marketing", "Founder")',
      language: 'Language code: "en" (English), "es" (Spanish), "pt" (Portuguese), or "fr" (French)',
      wallet: 'Cryptocurrency wallet address (Ethereum: 0x..., Solana: base58 string)'
    };

    const fieldList = expectedFields.map(field => {
      const desc = fieldDescriptions[field] || field;
      return `- ${field}: ${desc}`;
    }).join('\n');

    return `Extract structured information from this user message.

Current Context:
- Task: ${context.currentTask || 'unknown'}
- Step: ${context.currentStep || 'none'}
- Waiting for: ${context.pendingFields?.join(', ') || 'nothing'}

Expected Fields to Extract:
${fieldList}

User Message: "${message}"

Instructions:
1. Extract only the fields listed above
2. If a field is not mentioned, don't include it
3. For names: Extract full name even if user says "my name is [full name]"
4. For emails: Extract complete email address
5. For companies: Extract company name even if user says "I work at [company]"
6. For titles: Extract job title even if user says "I'm a [title]" or "as a [title]"
7. For language: Convert to code (English->en, Spanish->es, Portuguese->pt, French->fr)
8. For wallet: Extract complete wallet address

Return JSON with this structure:
{
  "extracted": {
    "field1": "value1",
    "field2": "value2"
  },
  "confidence": 0.0-1.0,
  "missingFields": ["field1", "field2"],
  "ambiguousFields": ["field3"]
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
   * Validate and normalize AI extraction result
   */
  private validateAndNormalizeExtraction(
    result: any,
    expectedFields: string[]
  ): AIExtractionResult {
    const extracted: Record<string, any> = {};
    const ambiguousFields: string[] = [];

    // Validate extracted fields
    if (result.extracted && typeof result.extracted === 'object') {
      for (const [field, value] of Object.entries(result.extracted)) {
        if (expectedFields.includes(field) && value != null) {
          // Basic validation
          if (typeof value === 'string' && value.trim().length > 0) {
            extracted[field] = value.trim();
          } else if (typeof value !== 'string' && value != null) {
            extracted[field] = value;
          }
        }
      }
    }

    // Check for ambiguous fields
    if (result.ambiguousFields && Array.isArray(result.ambiguousFields)) {
      for (const field of result.ambiguousFields) {
        if (typeof field === 'string' && expectedFields.includes(field)) {
          ambiguousFields.push(field);
        }
      }
    }

    // Calculate missing fields
    const missingFields = expectedFields.filter(field => !extracted[field]);

    // Calculate confidence
    const confidence = typeof result.confidence === 'number'
      ? Math.max(0, Math.min(1, result.confidence))
      : extracted && Object.keys(extracted).length > 0
        ? 0.7 // Default confidence if extraction succeeded
        : 0.0;

    return {
      extracted,
      confidence,
      missingFields,
      ambiguousFields,
      method: 'ai'
    };
  }

  /**
   * Combine local and AI extraction results
   * @param localResult Local extraction result
   * @param aiResult AI extraction result
   * @param expectedFields Original expected fields (for calculating missing fields correctly)
   */
  combineExtractionResults(
    localResult: LocalExtractionResult,
    aiResult: AIExtractionResult,
    expectedFields?: string[]
  ): AIExtractionResult {
    // Merge extracted data (AI takes precedence for conflicts)
    const combined: Record<string, any> = {
      ...this.localResultToExtracted(localResult),
      ...aiResult.extracted
    };

    // Calculate combined confidence
    const localConfidence = localResult.confidence || 0;
    const aiConfidence = aiResult.confidence || 0;
    const combinedConfidence = Math.max(localConfidence, aiConfidence * 0.9); // Slightly favor local

    // Determine missing fields - use expectedFields if provided, otherwise use extracted fields
    const fieldsToCheck = expectedFields && expectedFields.length > 0
      ? expectedFields
      : [
          ...new Set([
            ...Object.keys(localResult.rawMatches || {}),
            ...Object.keys(aiResult.extracted || {})
          ])
        ];
    const missingFields = fieldsToCheck.filter(field => !combined[field]);

    return {
      extracted: combined,
      confidence: combinedConfidence,
      missingFields,
      ambiguousFields: aiResult.ambiguousFields,
      method: 'hybrid'
    };
  }

  /**
   * Convert local extraction result to extracted data format
   */
  private localResultToExtracted(localResult: LocalExtractionResult): Record<string, any> {
    const extracted: Record<string, any> = {};
    
    if (localResult.name) extracted.name = localResult.name;
    if (localResult.email) extracted.email = localResult.email;
    if (localResult.company) extracted.company = localResult.company;
    if (localResult.title) extracted.title = localResult.title;
    if (localResult.language) extracted.language = localResult.language;
    if (localResult.wallet) extracted.wallet = localResult.wallet;

    return extracted;
  }
}

// Export singleton instance
export const aiInformationExtractor = new AIInformationExtractor();

