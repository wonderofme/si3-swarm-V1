// CRITICAL: This file must be the entry point to set up interceptors BEFORE any ElizaOS code runs
// ESM imports are hoisted, so we use dynamic import() after setting up interceptors

import fs from 'fs';

// CRITICAL: Store original console methods and streams BEFORE any patching happens
// This prevents infinite recursion when logging inside interceptors
const originalConsoleError = console.error.bind(console);
const originalConsoleLog = console.log.bind(console);
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

// Helper function to patch a pino logger instance
function patchPinoLoggerInstance(logger: any) {
  if (!logger || !logger.error) return logger;
  
  const originalError = logger.error.bind(logger);
  logger.error = function(obj: any, msg?: string, ...rest: any[]) {
    // Check all possible message formats that pino might use
    const messageToCheck = typeof obj === 'string' ? obj : (msg || '');
    const objStr = typeof obj === 'object' && obj !== null ? JSON.stringify(obj) : '';
    const fullMessage = (messageToCheck + ' ' + objStr).toLowerCase();
    
    const shouldSuppress = fullMessage.includes('error handling message') || 
                          fullMessage.includes('error sending message');
    
    // CRITICAL: Log full error details BEFORE suppressing
    // Use originalStderrWrite directly to avoid recursion (console.error uses process.stderr.write)
    if (shouldSuppress) {
      originalStderrWrite('[Bootstrap] 🔍 PINO ERROR INTERCEPTED (instance patch):\n');
      originalStderrWrite('[Bootstrap] Error object: ' + JSON.stringify(obj, null, 2) + '\n');
      originalStderrWrite('[Bootstrap] Error message: ' + (msg || '') + '\n');
      originalStderrWrite('[Bootstrap] Rest args: ' + JSON.stringify(rest, null, 2) + '\n');
      if (obj && typeof obj === 'object' && obj !== null) {
        if (obj.err) {
          originalStderrWrite('[Bootstrap] Error.err: ' + JSON.stringify(obj.err, null, 2) + '\n');
          if (obj.err.stack) {
            originalStderrWrite('[Bootstrap] Error.err.stack: ' + obj.err.stack + '\n');
          }
        }
        // Check all properties for error details
        Object.keys(obj).forEach(key => {
          if (key !== 'err' && obj[key] && typeof obj[key] === 'object') {
            originalStderrWrite(`[Bootstrap] Error.${key}: ` + JSON.stringify(obj[key], null, 2) + '\n');
          }
        });
      }
      originalStderrWrite('[Bootstrap] 🔍 END PINO ERROR INTERCEPT\n');
      return; // Suppress after logging
    }
    return originalError(obj, msg, ...rest);
  };
  
  return logger;
}

// Try to patch pino before it's used by ElizaOS
// Pino is the logging library used by ElizaOS
async function patchPinoLogger() {
  try {
    const pino = await import('pino');
    const originalPino = pino.default;
    
    // Create a wrapper that filters out specific error messages
    (pino as any).default = function(...args: any[]) {
      const logger = originalPino(...args);
      return patchPinoLoggerInstance(logger);
    };
    
    originalConsoleLog('[Bootstrap] Pino logger patched (async)');
  } catch (e) {
    // Pino not available or couldn't be patched - that's okay
    originalConsoleLog('[Bootstrap] Could not patch pino logger (may not be installed)');
  }
}

// Call the async pino patching function
patchPinoLogger().catch(() => {
  // Ignore errors - pino might not be available
});

