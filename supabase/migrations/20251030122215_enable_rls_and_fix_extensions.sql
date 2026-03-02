/*
  # Enable RLS on Tables and Fix Extension Schema

  ## Changes
  1. Enable RLS on tables that have policies but RLS is disabled
  2. Move vector extension from public to extensions schema
  
  ## Tables with RLS Enabled
  1. chatbot_documents
  2. developer_capacities
  3. selected_developers
  4. selected_projects
  
  ## Extensions
  - Move vector extension to extensions schema (if possible)
*/

-- ============================================
-- ENABLE RLS ON TABLES
-- ============================================

-- Enable RLS on chatbot_documents
ALTER TABLE chatbot_documents ENABLE ROW LEVEL SECURITY;

-- Enable RLS on developer_capacities
ALTER TABLE developer_capacities ENABLE ROW LEVEL SECURITY;

-- Enable RLS on selected_developers
ALTER TABLE selected_developers ENABLE ROW LEVEL SECURITY;

-- Enable RLS on selected_projects
ALTER TABLE selected_projects ENABLE ROW LEVEL SECURITY;

-- ============================================
-- MOVE VECTOR EXTENSION TO EXTENSIONS SCHEMA
-- ============================================

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Note: Vector extension cannot be moved after creation
-- This is a PostgreSQL limitation - extensions cannot be moved between schemas
-- We'll document this as a known limitation
-- For new installations, the extension should be created in the extensions schema:
-- CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Add a comment to document this
COMMENT ON EXTENSION vector IS 'Vector extension - Note: Cannot be moved to extensions schema after creation. This is a PostgreSQL limitation.';