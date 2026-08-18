# Build spec — Setup wizard (frames 05 to 09)

Source of truth: `/Users/bensonbillions/clubpto/docs/design/manage-wireframes-v2-lime.html` (frames `1f`, `1g`, `1h`, `1i`, `1j`). Extra state detail pulled from `/Users/bensonbillions/clubpto/docs/design/manage-wireframes-v1-green.html` (frames 05 to 09, plus 24a and 25b which are the only setup-time empty/error frames drawn anywhere). Where the two disagree, v2 wins and the difference is noted on one line.

Wireframe intent line for this whole job, quoted from v1's Job 1 header: "Setup is a wizard, one decision per screen. Each screen asks its question, says in one line why it matters, and carries the running count. The action bar always names what comes next."

---

## 0. Shared shell (applies to all five frames)

**Canvas:** 390 x 780, `box-sizing:border-box`, column flex, `background:#0E2418`, `color:#F4EDE0`, `font-family:Inter, system-ui, sans-serif`.

**Tokens observed in v2 (use these literal values):**

| Role | Value |
| --- | --- |
| Ground | `#0E2418` |
| Ink | `#F4EDE0` |
| Ink muted (body helper) | `rgba(244,237,224,.65)` and `.68` |
| Ink faint (captions, step label) | `rgba(244,237,224,.5)` and `.45` |
| Footer status text | `rgba(244,237,224,.72)` |
| Accent (lime) | `#D9E270` background with `#0A1810` text |
| Divider, header/footer | `1px solid rgba(244,237,224,.12)` |
| Divider, list rows | `1px solid rgba(244,237,224,.08)` |
| Card border, unselected | `1px solid rgba(244,237,224,.18)` |
| Card border, selected | `2px solid #F4EDE0` |
| Disabled option border | `1px dashed rgba(244,237,224,.22)` at `opacity:.55` |
| Chip border | `1px solid rgba(244,237,224,.2)`, `border-radius:999px` |
| Corner radius | `6px` on every card, field and button; `4px` on checkboxes; `999px` on chips and radios |

**Type:** Inter for all prose. `VT323` monospace for **every numeral** (step counters, counts, court sizes, target numbers, summary figures). `Playfair Display` 600 for the session title on frame 09 only.

Note for implementers: these radii and the lime accent are the wireframe's own system and differ from the public-site design system in CLAUDE.md (sharp corners, gold `#C9A84C`). Build the Manage wizard to the wireframe.

**Top bar** (frames 05 to 09, identical geometry): `padding:14px 18px`, bottom divider, space-between.
- Left: `Back`, 16px/600. Returns to the previous wizard step; from frame 05 it returns to Home (frame 03 or 04).
- Right, frames 05 to 08: `Step N of 4`, 13px/700, `letter-spacing:.08em`, uppercase, `rgba(244,237,224,.45)`; the two numerals render in VT323 19px.
- Right, frame 09: `Review` (same style, no numerals).

**Action bar** (bottom of all five): `padding:14px 18px 20px`, top divider, column, `gap:10px`.
1. A one-line running status sentence, 15px, `line-height:1.35`, `rgba(244,237,224,.72)`; numerals inside it render in VT323 22px.
2. A full-width primary button, `height:58px`, `border-radius:6px`, `background:#D9E270`, `color:#0A1810`, 19px/700, centred. The label always names the next screen.

**Wizard state to carry across steps:** `{ night, playerIds[], walkIns[], courtCount, courtAssignments, matchesEach }`. Every step is re-enterable via Back with its selections intact.

---

## Frame 05 — Which night

**Copy, exactly:**
- Step label: `Step 1 of 4`
- Back: `Back`
- H1 (24px/700, `line-height:1.2`): `Which night is this?`
- Sub (15px, `line-height:1.4`, muted): `The night decides which roster pre-fills.`
- Option 1: `Wednesday`
- Option 2: `Sunday`
- Footer status: `Wednesday selected.`
- Primary button: `Next: who is here`

**Layout:** header, then a `flex:1` body at `padding:22px 18px` with `gap:14px`. H1, then the one-line sub, then a column of option rows (`gap:12px`, `margin-top:6px`). Body is short, mostly empty space below the options. The one bold element is the H1 with the selected option row directly under it; the primary button carries the accent.