// Patch pino synchronously using require (for CommonJS compatibility)
try {
  const pinoPath = require.resolve('pino');
  const pinoModule = require('pino');
  if (pinoModule && pinoModule.default) {
    const originalPino = pinoModule.default;
    const patchedPino = function(...args: any[]) {
      const logger = originalPino(...args);
      return patchPinoLoggerInstance(logger);
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
    originalConsoleLog('[Bootstrap] ✅ Pino logger patched via require.cache');
  } else {
    originalConsoleLog('[Bootstrap] ⚠️ Pino module found but default export not available');
  }
} catch (e: any) {
  originalConsoleLog('[Bootstrap] Could not patch pino via require.cache: ' + (e?.message || e));
}

// Log masked bot token suffix to verify which token is loaded (do NOT log full token)
if (process.env.TELEGRAM_BOT_TOKEN) {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  const suffix = t.slice(-6);
  console.log(`[Bootstrap] Bot token suffix (masked): ****${suffix}`);
}

// Set up error suppression interceptors IMMEDIATELY
// originalConsoleError, originalConsoleLog, originalStdoutWrite, and originalStderrWrite 
// are already defined at the top of the file

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
  // Use originalStderrWrite directly to avoid recursion (console.error uses process.stderr.write)
  if (shouldSuppress) {
    originalStderrWrite('[Bootstrap] ⚠️ Intercepted ElizaOS error (will suppress after logging):\n');
    originalStderrWrite('[Bootstrap] Full message: ' + cleanMessage + '\n');
    originalStderrWrite('[Bootstrap] Raw message (with ANSI): ' + message + '\n');
    // Try to extract any error object or stack trace from the message
    if (message.includes('stack') || message.includes('Error:') || message.includes('at ')) {
      originalStderrWrite('[Bootstrap] ⚠️ Message contains stack trace or error details - check above\n');
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
  
  // Check if this is an error we want to suppress
  const isTargetError = lowerMessage.includes('error handling message') || 
                       lowerMessage.includes('error sending message');
  
  // Log ALL stdout writes that contain "error" to help debug (pino writes to stdout!)
  if (lowerMessage.includes('error') && message.length > 0) {
    originalStderrWrite('[Bootstrap] 📝 stdout.write write detected:\n');
    originalStderrWrite('[Bootstrap] Message length: ' + message.length + '\n');
    originalStderrWrite('[Bootstrap] First 200 chars: ' + message.substring(0, 200) + '\n');
    originalStderrWrite('[Bootstrap] Clean (first 200): ' + cleanMessage.substring(0, 200) + '\n');
    originalStderrWrite('[Bootstrap] Is target error: ' + isTargetError + '\n');
  }
  
  if (isTargetError) {
    // Log the full error BEFORE suppressing
    // Use originalStderrWrite directly to avoid recursion (console.error uses process.stderr.write)
    originalStderrWrite('[Bootstrap] 🔍🔍🔍 CAPTURED ERROR via stdout.write 🔍🔍🔍\n');
    originalStderrWrite('[Bootstrap] Raw chunk: ' + JSON.stringify(message) + '\n');
    originalStderrWrite('[Bootstrap] Clean message: ' + cleanMessage + '\n');
    originalStderrWrite('[Bootstrap] Lower message: ' + lowerMessage + '\n');
    originalStderrWrite('[Bootstrap] Pattern match - error handling: ' + lowerMessage.includes('error handling message') + '\n');
    originalStderrWrite('[Bootstrap] Pattern match - error sending: ' + lowerMessage.includes('error sending message') + '\n');
    originalStderrWrite('[Bootstrap] ⚠️ SUPPRESSING THIS ERROR\n');
    originalStderrWrite('[Bootstrap] 🔍🔍🔍 END ERROR CAPTURE 🔍🔍🔍\n');
    
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
  
  // Check if this is an error we want to suppress
  const isTargetError = lowerMessage.includes('error handling message') || 
                       lowerMessage.includes('error sending message');
  
  // Log ALL stderr writes that contain "error" to help debug
  if (lowerMessage.includes('error') && message.length > 0) {
    originalStderrWrite('[Bootstrap] 📝 stderr.write write detected:\n');
    originalStderrWrite('[Bootstrap] Message length: ' + message.length + '\n');
    originalStderrWrite('[Bootstrap] First 200 chars: ' + message.substring(0, 200) + '\n');
    originalStderrWrite('[Bootstrap] Clean (first 200): ' + cleanMessage.substring(0, 200) + '\n');
    originalStderrWrite('[Bootstrap] Is target error: ' + isTargetError + '\n');
  }
  
  if (isTargetError) {
    // Log the full error BEFORE suppressing
    // Use originalStderrWrite directly to avoid recursion (console.error uses process.stderr.write)
    originalStderrWrite('[Bootstrap] 🔍🔍🔍 CAPTURED ERROR via stderr.write 🔍🔍🔍\n');
    originalStderrWrite('[Bootstrap] Raw chunk: ' + JSON.stringify(message) + '\n');
    originalStderrWrite('[Bootstrap] Clean message: ' + cleanMessage + '\n');
    originalStderrWrite('[Bootstrap] Lower message: ' + lowerMessage + '\n');
    originalStderrWrite('[Bootstrap] Pattern match - error handling: ' + lowerMessage.includes('error handling message') + '\n');
    originalStderrWrite('[Bootstrap] Pattern match - error sending: ' + lowerMessage.includes('error sending message') + '\n');
    originalStderrWrite('[Bootstrap] ⚠️ SUPPRESSING THIS ERROR\n');
    originalStderrWrite('[Bootstrap] 🔍🔍🔍 END ERROR CAPTURE 🔍🔍🔍\n');
    
    // Suppress this message
    if (typeof callback === 'function') callback();
    return true;
  }
  
  return originalStderrWrite(chunk, encoding, callback);
};

// Also patch fs.writeSync for file descriptor 1 (stdout) and 2 (stderr)
// Some loggers bypass process.stdout/stderr and write directly to fd
// Pino uses sonic-boom which writes to fd directly!
const originalFsWriteSync = fs.writeSync.bind(fs);
(fs as any).writeSync = function(fd: number, buffer: any, ...rest: any[]): number {
  if (fd === 1 || fd === 2) { // Intercept BOTH stdout (fd 1) AND stderr (fd 2)
    const message = buffer?.toString() || '';
    // ALWAYS log first if it matches our error patterns
    const cleanMessage = message
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/\[[0-9;]*m/g, '')
      .replace(/\[[0-9]+m/g, '');
    const lowerMessage = cleanMessage.toLowerCase();
    
    // Check if this is an error we want to suppress
    const isTargetError = lowerMessage.includes('error handling message') || 
                         lowerMessage.includes('error sending message');
    
    // Log ALL writes that contain "error" to help debug
    if (lowerMessage.includes('error') && message.length > 0) {
      originalStderrWrite('[Bootstrap] 📝 fs.writeSync (fd=' + fd + ') write detected:\n');
      originalStderrWrite('[Bootstrap] Message length: ' + message.length + '\n');
      originalStderrWrite('[Bootstrap] First 200 chars: ' + message.substring(0, 200) + '\n');
      originalStderrWrite('[Bootstrap] Clean (first 200): ' + cleanMessage.substring(0, 200) + '\n');
      originalStderrWrite('[Bootstrap] Is target error: ' + isTargetError + '\n');
    }
    
    if (isTargetError) {
      // Log the full error BEFORE suppressing
      // Use originalStderrWrite directly to avoid recursion
      originalStderrWrite('[Bootstrap] 🔍🔍🔍 CAPTURED ERROR via fs.writeSync (fd=' + fd + ') 🔍🔍🔍\n');
      originalStderrWrite('[Bootstrap] Raw buffer: ' + JSON.stringify(message) + '\n');
      originalStderrWrite('[Bootstrap] Clean message: ' + cleanMessage + '\n');
      originalStderrWrite('[Bootstrap] Lower message: ' + lowerMessage + '\n');
      originalStderrWrite('[Bootstrap] Pattern match - error handling: ' + lowerMessage.includes('error handling message') + '\n');
      originalStderrWrite('[Bootstrap] Pattern match - error sending: ' + lowerMessage.includes('error sending message') + '\n');
      originalStderrWrite('[Bootstrap] ⚠️ SUPPRESSING THIS ERROR\n');
      originalStderrWrite('[Bootstrap] 🔍🔍🔍 END ERROR CAPTURE 🔍🔍🔍\n');
      
      // Suppress by returning the length (successful write) but not actually writing
      return typeof buffer === 'string' ? buffer.length : (buffer?.length || 0);
    }
  }
  return (originalFsWriteSync as any)(fd, buffer, ...rest);
};

// Also patch fs.write (async version) - sonic-boom may use this
const originalFsWrite = fs.write.bind(fs);
(fs as any).write = function(fd: number, buffer: any, ...rest: any[]) {
  if (fd === 1 || fd === 2) {
    const message = buffer?.toString() || '';
    const cleanMessage = message
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/\[[0-9;]*m/g, '')
      .replace(/\[[0-9]+m/g, '');
    const lowerMessage = cleanMessage.toLowerCase();
    
    const isTargetError = lowerMessage.includes('error handling message') || 
                         lowerMessage.includes('error sending message');
    
    // Log ALL writes that contain "error" to help debug
    if (lowerMessage.includes('error') && message.length > 0) {
      originalStderrWrite('[Bootstrap] 📝 fs.write (fd=' + fd + ') write detected:\n');
      originalStderrWrite('[Bootstrap] Message length: ' + message.length + '\n');
      originalStderrWrite('[Bootstrap] First 200 chars: ' + message.substring(0, 200) + '\n');
      originalStderrWrite('[Bootstrap] Clean (first 200): ' + cleanMessage.substring(0, 200) + '\n');
      originalStderrWrite('[Bootstrap] Is target error: ' + isTargetError + '\n');
    }
    
    if (isTargetError) {
      originalStderrWrite('[Bootstrap] 🔍🔍🔍 CAPTURED ERROR via fs.write (fd=' + fd + ') 🔍🔍🔍\n');
      originalStderrWrite('[Bootstrap] ⚠️ SUPPRESSING THIS ERROR\n');
      
      // Call callback with success if provided
      const callback = rest[rest.length - 1];
      if (typeof callback === 'function') {
        const len = typeof buffer === 'string' ? buffer.length : (buffer?.length || 0);
        process.nextTick(() => callback(null, len, buffer));
        return;
      }
      return;
    }
  }
  return (originalFsWrite as any)(fd, buffer, ...rest);
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
  originalStderrWrite('[Bootstrap] Failed to load main module: ' + String(error) + '\n');
  process.exit(1);
});

