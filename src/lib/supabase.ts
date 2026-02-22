import { createClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton — safe to import anywhere on the client
export const supabase = createClient(url, key, {
  realtime: { params: { eventsPerSecond: 20 } },
});
