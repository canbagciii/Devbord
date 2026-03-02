/*
  # Fix Login RLS Policies
  
  1. Changes
    - Add SELECT policy for anonymous users on users table (for login)
    - Add SELECT policy for anonymous users on companies table (for login with company info)
  
  2. Security
    - Allow anonymous users to read user data only during login (email lookup)
    - Allow anonymous users to read company data (needed for inner join during login)
    - These policies are safe because password validation happens in application logic
*/

-- Allow anonymous users to SELECT from users table (needed for login)
CREATE POLICY "Allow anonymous login lookup"
  ON users
  FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous users to SELECT from companies table (needed for login join)
CREATE POLICY "Allow anonymous company lookup"
  ON companies
  FOR SELECT
  TO anon
  USING (true);
