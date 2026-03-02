/*
  # Remove Duplicate and Unused Indexes

  ## Changes
  - Remove duplicate indexes (keep the newer ones)
  - Remove unused indexes to improve write performance and reduce storage
  
  ## Duplicate Indexes Removed
  1. idx_dev_caps_scope (keeping idx_developer_capacities_scope)
  2. idx_dev_caps_sprint (keeping idx_developer_capacities_sprint)
  3. uq_dev_caps_name_scope (keeping uq_developer_capacities_dev_scope)
  4. uq_dev_caps_name_sprint (keeping uq_developer_capacities_dev_sprint)
  
  ## Unused Indexes Removed
  - Multiple unused indexes on developer_capacities, users, tasks, chatbot tables
*/

-- ============================================
-- REMOVE DUPLICATE INDEXES
-- ============================================

-- Remove old developer_capacities duplicates
DROP INDEX IF EXISTS idx_dev_caps_scope;
DROP INDEX IF EXISTS idx_dev_caps_sprint;
DROP INDEX IF EXISTS uq_dev_caps_name_scope;
DROP INDEX IF EXISTS uq_dev_caps_name_sprint;

-- ============================================
-- REMOVE UNUSED INDEXES
-- ============================================

-- Developer capacities unused indexes
DROP INDEX IF EXISTS idx_developer_email;
DROP INDEX IF EXISTS idx_capacity_hours;
DROP INDEX IF EXISTS idx_developer_capacities_sprint_name;

-- Users unused indexes
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_is_active;

-- Tasks unused indexes
DROP INDEX IF EXISTS idx_tasks_bank;
DROP INDEX IF EXISTS idx_tasks_assigned_to;
DROP INDEX IF EXISTS idx_tasks_status;
DROP INDEX IF EXISTS idx_tasks_sprint_id;

-- Sprint evaluations unused indexes
DROP INDEX IF EXISTS idx_sprint_evaluations_project_key;

-- Selected projects/developers unused indexes
DROP INDEX IF EXISTS idx_selected_projects_active;
DROP INDEX IF EXISTS idx_selected_developers_active;

-- Chatbot unused indexes
DROP INDEX IF EXISTS idx_chatbot_documents_keywords;
DROP INDEX IF EXISTS idx_chatbot_documents_content_search;
DROP INDEX IF EXISTS idx_chatbot_conversations_user;
DROP INDEX IF EXISTS idx_chatbot_messages_conversation;
DROP INDEX IF EXISTS chatbot_documents_embedding_idx;