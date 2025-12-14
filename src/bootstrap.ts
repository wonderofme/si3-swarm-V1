// CRITICAL: This file must be the entry point to set up interceptors BEFORE any ElizaOS code runs
// ESM imports are hoisted, so we use dynamic import() after setting up interceptors

// Set up error suppression interceptors IMMEDIATELY
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);
let stdoutBuffer = '';
let stderrBuffer = '';

function shouldSuppressLine(line: string): boolean {
  // Remove ANSI escape codes for matching (both \x1b[ and [ formats)
  const cleanLine = line
    .replace(/\x1b\[[0-9;]*m/g, '')  // Standard ANSI codes
    .replace(/\[[0-9;]*m/g, '')      // Also match [31m format (when ANSI is displayed as text)
    .replace(/\[[0-9]+m/g, '');      // Match [31m, [39m, [36m patterns
  
  // Check if this line should be suppressed (case-insensitive, check for various patterns)
  const lowerLine = cleanLine.toLowerCase();
  return (
    lowerLine.includes('error handling message') ||
    lowerLine.includes('error sending message') ||
    lowerLine.includes('❌ error handling message') ||
    lowerLine.includes('❌ error sending message') ||
    (lowerLine.includes('error') && lowerLine.includes('handling message')) ||
    (lowerLine.includes('error') && lowerLine.includes('sending message'))
  );
}

function processBuffer(buffer: string, originalWrite: Function, encoding?: any, callback?: any): string {
  const hasNewline = buffer.includes('\n');
  const bufferTooLarge = buffer.length > 10000;
  const shouldSuppressBuffer = shouldSuppressLine(buffer);
  
  if (hasNewline) {
    const lines = buffer.split('\n');
    const lastLine = lines[lines.length - 1];
    const completeLines = lines.slice(0, -1);
    
    const linesToWrite: string[] = [];
    for (const line of completeLines) {
      if (!shouldSuppressLine(line)) {
        linesToWrite.push(line);
      }
    }
    
    if (linesToWrite.length > 0) {
      originalWrite(linesToWrite.join('\n') + '\n', encoding, callback);
    }
    
    return shouldSuppressLine(lastLine) ? '' : lastLine;
  } else if (bufferTooLarge || shouldSuppressBuffer) {
    if (!shouldSuppressBuffer) {
      originalWrite(buffer, encoding, callback);
    }
    return '';
  }
  
  return buffer;
}

// Patch stdout
process.stdout.write = function(chunk: any, encoding?: any, callback?: any): boolean {
  const message = chunk?.toString() || '';
  stdoutBuffer += message;
  stdoutBuffer = processBuffer(stdoutBuffer, originalStdoutWrite, encoding, callback);
  return true;
};

// Patch stderr
process.stderr.write = function(chunk: any, encoding?: any, callback?: any): boolean {
  const message = chunk?.toString() || '';
  stderrBuffer += message;
  stderrBuffer = processBuffer(stderrBuffer, originalStderrWrite, encoding, callback);
  return true;
};

// Patch console.error
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const message = args.join(' ');
  if (
    message.includes('Error handling message') ||
    message.includes('Error sending message') ||
    message.includes('❌ Error handling message')
  ) {
    return; // Suppress
  }
  originalConsoleError.apply(console, args);
};

console.log('[Bootstrap] Error interceptors installed');

// NOW import the main module after interceptors are set up
import('./index.js').catch((error) => {
  console.error('[Bootstrap] Failed to load main module:', error);
  process.exit(1);
});