**Option row:** `padding:16px 18px`, radius 6, space-between. Label 19px/700 on the left. On the right a 22px circle, `border-radius:999px`. Selected row: `2px solid #F4EDE0` border and the circle filled `#D9E270` with a `2px solid #F4EDE0` ring. Unselected row: `1px solid rgba(244,237,224,.18)` border and an empty circle with `2px solid rgba(244,237,224,.28)`.

**Controls:**
- Two mutually exclusive option rows (radio group, one always selected). Tapping a row selects it, updates the footer sentence to `<Day> selected.` and re-fetches the roster that frame 06 pre-fills.
- `Back` returns to Home.
- `Next: who is here` advances to frame 06. Always enabled because a night is always selected.

**Data needed:** the list of night options the club runs, each `{ dayName, isDefault }`. v2 draws exactly two, `Wednesday` and `Sunday`, with `Wednesday` preselected. Selecting a night must resolve to that night's booking roster for step 2, so the backend needs `getRosterForNight(dayName)`.

**Variants:** none drawn. If the option list is fetched rather than hard-coded, render the two-row skeleton with the header and disabled footer button (DERIVED, not drawn in either file).

**v1 difference:** v1 rendered the days as two side-by-side chips under a small `Day` label, subtitled `The day sits on every screen and on the summary you send around.` and confirmed with `Wednesday chosen.` v2 replaces all three; build v2.

---

## Frame 06 — Who is here

**Copy, exactly:**
- Step label: `Step 2 of 4`
- H1 (24px/700): `Who is here?`
- Sub (15px, muted): `Only the people you tick get put into matches.`
- Search field placeholder: `Search the roster`
- Roster rows as drawn: `Ade`, `Ayo`, `Chizea`, `Fiyin`, `Hamid`, `Kayode`, `Tamilore` (fixture names, alphabetical; `Hamid` is the one unticked row)
- Last row: `+ Add a walk-in` (the `+` is a VT323 24px glyph, then the words `Add a walk-in`)
- Footer status: `16 in tonight.`
- Primary button: `Next: courts`

**Layout:** header; then a fixed block at `padding:18px 18px 12px` holding H1, sub, and the search field (48px tall, `1px solid rgba(244,237,224,.18)`, radius 6, `padding:0 14px`, placeholder 16px at `rgba(244,237,224,.45)`); then a `flex:1` scrolling list; then the action bar. The list is the bulk of the screen and clearly scrolls past the seven visible rows, since the count says 16.

**Roster row:** `padding:12px 18px`, top divider `rgba(244,237,224,.08)`, space-between. Name 16px/600 on the left. On the right a 26px square, `border-radius:4px`. Ticked: filled `#D9E270` with `2px solid #F4EDE0`. Unticked: transparent with `2px solid rgba(244,237,224,.25)`. No text tag, no avatar, no secondary line.

**Walk-in row:** same divider, `padding:14px 18px`, 16px/600, left-aligned, `+` glyph then label.

**Controls:**
- Search input filters the roster list by name as you type.
- Each row is a toggle across its full width. Tapping flips the tick and increments/decrements the footer count.
- `+ Add a walk-in` opens name entry and appends a tonight-only player, ticked. Per frame 24: "Walk-ins are normal. Add the name and they play tonight only."
- `Next: courts` advances to frame 07 carrying the ticked set.
- `Back` returns to frame 05.

**Data needed:**
- For the selected night: the booking roster as `[{ playerId, displayName, bookedForThisNight: boolean, preTicked: boolean }]`, sorted alphabetically by display name. v2 shows people pre-ticked by default with one unticked, so the source must say who is expected tonight and who is merely in the club roster.
- A create-walk-in path returning a `playerId` scoped to this session only (not added to the permanent roster).
- The live count of ticked players, which the footer prints and which frames 07, 08 and 09 all consume.

