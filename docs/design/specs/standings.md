# Build spec — Standings slice

Frames **17 Standings tab** and **18 Tie broken by order**.

Source of truth: `/Users/bensonbillions/clubpto/docs/design/manage-wireframes-v2-lime.html` (frames `#1r` and `#1s`). Extra state detail pulled from `/Users/bensonbillions/clubpto/docs/design/manage-wireframes-v1-green.html` (`#f17`, `#f18`) and flagged as such. v2 wins every conflict.

---

## Shared tokens for this slice (v2)

| Role | Value |
|---|---|
| Screen background | `#0E2418` |
| Sheet background | `#173724` |
| Text primary | `#F4EDE0` |
| Text muted | `rgba(244,237,224,.55)` |
| Text de-emphasised row / token name | `rgba(244,237,224,.6)` |
| Column-header text | `rgba(244,237,224,.45)` |
| Footnote text | `rgba(244,237,224,.5)` |
| Section hairline | `1px solid rgba(244,237,224,.12)` |
| Row hairline | `1px solid rgba(244,237,224,.08)` |
| Accent (lime) | `#D9E270` |
| Text on lime | `#0A1810` |
| Modal scrim | `rgba(244,237,224,.35)` (v2's standard sheet scrim, used on 4 other frames — it is a *light* wash, not a dark dim) |
| Body/label typeface | Inter |
| Every numeral | VT323 monospace |
| Frame size | 390 × 780, `box-sizing:border-box` |

No red, no destructive colour appears anywhere in this slice.

`[[PLAYER_10]]` / `[[PLAYER_11]]` / `[[PLAYER_12]]` in the wireframe are unresolved-name **tokens**, not copy. Render real player names there.

---

# Frame 17 — Standings tab

## Layout, top to bottom

A single fixed-height column: header block, column-header strip, scrolling table, footnote, action bar, tab bar. The table is the screen. The **one bold element is the lime `Seed the playoff` button** — it is the only filled/saturated surface on the frame. Everything else is text on the dark ground separated by hairlines. Secondary: the helper line under the title, the per-row reason sub-lines, the footnote.

### 1. Header block
`padding:14px 18px 10px`, bottom hairline, `flex-direction:column; gap:6px`.

- Row, baseline-aligned, space-between:
  - Left, 20px/700: **`Standings`**
  - Right, 16px/600: **`Court 1`** (the active court's name)
- Helper line, 14px, muted:
  **`A win is 3. Points first, then score difference.`**
  The `3` is rendered inline in VT323 at 18px. Everything else Inter.

### 2. Column-header strip
`padding:8px 18px`, bottom hairline, 11px / 800 / `letter-spacing:.06em` / uppercase / `rgba(244,237,224,.45)`. Flex row with fixed widths:

| Label | Width | Align |
|---|---|---|
| `#` | 24px | left |
| `Player` | `flex:1` | left |
| `P` | 32px | right |
| `W` | 30px | right |
| `L` | 30px | right |
| `Diff` | 40px | right |
| `Pts` | 38px | right |

These exact single-letter labels are the copy. Do not expand them.

### 3. Table body
`flex:1`, scrolls when it overflows. Each row `padding:11px 18px`, bottom hairline `rgba(244,237,224,.08)`, `align-items:baseline`.

- All numerals: VT323 **24px**, uniform — the position number, P, W, L, Diff and Pts are all the same size. (v1 made `Pts` larger at 26px; v2 flattened them. Follow v2.)
- Player name: Inter **17px / 700**, overriding the row's mono font.
- `Diff` is signed: `+18`, `-3`, and bare `0` for zero.

A row that carries a reason becomes a two-line block: the flex row on top, then the reason line at 14px, muted, `margin-top:3px`, `padding-left:24px` (aligned under the Player column, indented past the `#`).

**The eight rows as drawn (fixture data — replace with live standings):**

| # | Player | P | W | L | Diff | Pts | Reason sub-line |
|---|---|---|---|---|---|---|---|
| 1 | Ade | 3 | 3 | 0 | +18 | 9 | — |
| 2 | Timi | 3 | 2 | 1 | +11 | 6 | — |
| 3 | Ayo | 3 | 2 | 1 | +4 | 6 | `Behind on score difference.` |
| 4 | Tumi | 2 | 1 | 1 | +2 | 3 | — |
| 5 | Fiyin | 3 | 1 | 2 | -3 | 3 | `Got there first, in match 4.` |
| 6 | *(name token)* | 3 | 1 | 2 | -3 | 3 | `Reached it in match 6, so second.` |
| 7 | *(name token)* | 2 | 0 | 2 | -9 | 0 | — |
| 8 | *(name token)* | 3 | 0 | 3 | -23 | 0 | — |

**De-emphasis rule:** rows 7 and 8 — the two players on **0 points** — are drawn with the entire row (numerals included) at `rgba(244,237,224,.6)`. Implement as: *a player on 0 points renders the whole row at 60%.* (Row 6 has only its name at 60%, and that is the unresolved-token styling, not a data state — a resolved name there is full-opacity.)

**Complete reason-line vocabulary.** These are the only sub-lines that exist across both files; use them verbatim, do not compose new ones:

- `Behind on score difference.` — level on points, lower Diff.
- `Got there first, in match 4.` — level on points *and* Diff, placed higher because they reached the total first. Substitute the match number.
- `Reached it in match 6, so second.` — the losing side of that same tie. Substitute the match number.
- `Arrived late.` — v1 only, on a player showing `0 0 0 0 0`.
- `Left early.` — v1 only; v1 also dims that player's **name** (its `#8E9A85`, i.e. the 60% treatment) while the row's numerals stay normal.

v1 additionally applied `Behind on score difference.` to *every* row in a points-tie, including the second of three tied players. v2 shows it on one. Rule to implement: show it on every row that is tied on points with the row above it and separated only by Diff.

### 4. Footnote
Sits directly under the last row, inside the scroll area. `padding:8px 18px`, 14px, `rgba(244,237,224,.5)`, `line-height:1.4`:

**`Two players have played 2. No points for sitting out.`**

The `2` is inline VT323 at 18px; the count `Two` is spelled out in Inter. This line is dynamic — it names how many players are short and how many matches they have played. Suppress it when everyone has played the same number of matches.

> v1's equivalent line, for reference only, read: `Points first, then score difference. Uneven games stay visible in P.` v2 replaces it with the two-fact version above. Use v2.

### 5. Action bar
`padding:14px 18px`, top hairline, `flex-direction:column; gap:10px`.

- Line, 16px/600, full-opacity: **`Ties go to whoever got there first.`**
- Button, `height:56px`, `border-radius:6px`, background `#D9E270`, text `#0A1810`, 18px/700, centred: **`Seed the playoff`**

Disabled variant (drawn on frame 19): background `rgba(244,237,224,.1)`, text `rgba(244,237,224,.4)`, same size, non-tappable.

> v1's frame 17 had **no** button here at all — just the sentence. v2 adds the seeding CTA to the standings tab. Follow v2.

### 6. Tab bar
Top hairline, three equal tabs, each `height:60px`, 13px / 800 / `letter-spacing:.06em` / uppercase.

`Match` · `Players` · `Standings`

Active tab (`Standings` here): `border-top:3px solid #F4EDE0`, text at full `#F4EDE0`. Inactive: `border-top:3px solid transparent`, text `rgba(244,237,224,.45)`.

## Interactive controls

| Control | Behaviour |
|---|---|
| `Match` tab | Navigates to the court view (frame 10). |
| `Players` tab | Navigates to the players tab (frame 13). |
| `Standings` tab | Current; no-op. |
| `Seed the playoff` | Enabled → goes to playoff readiness / seeds the bracket. Disabled → not tappable; frame 19 is the screen that explains why. |
| Table scroll | Vertical only. Eight rows fit at 390×780; more must scroll. The header block, action bar and tab bar stay fixed. |

**Not drawn:** the wireframe shows no tap affordance on a standings row, and no trigger for frame 18's sheet. Frame 18 is a sheet that overlays this screen, so a trigger must exist. Recommended (this is an inference, not in the file): tapping a row whose reason line is `Got there first, in match N.` or `Reached it in match N, so second.` opens the frame-18 sheet. There is no court switcher on this frame — court selection lives on the Match tab (frame 12); the header's `Court 1` is a read-only label.

## Data required

Standings are **per court**, not per session. Frame 19 states `Court 2 seeds on its own and is unaffected.` — compute and render one independent table per court.

```
StandingsView {
  courtLabel: string                 // "Court 1"
  pointsPerWin: number               // 3, drives "A win is 3."
  rows: StandingsRow[]               // pre-sorted
  shortfall: { playerCount: number, matchesPlayed: number } | null
                                     // drives "Two players have played 2."
  seedingEnabled: boolean
}

StandingsRow {
  position: number                   // 1-based, already resolved
  playerId: string
  displayName: string
  matchesPlayed: number              // P
  wins: number                       // W
  losses: number                     // L
  pointDifference: number            // Diff, signed
  points: number                     // Pts
  reachedTotalAtMatchNumber: number  // match index at which this player
                                     // first hit their current (points, diff)
  reason: null
    | { kind: "behindOnDiff" }
    | { kind: "gotThereFirst",  matchNumber: number }
    | { kind: "gotThereSecond", matchNumber: number }
    | { kind: "arrivedLate" }
    | { kind: "leftEarly" }
  tiedWithPlayerId: string | null    // set on both sides of an order-broken tie;
                                     // what frame 18 opens on
}
```

Sort key: `points` desc → `pointDifference` desc → `reachedTotalAtMatchNumber` asc. Never re-sort client-side by a different key; the order is the record.

Backend must also expose, for the button: `seedingEnabled` plus the blocker list frame 19 renders (`no match is on court right now`, `every tie is settled by match order`, `nobody is owed a match`).

## Variants

- **Session just started / no scores in.** Every row `0 0 0 0 0`, ordered by whatever the roster order is; no reason lines; footnote suppressed; `Seed the playoff` disabled. The wireframes do not draw this and **specify no copy for it** — do not invent a headline; render the table with zeros.
- **Late arrival.** Row shows `0 0 0 0 0` with sub-line `Arrived late.` (v1 detail).
- **Player left early.** Row keeps its real numbers, sub-line `Left early.`, name at 60% (v1 detail).
- **Loading.** Not drawn in either file. Reuse the 44px bordered placeholder rows that v2's frame 18 backdrop uses (`border:1px solid rgba(244,237,224,.18); border-radius:6px; height:44px`) under a live `Standings` title.
- **Error.** Not drawn for standings in either file; v1's error copy lives in frames 25a/25b (score / bookings), which are a different slice. Do not reuse that copy here.

---

# Frame 18 — Tie broken by order

v2 title: "Tie broken by order". v1 title: "Tie-breaker, reached it first".

## Shape

**v2 makes this a bottom sheet over the standings screen. v1 made it an inline panel on a standings screen. Follow v2 — it is a modal, and it dismisses.**

Three stacked layers inside the 390×780 frame (`position:relative`):

1. **Backdrop content** — the standings screen behind, rendered at `opacity:.35`: `padding:16px 18px`, `gap:10px`, a 20px/700 `Standings` title and three empty rows (`border:1px solid rgba(244,237,224,.18); border-radius:6px; height:44px`). In the real build this layer is the live frame-17 screen, not placeholders.
2. **Scrim** — `position:absolute; inset:0; background:rgba(244,237,224,.35)`.
3. **Sheet** — anchored bottom, full width: `background:#173724`, `border-top:2px solid #F4EDE0`, `border-radius:10px 10px 0 0`, `padding:18px 18px 22px`, `display:flex; flex-direction:column; gap:14px`.

## Sheet contents, in order

1. **Grab handle** — 44 × 4, `border-radius:999px`, `rgba(244,237,224,.2)`, centred.
2. **Title**, 22px/700: **`Level on points`**
3. **Body**, 16px, `line-height:1.45`, full opacity:
   **`Fiyin and [[PLAYER_10]] are level on points and on score difference. The higher place goes to whoever got there first.`**
   (Both `[[…]]` are player-name slots. Template: `{nameA} and {nameB} are level on points and on score difference. The higher place goes to whoever got there first.`)
4. **Two comparison cards**, side by side, `display:flex; gap:10px`, each `flex:1`, `border-radius:6px`, `padding:16px`, `flex-direction:column; gap:4px`.

   **Left card — the player placed higher.** `border:2px solid #D9E270`. This is **the one bold element of the frame**, alongside the button.
   - Name, 19px/700, full opacity: `Fiyin`
   - Stats, VT323 26px: **`3 pts, -3`** (template: `{points} pts, {signedDiff}`)
   - Reason, 14px/600, colour `#D9E270`: **`Got there in match 4`** (template: `Got there in match {n}` — no full stop)

   **Right card — the player placed lower.** `border:2px solid rgba(244,237,224,.2)`.
   - Name, 19px/700, `rgba(244,237,224,.6)`: `[[PLAYER_10]]`
   - Stats, VT323 26px, full opacity: **`3 pts, -3`**
   - Reason, 14px/600, `rgba(244,237,224,.55)`: **`Match 6`** (template: `Match {n}` — bare, no verb)

   The asymmetry is deliberate: the winner's card says the whole sentence in lime, the loser's card says only the match number in grey.

5. **Footnote**, 15px, `rgba(244,237,224,.6)`, `line-height:1.4`:
   **`No coin is tossed. The standings row says "Got there first" so the room can see why.`**
   The inner quotation marks are part of the copy.
6. **Button**, `height:58px`, `border-radius:6px`, background `#D9E270`, text `#0A1810`, 19px/700, centred: **`Got it`**

## Interactive controls

| Control | Behaviour |
|---|---|
| `Got it` | Dismisses the sheet, returns to frame 17 unchanged. It is an acknowledgement only — it decides nothing and changes no data. |
| Grab handle / swipe down | Same dismiss. |
| Scrim tap | Same dismiss (implied by the sheet pattern; not separately drawn). |

There is no accept/override/flip control. The copy is explicit that nothing is up for decision.

## Data required

```
TieExplainer {
  higher: { displayName, points, pointDifference, reachedAtMatchNumber }
  lower:  { displayName, points, pointDifference, reachedAtMatchNumber }
}
```

Both sides must be level on **both** `points` and `pointDifference`; `reachedAtMatchNumber` is the only differentiator and must be a real match number from the night's match log, not a timestamp. The backend has to record, per player, the match at which they first arrived at their current points-and-diff total — this is the single field the whole frame rests on, and frame 17's `Got there first, in match 4.` / `Reached it in match 6, so second.` sub-lines read from the same field.

## Variants

- **More than two players tied.** Not drawn. Two cards is what the layout supports.
- **Empty / loading / error.** None. The sheet is only ever opened when the tie already exists in already-loaded standings data.

---

## v1 → v2 differences (one line each)

- Frame 17 header right-hand slot: v1 showed a round counter `Round 3 of 4`; **v2 shows the court name `Court 1`** — standings are per-court in v2.
- Frame 17 helper line: v1 had none under the title; **v2 adds `A win is 3. Points first, then score difference.`**
- Frame 17 bottom bar: v1 was a sentence only (`Points first, then score difference. Uneven games stay visible in P.`); **v2 is `Ties go to whoever got there first.` plus the lime `Seed the playoff` button.**
- Frame 17 footnote: v1 had no shortfall count; **v2 adds `Two players have played 2. No points for sitting out.`**
- Frame 17 `Pts` numeral: v1 rendered it larger (26px) than the other columns; **v2 uses one uniform 24px for every numeral.**
- Frame 17 table size: v1 listed 15 players across the whole session; **v2 lists 8, one court.**
- Frame 18 form: v1 was an inline explainer card on a standings screen; **v2 is a modal bottom sheet with a `Got it` dismiss.**
- Frame 18 vocabulary: v1 said **round** (`Ahead, got there in round 3.`, `Got there in round 4.`); **v2 says match** (`Got there in match 4`, `Match 6`) — use "match" everywhere.
- Frame 18 explainer copy: v1's card read `Level on points and score difference` / `Whoever reached the total first is placed higher. Ayo was on 9 points with +14 after round 3, Timi after round 4. Nothing to decide and nothing to flip.` and closed with `The reason stays on the row for the rest of the night.`; **v2 replaces all of it with `Level on points`, the two-name body sentence, and the `No coin is tossed…` footnote.**
