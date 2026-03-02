/*
  # JIRA Filter Management Tables

  ## New Tables
  
  ### `selected_projects`
  - Project filtering for JIRA data
  
  ### `selected_developers`
  - Developer filtering for JIRA data

  ## Security
  - Enable RLS on both tables
  - Public access for demo purposes
*/

-- Create selected_projects table
CREATE TABLE IF NOT EXISTS selected_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key text UNIQUE NOT NULL,
  project_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
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
  created_by uuid,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE selected_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE selected_developers ENABLE ROW LEVEL SECURITY;

-- Policies for selected_projects (public access)
CREATE POLICY "Public can view selected projects"
  ON selected_projects FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert projects"
  ON selected_projects FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update projects"
  ON selected_projects FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete projects"
  ON selected_projects FOR DELETE
  TO public
  USING (true);

-- Policies for selected_developers (public access)
CREATE POLICY "Public can view selected developers"
  ON selected_developers FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert developers"
  ON selected_developers FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update developers"
  ON selected_developers FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete developers"
  ON selected_developers FOR DELETE
  TO public
  USING (true);

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
DROP TRIGGER IF EXISTS update_selected_projects_updated_at ON selected_projects;
CREATE TRIGGER update_selected_projects_updated_at
  BEFORE UPDATE ON selected_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_selected_developers_updated_at ON selected_developers;
CREATE TRIGGER update_selected_developers_updated_at
  BEFORE UPDATE ON selected_developers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();