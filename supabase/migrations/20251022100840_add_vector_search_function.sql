/*
  # Add vector search function
  
  1. New Functions
    - `search_documents_by_embedding` - Performs vector similarity search on documents
      - Takes category_id, query_embedding vector, match_threshold, and match_count as parameters
      - Returns documents ordered by similarity score
  
  2. Purpose
    - Enable semantic search using OpenAI embeddings
    - Find documents similar to user's query based on meaning, not just keywords
*/

CREATE OR REPLACE FUNCTION search_documents_by_embedding(
  category_id UUID,
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  content TEXT,
  file_url TEXT,
  file_type TEXT,
  file_size INT,
  keywords TEXT[],
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cd.id,
    cd.title,
    cd.description,
    cd.content,
    cd.file_url,
    cd.file_type,
    cd.file_size,
    cd.keywords,
    1 - (cd.embedding <=> query_embedding) AS similarity
  FROM chatbot_documents cd
  WHERE cd.category_id = search_documents_by_embedding.category_id
    AND cd.embedding IS NOT NULL
    AND 1 - (cd.embedding <=> query_embedding) > match_threshold
  ORDER BY cd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;