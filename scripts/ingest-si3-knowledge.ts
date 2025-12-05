import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load character JSON
const kaiaCharacter = JSON.parse(
  readFileSync(join(__dirname, '../characters/kaia.character.json'), 'utf-8')
);

// Load SI<3> document from file (to avoid memory issues)
function loadSI3Document(): string {
  return readFileSync(join(__dirname, 'si3-document.txt'), 'utf-8');
}

// Function to chunk text into smaller pieces (for better embedding and retrieval)
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);
    
    // Try to break at sentence boundaries
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > chunkSize * 0.5) {
        chunk = chunk.slice(0, breakPoint + 1);
      }
    }
    
    chunks.push(chunk.trim());
    start = end - overlap; // Overlap to maintain context
  }
  
  return chunks;
}

async function ingestKnowledge() {
  let pool: pg.Pool | undefined;
  
  try {
    console.log('Starting SI<3> knowledge ingestion...');
    
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    
    // Create database connection pool
    console.log('Connecting to database...');
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    // Test database connection
    console.log('Testing database connection...');
    try {
      const client = await pool.connect();
      await client.query('SELECT 1 as test');
      client.release();
      console.log('✓ Database connection successful');
    } catch (err: any) {
      await pool.end();
      throw new Error(`Database connection failed: ${err.message}`);
    }
    
    const agentId = kaiaCharacter.id || kaiaCharacter.name;
    console.log(`Agent ID: ${agentId}`);
  
    // Load and process document in streaming fashion
    console.log('Loading SI<3> document...');
    const si3Document = loadSI3Document();
    console.log(`Document loaded (${si3Document.length} characters)`);
    
    // Process in smaller batches to avoid memory issues
    const chunkSize = 1500;
    const overlap = 300;
    const totalLength = si3Document.length;
    let processedChunks = 0;
    let start = 0;
  
    // Create a runtime to use its knowledge methods
    // We'll use the database adapter directly since we need to create knowledge entries
    // Enable pgvector extension if not already enabled
    const client = await pool.connect();
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
      console.log('✓ pgvector extension enabled');
    } catch (err: any) {
      if (!err.message?.includes('already exists') && !err.message?.includes('permission denied')) {
        console.warn('Note: pgvector extension:', err.message);
      }
    }
    
    // Check if knowledge table exists, create if not, and migrate columns
    try {
      // Create table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS knowledge (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id UUID NOT NULL,
          user_id UUID,
          room_id UUID,
          content JSONB NOT NULL,
          embedding VECTOR(1536),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      
      // Migrate existing table if needed (handle camelCase to snake_case)
      await client.query(`
        DO $$ 
        BEGIN 
          -- Ensure id column exists with default
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='knowledge' AND column_name='id') THEN
            ALTER TABLE knowledge ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
          ELSE
            -- If id exists but no default, add default
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name='knowledge' 
              AND column_name='id' 
              AND column_default IS NOT NULL
            ) THEN
              ALTER TABLE knowledge ALTER COLUMN id SET DEFAULT gen_random_uuid();
            END IF;
          END IF;
          
          -- Rename agentId to agent_id if it exists
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='knowledge' AND column_name='agentId') THEN
            ALTER TABLE knowledge RENAME COLUMN "agentId" TO agent_id;
          END IF;
          
          -- Add agent_id if missing
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='knowledge' AND column_name='agent_id') THEN
            ALTER TABLE knowledge ADD COLUMN agent_id UUID;
          END IF;
          
          -- Add user_id if missing
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='knowledge' AND column_name='user_id') THEN
            ALTER TABLE knowledge ADD COLUMN user_id UUID;
          END IF;
          
          -- Add room_id if missing
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='knowledge' AND column_name='room_id') THEN
            ALTER TABLE knowledge ADD COLUMN room_id UUID;
          END IF;
          
          -- Add embedding column if missing
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='knowledge' AND column_name='embedding') THEN
            ALTER TABLE knowledge ADD COLUMN embedding VECTOR(1536);
          END IF;
          
          -- Add created_at if missing
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='knowledge' AND column_name='created_at') THEN
            ALTER TABLE knowledge ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
          END IF;
          
          -- Add updated_at if missing
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='knowledge' AND column_name='updated_at') THEN
            ALTER TABLE knowledge ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
          END IF;
        END $$;
      `);
      
      // Create indexes
      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_knowledge_agent_id ON knowledge(agent_id);
        `);
      } catch (idxErr: any) {
        console.warn('Note: Index creation:', idxErr.message);
      }
      
      // Try to create vector index (may fail if not enough data, that's okay)
      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_knowledge_embedding 
          ON knowledge USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = 100);
        `);
      } catch (idxErr: any) {
        console.warn('Note: Vector index creation (will be created after data is inserted):', idxErr.message);
      }
      
      console.log('✓ Knowledge table ready');
    } catch (err: any) {
      console.error('Error setting up knowledge table:', err);
      throw err;
    } finally {
      client.release();
    }
    
    // Generate embeddings and insert knowledge entries
    console.log('Generating embeddings and creating knowledge entries...');
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    // Function to generate embedding using OpenAI API
    async function generateEmbedding(text: string): Promise<number[]> {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }
      
      const data = await response.json();
      return data.data[0].embedding;
    }
    
    let successCount = 0;
    let chunkIndex = 0;
    
    // Calculate approximate total chunks for progress tracking
    const effectiveStep = chunkSize - overlap; // 1200 characters per chunk
    const approximateTotal = Math.ceil((totalLength - chunkSize) / effectiveStep) + 1;
    console.log(`Approximately ${approximateTotal} chunks to process...`);
    
    // Process chunks one at a time to minimize memory usage
    while (start < totalLength) {
      const end = Math.min(start + chunkSize, totalLength);
      let chunk = si3Document.slice(start, end);
      let actualEnd = end;
      
      // Try to break at sentence boundaries
      if (end < totalLength) {
        const lastPeriod = chunk.lastIndexOf('.');
        const lastNewline = chunk.lastIndexOf('\n');
        const breakPoint = Math.max(lastPeriod, lastNewline);
        if (breakPoint > chunkSize * 0.5) {
          chunk = chunk.slice(0, breakPoint + 1);
          actualEnd = start + breakPoint + 1; // Update actual end position
        }
      }
      
      chunk = chunk.trim();
      
      // Only process if chunk is meaningful
      if (chunk.length > 50) { // Minimum chunk size to avoid tiny chunks
        try {
          // Generate embedding
          const embedding = await generateEmbedding(chunk);
          
          // Insert into knowledge table immediately
          // Generate UUID for id if needed
          const { randomUUID } = await import('crypto');
          const knowledgeId = randomUUID();
          
          const insertClient = await pool.connect();
          try {
            await insertClient.query(`
              INSERT INTO knowledge (id, agent_id, user_id, room_id, content, embedding)
              VALUES ($1, $2, $3, $4, $5, $6::vector)
            `, [
              knowledgeId,
              agentId,
              agentId,
              agentId,
              JSON.stringify({
                text: chunk,
                type: 'knowledge',
                data: {
                  source: 'SI3_DOCUMENT',
                  chunkIndex: chunkIndex,
                  title: 'SI<3> Ecosystem Documentation'
                }
              }),
              `[${embedding.join(',')}]`
            ]);
          } finally {
            insertClient.release();
          }
          
          successCount++;
          chunkIndex++;
          
          // Clear references to help GC
          chunk = '';
          
          if (chunkIndex % 10 === 0) {
            const progress = approximateTotal > 0 ? Math.round((chunkIndex / approximateTotal) * 100) : 0;
            console.log(`  Processed ${chunkIndex} chunks... (${progress}% complete, ~${approximateTotal - chunkIndex} remaining)`);
            // Force garbage collection hint
            if (global.gc) {
              global.gc();
            }
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error processing chunk ${chunkIndex}:`, error);
        }
      }
      
      // Move to next chunk with overlap - use actualEnd to ensure we advance
      const nextStart = actualEnd - overlap;
      if (nextStart <= start) {
        // Safety check: ensure we always advance
        start = start + effectiveStep;
      } else {
        start = nextStart;
      }
      
      // Safety check: if we're not making progress, break
      if (start >= totalLength) {
        break;
      }
    }
    
    console.log(`\n✅ Successfully ingested ${successCount} knowledge chunks for SI<3>!`);
    console.log('The agent can now answer questions about SI<3>, Grow3dge, Kara Howard, and the ecosystem.');
    
    // Close database pool
    await pool.end();
  
  } catch (error: any) {
    console.error('\n❌ Error ingesting knowledge:');
    console.error('Error message:', error?.message || error);
    console.error('Error stack:', error?.stack);
    if (error?.cause) {
      console.error('Error cause:', error.cause);
    }
    // Try to close pool if it exists
    if (pool) {
      try {
        await pool.end();
      } catch (e) {
        // Ignore errors when closing
      }
    }
    process.exit(1);
  }
  
  console.log('\n✅ Knowledge ingestion complete!');
  process.exit(0);
}

// Run the ingestion with better error handling
ingestKnowledge().catch((error) => {
  console.error('\n❌ Fatal error:');
  console.error(error);
  process.exit(1);
});

