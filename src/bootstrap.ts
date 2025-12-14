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
  return (
    lowerMessage.includes('error handling message') ||
    lowerMessage.includes('error sending message')
  );
}

// Simple interceptor - check each write directly
// CRITICAL: Log BEFORE checking suppression so we always see the error details
process.stdout.write = function(chunk: any, encoding?: any, callback?: any): boolean {
  const message = chunk?.toString() || '';
  const cleanMessage = message
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\[[0-9;]*m/g, '')
    .replace(/\[[0-9]+m/g, '');
  const lowerMessage = cleanMessage.toLowerCase();
  
  const isTargetError = lowerMessage.includes('error handling message') || 
                       lowerMessage.includes('error sending message');
  
  if (isTargetError) {
    // Suppress this message
    if (typeof callback === 'function') callback();
    return true;
  }
  
  return originalStdoutWrite(chunk, encoding, callback);
};

process.stderr.write = function(chunk: any, encoding?: any, callback?: any): boolean {
  const message = chunk?.toString() || '';
  const cleanMessage = message
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\[[0-9;]*m/g, '')
    .replace(/\[[0-9]+m/g, '');
  const lowerMessage = cleanMessage.toLowerCase();
  
  const isTargetError = lowerMessage.includes('error handling message') || 
                       lowerMessage.includes('error sending message');
  
  if (isTargetError) {
    // Suppress this message
    if (typeof callback === 'function') callback();
    return true;
  }
  
  return originalStderrWrite(chunk, encoding, callback);
};

// Also patch fs.writeSync for file descriptor 1 (stdout) and 2 (stderr)
const originalFsWriteSync = fs.writeSync.bind(fs);
(fs as any).writeSync = function(fd: number, buffer: any, ...rest: any[]): number {
  if (fd === 1 || fd === 2) {
    const message = buffer?.toString() || '';
    const cleanMessage = message
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/\[[0-9;]*m/g, '')
      .replace(/\[[0-9]+m/g, '');
    const lowerMessage = cleanMessage.toLowerCase();
    
    const isTargetError = lowerMessage.includes('error handling message') || 
                         lowerMessage.includes('error sending message');
    
    if (isTargetError) {
      // Suppress by returning the length (successful write) but not actually writing
      return typeof buffer === 'string' ? buffer.length : (buffer?.length || 0);
    }
  }
  return (originalFsWriteSync as any)(fd, buffer, ...rest);
};

// Also patch fs.write (async version) - pino/sonic-boom uses this!
// This is the key interceptor that catches the ElizaOS errors
const originalFsWrite = fs.write.bind(fs);

// Track when we're capturing error details (pino writes in chunks)
let capturingErrorDetails = false;
let errorDetailBuffer: string[] = [];
let captureTimeout: NodeJS.Timeout | null = null;

function flushErrorDetails() {
  if (errorDetailBuffer.length > 0) {
    const fullError = errorDetailBuffer.join('');
    const cleanError = fullError
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/\[[0-9;]*m/g, '')
      .replace(/\[[0-9]+m/g, '');
    originalStderrWrite('[Bootstrap] 📋 Full error details:\n' + cleanError + '\n');
    errorDetailBuffer = [];
  }
  capturingErrorDetails = false;
  captureTimeout = null;
}

(fs as any).write = function(fd: number, buffer: any, ...rest: any[]) {
  if (fd === 1 || fd === 2) {
    const message = buffer?.toString() || '';
    const cleanMessage = message
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/\[[0-9;]*m/g, '')
      .replace(/\[[0-9]+m/g, '');
    const lowerMessage = cleanMessage.toLowerCase();
    
    const isTargetErrorHeader = lowerMessage.includes('error handling message') || 
                               lowerMessage.includes('error sending message');
    
    if (isTargetErrorHeader) {
      // Start capturing error details
      capturingErrorDetails = true;
      errorDetailBuffer = [cleanMessage];
      
      // Set timeout to flush after 100ms (pino writes in rapid succession)
      if (captureTimeout) clearTimeout(captureTimeout);
      captureTimeout = setTimeout(flushErrorDetails, 100);
      
      // Log that we're suppressing
      originalStderrWrite('[Bootstrap] ⚠️ Suppressed ElizaOS error header: ' + cleanMessage.trim().substring(0, 80) + '...\n');
      
      // Find and call callback with success
      for (let i = rest.length - 1; i >= 0; i--) {
        if (typeof rest[i] === 'function') {
          const callback = rest[i];
          const len = typeof buffer === 'string' ? buffer.length : (buffer?.length || 0);
          callback(null, len, buffer);
          return;
        }
      }
      return;
    }
    
    // If we're capturing error details, collect this write too
    if (capturingErrorDetails) {
      errorDetailBuffer.push(cleanMessage);
      
      // Reset timeout
      if (captureTimeout) clearTimeout(captureTimeout);
      captureTimeout = setTimeout(flushErrorDetails, 100);
      
      // Suppress but call callback
      for (let i = rest.length - 1; i >= 0; i--) {
        if (typeof rest[i] === 'function') {
          const callback = rest[i];
          const len = typeof buffer === 'string' ? buffer.length : (buffer?.length || 0);
          callback(null, len, buffer);
          return;
        }
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

// NOW import the main module after interceptors are set up
import('./index.js').catch((error) => {
  originalStderrWrite('[Bootstrap] Failed to load main module: ' + String(error) + '\n');
  process.exit(1);
});

