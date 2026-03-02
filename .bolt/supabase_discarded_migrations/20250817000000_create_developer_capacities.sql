/*
  # Create developer_capacities table

  1. Table Structure
    - `id` (uuid, primary key)
    - `developer_name` (text, unique)
    - `developer_email` (text)
    - `capacity_hours` (numeric, default 70)
    - `updated_by` (text)
    - `created_at` (timestamp)
    - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `developer_capacities` table
    - Add policy for authenticated users to read all capacities
    - Add policy for admins only to insert/update capacities

  3. Changes
    - Create table for storing developer capacity settings
    - Add indexes for performance
    - Add trigger for automatic updated_at timestamp
*/

CREATE TABLE IF NOT EXISTS developer_capacities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_name text UNIQUE NOT NULL,
  developer_email text NOT NULL,
  capacity_hours numeric DEFAULT 70 NOT NULL CHECK (capacity_hours > 0),
  updated_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_developer_capacities_name ON developer_capacities (developer_name);
CREATE INDEX IF NOT EXISTS idx_developer_capacities_email ON developer_capacities (developer_email);

-- Enable RLS
ALTER TABLE developer_capacities ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read developer capacities"
  ON developer_capacities
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert developer capacities"
  ON developer_capacities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE email = (auth.jwt() ->> 'email'::text) 
      AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can update developer capacities"
  ON developer_capacities
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE email = (auth.jwt() ->> 'email'::text) 
      AND role = 'admin'
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_developer_capacities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_developer_capacities_updated_at
  BEFORE UPDATE ON developer_capacities
  FOR EACH ROW
  EXECUTE FUNCTION update_developer_capacities_updated_at();

-- Insert default capacities for known developers
INSERT INTO developer_capacities (developer_name, developer_email, capacity_hours, updated_by)
VALUES 
  ('Abolfazl Pourmohammad', 'abolfazl.pourmohammad@acerpro.com.tr', 70, 'system'),
  ('Ahmet Tunç', 'ahmet.tunc@acerpro.com.tr', 70, 'system'),
  ('Alicem Polat', 'alicem.polat@acerpro.com.tr', 70, 'system'),
  ('Buse Eren', 'buse.eren@acerpro.com.tr', 70, 'system'),
  ('Canberk İsmet DİZDAŞ', 'canberk.dizdas@acerpro.com.tr', 70, 'system'),
  ('Gizem Akay', 'gizem.akay@acerpro.com.tr', 70, 'system'),
  ('Melih Meral', 'melih.meral@acerpro.com.tr', 70, 'system'),
  ('Oktay MANAVOĞLU', 'oktay.manavoglu@acerpro.com.tr', 70, 'system'),
  ('Onur Demir', 'onur.demir@acerpro.com.tr', 70, 'system'),
  ('Rüstem CIRIK', 'rustem.cirik@acerpro.com.tr', 70, 'system'),
  ('Soner Canki', 'soner.canki@acerpro.com.tr', 70, 'system'),
  ('Suat Aydoğdu', 'suat.aydogdu@acerpro.com.tr', 70, 'system'),
  ('Fahrettin DEMİRBAŞ', 'fahrettin.demirbas@acerpro.com.tr', 70, 'system'),
  ('Sezer Sinanoğlu', 'sezer.sinanoglu@acerpro.com.tr', 70, 'system'),
  ('Hüseyin Oral', 'huseyin.oral@acerpro.com.tr', 70, 'system'),
  ('Soner CANKI', 'soner.canki@acerpro.com.tr', 70, 'system')
ON CONFLICT (developer_name) DO NOTHING;