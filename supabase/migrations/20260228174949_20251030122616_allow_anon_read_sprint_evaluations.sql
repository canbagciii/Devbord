/*
  # Allow Anonymous Read Access to Sprint Evaluations

  ## Solution
  - Add SELECT policies for anonymous role on evaluation tables
*/

-- Allow anonymous users to view sprint evaluations
CREATE POLICY "Anonymous can view sprint evaluations"
  ON sprint_evaluations
  FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous users to view team member ratings
CREATE POLICY "Anonymous can view team member ratings"
  ON team_member_ratings
  FOR SELECT
  TO anon
  USING (true);