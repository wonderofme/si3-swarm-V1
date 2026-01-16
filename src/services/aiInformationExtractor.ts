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
  private readonly maxTokens = 500; // Increased for more complex extractions with conversation context
  private readonly temperature = 0.1; // Lower temperature for more consistent extraction

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
      name: 'Full name (e.g., "John Doe", "Jane Smith"). Extract even if user says "my name is [name]" or "I\'m [name]"',
      email: 'Email address (e.g., "john@example.com"). Extract complete email address',
      company: 'Company name (e.g., "Microsoft", "Uniswap"). Extract even if user says "I work at [company]" or "at [company]"',
      title: 'Job title (e.g., "Developer", "Head of Marketing", "Founder"). Extract even if user says "I\'m a [title]" or "as a [title]"',
      language: 'Language code: "en" (English), "es" (Spanish), "pt" (Portuguese), or "fr" (French). Convert language names to codes',
      wallet: 'Cryptocurrency wallet address (Ethereum: 0x..., Solana: base58 string). Extract complete address',
      roles: 'Array of professional roles. Map natural language to these exact values: "Founder/Builder", "Marketing/BD/Partnerships", "DAO Council Member/Delegate", "Community Leader", "Investor/Grant Program Operator", "Early Web3 Explorer", "Media", "Artist", "Developer", "Other". If user says "founder", "I\'m a founder", "I build things", map to "Founder/Builder". If user says "marketing", "BD", "partnerships", map to "Marketing/BD/Partnerships". If user says "developer", "coder", "programmer", map to "Developer". If user says "all" or "all of them", include all 10 roles. Return as array of strings.',
      interests: 'Array of interests. Map natural language to these exact values: "Web3 Growth Marketing", "Business Development & Partnerships", "Education 3.0", "AI", "Cybersecurity", "DAOs", "Tokenomics", "Fundraising", "Other". If user mentions "AI", "artificial intelligence", "machine learning", map to "AI". If user mentions "blockchain", "web3", "crypto", consider "Web3 Growth Marketing" or "Tokenomics". If user mentions "DAO", "daos", "decentralized", map to "DAOs". Return as array of strings.',
      connectionGoals: 'Array of connection goals. Map natural language to these exact values: "Startups to invest in", "Investors/grant programs", "Growth tools, strategies, and/or support", "Sales/BD tools, strategies and/or support", "Communities and/or DAO\'s to join", "New job opportunities". If user says "investors", "funding", "grants", map to "Investors/grant programs". If user says "job", "career", "opportunities", map to "New job opportunities". Return as array of strings.',
      events: 'Array of events. Extract event names, dates, and locations if mentioned. Return as array of strings, each string can contain event name, date, and location.',
      socials: 'Array of social media links or profiles. Extract URLs (twitter.com, linkedin.com, github.com, etc.) or profile handles. Return as array of strings.',
      telegramHandle: 'Telegram username/handle. Extract username without @ symbol. If user says "my telegram is @username" or "telegram username is username", extract just the username part. Return as string without @.',
      gender: 'Gender. Extract if mentioned. Return as string.',
      notifications: 'Notification preference. Map to "Yes", "No", or "Not sure yet". If user says "yes", "sure", "okay", map to "Yes". If user says "no", "don\'t", "not interested", map to "No". Return as string.'
    };

    const fieldList = expectedFields.map(field => {
      const desc = fieldDescriptions[field] || field;
      return `- ${field}: ${desc}`;
    }).join('\n');

    // Build context about what's already known (anonymized - only field names, not values)
    const knownFields: string[] = [];
    if (context.extractedData) {
      const extracted = context.extractedData;
      knownFields.push(...Object.keys(extracted).filter(key => extracted[key] != null));
    }
    const knownFieldsText = knownFields.length > 0 
      ? `Fields already collected: ${knownFields.join(', ')}. You can update these or extract new ones.`
      : 'No fields collected yet. Extract all mentioned fields.';
    
    // Get recent conversation context (last 3 messages) for better understanding
    const recentHistory = context.conversationHistory?.slice(-3) || [];
    const conversationContext = recentHistory.length > 0
      ? recentHistory.map(msg => `${msg.role}: ${msg.message.substring(0, 100)}`).join('\n')
      : 'No previous conversation context.';

    return `Extract structured information from this user message. Be intelligent and context-aware.

Current Context:
- Task: ${context.currentTask || 'unknown'}
- Step: ${context.currentStep || 'none'}
- Waiting for: ${context.pendingFields?.join(', ') || 'nothing'}
- ${knownFieldsText}

Recent Conversation:
${conversationContext}

Expected Fields to Extract:
${fieldList}

User Message: "${message}"

CRITICAL INSTRUCTIONS:
1. Extract ALL mentioned fields, even if they weren't explicitly asked for
2. For roles/interests/goals: Map natural language to the EXACT values listed above
3. For arrays (roles, interests, goals, events, socials): Always return as array, even if single value
4. For names: Extract full name, remove phrases like "my name is", "I'm", "call me"
5. For emails: Extract complete email address, validate format
6. For companies: Extract company name, remove phrases like "I work at", "at"
7. For titles: Extract job title, remove phrases like "I'm a", "as a"
8. For telegramHandle: Extract username only, remove @ symbol and phrases like "my telegram is"
9. If user says "all" for roles, include all 10 role options
10. If user corrects something (says "actually", "I meant", "that's wrong", "mistake"), extract the corrected value
11. If user provides multiple pieces of information, extract ALL of them
12. Be smart about synonyms and variations (e.g., "founder" = "Founder/Builder", "AI" = "AI", "blockchain" might be "Web3 Growth Marketing" or "Tokenomics")
13. Use conversation context to understand what the user is referring to
14. If user says something is "wrong" or "incorrect" but doesn't provide the correct value, don't extract that field (it will be handled separately)
15. Be very intelligent - understand implicit information (e.g., "I work at Microsoft" = company: "Microsoft", possibly title if mentioned)
16. Handle corrections intelligently - if user says "my name is actually John" after previously saying "Jane", extract "John" as the correction

Return JSON with this structure:
{
  "extracted": {
    "field1": "value1" or ["value1", "value2"] for arrays,
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

