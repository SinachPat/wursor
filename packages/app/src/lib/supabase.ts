// ── Supabase client helpers ───────────────────────────────────────────────────
// browserClient()  — uses the anon key; safe to call on the client side.
//                    RLS policies apply (currently: deny all anon).
// serverClient()   — uses the service-role key; ONLY call from Server
//                    Components or API route handlers. Never expose to the
//                    browser. Service role bypasses RLS entirely.

import { createClient } from '@supabase/supabase-js';
import type { DbClient } from '@originmain/origin-graph';

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

/** Browser-safe Supabase client (anon key, RLS enforced). */
export function browserClient(): DbClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  ) as unknown as DbClient;
}

/** Server-only Supabase client (service-role key, bypasses RLS). */
export function serverClient(): DbClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    // Disable the auto-refresh token flow — this client never runs in a browser.
    { auth: { autoRefreshToken: false, persistSession: false } },
  ) as unknown as DbClient;
}
