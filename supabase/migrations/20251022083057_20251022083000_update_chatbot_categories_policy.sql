/*
  # Update Chatbot Categories RLS Policy

  ## Changes
  - Allow public (unauthenticated) users to view active categories
  - This enables the document management interface to load categories for all users

  ## Security
  - Only reading active categories is allowed for public
  - Write operations still restricted to admins
*/

-- Drop existing select policy
DROP POLICY IF EXISTS "Anyone can view active categories" ON chatbot_categories;

-- Create new policy allowing public to view active categories
CREATE POLICY "Public can view active categories"
  ON chatbot_categories FOR SELECT
  TO public
  USING (is_active = true);
