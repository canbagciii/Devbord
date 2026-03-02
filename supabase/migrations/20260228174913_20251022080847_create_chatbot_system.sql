/*
  # Chatbot System - Document Management & AI Assistant

  ## New Tables

  ### 1. chatbot_categories
  Categories for organizing documents

  ### 2. chatbot_documents
  Stores uploaded documents and their metadata

  ### 3. chatbot_conversations
  Tracks user conversations with the chatbot

  ### 4. chatbot_messages
  Individual messages within conversations

  ## Security
  - Enable RLS on all tables
  - Public access for demo purposes
*/

-- Create chatbot_categories table
CREATE TABLE IF NOT EXISTS chatbot_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  icon text DEFAULT 'folder',
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  created_by uuid,
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
  uploaded_by uuid,
  uploaded_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Create chatbot_conversations table
CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
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
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_user ON chatbot_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_conversation ON chatbot_messages(conversation_id);

-- Enable Row Level Security
ALTER TABLE chatbot_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chatbot_categories (public access)
CREATE POLICY "Public can view active categories"
  ON chatbot_categories FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Public can insert categories"
  ON chatbot_categories FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update categories"
  ON chatbot_categories FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete categories"
  ON chatbot_categories FOR DELETE
  TO public
  USING (true);

-- RLS Policies for chatbot_documents (public access)
CREATE POLICY "Public can view active documents"
  ON chatbot_documents FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Public can insert documents"
  ON chatbot_documents FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update documents"
  ON chatbot_documents FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete documents"
  ON chatbot_documents FOR DELETE
  TO public
  USING (true);

-- RLS Policies for chatbot_conversations (public access)
CREATE POLICY "Public can view conversations"
  ON chatbot_conversations FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can create conversations"
  ON chatbot_conversations FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update conversations"
  ON chatbot_conversations FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete conversations"
  ON chatbot_conversations FOR DELETE
  TO public
  USING (true);

-- RLS Policies for chatbot_messages (public access)
CREATE POLICY "Public can view messages"
  ON chatbot_messages FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert messages"
  ON chatbot_messages FOR INSERT
  TO public
  WITH CHECK (true);

-- Insert default categories
INSERT INTO chatbot_categories (name, description, icon, color, is_active)
VALUES 
  ('Bankasürans', 'Bankasürans ürünleri ve süreçleri hakkında bilgiler', 'building-2', '#10B981', true),
  ('Insurgateway', 'Insurgateway platformu kullanımı ve dokümantasyonu', 'network', '#3B82F6', true),
  ('İK İşlemleri', 'İnsan Kaynakları süreçleri ve prosedürleri', 'users', '#F59E0B', true)
ON CONFLICT DO NOTHING;