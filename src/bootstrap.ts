// CRITICAL: This file must be the entry point to set up interceptors BEFORE any ElizaOS code runs
// ESM imports are hoisted, so we use dynamic import() after setting up interceptors

import fs from 'fs';

// CRITICAL: Store original console methods BEFORE any patching happens
// This prevents infinite recursion when logging inside interceptors
const originalConsoleError = console.error.bind(console);
const originalConsoleLog = console.log.bind(console);

// Try to patch pino before it's used by ElizaOS
// Pino is the logging library used by ElizaOS
async function patchPinoLogger() {
  try {
    const pino = await import('pino');
    const originalPino = pino.default;
    
    // Create a wrapper that filters out specific error messages
    (pino as any).default = function(...args: any[]) {
      const logger = originalPino(...args);
      const originalError = logger.error.bind(logger);
      
      logger.error = function(obj: any, msg?: string, ...rest: any[]) {
        const messageToCheck = typeof obj === 'string' ? obj : (msg || JSON.stringify(obj));
        const shouldSuppress = messageToCheck?.includes('Error handling message') || 
                              messageToCheck?.includes('Error sending message');
        
        // CRITICAL: Log full error details BEFORE suppressing
        // Use originalConsoleError from outer scope to avoid recursion
        if (shouldSuppress) {
          originalConsoleError('[Bootstrap] ⚠️ Intercepted pino error (will suppress after logging):');
          originalConsoleError('[Bootstrap] Error object:', JSON.stringify(obj, null, 2));
          originalConsoleError('[Bootstrap] Error message:', msg);
          originalConsoleError('[Bootstrap] Rest args:', rest);
          if (obj && typeof obj === 'object' && obj.err) {
            originalConsoleError('[Bootstrap] Error.err:', JSON.stringify(obj.err, null, 2));
            if (obj.err.stack) {
              originalConsoleError('[Bootstrap] Error.err.stack:', obj.err.stack);
            }
          }
          return; // Suppress after logging
        }
        return originalError(obj, msg, ...rest);
      };
      
      return logger;
    };
    
    console.log('[Bootstrap] Pino logger patched');
  } catch (e) {
    // Pino not available or couldn't be patched - that's okay
    console.log('[Bootstrap] Could not patch pino logger (may not be installed)');
  }
}

// Patch pino synchronously using require (for CommonJS compatibility)
try {
  const pinoPath = require.resolve('pino');
  const pinoModule = require('pino');
  if (pinoModule && pinoModule.default) {
    const originalPino = pinoModule.default;
    const patchedPino = function(...args: any[]) {
      const logger = originalPino(...args);
      if (logger && logger.error) {
        const originalError = logger.error.bind(logger);
        logger.error = function(obj: any, msg?: string, ...rest: any[]) {
          // CRITICAL: Always check and log FIRST before calling original
          const messageToCheck = typeof obj === 'string' ? obj : (msg || '');
          const objStr = typeof obj === 'object' ? JSON.stringify(obj) : '';
          const fullMessage = messageToCheck + ' ' + objStr;
          
          const shouldSuppress = fullMessage.includes('Error handling message') || 
                                fullMessage.includes('Error sending message');
          
          // CRITICAL: Log full error details BEFORE suppressing
          // Use originalConsoleError from outer scope to avoid recursion
          if (shouldSuppress) {
            originalConsoleError('[Bootstrap] 🔍🔍🔍 PINO ERROR INTERCEPTED via require.cache 🔍🔍🔍');
            originalConsoleError('[Bootstrap] Error object:', JSON.stringify(obj, null, 2));
            originalConsoleError('[Bootstrap] Error message:', msg);
            originalConsoleError('[Bootstrap] Rest args:', JSON.stringify(rest, null, 2));
            if (obj && typeof obj === 'object') {
              if (obj.err) {
                originalConsoleError('[Bootstrap] Error.err:', JSON.stringify(obj.err, null, 2));
                if (obj.err.stack) {
                  originalConsoleError('[Bootstrap] Error.err.stack:', obj.err.stack);
                }
              }
              // Check all properties for error details
              Object.keys(obj).forEach(key => {
                if (key !== 'err' && obj[key] && typeof obj[key] === 'object') {
                  originalConsoleError(`[Bootstrap] Error.${key}:`, JSON.stringify(obj[key], null, 2));
                }
              });
            }
            originalConsoleError('[Bootstrap] 🔍🔍🔍 END PINO ERROR INTERCEPT 🔍🔍🔍');
            return; // Suppress after logging
          }
          return originalError(obj, msg, ...rest);
        };
      }
      return logger;
    };
    // Copy over static properties
    Object.assign(patchedPino, originalPino);
    patchedPino.default = patchedPino;
    // Try multiple ways to patch
    if (require.cache[pinoPath]) {
      require.cache[pinoPath]!.exports = patchedPino;
      require.cache[pinoPath]!.exports.default = patchedPino;
    }
    pinoModule.default = patchedPino;
    console.log('[Bootstrap] ✅ Pino logger patched via require.cache');
  } else {
    console.log('[Bootstrap] ⚠️ Pino module found but default export not available');
  }
} catch (e: any) {
  console.log('[Bootstrap] Could not patch pino via require.cache:', e?.message || e);
}

