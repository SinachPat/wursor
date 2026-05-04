// ── Origin Graph client (spec Layer 4.2) ─────────────────────────────────────
// Thin typed wrapper around @supabase/supabase-js for the Origin Graph schema.
// The spec requires this file as the primary entry point for Supabase access
// in the origin-graph package.
//
// Usage in the app layer:
//   import { createOriginGraphClient } from '@originmain/origin-graph';
//   const db = createOriginGraphClient(supabaseUrl, supabaseKey);
//
// The returned client satisfies the `DbClient` interface used by all
// query functions in queries.ts — no type casting needed.

import { createClient } from '@supabase/supabase-js';
import type { DbClient } from './queries.js';

/**
 * Creates a typed Supabase client configured for the Origin Graph schema.
 * Pass `supabaseUrl` + `anonKey` for client-side usage (RLS enforced),
 * or `supabaseUrl` + `serviceRoleKey` for server-side usage (bypasses RLS).
 */
export function createOriginGraphClient(
  supabaseUrl: string,
  supabaseKey: string,
  options?: { auth?: { autoRefreshToken?: boolean; persistSession?: boolean } },
): DbClient {
  return createClient(supabaseUrl, supabaseKey, options) as unknown as DbClient;
}
