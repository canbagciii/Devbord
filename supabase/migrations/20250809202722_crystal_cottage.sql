/*
  # Kullanıcı Tablosu Oluşturma

  1. Yeni Tablolar
    - `users`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `name` (text)
      - `password_hash` (text)
      - `role` (text, enum: admin, analyst, developer)
      - `assigned_projects` (text array)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Güvenlik
    - RLS etkinleştirildi
    - Kullanıcılar kendi verilerini okuyabilir
    - Sadece admin kullanıcı oluşturabilir/güncelleyebilir

  3. Başlangıç Verileri
    - Demo kullanıcıları eklendi
    - Şifreler hash'lendi (basit demo için)
*/

-- Kullanıcı tablosu oluştur
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'analyst', 'developer')),
  assigned_projects text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS etkinleştir
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Güvenlik politikaları
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text OR email = auth.jwt() ->> 'email');

CREATE POLICY "Users can read all users for admin"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE email = auth.jwt() ->> 'email' 
      AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE email = auth.jwt() ->> 'email' 
      AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can update users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE email = auth.jwt() ->> 'email' 
      AND role = 'admin'
    )
  );

-- Updated at trigger fonksiyonu oluştur
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Updated at trigger ekle
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Demo kullanıcıları ekle (şifreler basit hash ile)
INSERT INTO users (email, name, password_hash, role, assigned_projects) VALUES
  ('can.bagci@acerpro.com.tr', 'Can Bağcı', 'e10adc3949ba59abbe56e057f20f883e', 'admin', '{}'),
  ('ahmet.korkusuz@acerpro.com.tr', 'Ahmet Korkusuz', 'e10adc3949ba59abbe56e057f20f883e', 'analyst', '{"ZK"}'),
  ('alicem.polat@acerpro.com.tr', 'Alicem Polat', 'e10adc3949ba59abbe56e057f20f883e', 'developer', '{"ZK"}')
  ('ekrem.yitmen@acerpro.com.tr', 'Ekrem Yitmen', 'e10adc3919ba59abbe56e057f20f883e', 'admin', '{}')
ON CONFLICT (email) DO NOTHING;

-- Index'ler ekle
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);