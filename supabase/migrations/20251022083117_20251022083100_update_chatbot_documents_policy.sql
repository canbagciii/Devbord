/*
  # Update Chatbot Documents RLS Policy

  ## Changes
  - Allow public (unauthenticated) users to view active documents
  - Allow authenticated users to insert documents
  - This enables the document management interface to work for all users

  ## Security
  - Public can only read active documents
  - All authenticated users can upload documents
  - Only admins can update/delete documents
*/

-- Drop existing select policy
DROP POLICY IF EXISTS "Anyone can view active documents" ON chatbot_documents;

-- Create new policy allowing public to view active documents
CREATE POLICY "Public can view active documents"
  ON chatbot_documents FOR SELECT
  TO public
  USING (is_active = true);

-- Drop existing insert policy
DROP POLICY IF EXISTS "Admins can insert documents" ON chatbot_documents;

-- Create new policy allowing all authenticated users to insert documents
CREATE POLICY "Authenticated users can insert documents"
  ON chatbot_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);
