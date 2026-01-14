import { IAgentRuntime, Memory } from '@elizaos/core';

/**
 * Local Processing Service
 * Handles all data extraction, validation, and processing that doesn't require AI
 * This keeps sensitive data (PII) out of OpenAI API calls
 */

export interface LocalExtractionResult {
  // Extracted data
  name?: string | null;
  email?: string | null;
  company?: string | null;
  title?: string | null;
  language?: string | null;
  wallet?: string | null;
  
  // Validation results
  isValid: boolean;
  errors: string[];
  confidence: number; // 0-1, how confident we are in the extraction
  
  // Metadata
  extractionMethod: 'regex' | 'pattern' | 'keyword' | 'none';
  rawMatches: Record<string, string[]>;
}

export interface LocalValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitized: string;
}

export class LocalProcessor {
  /**
   * Extract information from message using local rules (no AI)
   * Note: This is synchronous but kept as async for future extensibility
   */
  async extractFromMessage(
    message: string,
    expectedFields: string[]
  ): Promise<LocalExtractionResult> {
    if (!message || typeof message !== 'string' || !expectedFields || expectedFields.length === 0) {
      return {
        isValid: false,
        errors: [],
        confidence: 0,
        extractionMethod: 'none',
        rawMatches: {}
      };
    }
    const result: LocalExtractionResult = {
      isValid: false,
      errors: [],
      confidence: 0,
      extractionMethod: 'none',
      rawMatches: {}
    };
    
    // Extract email (high confidence)
    if (expectedFields.includes('email')) {
      const email = this.extractEmail(message);
      if (email) {
        result.email = email;
        result.confidence += 0.3;
        result.rawMatches.email = [email];
      }
    }
    
    // Extract name (medium confidence - use patterns)
    if (expectedFields.includes('name')) {
      const name = this.extractName(message);
      if (name) {
        result.name = name;
        result.confidence += 0.2;
        result.rawMatches.name = [name];
      }
    }
    
    // Extract company (medium confidence)
    if (expectedFields.includes('company')) {
      const company = this.extractCompany(message);
      if (company) {
        result.company = company;
        result.confidence += 0.2;
        result.rawMatches.company = [company];
      }
    }
    
    // Extract title (medium confidence)
    if (expectedFields.includes('title')) {
      const title = this.extractTitle(message);
      if (title) {
        result.title = title;
        result.confidence += 0.2;
        result.rawMatches.title = [title];
      }
    }
    
    // Extract language code (high confidence)
    if (expectedFields.includes('language')) {
      const language = this.extractLanguage(message);
      if (language) {
        result.language = language;
        result.confidence += 0.3;
        result.rawMatches.language = [language];
      }
    }
    
    // Extract wallet address (high confidence)
    if (expectedFields.includes('wallet')) {
      const wallet = this.extractWallet(message);
      if (wallet) {
        result.wallet = wallet;
        result.confidence += 0.3;
        result.rawMatches.wallet = [wallet];
      }
    }
    
    result.isValid = result.confidence > 0;
    result.extractionMethod = result.confidence > 0 ? 'pattern' : 'none';
    
    return result;
  }
  
  /**
   * Extract email address using regex
   */
  extractEmail(text: string): string | null {
    if (!text || typeof text !== 'string') return null;
    // RFC 5322 compliant email regex (simplified) with word boundaries for safety
    const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
    const matches = text.match(emailRegex);
    return matches && matches.length > 0 ? matches[0] : null;
  }
  
