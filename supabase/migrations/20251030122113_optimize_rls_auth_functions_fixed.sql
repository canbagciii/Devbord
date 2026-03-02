/*
  # Optimize RLS Policies for Better Performance

  ## Changes
  - Replace auth.uid() and auth.jwt() calls with (select auth.uid()) and (select auth.jwt())
  - This prevents re-evaluation for each row, significantly improving query performance
  
  ## Tables Updated
  1. chatbot_conversations - 4 policies
  2. chatbot_messages - 2 policies
  3. chatbot_categories - 3 policies
  4. sprint_evaluations - 3 policies
  5. team_member_ratings - 3 policies
*/

-- ============================================
-- CHATBOT_CONVERSATIONS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view own conversations" ON chatbot_conversations;
CREATE POLICY "Users can view own conversations"
  ON chatbot_conversations
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own conversations" ON chatbot_conversations;
CREATE POLICY "Users can create own conversations"
  ON chatbot_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own conversations" ON chatbot_conversations;
CREATE POLICY "Users can update own conversations"
  ON chatbot_conversations
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own conversations" ON chatbot_conversations;
CREATE POLICY "Users can delete own conversations"
  ON chatbot_conversations
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================
-- CHATBOT_MESSAGES POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view messages in own conversations" ON chatbot_messages;
CREATE POLICY "Users can view messages in own conversations"
  ON chatbot_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_conversations
      WHERE id = conversation_id
      AND user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON chatbot_messages;
CREATE POLICY "Users can insert messages in own conversations"
  ON chatbot_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chatbot_conversations
      WHERE id = conversation_id
      AND user_id = (select auth.uid())
    )
  );

-- ============================================
-- CHATBOT_CATEGORIES POLICIES
-- ============================================

DROP POLICY IF EXISTS "Admins can insert categories" ON chatbot_categories;
CREATE POLICY "Admins can insert categories"
  ON chatbot_categories
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.jwt() ->> 'user_role') = 'admin');

DROP POLICY IF EXISTS "Admins can update categories" ON chatbot_categories;
CREATE POLICY "Admins can update categories"
  ON chatbot_categories
  FOR UPDATE
  TO authenticated
  USING ((select auth.jwt() ->> 'user_role') = 'admin');

DROP POLICY IF EXISTS "Admins can delete categories" ON chatbot_categories;
CREATE POLICY "Admins can delete categories"
  ON chatbot_categories
  FOR DELETE
  TO authenticated
  USING ((select auth.jwt() ->> 'user_role') = 'admin');

-- ============================================
-- SPRINT_EVALUATIONS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can insert their own evaluations" ON sprint_evaluations;
CREATE POLICY "Users can insert their own evaluations"
  ON sprint_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.jwt() ->> 'email') = evaluator_email);

DROP POLICY IF EXISTS "Users can update their own evaluations" ON sprint_evaluations;
CREATE POLICY "Users can update their own evaluations"
  ON sprint_evaluations
  FOR UPDATE
  TO authenticated
  USING ((select auth.jwt() ->> 'email') = evaluator_email);

DROP POLICY IF EXISTS "Users can delete their own evaluations" ON sprint_evaluations;
CREATE POLICY "Users can delete their own evaluations"
  ON sprint_evaluations
  FOR DELETE
  TO authenticated
  USING ((select auth.jwt() ->> 'email') = evaluator_email);

-- ============================================
-- TEAM_MEMBER_RATINGS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can insert team member ratings for their own evaluations" ON team_member_ratings;
CREATE POLICY "Users can insert team member ratings for their own evaluations"
  ON team_member_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sprint_evaluations 
      WHERE id = evaluation_id 
      AND evaluator_email = (select auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Users can update team member ratings for their own evaluations" ON team_member_ratings;
CREATE POLICY "Users can update team member ratings for their own evaluations"
  ON team_member_ratings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sprint_evaluations 
      WHERE id = evaluation_id 
      AND evaluator_email = (select auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Users can delete team member ratings for their own evaluations" ON team_member_ratings;
CREATE POLICY "Users can delete team member ratings for their own evaluations"
  ON team_member_ratings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sprint_evaluations 
      WHERE id = evaluation_id 
      AND evaluator_email = (select auth.jwt() ->> 'email')
    )
  );