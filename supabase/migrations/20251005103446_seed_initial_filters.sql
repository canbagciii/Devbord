/*
  # Seed Initial JIRA Filters

  ## Overview
  This migration seeds the database with initial projects and developers
  that were previously hardcoded in the application.

  ## Changes
  - Insert default bank projects into selected_projects table
  - Insert default developers into selected_developers table
  - All entries are set as active by default
*/

-- Insert initial projects (bank projects)
INSERT INTO selected_projects (project_key, project_name, is_active) VALUES
  ('ATK', 'Albaraka Türk Katılım Bankası', true),
  ('ALB', 'Alternatif Bank', true),
  ('AN', 'Anadolubank', true),
  ('BB', 'Burgan Bank', true),
  ('EK', 'Emlak Katılım', true),
  ('OB', 'OdeaBank', true),
  ('QNB', 'QNB Bank', true),
  ('TFKB', 'Türkiye Finans Katılım Bankası', true),
  ('VK', 'Vakıf Katılım', true),
  ('ZK', 'Ziraat Katılım Bankası', true),
  ('DK', 'Dünya Katılım', true),
  ('HF', 'Hayat Finans', true)
ON CONFLICT (project_key) DO NOTHING;

-- Insert initial developers
INSERT INTO selected_developers (developer_name, developer_email, is_active) VALUES
  ('Abolfazl Pourmohammad', 'abolfazl.pourmohammad@acerpro.com.tr', true),
  ('Ahmet Tunç', 'ahmet.tunc@acerpro.com.tr', true),
  ('Alicem Polat', 'alicem.polat@acerpro.com.tr', true),
  ('Buse Eren', 'buse.eren@acerpro.com.tr', true),
  ('Canberk İsmet DİZDAŞ', 'canberk.dizdas@acerpro.com.tr', true),
  ('Gizem Akay', 'gizem.akay@acerpro.com.tr', true),
  ('Melih Meral', 'melih.meral@acerpro.com.tr', true),
  ('Oktay MANAVOĞLU', 'oktay.manavoglu@acerpro.com.tr', true),
  ('Onur Demir', 'onur.demir@acerpro.com.tr', true),
  ('Rüstem CIRIK', 'rustem.cirik@acerpro.com.tr', true),
  ('Soner Canki', 'soner.canki@acerpro.com.tr', true),
  ('Suat Aydoğdu', 'suat.aydogdu@acerpro.com.tr', true),
  ('Fahrettin DEMİRBAŞ', 'fahrettin.demirbas@acerpro.com.tr', true),
  ('Sezer SİNANOĞLU', 'sezer.sinanoglu@acerpro.com.tr', true),
  ('Hüseyin ORAL', 'huseyin.oral@acerpro.com.tr', true),
  ('Feyza Bilgiç', 'feyza.bilgic@acerpro.com.tr', true),
ON CONFLICT (developer_name) DO NOTHING;