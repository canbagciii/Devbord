/*
  # Çok Kiracılı (Multi-Tenant) Sistem Desteği Ekleme

  1. Yeni Tablolar
    - `companies` - Şirket bilgileri (Jira ve KolayIK entegrasyonları)
    - `users` - Kullanıcı bilgileri (şirket bazlı)
    - `selected_projects` - Seçili Jira projeleri
    - `selected_developers` - Seçili geliştiriciler
    - `developer_capacities` - Geliştirici kapasiteleri

  2. Mevcut Tabloları Güncelleme
    - `tasks` tablosuna company_id ekleme
    - `sprint_evaluations` tablosuna company_id ekleme

  3. Güvenlik
    - Tüm tablolarda RLS aktif
    - Şirket bazlı veri izolasyonu
    - JWT'deki company_id ile erişim kontrolü
*/

-- Companies tablosu oluştur
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  jira_email text NOT NULL,
  jira_api_token text NOT NULL,
  jira_base_url text NOT NULL,
  kolayik_api_token text DEFAULT '',
  kolayik_base_url text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Users tablosu oluştur
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'analyst', 'developer')),
  assigned_projects text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Selected Projects tablosu
CREATE TABLE IF NOT EXISTS selected_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_key text NOT NULL,
  project_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, project_key)
);

-- Selected Developers tablosu
CREATE TABLE IF NOT EXISTS selected_developers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  developer_name text NOT NULL,
  developer_email text DEFAULT '',
  jira_account_id text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  project_keys text[] DEFAULT '{}',
  UNIQUE(company_id, developer_email)
);

-- Developer Capacities tablosu
CREATE TABLE IF NOT EXISTS developer_capacities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  developer_name text NOT NULL,
  developer_email text NOT NULL,
  capacity_hours numeric DEFAULT 40,
  updated_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, developer_email)
);

