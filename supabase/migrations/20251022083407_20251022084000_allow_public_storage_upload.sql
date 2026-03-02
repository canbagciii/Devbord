/*
  # Allow Public Storage Upload for Documents

  ## Changes
  - Add policy to allow public (unauthenticated) users to upload documents to storage
  - This enables document upload without authentication

  ## Security
  - Upload restricted to 'documents' bucket only
  - File size and type restrictions enforced at bucket level
  - Only admins can delete files
*/

-- Allow public users to upload documents
CREATE POLICY "Public can upload documents"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'documents');
