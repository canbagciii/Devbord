/*
  # Kullanıcı Yönetimi Sistemi

  1. Yeni Tablolar
    - `users`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `name` (text)
      - `password_hash` (text)
      - `role` (text, check constraint)
      - `assigned_projects` (text array)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Güvenlik
    - Enable RLS on `users` table
    - Add policies for admin-only access
    - Add trigger for updated_at

  3. İndeksler
    - Email için unique index
    - Role ve is_active için performans indeksleri
*/

-- Users tablosu oluştur
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

-- İndeksler ekle
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- RLS etkinleştir
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Sadece admin kullanıcılar tüm kullanıcıları görebilir
CREATE POLICY "Users can read all users for admin"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE email = (jwt() ->> 'email') AND role = 'admin'
    )
  );

-- Kullanıcılar kendi verilerini görebilir
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    (uid())::text = id::text OR 
    email = (jwt() ->> 'email')
  );

-- Sadece admin kullanıcılar yeni kullanıcı ekleyebilir
CREATE POLICY "Only admins can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE email = (jwt() ->> 'email') AND role = 'admin'
    )
  );

-- Sadece admin kullanıcılar kullanıcı güncelleyebilir
CREATE POLICY "Only admins can update users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE email = (jwt() ->> 'email') AND role = 'admin'
    )
  );

-- Updated_at trigger'ı ekle
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Demo kullanıcıları ekle
INSERT INTO users (email, name, password_hash, role, assigned_projects, is_active) VALUES
  ('can.bagci@acerpro.com.tr', 'Can Bağcı', '$2b$10$dummy.hash.for.demo.purposes.only', 'admin', '{}', true),
  ('ekrem.yitmen@acerpro.com.tr', 'Ekrem Yitmen', '$2b$10$dummy.hash.for.demo.purposes.only', 'admin', '{}', true),
  ('ahmet.korkusuz@acerpro.com.tr', 'Ahmet Korkusuz', '$2b$10$dummy.hash.for.demo.purposes.only', 'analyst', '{"ZK"}', true),
  ('alicem.polat@acerpro.com.tr', 'Alicem Polat', '$2b$10$dummy.hash.for.demo.purposes.only', 'developer', '{"ZK"}', true)
ON CONFLICT (email) DO NOTHING;