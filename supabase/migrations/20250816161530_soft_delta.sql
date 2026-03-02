/*
  # Fix JWT function error in RLS policies

  1. Policy Updates
    - Replace jwt() with auth.jwt() in all policies
    - Update developer_capacities table policies
    - Update sprint_evaluations table policies
    - Update team_member_ratings table policies

  2. Security
    - Maintain same security logic
    - Use correct Supabase auth functions
    - Ensure proper role-based access
*/

-- Fix developer_capacities policies
DROP POLICY IF EXISTS "Admins can insert capacities" ON developer_capacities;
DROP POLICY IF EXISTS "Admins can update capacities" ON developer_capacities;

CREATE POLICY "Admins can insert capacities"
  ON developer_capacities
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'admin'::text);

CREATE POLICY "Admins can update capacities"
  ON developer_capacities
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

-- Fix sprint_evaluations policies if they exist with jwt()
-- Note: These might not exist yet, so we use IF EXISTS
DO $$
BEGIN
  -- Check if policies exist and drop them
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'sprint_evaluations' 
    AND policyname = 'Users can insert their own evaluations'
  ) THEN
    DROP POLICY "Users can insert their own evaluations" ON sprint_evaluations;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'sprint_evaluations' 
    AND policyname = 'Users can update their own evaluations'
  ) THEN
    DROP POLICY "Users can update their own evaluations" ON sprint_evaluations;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'sprint_evaluations' 
    AND policyname = 'Users can delete their own evaluations'
  ) THEN
    DROP POLICY "Users can delete their own evaluations" ON sprint_evaluations;
  END IF;
END $$;

-- Create correct policies for sprint_evaluations
CREATE POLICY "Users can insert their own evaluations"
  ON sprint_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email'::text) = evaluator_email);

CREATE POLICY "Users can update their own evaluations"
  ON sprint_evaluations
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = evaluator_email);

CREATE POLICY "Users can delete their own evaluations"
  ON sprint_evaluations
  FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = evaluator_email);

-- Fix team_member_ratings policies if they exist with jwt()
DO $$
BEGIN
  -- Check if policies exist and drop them
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'team_member_ratings' 
    AND policyname = 'Users can insert team member ratings for their own evaluations'
  ) THEN
    DROP POLICY "Users can insert team member ratings for their own evaluations" ON team_member_ratings;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'team_member_ratings' 
    AND policyname = 'Users can update team member ratings for their own evaluations'
  ) THEN
    DROP POLICY "Users can update team member ratings for their own evaluations" ON team_member_ratings;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'team_member_ratings' 
    AND policyname = 'Users can delete team member ratings for their own evaluations'
  ) THEN
    DROP POLICY "Users can delete team member ratings for their own evaluations" ON team_member_ratings;
  END IF;
END $$;

-- Create correct policies for team_member_ratings
CREATE POLICY "Users can insert team member ratings for their own evaluations"
  ON team_member_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sprint_evaluations
      WHERE sprint_evaluations.id = team_member_ratings.evaluation_id
      AND sprint_evaluations.evaluator_email = (auth.jwt() ->> 'email'::text)
    )
  );

CREATE POLICY "Users can update team member ratings for their own evaluations"
  ON team_member_ratings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sprint_evaluations
      WHERE sprint_evaluations.id = team_member_ratings.evaluation_id
      AND sprint_evaluations.evaluator_email = (auth.jwt() ->> 'email'::text)
    )
  );

CREATE POLICY "Users can delete team member ratings for their own evaluations"
  ON team_member_ratings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sprint_evaluations
      WHERE sprint_evaluations.id = team_member_ratings.evaluation_id
      AND sprint_evaluations.evaluator_email = (auth.jwt() ->> 'email'::text)
    )
  );