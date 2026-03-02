/*
  # Add Project Keys to Developers

  1. Changes
    - Add `project_keys` column to `selected_developers` table to store array of project keys
    - This allows many-to-many relationship between developers and projects
  
  2. Details
    - Column type: text[] (array of text)
    - Default value: empty array
    - Allows tracking which projects each developer works on
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