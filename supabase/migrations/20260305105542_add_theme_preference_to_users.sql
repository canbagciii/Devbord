/*
  # Kullanıcı Tema Tercihi Ekleme

  1. Değişiklikler
    - `users` tablosuna `theme_preference` kolonu eklenir
    - Varsayılan tema 'blue' olarak ayarlanır
    - Mevcut tema seçenekleri: 'blue', 'green', 'orange', 'red', 'slate'
  
  2. Güvenlik
    - Mevcut RLS politikaları geçerli kalır
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'theme_preference'
  ) THEN
    ALTER TABLE users ADD COLUMN theme_preference text DEFAULT 'blue';
    ALTER TABLE users ADD CONSTRAINT theme_preference_check 
      CHECK (theme_preference IN ('blue', 'green', 'orange', 'red', 'slate'));
  END IF;
END $$;