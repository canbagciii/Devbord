/*
  # Fix Multiple Permissive Policies

  ## Changes
  - Remove duplicate/overlapping RLS policies
  - Keep the most specific and secure policy for each table
  
  ## Tables Fixed
  1. chatbot_documents - Remove "Authenticated users can insert documents", keep "Public can insert documents"
  2. developer_capacities - Remove older admin policies
  3. sprint_evaluations - Remove "Allow all operations" policies
  4. team_member_ratings - Remove "Allow all operations" policies
  5. tasks - Remove "Allow all operations" policies
*/

-- ============================================
-- CHATBOT_DOCUMENTS
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can insert documents" ON chatbot_documents;

-- ============================================
-- DEVELOPER_CAPACITIES
-- ============================================
DROP POLICY IF EXISTS "Admins can insert capacities" ON developer_capacities;
DROP POLICY IF EXISTS "Admins can update capacities" ON developer_capacities;

-- ============================================
-- SPRINT_EVALUATIONS
-- ============================================
DROP POLICY IF EXISTS "Allow all operations for sprint evaluations" ON sprint_evaluations;

-- ============================================
-- TEAM_MEMBER_RATINGS
-- ============================================
DROP POLICY IF EXISTS "Allow all operations for team member ratings" ON team_member_ratings;

-- ============================================
-- TASKS
-- ============================================
DROP POLICY IF EXISTS "Allow all operations for tasks" ON tasks;