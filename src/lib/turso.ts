// Legacy data path — RETIRED 2026-08-14.
//
// This called a `turso-proxy` Edge Function on the Lovable-managed Supabase
// project, which forwarded SQL to a Turso database. Two things ended it:
//
//   1. The proxy already answers 500 "Turso not configured" — its Turso
//      credentials went away with the Lovable disconnect, so every call
//      through here was failing before this file changed.
//   2. The engine has moved to the club's own Supabase project, which has no
//      such function and no Turso behind it.
//
// It used to fall back to the OLD project's id and anon key when the env
// vars were missing. Those hard-coded values are deliberately gone: after a
// migration, a silent fallback to the database you just left is worse than
// an error, because it looks like it works.
//
// The surfaces that still import `query` are the legacy ones — /manage-classic,
// /manage2, the admin pages, and the old leaderboard. Court Manager v3
// (/manage) and Americano v4 (/manage4) do NOT use this file; they read and
// write Supabase directly and are unaffected.
//
// To bring those legacy screens back, port their queries onto Supabase
// tables (see supabase/migrations/20260814_engine_tables.sql) and delete
// this file along with its imports.

const RETIRED =
  "This screen used the retired Turso proxy, which went away with the Lovable " +
  "disconnect. Court Manager v3 (/manage) and Americano v4 (/manage4) are " +
  "unaffected — use those.";

// The return type stays `any` on purpose: 27 call sites across the legacy
// screens read `.rows` off the result, and narrowing it to `never` would
// turn a runtime retirement into a repo-wide typecheck failure.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query(_sql: string, _params?: any[]): Promise<any> {
  throw new Error(RETIRED);
}

/** Legacy export kept so old imports still typecheck. */
export const turso = null;
