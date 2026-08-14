# Schema map — ground truth before Publish & Attendance

Read from the live database (`flahcijysipymafazhxq`) and the repo on
2026-08-14. Step 0 of the Publish & Attendance plan. **No code changed.**

Source of truth for the DB half: `information_schema.columns`,
`pg_constraint`, `pg_policies`. Source for the session shapes: the code.

---

## 1. Tables

16 base tables in `public`: 10 `clubhouse_*`, 5 engine, 1 `engine_admins`.

### Clubhouse

| Table | Columns | Keys |
| --- | --- | --- |
| `clubhouse_roster` | `player_id text NN`, `display_name text NN`, `claimable bool NN d=true`, `updated_at timestamptz NN`, `hidden bool NN d=false` | PK `player_id` |
| `clubhouse_links` | `auth_user_id uuid NN`, `player_id text NN`, `claimed_at timestamptz NN`, `revoked bool NN d=false`, `consent_publication_at timestamptz` | PK `auth_user_id`; UNIQUE `player_id`; FK → `auth.users(id)` CASCADE |
| `clubhouse_prefs` | `player_id text NN`, `show_winpct bool NN d=true`, `show_rank bool NN d=false`, `updated_at timestamptz NN` | PK `player_id` |
| `clubhouse_sessions` | `session_id text NN`, `date date NN`, `venue text NN`, `attendance_count int NN d=0`, `recap_note text`, `shoutouts jsonb`, `practice_only bool NN d=false`, `published_at timestamptz NN` | PK `session_id` |
| `clubhouse_pairs` | `session_id text NN`, `pair_id text NN`, `players jsonb NN` | PK (`session_id`,`pair_id`); FK → sessions CASCADE |
| `clubhouse_results` | `session_id text NN`, `game_id text NN`, `winner_pair_id text NN`, `loser_pair_id text NN`, `completed_at bigint NN` | PK (`session_id`,`game_id`); FK → sessions CASCADE |
| `clubhouse_champions` | `session_id text NN`, `title text NN`, `points int NN d=0`, `pair jsonb NN` | PK (`session_id`,`title`); FK → sessions CASCADE |
| `clubhouse_finalists` | same shape as champions | PK (`session_id`,`title`); FK → sessions CASCADE |
| `clubhouse_totals` | `player_id`, `sessions`, `games`, `wins`, `losses`, `championships`, `pto_points`, `longest_win_streak`, `current_week_streak`, `best_week_streak`, `milestones jsonb`, `show_winpct`, … | PK `player_id` |
| `clubhouse_rivalries` | `player_a text NN`, `player_b text NN`, `meetings int NN`, `wins_a int NN`, `wins_b int NN` | PK (`player_a`,`player_b`) |

### Engine

`game_state` (PK `id text`, `state jsonb`, `updated_at`), `sessions`,
`pair_history`, `players`, `bookings`, plus `engine_admins`
(PK `user_id uuid` → `auth.users`).

### Row counts today

`clubhouse_roster` 66 (0 hidden) · `clubhouse_links` **1** · every other
clubhouse table **0** · `game_state` 5 · `pair_history` 373 · `sessions` 4.

**"1 claimed link" concretely:** `auth_user_id 9d3a9efc-6630-41c0-a999-a75b4cd802c8`
(bensonbillions0@gmail.com) ↔ `player_id 'p-benson'` ("Benson"),
`revoked=false`, consent stamped. One human has claimed a roster name.

---

## 2. RLS policies, verbatim

