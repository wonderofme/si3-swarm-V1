// CRITICAL: This file must be the entry point to set up interceptors BEFORE any ElizaOS code runs
// ESM imports are hoisted, so we use dynamic import() after setting up interceptors

import fs from 'fs';

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
        if (shouldSuppress) {
          console.error('[Bootstrap] ⚠️ Intercepted pino error (will suppress after logging):');
          console.error('[Bootstrap] Error object:', JSON.stringify(obj, null, 2));
          console.error('[Bootstrap] Error message:', msg);
          console.error('[Bootstrap] Rest args:', rest);
          if (obj && typeof obj === 'object' && obj.err) {
            console.error('[Bootstrap] Error.err:', JSON.stringify(obj.err, null, 2));
            if (obj.err.stack) {
              console.error('[Bootstrap] Error.err.stack:', obj.err.stack);
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
  const pinoModule = require('pino');
  if (pinoModule) {
    const originalPino = pinoModule;
    const patchedPino = function(...args: any[]) {
      const logger = originalPino(...args);
      if (logger && logger.error) {
        const originalError = logger.error.bind(logger);
        logger.error = function(obj: any, msg?: string, ...rest: any[]) {
          const messageToCheck = typeof obj === 'string' ? obj : (msg || '');
          const objStr = typeof obj === 'object' ? JSON.stringify(obj) : '';
          const shouldSuppress = messageToCheck?.includes?.('Error handling message') || 
                                messageToCheck?.includes?.('Error sending message') ||
                                objStr?.includes?.('Error handling message') ||
                                objStr?.includes?.('Error sending message');
          
          // CRITICAL: Log full error details BEFORE suppressing
          if (shouldSuppress) {
            console.error('[Bootstrap] ⚠️ Intercepted pino error via require.cache (will suppress after logging):');
            console.error('[Bootstrap] Error object:', JSON.stringify(obj, null, 2));
            console.error('[Bootstrap] Error message:', msg);
            console.error('[Bootstrap] Rest args:', rest);
            if (obj && typeof obj === 'object' && obj.err) {
              console.error('[Bootstrap] Error.err:', JSON.stringify(obj.err, null, 2));
              if (obj.err.stack) {
                console.error('[Bootstrap] Error.err.stack:', obj.err.stack);
              }
            }
            return; // Suppress after logging
          }
          return originalError(obj, msg, ...rest);
        };
      }
      return logger;
    };
    // Copy over static properties
    Object.assign(patchedPino, originalPino);
    require.cache[require.resolve('pino')]!.exports = patchedPino;
    console.log('[Bootstrap] Pino logger patched via require.cache');
  }
} catch (e) {
  console.log('[Bootstrap] Could not patch pino via require.cache');
}

// Log masked bot token suffix to verify which token is loaded (do NOT log full token)
if (process.env.TELEGRAM_BOT_TOKEN) {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  const suffix = t.slice(-6);
  console.log(`[Bootstrap] Bot token suffix (masked): ****${suffix}`);
}

// Set up error suppression interceptors IMMEDIATELY
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
  // This helps us diagnose the root cause
  if (shouldSuppress) {
    console.error('[Bootstrap] ⚠️ Intercepted ElizaOS error (will suppress after logging):');
    console.error('[Bootstrap] Full message:', cleanMessage);
    console.error('[Bootstrap] Raw message (with ANSI):', message);
    // Try to extract any error object or stack trace from the message
    if (message.includes('stack') || message.includes('Error:') || message.includes('at ')) {
      console.error('[Bootstrap] ⚠️ Message contains stack trace or error details - check above');
    }
  }
  
  return shouldSuppress;
}

// Simple interceptor - check each write directly
process.stdout.write = function(chunk: any, encoding?: any, callback?: any): boolean {
  const message = chunk?.toString() || '';
  if (shouldSuppressMessage(message)) {
    // Suppress this message
    if (typeof callback === 'function') callback();
    return true;
  }
  return originalStdoutWrite(chunk, encoding, callback);
};

process.stderr.write = function(chunk: any, encoding?: any, callback?: any): boolean {
  const message = chunk?.toString() || '';
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
    if (shouldSuppressMessage(message)) {
      return typeof buffer === 'string' ? buffer.length : (buffer?.length || 0);
    }
  }
  return (originalFsWriteSync as any)(fd, buffer, ...rest);
};

// Patch console.error directly
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  if (shouldSuppressMessage(message)) {
    return; // Suppress
  }
  originalConsoleError.apply(console, args);
};

// Patch console.log too in case errors go there
const originalConsoleLog = console.log;
console.log = (...args: any[]) => {
  const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  if (shouldSuppressMessage(message)) {
    return; // Suppress
  }
  originalConsoleLog.apply(console, args);
};

originalConsoleLog('[Bootstrap] Error interceptors installed');

// NOW import the main module after interceptors are set up
import('./index.js').catch((error) => {
  console.error('[Bootstrap] Failed to load main module:', error);
  process.exit(1);
});

