# Knowledge Ingestion Script

This script ingests the SI<3> ecosystem documentation into Kaia's knowledge base using RAG (Retrieval-Augmented Generation).

## What It Does

1. **Chunks the Document**: Breaks the SI<3> document into manageable pieces (~1500 characters each with 300 character overlap)
2. **Generates Embeddings**: Uses OpenAI's `text-embedding-3-small` model to create vector embeddings for each chunk
3. **Stores in Database**: Inserts knowledge entries into PostgreSQL with vector embeddings for semantic search

## Prerequisites

- PostgreSQL database with `pgvector` extension enabled
- `DATABASE_URL` environment variable set
- `OPENAI_API_KEY` environment variable set

## Usage

```bash
npm run ingest-knowledge
```

Or directly:

```bash
node --loader ts-node/esm scripts/ingest-si3-knowledge.ts
```

## What Happens

1. The script connects to your database
2. Creates the `knowledge` table if it doesn't exist (with vector support)
3. Processes the SI<3> document in chunks
4. Generates embeddings for each chunk (with rate limiting)
5. Stores everything in the database

## After Ingestion

Once ingested, Kaia will be able to answer questions about:
- SI<3> ecosystem and mission
- Grow3dge Accelerator program
- Si Her DAO
- SI U (Social Impact University)
- Kara Howard's background
- Strategic partnerships
- And more!

The agent will automatically retrieve relevant knowledge chunks when users ask questions about SI<3>.

## Notes

- The script includes rate limiting (100ms delay between chunks) to avoid OpenAI API limits
- Progress is logged every 10 chunks
- The knowledge table uses PostgreSQL's vector type for efficient semantic search
- Each chunk is stored with metadata (source, chunk index, title)

