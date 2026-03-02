/*
  # Add onboarding_completed to users table

  1. Changes
    - Add `onboarding_completed` boolean field to users table
    - Default value is false
    - This field tracks whether the user has completed the initial onboarding flow

  2. Purpose
    - First-time users will be directed to Jira filter management page
    - Once they select projects and developers, this flag will be set to true
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE users ADD COLUMN onboarding_completed boolean DEFAULT false;
  END IF;
END $$;
