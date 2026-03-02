/*
  # Fix Function Search Paths

  ## Changes
  - Set immutable search_path for functions to prevent security issues
  - Functions affected:
    1. search_documents_by_embedding
    2. update_updated_at_column
*/

-- ============================================
-- FIX search_documents_by_embedding
-- ============================================

-- Recreate the function with a safe search_path
CREATE OR REPLACE FUNCTION search_documents_by_embedding(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  file_path text,
  category_id uuid,
  similarity float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    chatbot_documents.id,
    chatbot_documents.title,
    chatbot_documents.content,
    chatbot_documents.file_path,
    chatbot_documents.category_id,
    1 - (chatbot_documents.embedding <=> query_embedding) as similarity
  FROM chatbot_documents
  WHERE chatbot_documents.is_active = true
    AND chatbot_documents.embedding IS NOT NULL
    AND 1 - (chatbot_documents.embedding <=> query_embedding) > match_threshold
  ORDER BY chatbot_documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- FIX update_updated_at_column
-- ============================================

-- Recreate the trigger function with a safe search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;