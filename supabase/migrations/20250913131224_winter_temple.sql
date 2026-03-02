/*
  # Add scope and sprint fields to developer_capacities table

  1. New Columns
    - `scope_key` (text) - To differentiate between 'active' and 'closed' sprint capacities
    - `sprint_id` (text) - To link capacity to specific sprint
    - `sprint_name` (text) - Sprint name for easier identification

  2. Indexes
    - Add indexes for better query performance on new fields

  3. Constraints
    - Add check constraint for scope_key values

  4. Notes
    - Existing records will have NULL scope_key (treated as global capacity)
    - New scoped capacities can be added per sprint type
*/

-- Add new columns for scope and sprint tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'developer_capacities' AND column_name = 'scope_key'
  ) THEN
    ALTER TABLE developer_capacities ADD COLUMN scope_key text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'developer_capacities' AND column_name = 'sprint_id'
  ) THEN
    ALTER TABLE developer_capacities ADD COLUMN sprint_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'developer_capacities' AND column_name = 'sprint_name'
  ) THEN
    ALTER TABLE developer_capacities ADD COLUMN sprint_name text;
  END IF;
END $$;

-- Add check constraint for scope_key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'developer_capacities' AND constraint_name = 'chk_dev_caps_scope'
  ) THEN
    ALTER TABLE developer_capacities 
    ADD CONSTRAINT chk_dev_caps_scope 
    CHECK (scope_key IN ('active', 'closed') OR scope_key IS NULL);
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_dev_caps_scope ON developer_capacities(scope_key);
CREATE INDEX IF NOT EXISTS idx_dev_caps_sprint ON developer_capacities(sprint_id);
CREATE INDEX IF NOT EXISTS idx_developer_capacities_sprint_name ON developer_capacities(sprint_name);

-- Add unique constraints for scoped capacities
CREATE UNIQUE INDEX IF NOT EXISTS uq_dev_caps_name_scope 
ON developer_capacities(developer_name, scope_key) 
WHERE scope_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dev_caps_name_sprint 
ON developer_capacities(developer_name, sprint_id) 
WHERE sprint_id IS NOT NULL;

-- Keep existing global unique constraint for backward compatibility
CREATE UNIQUE INDEX IF NOT EXISTS uq_dev_caps_name_global 
ON developer_capacities(developer_name) 
WHERE sprint_id IS NULL AND scope_key IS NULL;