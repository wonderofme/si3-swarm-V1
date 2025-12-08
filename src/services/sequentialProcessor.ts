/**
 * Sequential Message Processor
 * Processes messages one at a time per user to prevent race conditions
 * Implements untried approach #11.3 from UNTRIED_APPROACHES.md
 */

// Queue of messages per user (userId -> queue of messages)
const messageQueues = new Map<string, Array<{ message: any; resolve: (value: any) => void; reject: (error: any) => void }>>();

// Track if a user's message is currently being processed
const processingUsers = new Set<string>();

/**
 * Process a message sequentially for a user
 * If another message is being processed for this user, queue this one
 */
export async function processSequentially<T>(
  userId: string,
  message: any,
  processor: () => Promise<T>
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // If user is already being processed, queue this message
    if (processingUsers.has(userId)) {
      console.log(`[Sequential Processor] User ${userId} is already being processed, queuing message`);
      if (!messageQueues.has(userId)) {
        messageQueues.set(userId, []);
      }
      messageQueues.get(userId)!.push({ message, resolve, reject });
      return;
    }

    // Mark user as processing
    processingUsers.add(userId);
    console.log(`[Sequential Processor] Processing message for user ${userId}`);

    // Process the message
    processor()
      .then((result) => {
        resolve(result);
      })
      .catch((error) => {
        reject(error);
      })
      .finally(() => {
        // Mark user as done processing
        processingUsers.delete(userId);
        console.log(`[Sequential Processor] Finished processing message for user ${userId}`);

        // Process next message in queue if any
        const queue = messageQueues.get(userId);
        if (queue && queue.length > 0) {
          const next = queue.shift()!;
          console.log(`[Sequential Processor] Processing next queued message for user ${userId} (${queue.length} remaining)`);
          // Recursively process next message
          processSequentially(userId, next.message, processor)
            .then(next.resolve)
            .catch(next.reject);
        } else {
          // No more messages, remove queue
          messageQueues.delete(userId);
        }
      });
  });
}

/**
 * Check if a user has messages queued
 */
export function hasQueuedMessages(userId: string): boolean {
  const queue = messageQueues.get(userId);
  return queue ? queue.length > 0 : false;
}

/**
 * Get queue size for a user
 */
export function getQueueSize(userId: string): number {
  const queue = messageQueues.get(userId);
  return queue ? queue.length : 0;
}

