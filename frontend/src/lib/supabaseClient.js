import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn(
    '[Jesta] Supabase env vars not set.\n' +
    'Copy frontend/.env.local.example → frontend/.env.local and fill in your keys.'
  );
}

export const supabase = createClient(
  url ?? 'http://localhost:54321',
  key ?? 'public-anon-key',
);
