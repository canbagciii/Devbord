/*
  # Allow Public Document Insert

  ## Changes
  - Add policy to allow public (unauthenticated) users to insert documents
  - This enables document upload without authentication

  ## Security
  - Public users can insert documents
  - Only admins can update/delete documents
  - All users can view active documents
*/

-- Allow public users to insert documents
CREATE POLICY "Public can insert documents"
  ON chatbot_documents FOR INSERT
  TO public
  WITH CHECK (true);