-- Mevcut tasks tablosuna company_id ekle (varsa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Mevcut sprint_evaluations tablosuna company_id ekle (varsa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprint_evaluations' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE sprint_evaluations ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_companies_email ON companies(email);
CREATE INDEX IF NOT EXISTS idx_selected_projects_company_id ON selected_projects(company_id);
CREATE INDEX IF NOT EXISTS idx_selected_projects_project_key ON selected_projects(project_key);
CREATE INDEX IF NOT EXISTS idx_selected_developers_company_id ON selected_developers(company_id);
CREATE INDEX IF NOT EXISTS idx_selected_developers_email ON selected_developers(developer_email);
CREATE INDEX IF NOT EXISTS idx_developer_capacities_company_id ON developer_capacities(company_id);
CREATE INDEX IF NOT EXISTS idx_developer_capacities_email ON developer_capacities(developer_email);
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_sprint_evaluations_company_id ON sprint_evaluations(company_id);

-- RLS Aktif Et
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE selected_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE selected_developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_capacities ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger fonksiyonu
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_selected_projects_updated_at ON selected_projects;
CREATE TRIGGER update_selected_projects_updated_at
    BEFORE UPDATE ON selected_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_selected_developers_updated_at ON selected_developers;
CREATE TRIGGER update_selected_developers_updated_at
    BEFORE UPDATE ON selected_developers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_developer_capacities_updated_at ON developer_capacities;
CREATE TRIGGER update_developer_capacities_updated_at
    BEFORE UPDATE ON developer_capacities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS POLİTİKALARI
-- ============================================

-- Companies RLS Politikaları
DROP POLICY IF EXISTS "Companies can view own data" ON companies;
CREATE POLICY "Companies can view own data"
  ON companies FOR SELECT
  TO authenticated
  USING (id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "Companies can update own data" ON companies;
CREATE POLICY "Companies can update own data"
  ON companies FOR UPDATE
  TO authenticated
  USING (id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid)
  WITH CHECK (id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "Allow company registration" ON companies;
CREATE POLICY "Allow company registration"
  ON companies FOR INSERT
  TO anon
  WITH CHECK (true);

-- Users RLS Politikaları
DROP POLICY IF EXISTS "Users can view own company users" ON users;
CREATE POLICY "Users can view own company users"
  ON users FOR SELECT
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = (auth.jwt() ->> 'sub')::uuid)
  WITH CHECK (id = (auth.jwt() ->> 'sub')::uuid);

DROP POLICY IF EXISTS "Allow user registration" ON users;
CREATE POLICY "Allow user registration"
  ON users FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage company users" ON users;
CREATE POLICY "Admins can manage company users"
  ON users FOR ALL
  TO authenticated
  USING (
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Selected Projects RLS Politikaları
DROP POLICY IF EXISTS "Users can view own company projects" ON selected_projects;
CREATE POLICY "Users can view own company projects"
  ON selected_projects FOR SELECT
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "Users can insert own company projects" ON selected_projects;
CREATE POLICY "Users can insert own company projects"
  ON selected_projects FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "Users can update own company projects" ON selected_projects;
CREATE POLICY "Users can update own company projects"
  ON selected_projects FOR UPDATE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid)
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "Users can delete own company projects" ON selected_projects;
CREATE POLICY "Users can delete own company projects"
  ON selected_projects FOR DELETE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

-- Selected Developers RLS Politikaları
DROP POLICY IF EXISTS "Users can view own company developers" ON selected_developers;
CREATE POLICY "Users can view own company developers"
  ON selected_developers FOR SELECT
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "Users can insert own company developers" ON selected_developers;
CREATE POLICY "Users can insert own company developers"
  ON selected_developers FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "Users can update own company developers" ON selected_developers;
CREATE POLICY "Users can update own company developers"
  ON selected_developers FOR UPDATE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid)
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "Users can delete own company developers" ON selected_developers;
CREATE POLICY "Users can delete own company developers"
  ON selected_developers FOR DELETE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

-- Developer Capacities RLS Politikaları
DROP POLICY IF EXISTS "Users can view own company capacities" ON developer_capacities;
CREATE POLICY "Users can view own company capacities"
  ON developer_capacities FOR SELECT
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "Users can insert own company capacities" ON developer_capacities;
CREATE POLICY "Users can insert own company capacities"
  ON developer_capacities FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "Users can update own company capacities" ON developer_capacities;
CREATE POLICY "Users can update own company capacities"
  ON developer_capacities FOR UPDATE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid)
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "Users can delete own company capacities" ON developer_capacities;
CREATE POLICY "Users can delete own company capacities"
  ON developer_capacities FOR DELETE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

-- Tasks RLS Politikalarını Güncelle
DROP POLICY IF EXISTS "Users can view own company tasks" ON tasks;
CREATE POLICY "Users can view own company tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "Users can insert own company tasks" ON tasks;
CREATE POLICY "Users can insert own company tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "Users can update own company tasks" ON tasks;
CREATE POLICY "Users can update own company tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid)
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "Users can delete own company tasks" ON tasks;
CREATE POLICY "Users can delete own company tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

-- Sprint Evaluations RLS Politikalarını Güncelle
DROP POLICY IF EXISTS "Users can view own company evaluations" ON sprint_evaluations;
CREATE POLICY "Users can view own company evaluations"
  ON sprint_evaluations FOR SELECT
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "Users can insert own company evaluations" ON sprint_evaluations;
CREATE POLICY "Users can insert own company evaluations"
  ON sprint_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "Users can update own evaluations" ON sprint_evaluations;
CREATE POLICY "Users can update own evaluations"
  ON sprint_evaluations FOR UPDATE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid AND evaluator_email = auth.jwt() ->> 'email')
  WITH CHECK (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid AND evaluator_email = auth.jwt() ->> 'email');

DROP POLICY IF EXISTS "Users can delete own evaluations" ON sprint_evaluations;
CREATE POLICY "Users can delete own evaluations"
  ON sprint_evaluations FOR DELETE
  TO authenticated
  USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid AND evaluator_email = auth.jwt() ->> 'email');