// Log masked bot token suffix to verify which token is loaded (do NOT log full token)
if (process.env.TELEGRAM_BOT_TOKEN) {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  const suffix = t.slice(-6);
  console.log(`[Bootstrap] Bot token suffix (masked): ****${suffix}`);
}

// Set up error suppression interceptors IMMEDIATELY
// originalConsoleError and originalConsoleLog are already defined at the top of the file
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

function shouldSuppressMessage(message: string): boolean {
  // Remove ANSI escape codes for matching
  const cleanMessage = message
    .replace(/\x1b\[[0-9;]*m/g, '')  // Standard ANSI codes
    .replace(/\[[0-9;]*m/g, '')      // Match [31m format
    .replace(/\[[0-9]+m/g, '');      // Match [31m, [39m patterns
  
  // Check if this message should be suppressed (case-insensitive)
  const lowerMessage = cleanMessage.toLowerCase();
  
  // Match the exact error patterns from ElizaOS
  const shouldSuppress = (
    lowerMessage.includes('error handling message') ||
    lowerMessage.includes('error sending message')
  );
  
  // CRITICAL: Log full error details BEFORE suppressing
  // Use originalConsoleError to avoid recursion
  if (shouldSuppress) {
    originalConsoleError('[Bootstrap] ⚠️ Intercepted ElizaOS error (will suppress after logging):');
    originalConsoleError('[Bootstrap] Full message:', cleanMessage);
    originalConsoleError('[Bootstrap] Raw message (with ANSI):', message);
    // Try to extract any error object or stack trace from the message
    if (message.includes('stack') || message.includes('Error:') || message.includes('at ')) {
      originalConsoleError('[Bootstrap] ⚠️ Message contains stack trace or error details - check above');
    }
  }
  
  return shouldSuppress;
}

// Simple interceptor - check each write directly
// CRITICAL: Log BEFORE checking suppression so we always see the error details
process.stdout.write = function(chunk: any, encoding?: any, callback?: any): boolean {
  const message = chunk?.toString() || '';
  // ALWAYS log first if it matches our error patterns (before suppression check)
  const cleanMessage = message
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\[[0-9;]*m/g, '')
    .replace(/\[[0-9]+m/g, '');
  const lowerMessage = cleanMessage.toLowerCase();
  if (lowerMessage.includes('error handling message') || lowerMessage.includes('error sending message')) {
    // Log the full error BEFORE suppressing
    // Use originalConsoleError to avoid recursion
    originalConsoleError('[Bootstrap] 🔍 CAPTURED ERROR via stdout.write:');
    originalConsoleError('[Bootstrap] Raw chunk:', message);
    originalConsoleError('[Bootstrap] Clean message:', cleanMessage);
    // Try to get more context - check if there's a stack trace in subsequent writes
    originalConsoleError('[Bootstrap] ⚠️ This error will be suppressed, but details logged above');
  }
  
  if (shouldSuppressMessage(message)) {
    // Suppress this message
    if (typeof callback === 'function') callback();
    return true;
  }
  return originalStdoutWrite(chunk, encoding, callback);
};

process.stderr.write = function(chunk: any, encoding?: any, callback?: any): boolean {
  const message = chunk?.toString() || '';
  // ALWAYS log first if it matches our error patterns (before suppression check)
  const cleanMessage = message
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\[[0-9;]*m/g, '')
    .replace(/\[[0-9]+m/g, '');
  const lowerMessage = cleanMessage.toLowerCase();
  if (lowerMessage.includes('error handling message') || lowerMessage.includes('error sending message')) {
    // Log the full error BEFORE suppressing
    // Use originalConsoleError to avoid recursion
    originalConsoleError('[Bootstrap] 🔍 CAPTURED ERROR via stderr.write:');
    originalConsoleError('[Bootstrap] Raw chunk:', message);
    originalConsoleError('[Bootstrap] Clean message:', cleanMessage);
    originalConsoleError('[Bootstrap] ⚠️ This error will be suppressed, but details logged above');
  }
  
  if (shouldSuppressMessage(message)) {
    // Suppress this message
    if (typeof callback === 'function') callback();
    return true;
  }
  return originalStderrWrite(chunk, encoding, callback);
};

// Also patch fs.writeSync for file descriptor 1 (stdout) and 2 (stderr)
// Some loggers bypass process.stdout/stderr and write directly to fd
const originalFsWriteSync = fs.writeSync.bind(fs);
(fs as any).writeSync = function(fd: number, buffer: any, ...rest: any[]): number {
  if (fd === 1 || fd === 2) {
    const message = buffer?.toString() || '';
    // ALWAYS log first if it matches our error patterns
    const cleanMessage = message
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/\[[0-9;]*m/g, '')
      .replace(/\[[0-9]+m/g, '');
    const lowerMessage = cleanMessage.toLowerCase();
    if (lowerMessage.includes('error handling message') || lowerMessage.includes('error sending message')) {
      // Log the full error BEFORE suppressing
      // Use originalConsoleError to avoid recursion
      originalConsoleError('[Bootstrap] 🔍 CAPTURED ERROR via fs.writeSync (fd=' + fd + '):');
      originalConsoleError('[Bootstrap] Raw buffer:', message);
      originalConsoleError('[Bootstrap] Clean message:', cleanMessage);
      originalConsoleError('[Bootstrap] ⚠️ This error will be suppressed, but details logged above');
    }
    
    if (shouldSuppressMessage(message)) {
      return typeof buffer === 'string' ? buffer.length : (buffer?.length || 0);
    }
  }
  return (originalFsWriteSync as any)(fd, buffer, ...rest);
};

// Patch console.error directly
// Use originalConsoleError from top of file (already captured before any patching)
console.error = (...args: any[]) => {
  const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  if (shouldSuppressMessage(message)) {
    return; // Suppress
  }
  originalConsoleError.apply(console, args);
};

// Patch console.log too in case errors go there
// Use originalConsoleLog from top of file (already captured before any patching)
console.log = (...args: any[]) => {
  const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  if (shouldSuppressMessage(message)) {
    return; // Suppress
  }
  originalConsoleLog.apply(console, args);
};

originalConsoleLog('[Bootstrap] Error interceptors installed');
originalConsoleLog('[Bootstrap] Testing interceptor - if you see this, interceptors are working');
// Test that our interceptors are working
const testMessage = '[2025-12-14 08:54:15] [31mERROR[39m: [36m❌ Error handling message:[39m';
if (shouldSuppressMessage(testMessage)) {
  originalConsoleLog('[Bootstrap] ✅ Interceptor test PASSED - error pattern detection working');
} else {
  originalConsoleLog('[Bootstrap] ⚠️ Interceptor test FAILED - error pattern detection not working');
}

// NOW import the main module after interceptors are set up
import('./index.js').catch((error) => {
  originalConsoleError('[Bootstrap] Failed to load main module:', error);
  process.exit(1);
});

