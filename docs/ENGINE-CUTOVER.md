# Engine cutover — status and the two things still owed

Written 2026-08-14, when the engine moved off the Lovable-managed Supabase
project and `game_state` was closed.

## Done

| | |
| --- | --- |
| Data | `game_state` (5), `pair_history` (373), `sessions` (4) copied to the club's project and hash-verified identical |
| App | `.env` + Vercel env vars point at `flahcijysipymafazhxq`; no build output references the old project |
| `game_state` | **admin-only**, read and write. Verified: with the public bundle key, read returns 0 rows and an upsert onto `cm_v3_session` fails RLS 42501 |
| `bookings` | no policy at all — it holds `customer_email` / `stripe_payment_id` and was anon-readable before |
| Hosting | clubpto.com on Vercel. Hashed assets `immutable, max-age=31536000` + brotli; document `no-store`. GitHub Pages sent `max-age=600` on everything |

### Why an allowlist, not `to authenticated`

The clubhouse and the engine share one project, and the clubhouse gives a
passwordless login to every player on the 66-name roster. `to authenticated`
would have let any member write the live session. The boundary is membership
of `engine_admins`, checked by `is_engine_admin()`. Anonymous auth would have
been no better — anyone can mint that JWT too.

Adding the second admin, once they have signed in at /manage:

```sql
insert into engine_admins (user_id, note)
select id, 'second admin' from auth.users where email = 'them@example.com';
```

## Owed 1 — exercise v3 while signed in

Static analysis says `/manage` (v3) and `/manage4` (v4) never reach the
retired `src/lib/turso.ts`; only `/manage-classic`, `/manage2` and the admin
pages do, and those were already dead. **That is not the same as having run
it.** A module that throws on call is invisible to typecheck and to tests.

I could not finish this myself: past the sign-in screen it needs an emailed
code, and entering authentication codes is not something I do.

So, one pass on a real device, signed in:

1. `/manage` → does the session load with its roster?
2. Move through Check-In, Courts, Standings. Standings is the one that
   reached the old leaderboard code in the legacy build.
3. Complete a game, then reload — did it persist?
4. `/manage4` → same: start, score, reload.

If a screen throws, the error names the retired module and the fix is to
port that query onto the Supabase tables in
`supabase/migrations/20260814_engine_tables.sql`.

Rollback if the door ever locks someone out mid-night is in the comment at
the top of `20260814_lock_game_state.sql`.

## Owed 2 — delete the old project

**Migrating did not remediate anything.** `ikfbtktofcfkpqxwlfku` still holds
all 373 `pair_history` rows and the 78KB session, and its anon key is in this
repo's git history permanently, so it can never be un-published. Until that
project is deleted, every exposure the earlier audit flagged is exactly as
exposed as it was.

Reversibility is worth keeping briefly, not indefinitely.

**Delete by: 2026-08-28** (two weeks).

Deleting a project destroys its data irreversibly, so it is the owner's
action, not mine:

1. Confirm a night has run on the new project since the cutover.
2. Supabase dashboard → the old project → Settings → General → Delete project.
3. Note the date here when it is done.

Nothing in this repo depends on it: `supabase/config.toml`, `.env`, and the
Vercel env vars all name the club's project.
