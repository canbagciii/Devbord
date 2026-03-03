/*
  # Create Core Tables with Multi-Tenant Support

  1. New Tables
    - `selected_projects` - Stores selected Jira projects per company
    - `selected_developers` - Stores selected developers per company
    - `sprint_evaluations` - Stores sprint evaluations per company
    - `team_member_ratings` - Stores team member ratings (linked to evaluations)
    - `tasks` - Stores tasks per company
    - `developer_capacities` - Stores developer capacity settings per company

  2. Security
    - All tables have company_id
    - RLS enabled on all tables
    - Users can only access data from their own company

  3. Indexes
    - Indexes on company_id for all tables
    - Indexes on frequently queried columns
*/

-- Create selected_projects table
CREATE TABLE IF NOT EXISTS selected_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_key text NOT NULL,
  project_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, project_key)
);

-- Create selected_developers table
CREATE TABLE IF NOT EXISTS selected_developers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  developer_name text NOT NULL,
  developer_email text DEFAULT '',
  jira_account_id text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  project_keys text[] DEFAULT '{}',
  UNIQUE(company_id, developer_email)
);

-- Create sprint_evaluations table
CREATE TABLE IF NOT EXISTS sprint_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sprint_id text NOT NULL,
  sprint_name text NOT NULL,
  project_key text NOT NULL,
  evaluator_id text NOT NULL,
  evaluator_name text NOT NULL,
  evaluator_email text NOT NULL,
  general_comment text NOT NULL,
  overall_rating integer NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  sprint_success_rating integer NOT NULL CHECK (sprint_success_rating >= 1 AND sprint_success_rating <= 5),
  deficiencies text DEFAULT '',
  is_anonymous boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create team_member_ratings table
CREATE TABLE IF NOT EXISTS team_member_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES sprint_evaluations(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  member_email text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  assigned_to text NOT NULL,
  bank text NOT NULL,
  status text DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done')),
  estimated_hours numeric DEFAULT 0,
  actual_hours numeric DEFAULT 0,
  assigned_by text DEFAULT '',
  sprint_id text DEFAULT '',
  jira_key text DEFAULT '',
  jira_id text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create developer_capacities table
CREATE TABLE IF NOT EXISTS developer_capacities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  developer_name text NOT NULL,
  developer_email text NOT NULL,
  capacity_hours numeric DEFAULT 40,
  updated_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, developer_email)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_selected_projects_company_id ON selected_projects(company_id);
CREATE INDEX IF NOT EXISTS idx_selected_projects_project_key ON selected_projects(project_key);

CREATE INDEX IF NOT EXISTS idx_selected_developers_company_id ON selected_developers(company_id);
CREATE INDEX IF NOT EXISTS idx_selected_developers_email ON selected_developers(developer_email);

CREATE INDEX IF NOT EXISTS idx_sprint_evaluations_company_id ON sprint_evaluations(company_id);
CREATE INDEX IF NOT EXISTS idx_sprint_evaluations_sprint_id ON sprint_evaluations(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_evaluations_project_key ON sprint_evaluations(project_key);

CREATE INDEX IF NOT EXISTS idx_team_member_ratings_evaluation_id ON team_member_ratings(evaluation_id);

CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);

CREATE INDEX IF NOT EXISTS idx_developer_capacities_company_id ON developer_capacities(company_id);
CREATE INDEX IF NOT EXISTS idx_developer_capacities_email ON developer_capacities(developer_email);

-- Enable RLS on all tables
ALTER TABLE selected_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE selected_developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprint_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_capacities ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at
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

DROP TRIGGER IF EXISTS update_sprint_evaluations_updated_at ON sprint_evaluations;
CREATE TRIGGER update_sprint_evaluations_updated_at
    BEFORE UPDATE ON sprint_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_developer_capacities_updated_at ON developer_capacities;
CREATE TRIGGER update_developer_capacities_updated_at
    BEFORE UPDATE ON developer_capacities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();