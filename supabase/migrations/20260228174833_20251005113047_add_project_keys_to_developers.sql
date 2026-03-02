/*
  # Add Project Keys to Developers

  1. Changes
    - Add `project_keys` column to `selected_developers` table to store array of project keys
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'selected_developers' AND column_name = 'project_keys'
  ) THEN
    ALTER TABLE selected_developers ADD COLUMN project_keys text[] DEFAULT '{}';
  END IF;
END $$;