**Empty variant (search finds nothing)** — drawn as v2 frame 24, applies to this screen:
- Search field switches to the filled style: `2px solid #F4EDE0`, text 16px/600 (shown as `Bols`).
- Body copy 20px/700: `Nobody in the roster matches "Bols".`
- Body sub 16px, `rgba(244,237,224,.68)`: `Walk-ins are normal. Add the name and they play tonight only.`
- Outline button 56px, `2px solid #F4EDE0`, radius 6, 17px/700: `Add "Bols" as a walk-in`
- Text link under it, 15px/600, `rgba(244,237,224,.6)`: `Clear the search`
- The action bar stays, showing `15 in tonight.` and `Next: courts`. The query string is interpolated into both the headline and the button label.
- v1 phrased this as `No one called Sope on tonight's booking list.` with a ghost button `Add Sope as a walk-in`; v2 wins.

**Error variant (roster fetch failed)** — only drawn in v1 (frame 25b), and it is a setup-time error, so build it here:
- Headline 20px/800: `Tonight's bookings did not load.`
- Body 15px muted: `You can still run the night. Add everyone by name, or try the list again.`
- Action bar carries two controls: primary `Try the list again` and a secondary ghost `Add players by name`.
- Consequence for the build: setup must remain completable with zero backend roster, using walk-in entry alone.

**Loading variant:** not drawn. Show the header and the search field with a row skeleton in the list area; keep the primary button disabled until the count is known (DERIVED).

**v1 differences:** v1 used `In` and `Booked` text tags instead of checkboxes, greyed the un-included name, placeholder `Search the booking list`, walk-in row `Add a walk-in by name`, helper `Only people on this list get games. Tap a name to include them.`, count `15 in tonight.` v2 wins on all of them.

---

## Frame 07 — Courts

**Copy, exactly:**
- Step label: `Step 3 of 4`
- H1 (24px/700): `How many courts?`
- Sub (15px, muted): `Two courts means two sets of standings.`
- Court count options: `1` and `2` (VT323 36px, no other label)
- Helper under the selector (14px, `rgba(244,237,224,.5)`): `Tap a name to move it. The letter is a seeding hint and never shows on court.`
- Court card titles: `Court 1`, `Court 2`
- Court card counts as drawn: `08` and `08` (VT323 26px, zero-padded to two digits)
- Court 1 chips as drawn: `Ade A`, `Ayo`, `Timi`, `Tumi C`, `Fiyin`, `[[PLAYER_10]]`, `[[PLAYER_11]]`, `[[PLAYER_12]]`
- Court 2 chips as drawn: `Chizea`, `Hamid A`, `Kayode`, `Tamilore`, `[[PLAYER_13]]`, `[[PLAYER_14]]`, `[[PLAYER_15]]`, `[[PLAYER_16]]`
- Footer status: `Both courts are even at 8.`
- Primary button: `Next: matches each`

`[[PLAYER_nn]]` are unresolved-name tokens in the wireframe, rendered at `rgba(244,237,224,.55)`. Ship real names there; there is no token UI in the product.

**Layout:** header; `flex:1` body at `padding:18px`, `gap:10px`, `overflow:hidden`. Order down the page: H1, sub, the two-up count selector, the helper line, then the court cards stacked with `gap:10px`. The bold element is the selected count tile plus the two court cards; the helper line is deliberately quiet.

**Count selector:** a row of equal-width 56px tiles, `gap:10px`, radius 6, numeral centred in VT323 36px. Unselected: `1px solid rgba(244,237,224,.18)`. Selected: `2px solid #F4EDE0` with `background:#D9E270` and `color:#0A1810`.

**Court card:** `1px solid rgba(244,237,224,.18)`, radius 6, `padding:14px`. Header row is baseline-aligned space-between: title 17px/700 on the left, player count VT323 26px on the right. Below, a wrapping chip row, `gap:6px`, `margin-top:10px`. Chip: 14px/600, `white-space:nowrap`, `padding:6px 11px`, pill border, radius 999. A seeding letter, when present, is appended inside the same chip after the name in `rgba(244,237,224,.45)` (drawn: `A`, `C`).

**Controls:**
- Court count selector, single choice, `1` or `2`. Changing it re-splits the ticked players across the courts and re-renders the cards. Choosing `1` collapses to a single card holding everyone.
- Tapping a player chip moves that player to the other court. Both card counts and the footer sentence update.
- `Next: matches each` advances to frame 08.
- `Back` returns to frame 06.

**Data needed:**
- The ticked player set from step 2 with `{ playerId, displayName, seedLetter: "A" | "B" | "C" | null }`. The seed letter is optional per player (most chips have none) and is a setup-time hint only, never surfaced during play.
- A default split of those players across the chosen court count, balanced as evenly as possible, plus per-court `playerCount`.
- Court identities `Court 1` and `Court 2` for the rest of the app to key on.

**Footer sentence rules:** when both courts hold the same number, it reads `Both courts are even at <n>.` Uneven and one-court wording is not drawn; derive it from the same shape and keep it a single declarative line (DERIVED). Do not use an em dash.

**Empty variant (a court has nobody)** — drawn only in v1 as frame 24b, at setup:
- Dashed-border card, centred content: title `Court 3`, body `No one on Court 3 yet.`, ghost button `Assign players`.
- v2's frame 25 is a different, in-session take on the same idea and belongs to the states slice, not here.

**v1 differences:** v1 offered three count tiles (`1`, `2`, `3`), v2 offers two. v1's sub was `Players stay on their court all night, so the split matters.` and its footer read `15 players across 2 courts.` v1 had no seeding letters and no "tap a name to move it" helper. Build v2, and treat 3-court support as out of scope unless the count option is added back explicitly.

---

## Frame 08 — How many matches each

**Copy, exactly:**
- Step label: `Step 4 of 4`
- H1 (24px/700): `How many matches each?`
- Sub (15px, muted): `Court 1 has 8 players. Every target below has to divide into fours.`
- Option `2` label: `Short night, about [[MINUTES_PER_MATCH]] minutes each.`
- Option `3` label (selected): `The usual on two courts.`
- Option `4` label: `Long night. Extend later if there is time.`
- Option `5` label (disabled): `15 players needs a target of 4.`
- Bottom helper (14px, `rgba(244,237,224,.5)`, pushed down with `margin-top:auto`): `Greyed targets stay visible so the reason is readable, not hidden.`
- Footer status: `3 each means 6 matches on Court 1.`
- Primary button: `Next: review`

`[[MINUTES_PER_MATCH]]` is an unresolved token. Supply the real per-match minute estimate.

**Layout:** header; `flex:1` body at `padding:18px`, `gap:14px`. H1, sub, then a column of target rows (`gap:10px`, `margin-top:4px`), then the helper line pinned to the bottom of the body. The one bold element is the selected target row, filled lime.

**Target row:** radius 6, `padding:14px 16px`, horizontal flex, `gap:14px`. Left: the target numeral in VT323 34px inside a fixed `width:34px` box. Right: the reason line, 15px. Three states:
- Selected: `2px solid #F4EDE0`, `background:#D9E270`, `color:#0A1810`, label 15px/600.
- Available: `1px solid rgba(244,237,224,.18)`, label `rgba(244,237,224,.6)`.
- Unavailable: `1px dashed rgba(244,237,224,.22)`, whole row at `opacity:.55`, label at full colour so the reason stays readable. Not tappable, never hidden.

**Controls:**
- Single-select list of targets. Tapping an available row selects it and rewrites the footer sentence.
- Unavailable rows do not respond to taps.
- `Next: review` advances to frame 09.
- `Back` returns to frame 07.

**Data needed, and the rule behind it:**
- Per-court player count from step 3 (the sub line names `Court 1` specifically, so with two courts this screen reasons about the first court's headcount).
- For each candidate target, whether it is achievable and, when it is not, a one-line reason string to print in place of the descriptive label.
- The derived match count: `matchesOnCourt = courtPlayers * target / 4`. Check against the drawn fixtures: 8 players at target 3 gives 6 matches, which the footer prints; v1's 15 players at target 4 gives 15 games, which its summary prints. Validity is that same division landing on a whole number.
- A per-match minute estimate for the `2` row.

**Fixture inconsistency to be aware of:** v2's disabled row reads `15 players needs a target of 4.` while its own sub line says Court 1 has 8 players, and 8 at target 5 divides cleanly. That sentence is carried over from v1's 15-player fixture. Ship the copy shape (`<n> players needs a target of <t>.`) generated from the real numbers rather than the literal fixture sentence, and keep the greyed row visible.

**Variants:** no loading or error state drawn. If every target is unavailable, the wireframe gives no screen for it; block `Next` and keep the reasons on screen (DERIVED).

**v1 differences:** v1 showed only `3`, `4`, `5` with `4` selected, gave each disabled row a `Unavailable` heading above its reason, titled the selected row `4 matches each` with a second line `15 games in total, partners rotate every round.`, and its footer read `The guide updates as people arrive or leave.` with button `Next: ready`. v2 drops the `Unavailable` heading, adds the `2` option, and moves the total into the footer sentence. Build v2.

---

## Frame 09 — Ready

**Copy, exactly:**
- Header right label: `Review` (no step counter)
- Title (Playfair Display 32px/600, `line-height:1.1`): `Wednesday night`
- Summary row labels, top to bottom: `Players in`, `Courts`, `Matches each`, `Matches in total`, `Points for a win`
- Summary values as drawn: `16`, `2`, `3`, `12`, `3`
- Closing paragraph (15px, `line-height:1.45`, `rgba(244,237,224,.65)`, `text-wrap:pretty`): `Partners rotate every match. Nobody earns points for sitting out.`
- Footer status: `First matches are already drawn.`
- Primary button: `Start the night`

**Layout:** header; `flex:1` body at `padding:22px 18px`, `gap:18px`. The Playfair title sits alone at the top and is the one bold element on the screen. Under it, a borderless table: each row is `padding:14px 0` with a `1px solid rgba(244,237,224,.12)` top border, and the last row also carries a bottom border, so the block reads as five ruled lines. Each row is baseline space-between: label 16px in `rgba(244,237,224,.6)` on the left, value in VT323 30px on the right. The closing paragraph sits below the table. No controls in the body at all; this screen is read-only.

**Controls:**
- `Back` returns to frame 08 with every choice intact.
- `Start the night` commits the session and moves to the court view (frame 10). This is the only committing action in the wizard.
- Nothing in the summary rows is tappable as drawn. (v1 stated the same idea in its footer: `Nothing here is locked. You can extend, add or correct all night.`)

**Data needed:** the assembled session, ready to persist and to seed the schedule:
- Night day name, used verbatim as `<Day> night` in the Playfair title.
- `playersIn` count (ticked players plus walk-ins).
- `courtCount`.
- `matchesEach` (the step 4 target).
- `matchesInTotal`, which equals `playersIn * matchesEach / 4` — 16, 3 gives 12, matching the drawn figures.
- `pointsForAWin`, drawn as `3`. Read it from config rather than hard-coding it into the view, since the standings job quotes the same number.
- The generated first round for every court, because the footer asserts `First matches are already drawn.` The draw must exist before this screen is shown, not after the button is pressed.

**Variants:** none drawn. `Start the night` is a write, so give it an in-flight disabled state and, on failure, keep the user on this screen with the summary intact (DERIVED; the wireframes draw no setup-commit error).

**v1 differences:** v1 titled it `Ready to start` with a `Setup done` step label, included a `Night` row reading `Wednesday`, labelled the total `Games in total`, omitted `Points for a win` as a row, and closed with `Partners rotate every round. Everyone is ranked as an individual. A win is 3 points.` v2 promotes the night into a Playfair headline, renames the total, and pulls points-for-a-win into the table. Build v2.

---

## Cross-frame implementation notes

1. **Numerals are always VT323.** Every count, step number, court size, target and summary figure, including the numerals embedded inside footer sentences. Prose around them stays Inter.
2. **Zero padding.** Frame 07's court counts render as `08`, not `8`, while the same value in a footer sentence renders unpadded (`Both courts are even at 8.`). Pad the standalone display numerals to two digits; leave in-sentence numerals unpadded.
3. **The footer sentence is derived, never static.** It restates the current state of the screen in one declarative line and updates on every selection.
4. **The button always names the destination:** `Next: who is here`, `Next: courts`, `Next: matches each`, `Next: review`, `Start the night`.
5. **No em dashes in any rendered string.** All the wireframe copy above already obeys this; keep it that way when generating the dynamic sentences.
6. **Entry point.** Frame 03 (Home, nothing running) enters this wizard via its `Start tonight` button and its footer promises `Five steps to a running night.`, which is these five frames. Frame 04's `Start a different night` is the second entry point and states `Tonight's results stay saved.`
7. **Back is non-destructive at every step**, including out of frame 05 to Home.
