/*
  # Demo kullanıcıları ekle

  1. Demo Kullanıcıları
    - Admin: Can Bağcı (tüm projelere erişim)
    - Analist: Ahmet Korkusuz (EK, VK, AN projelerine erişim)
    - Yazılımcı: Buse Eren (sadece EK projesine erişim)

  2. Güvenlik
    - Tüm kullanıcılar aktif durumda
    - Demo şifreleri basit tutuldu (123456)
*/

-- Demo kullanıcıları ekle (eğer yoksa)
INSERT INTO users (id, email, name, password_hash, role, assigned_projects, is_active)
VALUES 
  (
    'demo-admin-can-bagci',
    'can.bagci@acerpro.com.tr',
    'Can Bağcı',
    '$2b$10$dummy.hash.123456.for.demo',
    'admin',
    '{}',
    true
  ),
  (
    'demo-analyst-ahmet-korkusuz',
    'ahmet.korkusuz@acerpro.com.tr',
    'Ahmet Korkusuz',
    '$2b$10$dummy.hash.123456.for.demo',
    'analyst',
    '{"EK", "VK", "AN"}',
    true
  ),
  (
    'demo-developer-buse-eren',
    'buse.eren@acerpro.com.tr',
    'Buse Eren',
    '$2b$10$dummy.hash.123456.for.demo',
    'developer',
    '{"EK"}',
    true
  )
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  assigned_projects = EXCLUDED.assigned_projects,
  is_active = EXCLUDED.is_active,
  updated_at = now();