# Where the manager's roster comes from

Two sources, in this order of precedence:

1. **The bundled list.** `src/manage/roster/names.ts`, a generated file of 66
   ids and first names, compiled into the build. Every path starts here.
2. **A refresh from `clubhouse_roster`.** Layered on top of the bundled names
   when the read succeeds. It can ADD people. It cannot remove them, and the
   next section says why that matters. It is never the thing the wizard
   depends on.

## Taking somebody off the list

The refresh can only add. A short read and a truthful read look identical from
here, both being a list with fewer names and no error, so treating a missing
name as a removal would let a policy change quietly shrink the list the night
runs on, and nobody would find out until a real person was standing on the
court unable to be added.

That has a cost, and it is worth saying out loud. Setting `hidden` on one of
the 66 bundled names removes them from every clubhouse surface at once, and
from the manager's picker only at the next deploy. The procedure is two
commands:

```
node scripts/gen-manage-roster.mjs
```

after editing `src/clubhouse/migrations/002_roster_seed.sql`, then commit both
files and ship. Until that lands, their name is still in the picker.

## Why bundled at all

A night runs on one phone, in a loud room, on club wifi that sits somewhere
between bad and absent. If step 2 of the wizard had to ask the network who
plays here, the night would stall before the first serve. So the names ship
with the build and the network is an improvement, not a prerequisite. To
change the bundled list, edit `src/clubhouse/migrations/002_roster_seed.sql`,
re-run `scripts/gen-manage-roster.mjs`, commit both, deploy.

## What an operator actually sees

**The list, 66 names, no fuss, and no extra line.** The refresh landed and
returned the club's rows. This is the normal state since the anon read policy
was applied on 2026-08-18. Names added to `clubhouse_roster` since the last
deploy appear here without one. Nobody is dropped, by design.

**The same list, plus a line saying it is the copy saved on this device.** The
refresh did not land: no network, or the policy was rolled back, or the request
passed its six second deadline. The bundled names carry the screen and the
night runs exactly as it would have. The line is the only difference.

**No list at all.** This state does not exist and there is no screen for it.
The wizard always has the bundled names, so a frame reading "Tonight's
bookings did not load" would be a lie with a retry button on it. That frame
was drawn, and it was deleted rather than wired. What the wizard says instead
is one quiet line naming which list it is showing, and that line is true in
every state.

## How it is closed, and how to undo it

**Applied: the anon-read policy.** `supabase/migrations/20260818_clubhouse_roster_anon_read.sql`
went in on 2026-08-18. First names and ids are readable without a login,
scoped to non-hidden rows. Verified from outside the same minute: the anon key
reads 66 rows, and `game_state` still answers an anon write with 42501.

To undo it, one statement, and nothing else changes:

```sql
drop policy if exists "roster read for anon" on clubhouse_roster;
```

The two alternatives below were the other ways to close the same gap. They are
kept because either would let the policy above be dropped.

**Deploy the passcode Edge Function (Part B).** It mints a real session behind
the door, so the app reads as `authenticated` and the policy that already
exists covers the read. No policy change, but it is a service to build,
deploy and keep alive, and the existing policy does not filter `hidden`, so
that filter has to move with it.

**Leave it bundled-only.** Drop the policy. Nothing to run. The roster is
correct as of the last deploy, and changing it means a code change and a
redeploy, which for a list that turns over a few names a season may simply be
the honest cost.