  /**
   * Extract name using common patterns
   */
  extractName(text: string): string | null {
    if (!text || typeof text !== 'string') return null;
    
    // Patterns:
    // - "my name is John Doe"
    // - "I'm John"
    // - "call me Jane"
    // - "name: John Doe"
    // - "John Doe" (if it looks like a name)
    
    const patterns = [
      /(?:my\s+name\s+is|i'?m|i\s+am|call\s+me|name\s*:)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)$/, // Full name at start
      /([A-Z][a-z]+\s+[A-Z][a-z]+)/, // Two capitalized words
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Basic validation: name should be 2-50 chars, contain letters
        if (name.length >= 2 && name.length <= 50 && /^[A-Za-z\s'-]+$/.test(name)) {
          return name;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Extract company name using patterns
   */
  extractCompany(text: string): string | null {
    if (!text || typeof text !== 'string') return null;
    
    // Patterns:
    // - "I work at Microsoft"
    // - "company: Google"
    // - "at Uniswap"
    // - "Microsoft" (standalone, if context suggests)
    
    const patterns = [
      /(?:work\s+(?:at|for)|company\s*:|at)\s+([A-Z][A-Za-z0-9\s&.,-]+)/i,
      /^([A-Z][A-Za-z0-9\s&.,-]+)$/, // Company name at start
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const company = match[1].trim();
        // Basic validation: company should be 2-100 chars
        if (company.length >= 2 && company.length <= 100) {
          return company;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Extract job title using patterns
   */
  extractTitle(text: string): string | null {
    if (!text || typeof text !== 'string') return null;
    
    // Patterns:
    // - "as a developer"
    // - "title: Senior Engineer"
    // - "head of marketing"
    // - "I'm a founder"
    
    // Pattern 1: "as a developer", "title: Senior Engineer", "I'm a founder"
    const pattern1 = /(?:as\s+(?:a|an)|title\s*:|i'?m\s+(?:a|an))\s+([A-Z][A-Za-z\s-]+)/i;
    const match1 = text.match(pattern1);
    if (match1 && match1[1]) {
      const title = match1[1].trim();
      if (title.length >= 2 && title.length <= 100) {
        return title;
      }
    }
    
    // Pattern 2: "head of marketing", "director of sales"
    const pattern2 = /(head|director|manager|lead|senior|junior)\s+(?:of|in)?\s*([A-Za-z\s]+)/i;
    const match2 = text.match(pattern2);
    if (match2 && match2[2]) {
      const title = match2[2].trim();
      if (title.length >= 2 && title.length <= 100) {
        return title;
      }
    }
    
    return null;
  }
  
  /**
   * Extract language code
   */
  extractLanguage(text: string): string | null {
    if (!text || typeof text !== 'string') return null;
    
    const lowerText = text.toLowerCase().trim();
    
    // Direct language codes
    const languageMap: Record<string, string> = {
      'english': 'en',
      'en': 'en',
      'spanish': 'es',
      'español': 'es',
      'es': 'es',
      'portuguese': 'pt',
      'português': 'pt',
      'pt': 'pt',
      'french': 'fr',
      'français': 'fr',
      'fr': 'fr',
    };
    
    // Check for exact matches
    if (languageMap[lowerText]) {
      return languageMap[lowerText];
    }
    
    // Check for "language: en" pattern
    const langPattern = /(?:language|lang|idioma)\s*:?\s*([a-z]{2})/i;
    const match = text.match(langPattern);
    if (match && match[1] && languageMap[match[1].toLowerCase()]) {
      return languageMap[match[1].toLowerCase()];
    }
    
    return null;
  }
  
  /**
   * Extract wallet address (Ethereum, Solana, etc.)
   */
  extractWallet(text: string): string | null {
    if (!text || typeof text !== 'string') return null;
    
    // Ethereum address (0x followed by exactly 40 hex chars, word boundary)
    const ethPattern = /\b0x[a-fA-F0-9]{40}\b/;
    const ethMatch = text.match(ethPattern);
    if (ethMatch) return ethMatch[0];
    
    // Solana address (base58, 32-44 chars, word boundary)
    // More strict: must be 32-44 chars, base58 characters only
    const solPattern = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
    const solMatch = text.match(solPattern);
    if (solMatch) {
      const candidate = solMatch[0];
      // Additional validation: Solana addresses are typically 32-44 chars
      // and contain a mix of letters and numbers (not just letters)
      if (candidate.length >= 32 && candidate.length <= 44) {
        // Check if it looks like a wallet (has numbers or is all uppercase/mixed case)
        if (/[0-9]/.test(candidate) || /^[A-Z0-9]+$/.test(candidate)) {
          return candidate;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Validate extracted data locally
   */
  validateData(
    field: string,
    value: string | null | undefined
  ): LocalValidationResult {
    const result: LocalValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      sanitized: value || ''
    };
    
    if (!value || value.trim().length === 0) {
      result.errors.push(`${field} is required`);
      return result;
    }
    
    result.sanitized = value.trim();
    
    switch (field) {
      case 'email':
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(result.sanitized)) {
          result.errors.push('Invalid email format');
        }
        break;
        
      case 'name':
        if (result.sanitized.length < 2) {
          result.errors.push('Name must be at least 2 characters');
        }
        if (result.sanitized.length > 50) {
          result.warnings.push('Name is very long');
        }
        if (!/^[A-Za-z\s'-]+$/.test(result.sanitized)) {
          result.warnings.push('Name contains unusual characters');
        }
        break;
        
      case 'company':
        if (result.sanitized.length < 2) {
          result.errors.push('Company name must be at least 2 characters');
        }
        if (result.sanitized.length > 100) {
          result.warnings.push('Company name is very long');
        }
        break;
        
      case 'title':
        if (result.sanitized.length < 2) {
          result.errors.push('Title must be at least 2 characters');
        }
        if (result.sanitized.length > 100) {
          result.warnings.push('Title is very long');
        }
        break;
        
      case 'wallet':
        // Validate Ethereum or Solana address
        const isEth = /^0x[a-fA-F0-9]{40}$/.test(result.sanitized);
        const isSol = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(result.sanitized);
        if (!isEth && !isSol) {
          result.errors.push('Invalid wallet address format');
        }
        break;
    }
    
    result.isValid = result.errors.length === 0;
    return result;
  }
  
  /**
   * Extract multiple choice selections (e.g., "1, 2, 3" or "all")
   */
  extractMultipleChoice(
    text: string,
    options: string[],
    allowAll: boolean = true
  ): number[] | null {
    if (!text || typeof text !== 'string' || !options || options.length === 0) return null;
    
    const lowerText = text.toLowerCase().trim();
    
    // Check for "all" option
    if (allowAll && (lowerText === 'all' || lowerText === 'everything')) {
      return options.map((_, i) => i);
    }
    
    // Extract numbers (e.g., "1, 2, 3" or "1 2 3")
    const numberPattern = /\d+/g;
    const matches = text.match(numberPattern);
    if (matches) {
      const indices = matches
        .map(m => parseInt(m, 10) - 1) // Convert to 0-based
        .filter(i => i >= 0 && i < options.length);
      
      if (indices.length > 0) {
        return [...new Set(indices)]; // Remove duplicates
      }
    }
    
    // Try to match option text directly
    const matchedIndices: number[] = [];
    for (let i = 0; i < options.length; i++) {
      const optionLower = options[i].toLowerCase();
      if (lowerText.includes(optionLower)) {
        matchedIndices.push(i);
      }
    }
    
    return matchedIndices.length > 0 ? matchedIndices : null;
  }
  
  /**
   * Detect simple intents locally (without AI)
   */
  detectSimpleIntent(text: string): {
    type: 'go_back' | 'skip' | 'restart' | 'help' | 'question' | 'none';
    confidence: number;
  } {
    if (!text || typeof text !== 'string') {
      return { type: 'none', confidence: 0 };
    }
    
    const lowerText = text.toLowerCase().trim();
    if (lowerText.length === 0) {
      return { type: 'none', confidence: 0 };
    }
    
    // Go back
    if (/\b(go\s+back|back|previous|undo|return)\b/.test(lowerText)) {
      return { type: 'go_back', confidence: 0.9 };
    }
    
    // Skip
    if (/\b(skip|next|pass|none|n\/a)\b/.test(lowerText)) {
      return { type: 'skip', confidence: 0.9 };
    }
    
    // Restart
    if (/\b(restart|start\s+over|begin\s+again|reset)\b/.test(lowerText)) {
      return { type: 'restart', confidence: 0.9 };
    }
    
    // Help
    if (/\b(help|what|how|explain|\?)\b/.test(lowerText)) {
      return { type: 'help', confidence: 0.7 };
    }
    
    // Question (ends with ?)
    if (text.trim().endsWith('?')) {
      return { type: 'question', confidence: 0.8 };
    }
    
    return { type: 'none', confidence: 0 };
  }
  
  /**
   * Sanitize message to remove accidental PII before sending to AI
   */
  sanitizeMessage(message: string): string {
    if (!message || typeof message !== 'string') return '';
    
    let sanitized = message;
    
    // Remove email addresses (replace with [EMAIL])
    sanitized = sanitized.replace(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, '[EMAIL]');
    
    // Remove wallet addresses (replace with [WALLET])
    // Ethereum addresses: 0x followed by exactly 40 hex characters with word boundary
    sanitized = sanitized.replace(/\b0x[a-fA-F0-9]{40}\b/g, '[WALLET]');
    // Solana addresses: base58, 32-44 chars, but be more careful - only match if it looks like a wallet
    // Match base58 strings that are 32-44 chars with word boundaries
    sanitized = sanitized.replace(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, (match) => {
      // Only replace if it looks like a wallet address:
      // - Contains numbers (typical for wallets)
      // - Or is all uppercase/mixed case with numbers (not a normal word)
      // - And is not a common word pattern
      if ((/[0-9]/.test(match) || /^[A-Z0-9]+$/.test(match)) && match.length >= 32) {
        return '[WALLET]';
      }
      return match;
    });
    
    // Remove phone numbers (replace with [PHONE])
    sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
    
    // Note: We keep names in the message since user is providing them
    // But we don't include names from context/profile
    
    return sanitized;
  }
}

// Export singleton instance
export const localProcessor = new LocalProcessor();

