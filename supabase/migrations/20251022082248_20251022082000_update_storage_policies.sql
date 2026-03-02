/*
  # Update Storage Policies for Document Upload

  ## Changes
  - Update storage policies to allow all authenticated users to upload documents
  - Keep admin-only delete permission for safety
  - Maintain public read access

  ## Security
  - All authenticated users can upload documents
  - Only admins can delete documents
  - Public read access enabled
*/

-- Drop existing upload policy
DROP POLICY IF EXISTS "Admins can upload documents" ON storage.objects;

-- Create new policy allowing all authenticated users to upload
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents');
