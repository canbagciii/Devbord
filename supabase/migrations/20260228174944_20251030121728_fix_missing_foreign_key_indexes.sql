/*
  # Add Missing Foreign Key Indexes

  ## Indexes Added
  1. `idx_chatbot_categories_created_by`
  2. `idx_chatbot_conversations_category_id`
  3. `idx_chatbot_documents_uploaded_by`
  4. `idx_selected_developers_created_by`
  5. `idx_selected_projects_created_by`
*/

-- Add index for chatbot_categories.created_by
CREATE INDEX IF NOT EXISTS idx_chatbot_categories_created_by 
ON chatbot_categories(created_by);

-- Add index for chatbot_conversations.category_id
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_category_id 
ON chatbot_conversations(category_id);

-- Add index for chatbot_documents.uploaded_by
CREATE INDEX IF NOT EXISTS idx_chatbot_documents_uploaded_by 
ON chatbot_documents(uploaded_by);

-- Add index for selected_developers.created_by
CREATE INDEX IF NOT EXISTS idx_selected_developers_created_by 
ON selected_developers(created_by);

-- Add index for selected_projects.created_by
CREATE INDEX IF NOT EXISTS idx_selected_projects_created_by 
ON selected_projects(created_by);