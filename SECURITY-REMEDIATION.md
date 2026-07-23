# Security Remediation Runbook

Findings from the security scan (2026-07-23) and the exact steps to fix them.

**Two things you must know first:**

1. **I cannot deploy these changes.** Applying RLS policies and edge-function
   config needs your Supabase project's deploy access (Supabase dashboard SQL
   editor, the `supabase` CLI with the service-role key, or Lovable). I only
   have the public anon key. Every SQL block below is for **you** to run.
2. **Order matters. Do NOT lock down RLS before auth exists.** The app currently
   uses the anonymous key with no login. If you restrict a table to
   authenticated users before there's an authenticated identity, the feature
   that uses it goes fully offline. Work top-to-bottom.

Test every change in a Lovable preview / Supabase branch **before** production.
Several of these can break the public booking page (revenue) or a live session.

---

## Phase 0 — Safe now, no auth required (deploy before tonight if you want)

These reduce risk without breaking normal operation.

### 0a. turso-proxy: destructive SQL blocked  ✅ code already changed
`supabase/functions/turso-proxy/index.ts` now denies `CREATE/ALTER/DROP` and
stacked statements — a caller can no longer drop or restructure the database.
**Action:** redeploy the function:
```bash
supabase functions deploy turso-proxy
```
Still unauthenticated (reads/writes leaderboard data) — Phase 2 closes that.

### 0b. bookings: stop exposing customer emails/payment
The `Users can view their own bookings` policy is `USING (true)` — anyone can
read every booking. Customers don't read bookings back through the API (the
confirmation comes from the booking flow itself), so removing public SELECT is
safe. **Verify** the booking page doesn't re-query the table after insert, then:
```sql
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
-- INSERT policy ("Anyone can create bookings") stays so booking still works.
-- No SELECT policy => no one can read bookings via the anon API.
-- Admins read bookings via the Supabase dashboard (service role bypasses RLS).
```

### 0c. ai-setup-assistant: stop anonymous billed calls
If this function is unused in production, delete it. Otherwise gate it — set
`verify_jwt = true` in `supabase/config.toml` (needs Phase 1 auth), or add a
shared-secret header check as a stopgap.

### 0d. players: hide the email column from public reads
The leaderboard needs names + points public, but **not emails**. Expose a view
without email and point the client at it; keep the base table admin-only:
```sql
CREATE OR REPLACE VIEW public.players_public AS
  SELECT id, name, total_points, wins, losses, games_played FROM public.players;
GRANT SELECT ON public.players_public TO anon;
-- then remove public SELECT on the base table in Phase 2.
```
(Requires updating the leaderboard/profile client code to read `players_public`.)

---

## Phase 1 — Add authentication (prerequisite for real lockdown)

Nothing in Phase 2 is safe until admins can authenticate.

1. Enable Supabase Auth (email magic-link is simplest for a small admin group).
2. Replace the client-side passcodes (`9999` / `7777`) — which are cosmetic,
   readable in the JS bundle — with a real login gate on `/manage`, `/manage2`,
   `/manage-classic`, and `/admin/*`.
3. Give admin accounts a role (custom claim or an `admins` table keyed by
   `auth.uid()`) so RLS can check `is_admin()`.
4. Court Managers and admin pages must call Supabase as the logged-in user
   (the JWT rides automatically on the supabase-js client once signed in).

---

## Phase 2 — Lock down RLS (after Phase 1)

Replace every `USING (true)` / `WITH CHECK (true)` write policy. Example shape:

```sql
-- helper
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
$$;

-- game_state: only admins write; keep public read only if the realtime board
-- must be viewable without login (else restrict to is_admin() too).
DROP POLICY IF EXISTS "Game state is publicly writable"  ON public.game_state;
DROP POLICY IF EXISTS "Game state is publicly updatable" ON public.game_state;
CREATE POLICY "Admins write game state" ON public.game_state
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- players: admins write; public reads go through players_public (0d).
DROP POLICY IF EXISTS "Players are publicly writable"   ON public.players;
DROP POLICY IF EXISTS "Players are publicly updatable"  ON public.players;
DROP POLICY IF EXISTS "Players are publicly deletable"  ON public.players;
DROP POLICY IF EXISTS "Players are publicly readable"   ON public.players;
CREATE POLICY "Admins manage players" ON public.players
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- pair_history: admins only.
DROP POLICY IF EXISTS "Pair history is publicly writable" ON public.pair_history;
CREATE POLICY "Admins write pair history" ON public.pair_history
  FOR INSERT WITH CHECK (public.is_admin());
```

**Breakage check before you ship Phase 2:** with these live, the Court Managers
MUST be signed in as an admin or every write fails. That's why Phase 1 comes
first. Test a full session end-to-end in preview.

### turso-proxy (Phase 2)
Set `verify_jwt = true` in `supabase/config.toml` for `turso-proxy`, and have
the leaderboard client send the user JWT. Better: replace the raw-SQL proxy with
specific RPCs (`award_points`, `get_leaderboard`) so no SQL string crosses the
wire at all.

---

## Priority order
1. **0a turso DDL block** (done in code — just deploy) — stops DB deletion.
2. **0b bookings SELECT** — stops customer email/payment exposure.
3. **0d players email view** — stops player email exposure.
4. **0c ai-setup-assistant** — stops billed-call abuse.
5. **Phase 1 auth**, then **Phase 2 RLS** — the real fix; do deliberately, tested.

## Note on the Court Manager roster
The v3 roster synced to `game_state` now contains **names + tiers only** — no
emails or phone numbers (removed 2026-07-23, commit d5bb9c6). Keep it that way:
never put contact PII in `game_state` while it is publicly readable.