| Table | Policy |
| --- | --- |
| `clubhouse_roster` | SELECT **to authenticated USING true** |
| `clubhouse_sessions` | SELECT **to authenticated USING true** |
| `clubhouse_pairs` | SELECT **to authenticated USING true** |
| `clubhouse_results` | SELECT **to authenticated USING true** |
| `clubhouse_champions` | SELECT **to authenticated USING true**; SELECT to anon USING `session_id = latest_published_session_id()` |
| `clubhouse_finalists` | SELECT **to authenticated USING true** |
| `clubhouse_totals` | SELECT **to authenticated USING true** |
| `clubhouse_rivalries` | SELECT **to authenticated USING true** |
| `clubhouse_links` | SELECT to authenticated USING `auth.uid() = auth_user_id`; INSERT with ownership + claimable check |
| `clubhouse_prefs` | INSERT/UPDATE gated on `clubhouse_links` ownership; SELECT to authenticated |
| `game_state` | SELECT + ALL to authenticated USING `is_engine_admin()` |
| `engine_admins` | SELECT to authenticated USING `user_id = auth.uid()` |
| `sessions`, `pair_history`, `players` | SELECT to **anon**, authenticated USING true |
| `bookings` | **no policy** (closed) |

---

## 3. Session shape at end of night

### v3 — `/manage`

`SessionV2`, defined in `src/court-manager/react/useSessionV2.ts` (not
types.ts): `phase` ("setup"|"rounds"|"playoffs"|"done"), `config`,
`practice`, `players: Player[]`, `pairs`, `unpaired`, `pairSeed`,
`schedule`, `currentRound`, `results: GameResult[]`, `voidedGames`,
`gameStarts`, `paceSamples`, `pauses`, `sessionStartedAt: number|null`,
`playoffs`, `champion: string[]|null`.

- **No `sessionId`, no `date`, no `venue`.** Only `sessionStartedAt` epoch ms.
- Persisted as `Envelope<SessionV2>` (schemaVersion 5) in one `game_state`
  row `cm_v3_session`. Upserted — no archive; tonight overwrites last night.
- `Player`: `id`, `name` (first name), `tier`, `isVip`, `isCoach`,
  `attending?`, `checkedIn`, `checkInTime?`, `lastName?`, `email?`.
- **Everyone who took part is present** in `session.players` with
  `checkedIn` / `attending` flags — including people who played no game
  (`unpaired`, latecomers). Attendance must read those flags, never `pairs`.
- Round-robin results in `results[]` (`gameId` like `r1g1`, recurring
  weekly). **Playoff results are NOT there** — they are in
  `playoffs.winners`. `champion` is player ids, not a pair id.
- **`resetSession()` clears `attending`/`checkedIn`/`checkInTime` on every
  player.** The Reset button sits in the header all night behind one
  `window.confirm`. Publish must run before Reset.
- No session-summary component exists (`src/components/manage-next/` has
  four files: ErrorBoundary, RoundBoard, SetupCheckIn, StandingsPlayoffs).

### v4 — `/manage4`

`AmericanoSession` (`src/types/americano.ts:221`): `id`, `date`,
`sessionName`, `players: AmericanoPlayer[]`, `pools: AmericanoPool[]`,
`defaultMatchFormat`, `isPractice`, `status`, `integrityErrors?`.

- `AmericanoPlayer`: `playerId`, `displayName`, `tier`,
  `status: "present"|"not_arrived"|"left"`, `joinedAtMatchIndex`, `catchUpUsed`.
  **No `lastName`** (dropped at `addToDraft`).
- `date` = `new Date().toISOString().slice(0,10)` — **UTC**.
- `id` = `` `night-${date}` ``.
- Results only in `pool.matches[]`; standings recomputed, never stored.
- Persisted to one `game_state` row `cm_v4_session` (schemaVersion 10).
- **No venue field.**
- "End session and reset" commits `DEFAULTS()` over the same single row —
  destroys the night locally and remotely with no archive.

---

## 4. What the clubhouse renders, and from what

One read path: `fetchBundles()` in `src/clubhouse/data/reads.ts` reads
`clubhouse_sessions` + `pairs` + `results` + `champions` + `finalists`,
plus `fetchRoster()` and `fetchAllPrefs()`. `sections.tsx` makes no
Supabase calls. **Nothing in `src/` writes any of the five content
tables** — `buildPublishBundle` has no non-test caller.

