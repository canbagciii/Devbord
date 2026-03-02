ALTER TABLE developer_capacities ENABLE ROW LEVEL SECURITY;

-- Authenticated kullanıcılar okuma yapabilir
CREATE POLICY "Authenticated users can read all capacities"
  ON developer_capacities
  FOR SELECT
  TO authenticated
  USING (true);

-- Admin rolündekiler insert yapabilir
CREATE POLICY "Admins can insert capacities"
  ON developer_capacities
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

-- Admin rolündekiler update yapabilir
CREATE POLICY "Admins can update capacities"
  ON developer_capacities
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');
