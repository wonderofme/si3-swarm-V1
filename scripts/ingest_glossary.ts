import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import { fileURLToPath } from 'url';
import pg from 'pg';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const GLOSSARY_FILE = path.join(__dirname, '../glossary_dump.txt');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!OPENAI_API_KEY || !DATABASE_URL) {
  console.error('Missing OPENAI_API_KEY or DATABASE_URL in .env');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const pool = new pg.Pool({ connectionString: DATABASE_URL });

// SI<3 Agent ID (UUID v4 based on name "SI<3>")
// We need to match the exact ID used in the runtime. 
// Since we don't have the runtime here, we can hardcode the one from logs or derive it.
// For now, we'll use a placeholder UUID or query the characters table if possible.
// A safe bet is to query the 'agents' table or 'rooms' table, but for knowledge, we just need a consistent AgentId.
// Let's use a deterministic UUID for "SI<3>" or just use the one form the logs: d24d3f40-0000-0000-0000-000000000002
const AGENT_ID = 'd24d3f40-0000-0000-0000-000000000002'; 

async function getEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small', // Must match what we use in the bot
    input: text,
  });
  return response.data[0].embedding;
}

async function generateDefinition(term: string) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a Web3 glossary expert. Define the following term clearly and concisely (1-2 sentences). Focus on its meaning in the context of blockchain and crypto.'
      },
      { role: 'user', content: `Define: ${term}` }
    ],
  });
  return completion.choices[0].message.content || '';
}

async function ingest() {
  console.log('Starting ingestion...');
  
  // Read terms
  const content = fs.readFileSync(GLOSSARY_FILE, 'utf-8');
  const terms = content.split('\n').map(t => t.trim()).filter(t => t.length > 0);
  
  console.log(`Found ${terms.length} terms.`);

  const client = await pool.connect();

  try {
    for (const [index, term] of terms.entries()) {
      console.log(`Processing [${index + 1}/${terms.length}]: ${term}`);
      
      // 1. Generate Definition
      const definition = await generateDefinition(term);
      const fullText = `${term}: ${definition}`;
      
      // 2. Generate Embedding
      const embedding = await getEmbedding(fullText);
      
      // 3. Insert into Knowledge Table
      // Note: The schema for 'knowledge' table usually has: id, agentId, content, embedding, createdAt, etc.
      // We need to match the schema exactly.
      // Based on standard ElizaOS schema + our "isShared" addition.
      
      const id = crypto.randomUUID();
      
      await client.query(
        `INSERT INTO knowledge ("id", "agentId", "content", "embedding", "createdAt", "isShared")
         VALUES ($1, $2, $3, $4, NOW(), $5)
         ON CONFLICT ("id") DO NOTHING`,
        [id, AGENT_ID, { text: fullText }, JSON.stringify(embedding), true] // isShared = true
      );
      
      // Optional: Sleep to avoid rate limits
      await new Promise(r => setTimeout(r, 200));
    }
    console.log('Ingestion complete!');
  } catch (error) {
    console.error('Error during ingestion:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

ingest();

