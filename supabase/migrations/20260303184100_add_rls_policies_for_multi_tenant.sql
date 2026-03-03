/*
  # RLS Policies for Multi-Tenant Access

  1. RLS Policies
    - All tables filtered by company_id from JWT
    - Users can only see data from their own company
    - Proper CRUD permissions based on role

  2. Security Model
    - company_id stored in JWT app_metadata
    - All SELECT/INSERT/UPDATE/DELETE filtered by company_id
    - Role-based access control where needed
*/

-- RLS Policies for selected_projects

CREATE POLICY "Users can view own company projects"
  ON selected_projects FOR SELECT
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

CREATE POLICY "Users can insert own company projects"
  ON selected_projects FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

CREATE POLICY "Users can update own company projects"
  ON selected_projects FOR UPDATE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid)
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

CREATE POLICY "Users can delete own company projects"
  ON selected_projects FOR DELETE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

-- RLS Policies for selected_developers

CREATE POLICY "Users can view own company developers"
  ON selected_developers FOR SELECT
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

CREATE POLICY "Users can insert own company developers"
  ON selected_developers FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

CREATE POLICY "Users can update own company developers"
  ON selected_developers FOR UPDATE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid)
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

CREATE POLICY "Users can delete own company developers"
  ON selected_developers FOR DELETE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

-- RLS Policies for sprint_evaluations

CREATE POLICY "Users can view own company evaluations"
  ON sprint_evaluations FOR SELECT
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

CREATE POLICY "Users can insert own company evaluations"
  ON sprint_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

CREATE POLICY "Users can update own evaluations"
  ON sprint_evaluations FOR UPDATE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid AND evaluator_email = auth.jwt() ->> 'email')
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid AND evaluator_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can delete own evaluations"
  ON sprint_evaluations FOR DELETE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid AND evaluator_email = auth.jwt() ->> 'email');

-- RLS Policies for team_member_ratings

CREATE POLICY "Users can view own company ratings"
  ON team_member_ratings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sprint_evaluations
      WHERE sprint_evaluations.id = team_member_ratings.evaluation_id
      AND sprint_evaluations.company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
    )
  );

CREATE POLICY "Users can insert ratings for own evaluations"
  ON team_member_ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sprint_evaluations
      WHERE sprint_evaluations.id = evaluation_id
      AND sprint_evaluations.company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
      AND sprint_evaluations.evaluator_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can update ratings for own evaluations"
  ON team_member_ratings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sprint_evaluations
      WHERE sprint_evaluations.id = evaluation_id
      AND sprint_evaluations.company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
      AND sprint_evaluations.evaluator_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can delete ratings for own evaluations"
  ON team_member_ratings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sprint_evaluations
      WHERE sprint_evaluations.id = evaluation_id
      AND sprint_evaluations.company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
      AND sprint_evaluations.evaluator_email = auth.jwt() ->> 'email'
    )
  );

-- RLS Policies for tasks

CREATE POLICY "Users can view own company tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

CREATE POLICY "Users can insert own company tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

CREATE POLICY "Users can update own company tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid)
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

CREATE POLICY "Users can delete own company tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

-- RLS Policies for developer_capacities

CREATE POLICY "Users can view own company capacities"
  ON developer_capacities FOR SELECT
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

CREATE POLICY "Users can insert own company capacities"
  ON developer_capacities FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

CREATE POLICY "Users can update own company capacities"
  ON developer_capacities FOR UPDATE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid)
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

CREATE POLICY "Users can delete own company capacities"
  ON developer_capacities FOR DELETE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);