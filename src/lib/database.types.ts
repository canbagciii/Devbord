export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          email: string;
          jira_email: string;
          jira_api_token: string;
          jira_base_url: string;
          kolayik_api_token: string | null;
          kolayik_base_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          jira_email: string;
          jira_api_token: string;
          jira_base_url: string;
          kolayik_api_token?: string | null;
          kolayik_base_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          jira_email?: string;
          jira_api_token?: string;
          jira_base_url?: string;
          kolayik_api_token?: string | null;
          kolayik_base_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          company_id: string;
          email: string;
          password_hash: string;
          name: string;
          role: 'admin' | 'analyst' | 'developer';
          assigned_projects: string[] | null;
          is_active: boolean;
          onboarding_completed: boolean;
          theme_preference: 'blue' | 'green' | 'orange' | 'red' | 'slate';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          email: string;
          password_hash: string;
          name: string;
          role: 'admin' | 'analyst' | 'developer';
          assigned_projects?: string[] | null;
          is_active?: boolean;
          onboarding_completed?: boolean;
          theme_preference?: 'blue' | 'green' | 'orange' | 'red' | 'slate';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          email?: string;
          password_hash?: string;
          name?: string;
          role?: 'admin' | 'analyst' | 'developer';
          assigned_projects?: string[] | null;
          is_active?: boolean;
          onboarding_completed?: boolean;
          theme_preference?: 'blue' | 'green' | 'orange' | 'red' | 'slate';
          created_at?: string;
          updated_at?: string;
        };
      };
      selected_projects: {
        Row: {
          id: string;
          company_id: string;
          project_key: string;
          project_name: string;
          is_active: boolean;
          created_at: string;
          created_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          project_key: string;
          project_name: string;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          project_key?: string;
          project_name?: string;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
        };
      };
      selected_developers: {
        Row: {
          id: string;
          company_id: string;
          developer_name: string;
          developer_email: string | null;
          jira_account_id: string | null;
          is_active: boolean;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          project_keys: string[] | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          developer_name: string;
          developer_email?: string | null;
          jira_account_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          project_keys?: string[] | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          developer_name?: string;
          developer_email?: string | null;
          jira_account_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          project_keys?: string[] | null;
        };
      };
      sprint_evaluations: {
        Row: {
          id: string;
          company_id: string;
          sprint_id: string;
          sprint_name: string;
          project_key: string;
          evaluator_id: string;
          evaluator_name: string;
          evaluator_email: string;
          general_comment: string;
          overall_rating: number;
          sprint_success_rating: number;
          deficiencies: string | null;
          is_anonymous: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          sprint_id: string;
          sprint_name: string;
          project_key: string;
          evaluator_id: string;
          evaluator_name: string;
          evaluator_email: string;
          general_comment: string;
          overall_rating: number;
          sprint_success_rating: number;
          deficiencies?: string | null;
          is_anonymous?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          sprint_id?: string;
          sprint_name?: string;
          project_key?: string;
          evaluator_id?: string;
          evaluator_name?: string;
          evaluator_email?: string;
          general_comment?: string;
          overall_rating?: number;
          sprint_success_rating?: number;
          deficiencies?: string | null;
          is_anonymous?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      team_member_ratings: {
        Row: {
          id: string;
          evaluation_id: string;
          member_name: string;
          member_email: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          evaluation_id: string;
          member_name: string;
          member_email: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          evaluation_id?: string;
          member_name?: string;
          member_email?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          company_id: string;
          title: string;
          description: string | null;
          assigned_to: string;
          bank: string;
          status: 'todo' | 'in-progress' | 'done';
          estimated_hours: number | null;
          actual_hours: number | null;
          assigned_by: string | null;
          sprint_id: string;
          jira_key: string | null;
          jira_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          title: string;
          description?: string | null;
          assigned_to: string;
          bank: string;
          status?: 'todo' | 'in-progress' | 'done';
          estimated_hours?: number | null;
          actual_hours?: number | null;
          assigned_by?: string | null;
          sprint_id?: string;
          jira_key?: string | null;
          jira_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          title?: string;
          description?: string | null;
          assigned_to?: string;
          bank?: string;
          status?: 'todo' | 'in-progress' | 'done';
          estimated_hours?: number | null;
          actual_hours?: number | null;
          assigned_by?: string | null;
          sprint_id?: string;
          jira_key?: string | null;
          jira_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      developer_capacities: {
        Row: {
          id: string;
          company_id: string;
          developer_name: string;
          developer_email: string;
          capacity_hours: number;
          updated_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          developer_name: string;
          developer_email: string;
          capacity_hours?: number;
          updated_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          developer_name?: string;
          developer_email?: string;
          capacity_hours?: number;
          updated_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}