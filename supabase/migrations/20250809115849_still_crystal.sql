/*
  # Sprint Değerlendirmeleri Tabloları

  1. Yeni Tablolar
    - `sprint_evaluations`
      - `id` (uuid, primary key)
      - `sprint_id` (text, sprint ID'si)
      - `sprint_name` (text, sprint adı)
      - `project_key` (text, proje kodu)
      - `evaluator_id` (text, değerlendiren kullanıcı ID'si)
      - `evaluator_name` (text, değerlendiren adı)
      - `evaluator_email` (text, değerlendiren email)
      - `general_comment` (text, genel yorum)
      - `overall_rating` (integer, genel puan 1-5)
      - `sprint_success_rating` (integer, sprint başarı puanı 1-5)
      - `deficiencies` (text, eksiklikler)
      - `is_anonymous` (boolean, anonim mi)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `team_member_ratings`
      - `id` (uuid, primary key)
      - `evaluation_id` (uuid, foreign key to sprint_evaluations)
      - `member_name` (text, takım üyesi adı)
      - `member_email` (text, takım üyesi email)
      - `rating` (integer, puan 1-5)
      - `comment` (text, yorum)
      - `created_at` (timestamptz)

  2. Güvenlik
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own evaluations
    - Add policies for admins to view all evaluations
*/

-- Sprint Evaluations tablosu
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

-- Team Member Ratings tablosu
CREATE TABLE IF NOT EXISTS team_member_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES sprint_evaluations(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  member_email text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sprint_evaluations_sprint_id ON sprint_evaluations(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_evaluations_project_key ON sprint_evaluations(project_key);
CREATE INDEX IF NOT EXISTS idx_sprint_evaluations_evaluator_email ON sprint_evaluations(evaluator_email);
CREATE INDEX IF NOT EXISTS idx_team_member_ratings_evaluation_id ON team_member_ratings(evaluation_id);

-- Enable RLS
ALTER TABLE sprint_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sprint_evaluations

-- Users can view all evaluations (for analytics)
CREATE POLICY "Users can view all sprint evaluations"
  ON sprint_evaluations FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own evaluations
CREATE POLICY "Users can insert their own evaluations"
  ON sprint_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = evaluator_email);

-- Users can update their own evaluations
CREATE POLICY "Users can update their own evaluations"
  ON sprint_evaluations FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = evaluator_email);

-- Users can delete their own evaluations
CREATE POLICY "Users can delete their own evaluations"
  ON sprint_evaluations FOR DELETE
  TO authenticated
  USING (auth.jwt() ->> 'email' = evaluator_email);

-- RLS Policies for team_member_ratings

-- Users can view all team member ratings
CREATE POLICY "Users can view all team member ratings"
  ON team_member_ratings FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert team member ratings for their own evaluations
CREATE POLICY "Users can insert team member ratings for their own evaluations"
  ON team_member_ratings FOR INSERT
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
  ON team_member_ratings FOR UPDATE
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
  ON team_member_ratings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sprint_evaluations 
      WHERE id = evaluation_id 
      AND evaluator_email = auth.jwt() ->> 'email'
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for sprint_evaluations
CREATE TRIGGER update_sprint_evaluations_updated_at 
    BEFORE UPDATE ON sprint_evaluations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();