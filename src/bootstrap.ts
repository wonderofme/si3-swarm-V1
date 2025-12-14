// CRITICAL: This file must be the entry point to set up interceptors BEFORE any ElizaOS code runs
// ESM imports are hoisted, so we use dynamic import() after setting up interceptors

import fs from 'fs';

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
  return (
    lowerMessage.includes('error handling message') ||
    lowerMessage.includes('error sending message')
  );
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

