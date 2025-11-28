import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';
import OpenAI from 'openai';

// Configuration
const INPUT_FILE = 'glossary_dump.txt';
const AGENT_ID = 'd24d3f40-0000-0000-0000-000000000002'; // SI<3> Agent ID
const TABLE_NAME = 'knowledge';

// Setup OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Setup Database
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function getEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small', 
    input: text,
  });
  return response.data[0].embedding;
}

async function generateDefinition(term: string) {
  const completion = await openai.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are a Web3 dictionary. Define the term clearly and concisely in 1-2 sentences.' },
      { role: 'user', content: `Define: ${term}` }
    ],
    model: 'gpt-4o-mini',
  });
  return completion.choices[0].message.content || 'No definition found.';
}

async function main() {
  console.log('🚀 Starting AI-Augmented Ingestion from glossary_dump.txt...');

  // 1. Read File
  const filePath = path.resolve(process.cwd(), INPUT_FILE);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${INPUT_FILE}`);
    return;
  }
  
  const text = fs.readFileSync(filePath, 'utf-8');
  // Assume file is just a list of TERMS, one per line.
  const terms = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  console.log(`✅ Found ${terms.length} terms. Generating definitions...`);

  // 2. Process and Insert
  console.log('💾 Processing and saving to database...');
  
  for (const term of terms) {
    console.log(`   Processing: ${term}`);

    try {
      // A. Generate Definition
      const definition = await generateDefinition(term);
      const content = `${term}: ${definition}`;
      
      // B. Generate Embedding
      const embedding = await getEmbedding(content);
      const vectorStr = `[${embedding.join(',')}]`;
      
      // C. Insert
      await pool.query(
        `INSERT INTO "${TABLE_NAME}" ("id", "agentId", "content", "embedding", "createdAt", "isMain", "isShared")
         VALUES ($1, $2, $3, $4::vector, NOW(), false, true)`,
        [uuidv4(), AGENT_ID, JSON.stringify({ text: content }), vectorStr]
      );
    } catch (err) {
      console.error(`❌ Failed to process ${term}:`, err);
    }
  }

  console.log('🎉 Ingestion complete!');
  await pool.end();
}

main().catch(console.error);

