/*
  # Remove Insecure Anonymous Policies

  1. Security Fix
    - Remove anonymous access policies from selected_projects
    - Remove anonymous access policies from selected_developers
    - These policies were bypassing RLS and allowing access to all company data
    - Proper RLS policies with company_id filtering are already in place

  2. Impact
    - Users must be authenticated to access project and developer selections
    - Data is properly filtered by company_id through RLS
*/

-- Drop insecure anon policies from selected_projects
DROP POLICY IF EXISTS "Anonymous users can insert projects (temp)" ON selected_projects;
DROP POLICY IF EXISTS "Anonymous users can update projects (temp)" ON selected_projects;
DROP POLICY IF EXISTS "Anonymous users can delete projects (temp)" ON selected_projects;
DROP POLICY IF EXISTS "Anonymous users can view projects (temp)" ON selected_projects;

-- Drop insecure anon policies from selected_developers
DROP POLICY IF EXISTS "Anonymous users can insert developers (temp)" ON selected_developers;
DROP POLICY IF EXISTS "Anonymous users can update developers (temp)" ON selected_developers;
DROP POLICY IF EXISTS "Anonymous users can delete developers (temp)" ON selected_developers;
DROP POLICY IF EXISTS "Anonymous users can view developers (temp)" ON selected_developers;
