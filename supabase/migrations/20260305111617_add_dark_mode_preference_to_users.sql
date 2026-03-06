/*
  # Dark Mode Tercihi Ekleme

  1. Değişiklikler
    - `users` tablosuna `dark_mode` kolonu ekleniyor (boolean, varsayılan false)
  
  2. Amaç
    - Kullanıcıların dark/light mode tercihlerini kaydetmek
    - Her kullanıcı için bağımsız dark mode ayarı
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'dark_mode'
  ) THEN
    ALTER TABLE users ADD COLUMN dark_mode boolean DEFAULT false;
  END IF;
END $$;