| Section | Reads | Today |
| --- | --- | --- |
| Seat / dashboard | pairs, results, champions, finalists, prefs, roster+links | renders, all zeros |
| Recaps | sessions, results, champions, finalists, pairs | "Your first recap lands here after the next session." |
| Champions wall | champions, finalists (+ sessions header) | "The wall is waiting for its first names." |
| Records book | pairs, results, champions | block hidden entirely |
| Boards | pairs, results, champions, finalists, prefs | "The boards start counting at the first session." |
| Milestone clubs | pairs (via `playerTotals`) | four cards, "Doors open. Show up, you're in." |
| Players / profiles | **roster** (rows) + bundle tables (stats) | 66 names, all zeros |
| Mosaic | pairs only | unfilled P, "Squares fill as sessions land." |

**"Nights attended" is not attendance.** `playerTotals` (`derive/stats.ts`)
increments `sessions` once per bundle in which your id appears inside a
`clubhouse_pairs.players` JSON blob — i.e. *nights you were paired and
published*. Three counters key off pairs: `t.sessions` (stats.ts),
`rankedSessions` and `datesOf` (viewmodel.ts). The one true attendance
value, `clubhouse_sessions.attendance_count`, is a per-session scalar
rendered only as "{n} in the room" and feeds no per-player number.

Nothing reads `game_state` or a nonexistent table.

---

## 5. Contradictions with the plan's assumptions

**C1 — BLOCKER: there is no joinable player id.** The plan says extend
`clubhouse_roster` as the person table. It *is* the person table, but
nothing can join to it. `clubhouse_roster.player_id` values are
hand-authored name slugs (`p-benson`, `p-abubakar`) from
`002_roster_seed.sql`. v3 `Player.id` is `pl-<base36ts>-<n>`, a 9-char
legacy random, or `csv_<normalized>`; v4 `playerId` is copied from the v3
roster or `plv4-<...>`. **Zero overlap, and no mapping code exists.**
Worse, v3's `mergeRoster` can *replace* an existing player's id on
re-import, so v3 ids are not stable either. Step 1 can key attendance off
roster ids as instructed, but **Step 2 cannot write a row without a
name→roster resolution step**, and identity resolution is listed as out of
scope. This needs a decision before Step 2.

**C2 — the `to authenticated` rule is already violated by eight existing
tables.** roster, sessions, pairs, results, champions, finalists, totals
and rivalries are all `SELECT to authenticated USING true` — every member
can read all of it. That may be the intent for a members' area, but it is
exactly the pattern the standing rule forbids, and the new attendance
table is specified to be stricter (own rows only) than the tables beside
it. Decision needed: leave the shared content tables as member-visible, or
bring them to the same standard.

**C3 — nothing FKs to `clubhouse_roster`.** `clubhouse_links.player_id`
and `clubhouse_prefs.player_id` are unconstrained text. Attendance FK-ing
to roster would be the first, which is right, but it means orphans are
possible in the existing tables today.

**C4 — "milestone clubs just need feeding" is half true.** The cards
render, but they iterate only ids present in published pairs
(`viewmodel.ts:279-288`), never the roster. Someone who attends ten nights
and is never in a published pair can never join a club. Step 3 requires
editing `playerTotals` plus two viewmodel counters, not just inserting rows.

**C5 — the seat and the boards already disagree on what a session is.**
`t.sessions` counts practice nights (stats.ts increments before the
`practiceOnly` guard); `rankedSessions` excludes them. Attendance must
pick one definition and the other surface must be reconciled.

**C6 — v4 specifics that will break a naive Publish:**
- `session.status === "complete"` is **dead code** — never assigned. A
  Publish gated on it never fires.
- `session.id = night-${date}` is **not unique**; `clubhouse_sessions.session_id`
  is a PK, so a second session on one date silently upserts over the first.
- `date` is computed in **UTC**, so a Toronto evening after 8pm EDT already
  stamps tomorrow.
