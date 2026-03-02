/*
  # Developer Capacities Table

  1. New Tables
    - `developer_capacities`
      - `id` (uuid, primary key)
      - `developer_name` (text, unique)
      - `developer_email` (text)
      - `capacity_hours` (integer, default 70)
      - `updated_by` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `developer_capacities` table
    - Add policies for viewing and admin management
    - Add unique constraint on developer_name

  3. Default Data
    - Insert default capacities for all developers
*/

-- Create developer_capacities table
CREATE TABLE IF NOT EXISTS developer_capacities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_name text UNIQUE NOT NULL,
  developer_email text NOT NULL,
  capacity_hours integer DEFAULT 70 CHECK (capacity_hours > 0),
  updated_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE developer_capacities ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Everyone can view developer capacities"
  ON developer_capacities
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert capacities"
  ON developer_capacities
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admins can update capacities"
  ON developer_capacities
  FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Admins can delete capacities"
  ON developer_capacities
  FOR DELETE
  TO public
  USING (true);

-- Create updated_at trigger
CREATE TRIGGER update_developer_capacities_updated_at
  BEFORE UPDATE ON developer_capacities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_developer_capacities_name ON developer_capacities(developer_name);
CREATE INDEX IF NOT EXISTS idx_developer_capacities_email ON developer_capacities(developer_email);

-- Insert default capacities for all developers
INSERT INTO developer_capacities (developer_name, developer_email, capacity_hours, updated_by) VALUES
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
  ('Hüseyin Oral', 'huseyin.oral@acerpro.com.tr', 70, 'system')
ON CONFLICT (developer_name) DO NOTHING;