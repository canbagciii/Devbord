/*
  # Story Point Field Mapping and Daily Capacity Settings

  1. New Table: `project_story_point_config`
    - Maps each project to its Story Point field name in Jira
    - Stores the Jira custom field ID for Story Points (e.g., "customfield_10016")
    
  2. New Table: `capacity_settings`
    - Stores daily capacity settings per company
    - Separates daily hours from daily story points
    - `daily_hours`: Used when capacity_metric = 'hours'
    - `daily_story_points`: Used when capacity_metric = 'storyPoints'
    
  3. Security
    - Enable RLS on both tables
    - Users can only access their company's data
*/

-- Project Story Point Field Configuration
CREATE TABLE IF NOT EXISTS project_story_point_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_key text NOT NULL,
  story_point_field text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, project_key)
);

ALTER TABLE project_story_point_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company story point config"
  ON project_story_point_config FOR SELECT
  TO authenticated
  USING (company_id = (auth.jwt()->>'company_id')::uuid);

CREATE POLICY "Users can insert own company story point config"
  ON project_story_point_config FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (auth.jwt()->>'company_id')::uuid);

CREATE POLICY "Users can update own company story point config"
  ON project_story_point_config FOR UPDATE
  TO authenticated
  USING (company_id = (auth.jwt()->>'company_id')::uuid)
  WITH CHECK (company_id = (auth.jwt()->>'company_id')::uuid);

CREATE POLICY "Users can delete own company story point config"
  ON project_story_point_config FOR DELETE
  TO authenticated
  USING (company_id = (auth.jwt()->>'company_id')::uuid);

-- Capacity Settings (daily hours and daily story points)
CREATE TABLE IF NOT EXISTS capacity_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  capacity_metric text NOT NULL DEFAULT 'hours',
  daily_hours numeric DEFAULT 8,
  daily_story_points numeric DEFAULT 8,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE capacity_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company capacity settings"
  ON capacity_settings FOR SELECT
  TO authenticated
  USING (company_id = (auth.jwt()->>'company_id')::uuid);

CREATE POLICY "Users can insert own company capacity settings"
  ON capacity_settings FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (auth.jwt()->>'company_id')::uuid);

CREATE POLICY "Users can update own company capacity settings"
  ON capacity_settings FOR UPDATE
  TO authenticated
  USING (company_id = (auth.jwt()->>'company_id')::uuid)
  WITH CHECK (company_id = (auth.jwt()->>'company_id')::uuid);

CREATE POLICY "Users can delete own company capacity settings"
  ON capacity_settings FOR DELETE
  TO authenticated
  USING (company_id = (auth.jwt()->>'company_id')::uuid);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_sp_config_company 
  ON project_story_point_config(company_id);

CREATE INDEX IF NOT EXISTS idx_capacity_settings_company 
  ON capacity_settings(company_id);