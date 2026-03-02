/*
  # Allow Anonymous Read Access to Sprint Evaluations

  ## Problem
  - Application uses local authentication (localStorage)
  - Supabase client doesn't have authenticated session
  - RLS policies block anonymous users from reading evaluations
  
  ## Solution
  - Add SELECT policies for anonymous role on evaluation tables
  - Keep INSERT/UPDATE/DELETE restricted to authenticated users
  
  ## Security Note
  - This allows public read access to sprint evaluations
  - Consider implementing Supabase Auth integration for better security
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