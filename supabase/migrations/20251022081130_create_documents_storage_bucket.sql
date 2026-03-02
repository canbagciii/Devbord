/*
  # Create Storage Bucket for Chatbot Documents

  ## Overview
  Creates a storage bucket for chatbot documents (PDFs, videos, etc.)
  with appropriate security policies.

  ## Storage Configuration
  - Bucket name: documents
  - Public access enabled for reading files
  - Upload restricted to authenticated admin users
  - File size limit: 100MB

  ## Security
  - Only admins can upload files
  - Only admins can delete files
  - All authenticated users can read files
  - Public access for reading to allow document viewing
*/

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  104857600,
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read documents
CREATE POLICY "Authenticated users can read documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

-- Allow admins to upload documents
CREATE POLICY "Admins can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'system_admin')
    )
  );

-- Allow admins to delete documents
CREATE POLICY "Admins can delete documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'system_admin')
    )
  );

-- Allow public read access for documents
CREATE POLICY "Public can read documents"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'documents');