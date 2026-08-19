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

**The list, 66 names, no fuss.** The refresh returned nothing and the bundled
names carried the screen. This is what every device gets today, because
`clubhouse_roster` has only an authenticated SELECT policy and the passcode
door creates no auth session, so the anon read comes back empty with HTTP 200.
Nothing is broken and nothing is announced.

**The list, including someone who joined after the last deploy.** The refresh
landed. Names added since the build appear. Nobody is dropped, by design.

**No list at all.** This state does not exist and there is no screen for it.
The wizard always has the bundled names, so a frame reading "Tonight's
bookings did not load" would be a lie with a retry button on it. That frame
was drawn, and it was deleted rather than wired. What the wizard says instead
is one quiet line naming which list it is showing, and that line is true in
every state.

## The open decision

Three ways to close the gap. Pick one.

**Apply the anon-read migration.** `supabase/migrations/20260818_clubhouse_roster_anon_read.sql`,
unapplied. First names and ids become readable without a login, scoped to
non-hidden rows. The refresh starts working tonight, on the phone that is
already in the building. Fully reversible: one `drop policy` returns the table
to exactly its current behaviour, and nothing else changes.

**Deploy the passcode Edge Function (Part B).** It mints a real session behind
the door, so the app reads as `authenticated` and the policy that already
exists covers the read. No policy change, but it is a service to build,
deploy and keep alive, and the existing policy does not filter `hidden`, so
that filter has to move with it.

**Leave it bundled-only.** Nothing to apply and nothing to run. The roster is
correct as of the last deploy, and changing it means a code change and a
redeploy, which for a list that turns over a few names a season may simply be
the honest cost.
