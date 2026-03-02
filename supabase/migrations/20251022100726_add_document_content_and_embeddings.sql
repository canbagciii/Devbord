/*
  # Add document content and AI capabilities
  
  1. Changes
    - Add `content` column to `chatbot_documents` table to store extracted text from PDFs/Word files
    - Add `embedding` column to store OpenAI embeddings for semantic search
    - Add `content_extracted` boolean to track if content has been extracted
    - Add index on embedding column for faster vector similarity search
  
  2. Purpose
    - Enable AI-powered semantic search within document contents
    - Allow chatbot to answer questions based on actual document content
    - Support vector similarity search using embeddings
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