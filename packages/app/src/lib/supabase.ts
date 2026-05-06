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

/** Browser-safe Supabase client (anon key, RLS enforced).
 *
 * IMPORTANT: NEXT_PUBLIC_* vars must be accessed via dot notation so Next.js
 * can statically inline them into the client bundle at build time. Dynamic
 * bracket access (process.env[name]) is not replaced and yields undefined. */
export function browserClient(): DbClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL');
  if (!key) throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return createClient(url, key) as unknown as DbClient;
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
