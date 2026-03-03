/*
  # Multi-Tenant Company System

  1. New Tables
    - `companies`
      - `id` (uuid, primary key)
      - `name` (text, company name)
      - `email` (text, company contact email)
      - `jira_email` (text, Jira account email)
      - `jira_api_token` (text, encrypted Jira API token)
      - `jira_base_url` (text, Jira instance URL)
      - `kolayik_api_token` (text, optional, encrypted Kolay IK API token)
      - `kolayik_base_url` (text, optional, Kolay IK API URL)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `users` (create if not exists)
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `email` (text, unique)
      - `password_hash` (text)
      - `name` (text)
      - `role` (text, enum: admin, analyst, developer)
      - `assigned_projects` (text[], array of project keys)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Companies can only see their own data
    - Users can only see data from their own company
    - Proper foreign key constraints

  3. Indexes
    - Index on company_id for all tables
    - Index on email for users table
*/

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  jira_email text NOT NULL,
  jira_api_token text NOT NULL,
  jira_base_url text NOT NULL,
  kolayik_api_token text DEFAULT '',
  kolayik_base_url text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create users table if not exists
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'analyst', 'developer')),
  assigned_projects text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_companies_email ON companies(email);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for companies
-- Note: We'll use a custom claim 'company_id' in JWT for RLS

-- Companies can view their own data
CREATE POLICY "Companies can view own data"
  ON companies
  FOR SELECT
  TO authenticated
  USING (id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

-- Companies can update their own data
CREATE POLICY "Companies can update own data"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid)
  WITH CHECK (id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

-- Allow anonymous users to insert companies (for registration)
CREATE POLICY "Allow company registration"
  ON companies
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- RLS Policies for users

-- Users can view users from their company
CREATE POLICY "Users can view own company users"
  ON users
  FOR SELECT
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (id = (auth.jwt() ->> 'sub')::uuid)
  WITH CHECK (id = (auth.jwt() ->> 'sub')::uuid);

-- Allow anonymous users to insert users (for registration)
CREATE POLICY "Allow user registration"
  ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Admins can manage users in their company
CREATE POLICY "Admins can manage company users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );