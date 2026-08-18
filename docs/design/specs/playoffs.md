# Build spec — Playoffs (frames 19a, 19b, 20, 21, 22)

Source of truth: `/Users/bensonbillions/clubpto/docs/design/manage-wireframes-v2-lime.html` (frames `#1t` 19, `#1u` 20, `#1v` 21, `#1w` 22). v1 (`/Users/bensonbillions/clubpto/docs/design/manage-wireframes-v1-green.html`, `#f19`–`#f22`) supplies frame **19b** (the ready state), which v2 does not draw, plus extra state detail called out inline.

---

## 0. Shared shell (all five frames)

Phone canvas: **390 x 780**, `box-sizing:border-box`, `display:flex; flex-direction:column`.

| Token | Value | Use |
|---|---|---|
| ground | `#0E2418` | screen background |
| ink | `#F4EDE0` | primary text, strong borders (2px) |
| ink 72% / 70% | `rgba(244,237,224,.72)` / `.7` | footer helper, body copy inside cards |
| ink 60% / 55% / 50% / 45% | same alpha ramp | secondary lines, dimmed loser names, seed labels, eyebrows |
| hairline | `rgba(244,237,224,.12)` | header and footer dividers |
| card border | `1px solid rgba(244,237,224,.18)` | resting cards and bracket rows |
| lime | `#D9E270` | primary button fill, score band fill |
| on-lime ink | `#0A1810` | text/numerals sitting on lime |
| alarm | `#FF9382` | the `NO` marker on the readiness checklist only |
| radius | `6px` everywhere (`4px` on the champion score band) | |

Type: **Inter** for all functional text. **VT323** monospace for every numeral, including inline numbers inside sentences and the `OK` / `NO` checklist markers. **Playfair Display** 600 only on the champion name.

Standard section header bar (frames 19a, 19b, 20, 21): `padding:14px 18px`, `border-bottom:1px solid rgba(244,237,224,.12)`, left title / right court, `justify-content:space-between`.

Standard footer bar (19a, 19b, 20, 22): `padding:14px 18px 20px` (bracket and match frames use `14px 18px`), `border-top:1px solid rgba(244,237,224,.12)`, column, `gap:10px`: one helper sentence then the primary button. Primary button = full width, height `56–58px`, lime fill, on-lime ink, `18–19px/700`. Disabled primary = `background:rgba(244,237,224,.1)`, `color:rgba(244,237,224,.4)`, same height, non-tappable.

**v2 vs v1 difference (applies to 19a, 19b, 20, 21):** v1 renders a bottom tab bar `Match | Players | Standings` on every playoff frame. **v2 drops the tab bar on all playoff frames.** Build without tabs; the playoff surface is a full-screen mode entered from the Standings tab, exited by "Back to bracket" / the header.

`[[PLAYER_10]]`, `[[PLAYER_11]]`, `[[PLAYER_12]]` in the wireframes are unresolved fixture placeholders, not copy. Render real names.

---

## 1. Frame 19a — Playoff readiness, blocked

Entered by tapping **"Seed the playoff"** on the Standings tab (frame 17) when the court is not ready. The v2 screen is a full-screen readiness gate, not a sheet.

### Copy (exact)
- Header left: `Playoff` — Header right: `Court 1`
- Checklist row 1 marker: `OK` — label: `No match is on court right now`
- Checklist row 2 marker: `OK` — label: `Every tie is settled by match order`
- Checklist row 3 marker: `NO` — label: `Tumi is owed a match`
- Blocked card heading: `Tumi is owed a match before seeding`
- Blocked card body: `Everyone else on Court 1 has played 3. Seeding now would place Tumi below players Tumi never got to face.`
- Blocked card button: `Draw Tumi a match`
- Line under the card: `Court 2 seeds on its own and is unaffected.`
- Footer helper: `Seeding is held until games played are even.`
- Footer button (disabled): `Seed the playoff`

Copy is templated: `{name} is owed a match`, `{name} is owed a match before seeding`, `Everyone else on Court {n} has played {count}.`, `Draw {name} a match`, `Court {other} seeds on its own and is unaffected.` The `3` inside the body sentence renders in Inter here (it sits mid-sentence in a body paragraph, unlike the standalone numerals elsewhere).

### Layout
Body `flex:1; padding:20px 18px; column; gap:16px`.
1. **Checklist**, tight column, no gaps: each row `display:flex; align-items:center; gap:12px; padding:14px 0; border-bottom:1px solid rgba(244,237,224,.12)`. Marker is VT323 `26px`, `OK` in ink, `NO` in `#FF9382`. Label `16px`, `flex:1`; the failing row's label is `font-weight:600`, passing rows are regular.
2. **The one bold element: the blocked card.** `border:2px solid #F4EDE0; border-radius:6px; padding:16px; column; gap:12px`. Heading `19px/700, line-height 1.3`. Body `15px/1.45` at ink 70%. Then the in-card lime action button, height `52px`, radius `6px`, `17px/700`.
3. Cross-court reassurance line, `15px` at ink 55%, `line-height:1.4`, pushed to the bottom of the body with `margin-top:auto`.
4. Footer: helper `15px` at ink 72%, then the **disabled** `Seed the playoff` (height 58px).

Secondary: everything above the card. The passing checklist rows exist to prove what is already fine, so they stay quiet.

### Controls
- **`Draw Tumi a match`** (in-card, lime): creates a regular round-robin match that includes the owed player on this court, then returns to the court view so it can be played. This is the only unblocking path offered on screen.
- **`Seed the playoff`**: disabled while any check fails. No tap target, no toast.
- Header `Court 1` is a label here, not a switcher.
- Multiple failing checks: render one row per check; the blocked card describes the **first** blocking reason with its own action. Multiple owed players collapse into one card, name-list them in the heading and pluralise (`are owed a match before seeding`).

### Data needed
- `courtId`, `courtNumber`, `otherCourtNumbers[]` still running.
- `readiness: { liveMatchOnCourt: boolean, tiesResolvable: boolean, playersOwedMatches: string[] }` — one entry per check with pass/fail so the checklist renders in fixed order (live match, ties, games played).
- Per-player on this court: `name`, `matchesPlayed`, `isOwedMatch`, plus the modal `matchesPlayed` of everyone else (the `3` in the body copy).
- Whether the drawing engine can actually produce a match for the owed player (if it cannot, the in-card button must not render as tappable).

### Variants
- **Loading:** header renders immediately; checklist rows render as three skeleton rows at hairline height; footer button stays in its disabled style until readiness resolves.
- **Blocked by a live match instead:** row 1 flips to `NO`, the card heading and body describe that check, and the card action becomes the score action rather than a draw. (v1's version of this exact case, `#f19` 19a, is the only drawn copy for it: heading `One score is still outstanding`, body `Round 4, Ade and Seyi against Dami and Lanre. Seeding needs it, because it changes who meets whom.`, ghost button `Score that match`. Ship v2's visual treatment with v1's wording; the v2 button style is the lime in-card button, not v1's ghost outline.)
- **Error (readiness call fails):** do not guess readiness. Keep `Seed the playoff` disabled and show the failure in the helper slot; reuse the states-slice error pattern rather than inventing new copy here.
- v1 also stamps a header chip `Round 4 done` next to the title. v2 drops it; do not build it.

---

## 2. Frame 19b — Playoff readiness, ready

**v2 does not draw this frame.** v2's only "ready" affordance is the live `Seed the playoff` button in the Standings tab footer (frame 17, helper line `Ties go to whoever got there first.`). Build 19b as the same full-screen gate as 19a with all checks passing, using v1 `#f19`'s copy, in v2's visual language.

### Copy (exact, from v1)
- Card heading: `Standings settled`
- Card body: `Every score is in. Everyone on this court is in the playoff, seeded from the table.`
- Footer helper: `Quarterfinals first. Pairs are seeded top with bottom.`
- Footer button (enabled): `Seed the playoff`
- Header: `Playoff` / `Court 1` (v2 header wording; v1 wrote `Playoff, Court 1` as a single title)

### Layout
Identical grid to 19a with three differences:
1. Every checklist row shows the ink-coloured `OK` marker and a regular-weight label.
2. The card drops to the resting border, `1px solid rgba(244,237,224,.18)` (v1 uses `1.5px`; v2's resting weight is `1px`), holds heading + body only, and carries **no** in-card button.
3. The footer button is live lime. **The one bold element on this frame is the footer button**, not the card.

### Controls
- **`Seed the playoff`** (lime, height 58): freezes the standings order into seeds and generates the bracket, then navigates to frame 20. Irreversible in the sense that re-seeding means deleting the bracket, so treat the tap as committing.
- No back-out control is drawn. Exit is the header / hardware back to the Standings tab.

### Data needed
- Same readiness payload as 19a, all checks passing.
- Final ordered standings for the court (`rank`, `name`, `points`, `scoreDiff`, `reachedAtMatchNumber` for the tie-order rule) — this is the input the seeding writes down.
- `playersOnCourt` count, which decides the stage list (8 players → Semifinals then Final; 16 → Quarterfinals, Semifinals, Final).

### Difference to flag
The footer helper is the only place the two versions disagree on seeding math. v1: `Quarterfinals first. Pairs are seeded top with bottom.` v2's bracket (frame 20) states `Seeds pair 1+3 and 2+4`, i.e. individual player seeds combined into pairs, not top-with-bottom fixed pairs. **Follow v2's pairing rule**; if the court is 8 players the helper must read Semifinals, not Quarterfinals, so the stage word is data-driven off the stage list.

---

## 3. Frame 20 — Bracket, vertical stages

Never a horizontal tree. One vertical column of stages, each stage a stack of full-width rows.

### Copy (exact)
- Header: `Playoff` / `Court 1`
- Intro line: `All 8 players are in. Seeds pair 1+3 and 2+4.` (the `8`, `1`, `3`, `2`, `4` are VT323 20px inline)
- Stage label: `Semifinals`
- Stage label: `Final`
- Row seed labels: `1+3`, `6+8`, `2+4`, `5+7`
- Final placeholder second line: `Waiting on the second semifinal`
- Footer helper: `The second semifinal is on court now.`
- Footer button: `Score that match`

v1 extras worth carrying: the stage list for a 16-player court is `Quarterfinals`, `Semifinals`, `Final`; the live row carries a `Live` tag; v1's final placeholder wording is `Waits for the second semifinal`. **Use v2's `Waiting on the second semifinal`.** v1's footer wording (`Each court runs its playoff independently.` / `Score the live semifinal`) loses to v2's.

### Layout
Body `flex:1; padding:16px 18px; column; gap:18px; overflow:hidden` (stages scroll as a group when a third stage exists).
- Intro line: `15px` at ink 60%, `line-height:1.4`.
- Each stage block: column, `gap:10px`. Stage label `13px/800`, `letter-spacing:.1em`, uppercase, ink 45%.
- **Match row** (radius 6, `overflow:hidden`), three bands stacked:
  1. Team A row: `padding:11px 14px`, `align-items:baseline`, `space-between`. Team name `17px/700`. Seed label right, VT323 `20px` at ink 50%.
  2. **Score band**: `display:grid; grid-template-columns:1fr 1px 1fr; background:#D9E270`, centre column `rgba(10,24,16,.28)` as the divider. Each number VT323 `48px`, `line-height:.9`, colour `#0A1810`, cell `padding:4px 0`.
  3. Team B row, mirror of band 1.
- **Row states:**
  - *Completed*: `border:1px solid rgba(244,237,224,.18)`; the **losing** team name drops to ink 55%; both numerals stay full `#0A1810`.
  - *Live / next up* (**the one bold element on this frame**): `border:2px solid #F4EDE0`; both team names full ink; score band shows `00` and `00` until a score lands.
  - *Not formed yet*: no score band at all. `border:1px dashed rgba(244,237,224,.25); padding:16px 14px; column; gap:6px`. Known side as `17px/700`, unknown side as the `Waiting on the second semifinal` line at `16px`, ink 50%.
- Footer: helper `16px/600` (full ink, not the muted footer treatment used on 19a/22), then the lime `Score that match`.

### Controls
- **Tap a live or next-up row** → frame 21 for that match.
- **Tap a completed row** → the correct/void flow for that result (frame 16, other slice). Do not open the scoring screen for a finished playoff match.
- Dashed rows are inert.
- **`Score that match`** (footer, lime): jumps to whichever playoff match is currently on court. Hide the whole footer bar when no playoff match is playable (all stages complete → the champion frame is the destination instead).
- Destructive path attached to this screen: deleting the bracket. Its confirm sheet lives in the states slice; its exact copy is heading `Delete the Court 1 playoff?`, body `The bracket and every playoff score on it are deleted. The night's standings are untouched.`, destructive `Delete the playoff`, dismiss `Keep the bracket`.

### Data needed
- `courtNumber`, `playersInPlayoff` count, and the seed-pairing rule as pairs of seed numbers so the intro line and the row labels come from one source: `[[1,3],[6,8],[2,4],[5,7]]`.
- `stages: [{ name, matches: [...] }]` in play order, stage names derived from the court size.
- Per match: `matchId`, `stage`, `teamA: { playerNames[], seedLabel }`, `teamB` (nullable while the feeding stage is unresolved), `scoreA`, `scoreB` (nullable), `status: complete | live | next | pending`, `winnerSide`.
- Which match, if any, is physically on court now, to drive the footer sentence and its target.

### Variants
- **Just seeded (nothing played):** first stage rows all render in the resting border, the first row is marked `next` and takes the 2px treatment, later stages render dashed with both sides unknown.
- **Loading:** stage labels plus skeleton rows at the row height; footer hidden until the live match is known.
- **Error (bracket fetch fails):** do not render a partial bracket; a wrong bracket is worse than none. Use the states-slice error pattern.
- No empty state exists: this frame is unreachable before seeding.

---

## 4. Frame 21 — Playoff match

### Copy (exact)
- Header left: `Semifinal 2` (the `2` is VT323 20px) — Header right: `Court 1`
- Team A: `Timi and Tumi`, seed label `2+4`
- Team B: `Fiyin and [[PLAYER_10]]`, seed label `5+7`
- Score band: `00` / `00`
- Helper under the card: `Winner meets Ade and Ayo in the final. Nobody sits out: the other four are on the second court.`
- Footer helper: `Tap the winning side to score.`
- Winner button A: `Timi and Tumi`
- Winner button B: `Fiyin and [[PLAYER_10]]`
- Bottom link: `Back to bracket`

Templated: `{Stage} {n}`, `Winner meets {teamName} in the final.`, `Nobody sits out: the other {n} are on the second court.`

### Layout
- Header: stage label left as `14px/800`, `letter-spacing:.1em`, uppercase; court right `17px/700`.
- Body `flex:1; padding:16px 18px; column; gap:14px`.
- **The one bold element: the match card**, same three-band anatomy as a bracket row but scaled up. Border `1px solid rgba(244,237,224,.18)`, radius 6. Team rows `padding:16px 18px`, name `22px/700`, seed label VT323 `22px` at ink 50%. Score band identical grid, cell `padding:10px 0`, numerals VT323 **`96px`**, `line-height:.9`, `#0A1810`.
- Helper paragraph `15px`, ink 60%, `line-height:1.4`.
- Footer bar: `Tap the winning side to score.` at `16px/600`, then two buttons side by side, `flex:1` each, height `56px`, `border:2px solid #F4EDE0`, radius 6, transparent fill, `17px/700` (drop to `16px` for the longer name). Order matches the card: A left, B right.
- Below the footer bar, outside it: `Back to bracket`, `padding:12px 18px 18px`, centred, `15px/600`, ink 60%.

### Controls
- **Winner button A / B**, and equivalently **tapping that team's half of the score band**: picks the winning side. This is tap one of the two-tap scoring flow; it hands off to score entry (frame 11, other slice) to attach the numbers. The `00 / 00` band is the pre-score state, not an editable field on this frame.
- **`Back to bracket`** → frame 20, no state change.
- Header is not interactive.

### Data needed
- `matchId`, `stageLabel` and `stageIndexWithinStage` (the `2` in `Semifinal 2`), `courtNumber`.
- Both teams: `playerNames[]`, `seedLabel`, current `score` (0/0 until entered).
- The already-decided opponent waiting in the next stage, for the `Winner meets ...` sentence, and its stage name.
- Count and location of the players not in this match (`the other four are on the second court`), so the sentence is true. If they are not all on one other court, this sentence must be recomputed, not hard-coded.

### Variants
- **Final rather than semifinal:** header reads the final's stage name and the `Winner meets ...` sentence is replaced or dropped; nothing feeds off a final.
- **Score already entered (revisit):** band shows the real numbers, loser side dims per the bracket-row rule, and the winner buttons are replaced by the correct/void entry point.
- v1's version of this frame (`#f21`) has no winner buttons and no back link. It relies on tapping the giant `108px` score halves, with `Tap the winning side to score.` centred above the tab bar. **v2 wins: explicit named winner buttons, `96px` numerals, `Back to bracket`, no tabs.**

---

## 5. Frame 22 — Champion

### Copy (exact)
- Eyebrow: `Court 1 champions`
- Champion name: `Timi` / line break / `and Tumi`
- Score: `21` / `19`
- Line under the score: `Beat Ade and Ayo in the final.`
- Footer helper: `Court 2 is still playing its final.`
- Footer primary: `Go to Court 2`
- Footer secondary: `Back to bracket`

Templated: `Court {n} champions`, `Beat {loserTeam} in the final.`, `Court {other} is still playing its final.`, `Go to Court {other}`.

### Layout
No header bar. Body `flex:1; padding:34px 20px; column; gap:20px; justify-content:center` (left-aligned content, vertically centred block):
1. Eyebrow `12px/800`, `letter-spacing:.14em`, uppercase, ink 45%.
2. **The one bold element: the champion name.** Playfair Display 600, `46px`, `line-height:1.05`, hard line break between the first name and `and {second}`.
3. Score band, same grid as elsewhere but `border-radius:4px; overflow:hidden`, cell `padding:14px 0`, numerals VT323 **`104px`**, `line-height:.9`. Winner's number `#0A1810`; **loser's number `rgba(10,24,16,.45)`** (on this frame the losing *number* dims, unlike bracket rows where the losing *name* dims).
4. `Beat ... in the final.` at `17px`, `line-height:1.45`, ink 70%.

Footer: helper `15px` at ink 72%; lime `Go to Court 2` at height 58, `19px/700`; then `Back to bracket` as a height-50 centred text row, `17px/600`, ink 60%.

### Controls
- **`Go to Court 2`** (lime): switches to the other court that is still live. Only render when another court is unfinished; when every court is done, this slot should carry the night's next step rather than a dead court jump.
- **`Back to bracket`** → frame 20 with all rows complete.
- Nothing on this frame edits the result. Correcting a final goes through the bracket row.

### Data needed
- `courtNumber`, champion `playerNames[]` (exactly two, rendered as `{a}` + `and {b}`), final `scoreWinner` / `scoreLoser`, `runnerUpTeamName`.
- Status of every other court: which are still playing and which stage they are in, to write the footer helper and target the jump.

### Variants
- **Last court to finish:** the `Court 2 is still playing its final.` line and `Go to Court 2` have no truthful content. Fall back to the session summary as the primary action (frame 23, other slice) and keep `Back to bracket` secondary. Do not print a false court status.
- v1's champion (`#f22`) is centre-aligned, adds the italic Playfair night name `Wednesday night` above the champion and the eyebrow `Champions, Court 1` below it, and its primary button is `Copy for WhatsApp` over a `Back to bracket` secondary. **v2 wins:** left-aligned, no night name, eyebrow above, and the WhatsApp copy action moves off this frame to the session summary.

---

## 6. Cross-frame rules the implementer must hold

1. **Per-court isolation.** Every playoff frame is scoped to one court. Readiness, seeding, the bracket, and the champion are per court and never merge. Both the blocked gate and the champion frame say this out loud in copy, so the model must actually support it.
2. **Seeding is a snapshot.** `Seed the playoff` freezes the standings order at that moment. Later corrections to round-robin results change the standings but must not silently re-seed a live bracket; re-seeding means deleting the bracket through the confirm sheet.
3. **Seeds are per player, paired into teams.** An 8-player court seeds 1 through 8 and pairs `1+3`, `2+4`, `5+7`, `6+8`. Seed labels appear on every bracket row and on the match frame, so the pairing must be stored, not recomputed for display.
4. **Ties never coin-toss.** Order comes from points, then score difference, then who reached the total first (`reachedAtMatchNumber`). The readiness checklist's second row asserts this is settled before seeding is allowed.
5. **Score band is one component** used at four sizes: `48px` (bracket row), `96px` (playoff match), `104px` (champion). Same lime fill, same `1fr 1px 1fr` grid, same `rgba(10,24,16,.28)` divider.