- `PublishSessionInput.venue` is required; v4 has no venue field. Neither does v3.
- Champion title is `"Court 1 Champion"` (singular) while `PTO_POINTS_V1`
  keys `"Court 1 Champions"` (plural) → publishes 0 points.
- v4 is individual scoring; the publish pipeline is pairs-based.

**C7 — both managers can destroy the night before it is published.** v3
`resetSession()` and v4 "End session and reset" both overwrite the single
`game_state` row with no archive.

---

## 6. Amendments since Step 0

This map is a snapshot taken on 2026-08-14 before any of the work landed.
What has changed since, so the map does not quietly go stale:

**C7 — closed.** `game_state_archive` (append-only, admin-only, no UPDATE or
DELETE policy at all) plus `archiveOrThrow()` in front of both resets. C7a
extended it to archive the device's in-memory envelope as well as the remote
row, because a session whose push had been failing lived only on the device.

**C3 — closed for the new table only.** `clubhouse_attendance.player_id` is
the first foreign key to `clubhouse_roster` anywhere in the schema. The
existing `clubhouse_links.player_id` and `clubhouse_prefs.player_id` are
still unconstrained text and can still orphan.

**C2 — partly answered, deliberately.** The eight `SELECT to authenticated
USING true` tables were reviewed and seven were left alone: they hold what a
members' room is for, and member-visible is the intent. `clubhouse_roster`
was the exception and is now `hidden = false OR the reader owns the row`,
because migration 004 added the `hidden` flag and then enforced it only in
the browser. `clubhouse_attendance` is stricter than all of them — own rows
or admin — which is the standard for anything that records where a person
was on a given night.

**Still open:** C1 (no joinable id between engine players and roster ids —
Step 1.5), C4, C5 and C6.

**New table.** `clubhouse_attendance` — PK (`session_id`, `player_id`),
`status` in (present, booked, no_show), `source` in (publish, checkin,
walkin, booking), `checked_in_at`, `recorded_by`, `created_at`,
`updated_at`. `session_id` carries NO foreign key to `clubhouse_sessions`
on purpose: that table is the published record, and attendance has to be
writable before a night is published. A BEFORE UPDATE trigger keeps the
earliest `checked_in_at`, freezes `source`, and refuses `present -> booked`,
`no_show -> booked`, and `present -> no_show` unless it comes through
`mark_attendance_no_show()`.

### Step 1.5 (migration 006)

**C1 — closed.** `clubhouse_player_alias` is the join: `(kind, value)` as the
primary key, `player_id` FK to `clubhouse_roster`, `verified`, `confirmed_by`.
`kind` is closed by a check constraint to `engine_player_id`; `email` and
`phone` get added by migration when something writes them. Two further checks
make "never auto-confirm" structural — an engine alias cannot be stored
unverified, and it cannot be stored without naming the admin who confirmed it.

Many aliases may point at one member; one alias points at exactly one. That
shape is required, not incidental: v3's `mergeRoster` replaces a `csv_` id
with a stable one when "Import classic roster" matches a CSV-created player,
and both import callers rewrite `session.players` only — the old id stays
behind in `pairs[].playerIds`, in the pair id string, in `unpaired`,
`vipPartnerId`, `playoffs` and `champion`. A publish input built from pairs
therefore carries the old id while one built from players carries the new one,
and both have to land on the same person.

**`clubhouse_player_alias_history`** records every reassignment and every
deletion, written by a trigger on the alias table. Append-only: no UPDATE or
DELETE policy. `now_player_id` null means the alias was removed rather than
repointed.

**The roster policy gained an admin clause.** Migration 005 set
`hidden = false OR the reader owns the row` and stopped there, which is right
for members and wrong for admins: the Publish confirm screen builds its
candidate list by reading `clubhouse_roster` as the admin, so a hidden member
would have been unmappable and would never get an attendance row. 006 adds
`is_engine_admin()`.

**Still open:** C4, C5, C6.
