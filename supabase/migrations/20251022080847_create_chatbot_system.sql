/*
  # Chatbot System - Document Management & AI Assistant

  ## Overview
  This migration creates a comprehensive chatbot system that allows administrators
  to upload documents (PDFs, videos, and other files) organized by categories.
  Users can search and query these documents through an AI-powered chatbot interface.

  ## New Tables

  ### 1. chatbot_categories
  Categories for organizing documents (e.g., Bankasürans, Insurgateway, İK İşlemleri)
  - `id` (uuid, primary key): Unique identifier
  - `name` (text): Category name
  - `description` (text): Category description
  - `icon` (text): Icon identifier for UI
  - `color` (text): Brand color for the category
  - `created_at` (timestamptz): Creation timestamp
  - `created_by` (uuid): User who created the category
  - `is_active` (boolean): Whether category is active

  ### 2. chatbot_documents
  Stores uploaded documents and their metadata
  - `id` (uuid, primary key): Unique identifier
  - `category_id` (uuid): Reference to category
  - `title` (text): Document title
  - `description` (text): Document description
  - `file_url` (text): Storage URL for the file
  - `file_type` (text): MIME type (application/pdf, video/mp4, etc.)
  - `file_size` (bigint): File size in bytes
  - `keywords` (text[]): Searchable keywords
  - `content_text` (text): Extracted text content for search
  - `uploaded_by` (uuid): User who uploaded the document
  - `uploaded_at` (timestamptz): Upload timestamp
  - `is_active` (boolean): Whether document is active

  ### 3. chatbot_conversations
  Tracks user conversations with the chatbot
  - `id` (uuid, primary key): Unique identifier
  - `user_id` (uuid): User having the conversation
  - `category_id` (uuid): Category context (nullable)
  - `created_at` (timestamptz): Conversation start time
  - `updated_at` (timestamptz): Last message time

  ### 4. chatbot_messages
  Individual messages within conversations
  - `id` (uuid, primary key): Unique identifier
  - `conversation_id` (uuid): Reference to conversation
  - `role` (text): 'user' or 'assistant'
  - `content` (text): Message content
  - `document_references` (uuid[]): Referenced document IDs
  - `created_at` (timestamptz): Message timestamp

  ## Security
  - Enable RLS on all tables
  - Admins can manage categories and documents
  - All authenticated users can read categories and documents
  - Users can only access their own conversations
  - Document upload restricted to admins only

  ## Indexes
  - Full-text search on document content and keywords
  - Category and user lookups optimized
*/

-- Create chatbot_categories table
CREATE TABLE IF NOT EXISTS chatbot_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  icon text DEFAULT 'folder',
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  is_active boolean DEFAULT true
);

-- Create chatbot_documents table
CREATE TABLE IF NOT EXISTS chatbot_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES chatbot_categories(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size bigint DEFAULT 0,
  keywords text[] DEFAULT '{}',
  content_text text DEFAULT '',
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Create chatbot_conversations table
CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES chatbot_categories(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create chatbot_messages table
CREATE TABLE IF NOT EXISTS chatbot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES chatbot_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  document_references uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chatbot_documents_category ON chatbot_documents(category_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_documents_keywords ON chatbot_documents USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_chatbot_documents_content_search ON chatbot_documents USING GIN(to_tsvector('turkish', content_text));
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_user ON chatbot_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_conversation ON chatbot_messages(conversation_id);

-- Enable Row Level Security
ALTER TABLE chatbot_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chatbot_categories

CREATE POLICY "Anyone can view active categories"
  ON chatbot_categories FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can insert categories"
  ON chatbot_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'system_admin')
    )
  );

CREATE POLICY "Admins can update categories"
  ON chatbot_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'system_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'system_admin')
    )
  );

CREATE POLICY "Admins can delete categories"
  ON chatbot_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'system_admin')
    )
  );

-- RLS Policies for chatbot_documents

CREATE POLICY "Anyone can view active documents"
  ON chatbot_documents FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can insert documents"
  ON chatbot_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'system_admin')
    )
  );

CREATE POLICY "Admins can update documents"
  ON chatbot_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'system_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'system_admin')
    )
  );

CREATE POLICY "Admins can delete documents"
  ON chatbot_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'system_admin')
    )
  );

-- RLS Policies for chatbot_conversations

CREATE POLICY "Users can view own conversations"
  ON chatbot_conversations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own conversations"
  ON chatbot_conversations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own conversations"
  ON chatbot_conversations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own conversations"
  ON chatbot_conversations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for chatbot_messages

CREATE POLICY "Users can view messages in own conversations"
  ON chatbot_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_conversations
      WHERE chatbot_conversations.id = chatbot_messages.conversation_id
      AND chatbot_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in own conversations"
  ON chatbot_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chatbot_conversations
      WHERE chatbot_conversations.id = chatbot_messages.conversation_id
      AND chatbot_conversations.user_id = auth.uid()
    )
  );

-- Insert default categories
INSERT INTO chatbot_categories (name, description, icon, color, is_active)
VALUES 
  ('Bankasürans', 'Bankasürans ürünleri ve süreçleri hakkında bilgiler', 'building-2', '#10B981', true),
  ('Insurgateway', 'Insurgateway platformu kullanımı ve dokümantasyonu', 'network', '#3B82F6', true),
  ('İK İşlemleri', 'İnsan Kaynakları süreçleri ve prosedürleri', 'users', '#F59E0B', true)
ON CONFLICT DO NOTHING;