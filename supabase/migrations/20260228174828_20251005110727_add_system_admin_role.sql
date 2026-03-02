/*
  # Add System Admin Role
  
  1. Changes
    - Add 'system_admin' to the role check constraint in users table
*/

-- Drop the existing check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new check constraint with system_admin role
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role = ANY (ARRAY['system_admin'::text, 'admin'::text, 'analyst'::text, 'developer'::text]));