/*
  # JIRA Filter Management Tables

  ## Overview
  This migration creates tables to manage dynamic JIRA project and developer filtering.
  Allows administrators to select which projects and developers should be tracked
  from JIRA instead of using hardcoded lists.

  ## New Tables
  
  ### `selected_projects`
  - `id` (uuid, primary key) - Unique identifier
  - `project_key` (text, unique, not null) - JIRA project key (e.g., 'ATK', 'ALB')
  - `project_name` (text, not null) - Display name of the project
  - `is_active` (boolean, default true) - Whether the project is currently tracked
  - `created_at` (timestamptz) - Record creation timestamp
  - `created_by` (uuid) - User who added this project
  - `updated_at` (timestamptz) - Last update timestamp

  ### `selected_developers`
  - `id` (uuid, primary key) - Unique identifier
  - `developer_name` (text, unique, not null) - JIRA display name
  - `developer_email` (text) - Email address
  - `jira_account_id` (text) - JIRA account identifier
  - `is_active` (boolean, default true) - Whether the developer is currently tracked
  - `created_at` (timestamptz) - Record creation timestamp
  - `created_by` (uuid) - User who added this developer
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on both tables
  - Only authenticated users can read filter data
  - Only admin users can modify filter selections
*/

-- Create selected_projects table
CREATE TABLE IF NOT EXISTS selected_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key text UNIQUE NOT NULL,
  project_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

-- Create selected_developers table
CREATE TABLE IF NOT EXISTS selected_developers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_name text UNIQUE NOT NULL,
  developer_email text,
  jira_account_id text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE selected_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE selected_developers ENABLE ROW LEVEL SECURITY;

-- Policies for selected_projects
CREATE POLICY "Authenticated users can view selected projects"
  ON selected_projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can insert projects"
  ON selected_projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update projects"
  ON selected_projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete projects"
  ON selected_projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policies for selected_developers
CREATE POLICY "Authenticated users can view selected developers"
  ON selected_developers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can insert developers"
  ON selected_developers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update developers"
  ON selected_developers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete developers"
  ON selected_developers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_selected_projects_active ON selected_projects(is_active);
CREATE INDEX IF NOT EXISTS idx_selected_projects_key ON selected_projects(project_key);
CREATE INDEX IF NOT EXISTS idx_selected_developers_active ON selected_developers(is_active);
CREATE INDEX IF NOT EXISTS idx_selected_developers_name ON selected_developers(developer_name);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to update updated_at automatically
CREATE TRIGGER update_selected_projects_updated_at
  BEFORE UPDATE ON selected_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_selected_developers_updated_at
  BEFORE UPDATE ON selected_developers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();