/*
  # Kolay İK Entegrasyonu için Veritabanı Şeması

  1. Yeni Tablolar
    - `kolayik_employees`
      - Kolay İK'dan çekilen çalışan bilgileri
      - `kolayik_id` (integer, Kolay İK'daki ID)
      - `name` (text, ad)
      - `surname` (text, soyad)
      - `email` (text, e-posta)
      - `department` (text, departman)
      - `position` (text, pozisyon)
      - `is_active` (boolean, aktif durumu)
      - `jira_developer_name` (text, Jira'daki yazılımcı ismi ile eşleştirme)
      - `created_at`, `updated_at` (timestamp)

    - `sprint_capacity_calculations`
      - Sprint bazlı dinamik kapasite hesaplamaları
      - `id` (uuid, primary key)
      - `developer_name` (text, yazılımcı adı)
      - `sprint_id` (text, sprint ID)
      - `sprint_start_date` (date, sprint başlangıç)
      - `sprint_end_date` (date, sprint bitiş)
      - `total_working_days` (integer, toplam çalışma günü)
      - `leave_days` (integer, izin günü sayısı)
      - `available_working_days` (integer, kullanılabilir çalışma günü)
      - `daily_hours` (numeric, günlük çalışma saati)
      - `total_capacity_hours` (numeric, toplam kapasite saati)
      - `kolayik_employee_id` (integer, Kolay İK çalışan ID)
      - `calculation_date` (timestamp, hesaplama tarihi)
      - `created_at`, `updated_at` (timestamp)

  2. Güvenlik
    - Her iki tablo için RLS etkinleştir
    - Admin kullanıcılar için CRUD politikaları
    - Authenticated kullanıcılar için READ politikası

  3. İndeksler
    - Performans için gerekli indeksler
    - Unique constraint'ler
</sql>

-- Kolay İK çalışanları tablosu
CREATE TABLE IF NOT EXISTS kolayik_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kolayik_id integer UNIQUE NOT NULL,
  name text NOT NULL,
  surname text NOT NULL,
  email text,
  department text,
  position text,
  is_active boolean DEFAULT true,
  jira_developer_name text,
  start_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Sprint kapasite hesaplamaları tablosu
CREATE TABLE IF NOT EXISTS sprint_capacity_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_name text NOT NULL,
  sprint_id text NOT NULL,
  sprint_start_date date NOT NULL,
  sprint_end_date date NOT NULL,
  total_working_days integer NOT NULL,
  leave_days integer DEFAULT 0,
  available_working_days integer NOT NULL,
  daily_hours numeric DEFAULT 7,
  total_capacity_hours numeric NOT NULL,
  kolayik_employee_id integer,
  calculation_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unique constraint: Her yazılımcı için her sprint'te sadece bir hesaplama
  CONSTRAINT unique_developer_sprint UNIQUE (developer_name, sprint_id)
);

-- RLS etkinleştir
ALTER TABLE kolayik_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprint_capacity_calculations ENABLE ROW LEVEL SECURITY;

-- Kolay İK çalışanları için politikalar
CREATE POLICY "Admins can manage kolayik employees"
  ON kolayik_employees
  FOR ALL
  TO authenticated
  USING ((jwt() ->> 'role'::text) = 'admin'::text)
  WITH CHECK ((jwt() ->> 'role'::text) = 'admin'::text);

CREATE POLICY "Authenticated users can read kolayik employees"
  ON kolayik_employees
  FOR SELECT
  TO authenticated
  USING (true);

-- Sprint kapasite hesaplamaları için politikalar
CREATE POLICY "Admins can manage sprint capacity calculations"
  ON sprint_capacity_calculations
  FOR ALL
  TO authenticated
  USING ((jwt() ->> 'role'::text) = 'admin'::text)
  WITH CHECK ((jwt() ->> 'role'::text) = 'admin'::text);

CREATE POLICY "Authenticated users can read sprint capacity calculations"
  ON sprint_capacity_calculations
  FOR SELECT
  TO authenticated
  USING (true);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_kolayik_employees_kolayik_id ON kolayik_employees (kolayik_id);
CREATE INDEX IF NOT EXISTS idx_kolayik_employees_email ON kolayik_employees (email);
CREATE INDEX IF NOT EXISTS idx_kolayik_employees_jira_name ON kolayik_employees (jira_developer_name);
CREATE INDEX IF NOT EXISTS idx_kolayik_employees_active ON kolayik_employees (is_active);

CREATE INDEX IF NOT EXISTS idx_sprint_capacity_developer ON sprint_capacity_calculations (developer_name);
CREATE INDEX IF NOT EXISTS idx_sprint_capacity_sprint ON sprint_capacity_calculations (sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_capacity_dates ON sprint_capacity_calculations (sprint_start_date, sprint_end_date);
CREATE INDEX IF NOT EXISTS idx_sprint_capacity_calculation_date ON sprint_capacity_calculations (calculation_date DESC);

-- Güncelleme trigger'ları
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger'ları ekle (eğer yoksa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_kolayik_employees_updated_at'
  ) THEN
    CREATE TRIGGER update_kolayik_employees_updated_at
      BEFORE UPDATE ON kolayik_employees
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_sprint_capacity_calculations_updated_at'
  ) THEN
    CREATE TRIGGER update_sprint_capacity_calculations_updated_at
      BEFORE UPDATE ON sprint_capacity_calculations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;