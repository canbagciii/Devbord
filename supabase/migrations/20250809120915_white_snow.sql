/*
  # Sprint Evaluations System

  1. New Tables
    - `sprint_evaluations`
      - `id` (uuid, primary key)
      - `sprint_id` (text)
      - `sprint_name` (text)
      - `project_key` (text)
      - `evaluator_id` (text)
      - `evaluator_name` (text)
      - `evaluator_email` (text)
      - `general_comment` (text)
      - `overall_rating` (integer, 1-5)
      - `sprint_success_rating` (integer, 1-5)
      - `deficiencies` (text, optional)
      - `is_anonymous` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `team_member_ratings`
      - `id` (uuid, primary key)
      - `evaluation_id` (uuid, foreign key)
      - `member_name` (text)
      - `member_email` (text)
      - `rating` (integer, 1-5)
      - `comment` (text, optional)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Users can manage their own evaluations
    - Users can view all evaluations (for analytics)
    - Proper foreign key constraints
*/

-- Create sprint_evaluations table
CREATE TABLE IF NOT EXISTS sprint_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sprint_evaluations_sprint_id ON sprint_evaluations(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_evaluations_project_key ON sprint_evaluations(project_key);
CREATE INDEX IF NOT EXISTS idx_sprint_evaluations_evaluator_email ON sprint_evaluations(evaluator_email);
CREATE INDEX IF NOT EXISTS idx_team_member_ratings_evaluation_id ON team_member_ratings(evaluation_id);

-- Enable Row Level Security
ALTER TABLE sprint_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_ratings ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_sprint_evaluations_updated_at ON sprint_evaluations;
CREATE TRIGGER update_sprint_evaluations_updated_at
    BEFORE UPDATE ON sprint_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for sprint_evaluations

-- Users can view all sprint evaluations (for analytics and reporting)
CREATE POLICY "Users can view all sprint evaluations"
  ON sprint_evaluations
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own evaluations
CREATE POLICY "Users can insert their own evaluations"
  ON sprint_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = evaluator_email);

-- Users can update their own evaluations
CREATE POLICY "Users can update their own evaluations"
  ON sprint_evaluations
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = evaluator_email);

-- Users can delete their own evaluations
CREATE POLICY "Users can delete their own evaluations"
  ON sprint_evaluations
  FOR DELETE
  TO authenticated
  USING (auth.jwt() ->> 'email' = evaluator_email);

-- RLS Policies for team_member_ratings

-- Users can view all team member ratings (for analytics)
CREATE POLICY "Users can view all team member ratings"
  ON team_member_ratings
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert team member ratings for their own evaluations
CREATE POLICY "Users can insert team member ratings for their own evaluations"
  ON team_member_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sprint_evaluations 
      WHERE id = evaluation_id 
      AND evaluator_email = auth.jwt() ->> 'email'
    )
  );

-- Users can update team member ratings for their own evaluations
CREATE POLICY "Users can update team member ratings for their own evaluations"
  ON team_member_ratings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sprint_evaluations 
      WHERE id = evaluation_id 
      AND evaluator_email = auth.jwt() ->> 'email'
    )
  );

-- Users can delete team member ratings for their own evaluations
CREATE POLICY "Users can delete team member ratings for their own evaluations"
  ON team_member_ratings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sprint_evaluations 
      WHERE id = evaluation_id 
      AND evaluator_email = auth.jwt() ->> 'email'
    )
  );