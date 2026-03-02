import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase environment variables not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file with actual values from your Supabase project dashboard.');
}

// Check for placeholder values and warn instead of throwing
if (supabaseUrl?.includes('placeholder') || supabaseAnonKey?.includes('placeholder')) {
  console.warn('⚠️ Using placeholder Supabase credentials. Please update with actual values from your Supabase project dashboard.');
}

// Validate URL format only if not using placeholder
if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
  try {
    new URL(supabaseUrl);
  } catch (error) {
    console.error(`❌ Invalid VITE_SUPABASE_URL format: "${supabaseUrl}". Please ensure it's a valid URL starting with https:// (e.g., https://your-project-id.supabase.co)`);
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type { Database };