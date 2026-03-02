/*
  # Allow Anonymous Access to Filter Tables (Temporary)
  
  1. Changes
    - Allow anon role to INSERT/UPDATE/DELETE on selected_projects and selected_developers
    - This is a temporary fix until authentication is properly configured
  
  2. Security Note
    - This is NOT recommended for production
    - Should be reverted once authentication is working
*/

-- Add policies for anon role on selected_projects
CREATE POLICY "Anonymous users can insert projects (temp)"
  ON selected_projects
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous users can update projects (temp)"
  ON selected_projects
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous users can delete projects (temp)"
  ON selected_projects
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Anonymous users can view projects (temp)"
  ON selected_projects
  FOR SELECT
  TO anon
  USING (true);

-- Add policies for anon role on selected_developers
CREATE POLICY "Anonymous users can insert developers (temp)"
  ON selected_developers
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous users can update developers (temp)"
  ON selected_developers
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous users can delete developers (temp)"
  ON selected_developers
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Anonymous users can view developers (temp)"
  ON selected_developers
  FOR SELECT
  TO anon
  USING (true);