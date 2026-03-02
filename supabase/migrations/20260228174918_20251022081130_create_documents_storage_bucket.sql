/*
  # Create Storage Bucket for Chatbot Documents

  ## Storage Configuration
  - Bucket name: documents
  - Public access enabled for reading files
  - Upload allowed for all users
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

-- Allow public to read documents
CREATE POLICY "Public can read documents"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'documents');

-- Allow public to upload documents
CREATE POLICY "Public can upload documents"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'documents');

-- Allow public to delete documents
CREATE POLICY "Public can delete documents"
  ON storage.objects FOR DELETE
  TO public
  USING (bucket_id = 'documents');