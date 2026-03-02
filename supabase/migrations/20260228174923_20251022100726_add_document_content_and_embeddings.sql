/*
  # Add document content and AI capabilities
  
  1. Changes
    - Add `content` column to `chatbot_documents` table
    - Add `embedding` column to store OpenAI embeddings
    - Add `content_extracted` boolean
    - Add index on embedding column
*/

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add new columns to chatbot_documents table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatbot_documents' AND column_name = 'content'
  ) THEN
    ALTER TABLE chatbot_documents ADD COLUMN content TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatbot_documents' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE chatbot_documents ADD COLUMN embedding vector(1536);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatbot_documents' AND column_name = 'content_extracted'
  ) THEN
    ALTER TABLE chatbot_documents ADD COLUMN content_extracted BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create index for faster vector similarity search
CREATE INDEX IF NOT EXISTS chatbot_documents_embedding_idx ON chatbot_documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);