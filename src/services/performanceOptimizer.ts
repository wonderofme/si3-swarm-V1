import { IAgentRuntime, UUID } from '@elizaos/core';

/**
 * Performance Optimizer
 * Implements caching, batching, and performance monitoring to reduce LLM calls and improve response times
 */

interface ExtractionCacheEntry {
  messageHash: string;
  extracted: Record<string, any>;
  confidence: number;
  timestamp: Date;
  expiresAt: Date;
}

interface IntentCacheEntry {
  messageHash: string;
  intent: string;
  confidence: number;
  timestamp: Date;
  expiresAt: Date;
}

interface PerformanceMetrics {
  llmCalls: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  totalRequests: number;
  cacheHitRate?: number;
}

export class PerformanceOptimizer {
  private extractionCache: Map<string, ExtractionCacheEntry> = new Map();
  private intentCache: Map<string, IntentCacheEntry> = new Map();
  private metrics: PerformanceMetrics = {
    llmCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    totalRequests: 0
  };
  
  // Cache TTL: 5 minutes for extraction, 10 minutes for intent
  private readonly EXTRACTION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly INTENT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private readonly MAX_CACHE_SIZE = 1000; // Maximum cache entries per type

  /**
   * Generate hash for message (for caching)
   */
  private hashMessage(message: string, context?: any): string {
    // Handle null/undefined/empty messages
    if (!message || typeof message !== 'string') {
      message = '';
    }
    const normalized = message.toLowerCase().trim();
    let contextStr = '';
    if (context) {
      try {
        contextStr = JSON.stringify({
          task: context.currentTask,
          step: context.currentStep
        });
      } catch (error) {
        // Fallback if JSON.stringify fails (e.g., circular reference)
        contextStr = `${context.currentTask || ''}_${context.currentStep || ''}`;
      }
    }
    return `${normalized}_${contextStr}`;
  }

  /**
   * Get cached extraction result
   */
  getCachedExtraction(message: string, context?: any): ExtractionCacheEntry | null {
    const hash = this.hashMessage(message, context);
    const cached = this.extractionCache.get(hash);
    
    if (!cached) {
      this.metrics.cacheMisses++;
      return null;
    }

    // Check if expired
    if (new Date() > cached.expiresAt) {
      this.extractionCache.delete(hash);
      this.metrics.cacheMisses++;
      return null;
    }

    this.metrics.cacheHits++;
    return cached;
  }

  /**
   * Cache extraction result
   */
  cacheExtraction(
    message: string,
    context: any,
    extracted: Record<string, any>,
    confidence: number
  ): void {
    const hash = this.hashMessage(message, context);
    
    // Only need to evict if adding a NEW entry (hash doesn't exist) and cache is at limit
    const isNewEntry = !this.extractionCache.has(hash);
    
    if (isNewEntry && this.extractionCache.size >= this.MAX_CACHE_SIZE) {
      // Find and remove oldest entry (O(n) instead of O(n log n))
      let oldestKey: string | undefined;
      let oldestTime = Infinity;
      for (const [key, entry] of this.extractionCache.entries()) {
        const time = entry.timestamp.getTime();
        if (time < oldestTime) {
          oldestTime = time;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        this.extractionCache.delete(oldestKey);
      }
    }

    this.extractionCache.set(hash, {
      messageHash: hash,
      extracted,
      confidence,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + this.EXTRACTION_CACHE_TTL)
    });
  }

  /**
   * Get cached intent result
   */
  getCachedIntent(message: string, context?: any): IntentCacheEntry | null {
    const hash = this.hashMessage(message, context);
    const cached = this.intentCache.get(hash);
    
    if (!cached) {
      this.metrics.cacheMisses++;
      return null;
    }

    // Check if expired
    if (new Date() > cached.expiresAt) {
      this.intentCache.delete(hash);
      this.metrics.cacheMisses++;
      return null;
    }

    this.metrics.cacheHits++;
    return cached;
  }

  /**
   * Cache intent result
   */
  cacheIntent(
    message: string,
    context: any,
    intent: string,
    confidence: number
  ): void {
    const hash = this.hashMessage(message, context);
    
    // Only need to evict if adding a NEW entry (hash doesn't exist) and cache is at limit
    const isNewEntry = !this.intentCache.has(hash);
    
    if (isNewEntry && this.intentCache.size >= this.MAX_CACHE_SIZE) {
      // Find and remove oldest entry (O(n) instead of O(n log n))
      let oldestKey: string | undefined;
      let oldestTime = Infinity;
      for (const [key, entry] of this.intentCache.entries()) {
        const time = entry.timestamp.getTime();
        if (time < oldestTime) {
          oldestTime = time;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        this.intentCache.delete(oldestKey);
      }
    }

    this.intentCache.set(hash, {
      messageHash: hash,
      intent,
      confidence,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + this.INTENT_CACHE_TTL)
    });
  }

  /**
   * Track LLM call
   */
  trackLLMCall(): void {
    this.metrics.llmCalls++;
  }

  /**
   * Track request with response time
   */
  trackRequest(responseTime: number): void {
    this.metrics.totalRequests++;
    // Calculate running average
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
      this.metrics.totalRequests;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics & { cacheHitRate: number } {
    const totalCacheRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    return {
      ...this.metrics,
      cacheHitRate: totalCacheRequests > 0 
        ? (this.metrics.cacheHits / totalCacheRequests) * 100 
        : 0
    };
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = new Date();
    
    // Clear expired extraction cache
    for (const [key, entry] of this.extractionCache.entries()) {
      if (now > entry.expiresAt) {
        this.extractionCache.delete(key);
      }
    }

    // Clear expired intent cache
    for (const [key, entry] of this.intentCache.entries()) {
      if (now > entry.expiresAt) {
        this.intentCache.delete(key);
      }
    }
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.extractionCache.clear();
    this.intentCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    extractionCacheSize: number;
    intentCacheSize: number;
    totalCacheSize: number;
  } {
    return {
      extractionCacheSize: this.extractionCache.size,
      intentCacheSize: this.intentCache.size,
      totalCacheSize: this.extractionCache.size + this.intentCache.size
    };
  }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer();

// Clean up expired cache entries every 5 minutes
// Only set up interval in non-test environments and if not already set
if (typeof setInterval !== 'undefined' && typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  // Use a single interval to avoid multiple timers if module is loaded multiple times
  if (!(globalThis as any).__performanceOptimizerInterval) {
    (globalThis as any).__performanceOptimizerInterval = setInterval(() => {
      performanceOptimizer.clearExpiredCache();
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}

