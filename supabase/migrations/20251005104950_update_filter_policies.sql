/*
  # Update RLS Policies for Selected Projects and Developers
  
  1. Changes
    - Update INSERT policies to allow authenticated users (not just admins)
    - Update UPDATE policies to allow authenticated users (not just admins)
    - Update DELETE policies to allow authenticated users (not just admins)
    - Keep SELECT policies as is (all authenticated users can view)
  
  2. Reasoning
    - All authenticated users should be able to manage project and developer selections
    - This is a configuration feature that doesn't contain sensitive data
    - Simplifies the user experience
*/

-- Drop existing policies for selected_projects
DROP POLICY IF EXISTS "Admin users can insert projects" ON selected_projects;
DROP POLICY IF EXISTS "Admin users can update projects" ON selected_projects;
DROP POLICY IF EXISTS "Admin users can delete projects" ON selected_projects;

-- Create new policies for selected_projects
CREATE POLICY "Authenticated users can insert projects"
  ON selected_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update projects"
  ON selected_projects
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete projects"
  ON selected_projects
  FOR DELETE
  TO authenticated
  USING (true);

-- Drop existing policies for selected_developers
DROP POLICY IF EXISTS "Admin users can insert developers" ON selected_developers;
DROP POLICY IF EXISTS "Admin users can update developers" ON selected_developers;
DROP POLICY IF EXISTS "Admin users can delete developers" ON selected_developers;

-- Create new policies for selected_developers
CREATE POLICY "Authenticated users can insert developers"
  ON selected_developers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update developers"
  ON selected_developers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete developers"
  ON selected_developers
  FOR DELETE
  TO authenticated
  USING (true);