/*
  # Create tasks table for manual task assignments

  1. New Tables
    - `tasks`
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `description` (text, optional)
      - `assigned_to` (text, required)
      - `bank` (text, required)
      - `status` (text, default 'todo')
      - `estimated_hours` (integer, optional)
      - `actual_hours` (integer, optional)
      - `assigned_by` (text, optional)
      - `sprint_id` (text, default 'sprint-2024-02')
      - `jira_key` (text, optional)
      - `jira_id` (text, optional)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `tasks` table
    - Add policies for public access (since this is an internal tool)
*/

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assigned_to text NOT NULL,
  bank text NOT NULL,
  status text DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done')),
  estimated_hours integer,
  actual_hours integer,
  assigned_by text,
  sprint_id text DEFAULT 'sprint-2024-02',
  jira_key text,
  jira_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (internal tool)
CREATE POLICY "Tasks are viewable by everyone"
  ON tasks FOR SELECT
  USING (true);

CREATE POLICY "Tasks are insertable by everyone"
  ON tasks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Tasks are updatable by everyone"
  ON tasks FOR UPDATE
  USING (true);

CREATE POLICY "Tasks are deletable by everyone"
  ON tasks FOR DELETE
  USING (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);