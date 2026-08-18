# Build spec: summary-states

Frames 23, 24a, 24b, 25a, 25b, 26a, 26b, 26c. Numbering below follows v1. Where v2 carries the same frame under a different number, both ids are given, and **v2 wins**.

Sources:
- `/Users/bensonbillions/clubpto/docs/design/manage-wireframes-v2-lime.html` (later pass, lime `#D9E270`) — frames `1x` 23 Session summary, `1y` 24 Empty roster search, `1z` 25 Empty court unassigned, `1aa` 26 Error score would not save, `1ab` 27 Confirmation end the night.
- `/Users/bensonbillions/clubpto/docs/design/manage-wireframes-v1-green.html` (earlier pass, green `#4E9B63`) — frames 23, 24a, 24b, 25a, 25b, 26a, 26b, 26c. Sole source for 25b, 26a, 26b.

The wireframe author's own rule for this group, quoted from v1: "Empty states invite an action. Errors say what happened and what to do, never apologise, never go vague. Every destructive action names exactly what will be lost."

---

## 0. Shared foundation (applies to every frame in this slice)

### Canvas
Phone frame is **390 x 780**, `box-sizing:border-box`, column flex, no page-level horizontal scroll.

### Tokens (v2 lime, authoritative)

| Role | Value |
|---|---|
| Screen background | `#0E2418` |
| Raised sheet background | `#173724` |
| Text primary | `#F4EDE0` |
| Text secondary | `rgba(244,237,224,.72)` |
| Text body-muted | `rgba(244,237,224,.68)` |
| Text tertiary / link | `rgba(244,237,224,.6)` |
| Text faint / helper | `rgba(244,237,224,.55)` and `.5` |
| Eyebrow / column label | `rgba(244,237,224,.45)` |
| Accent (lime) | `#D9E270`, text on accent `#0A1810` |
| Danger line | `#EF4444` |
| Danger text | `#FF9382` |
| Structural divider | `1px solid rgba(244,237,224,.12)` |
| Card border | `1px solid rgba(244,237,224,.18)` |
| Row rule | `1px solid rgba(244,237,224,.1)` (summary) / `.08` (standings) |
| Selected outline | `2px solid #F4EDE0` |
| Radius | `6px` everywhere; bottom sheets `10px 10px 0 0` |

### Type
- **Inter** for all functional text (400/500/600/700/800).
- **VT323 monospace for every numeral** that is a value: stat numbers, scores, ranks, table figures, inline counts. Numerals set in VT323 always run ~4px larger than the Inter text they sit in (e.g. 22px VT323 inside 15px Inter).
- **Playfair Display** only for the session title ("Wednesday night") and the champion name.
- Eyebrow style: `12px/800`, `letter-spacing:.1em`, uppercase, `rgba(244,237,224,.45)`. Column-label variant uses `.06em`.

### Buttons
| Kind | Spec |
|---|---|
| Primary | height `58px` (`56px` when a tab bar sits under it), radius 6, fill `#D9E270`, text `#0A1810` `19px/700` |
| Secondary | height `56px`, `2px solid #F4EDE0`, transparent, text `#F4EDE0` `17-18px/700` |
| Tertiary (text) | height `50px`, no border, `17px/600`, `rgba(244,237,224,.6)` |
| Destructive | height `58px`, `2px solid #EF4444`, transparent fill, text `#FF9382` `19px/700`. Never a filled red button. |

### Numeral padding rule
Derived from the wireframes and applied consistently: **stat-tile values and match scores are zero-padded to two digits** (`01`, `05`, `00`, `09`), **numerals inside a sentence are not** (`2 results are queued.`, `15 in tonight.`, `All 24 results`).

### Bottom-sheet pattern (used by 26a, 26b, 26c)
1. Underlying screen stays mounted at `opacity:.35`.
2. Absolutely positioned scrim `inset:0`, `background:rgba(244,237,224,.35)`. Note this is a **light** scrim, not the dark one v1 used.
3. Sheet pinned bottom, full width, `background:#173724`, `border-radius:10px 10px 0 0`, `padding:18px 18px 22px`, `gap:14px`, column flex.
4. Top border colour signals intent: `2px solid #EF4444` for destructive confirms, `2px solid #F4EDE0` for neutral sheets.
5. Grab handle first child: `44 x 4`, `border-radius:999px`, `rgba(244,237,224,.2)`, `align-self:center`.
6. Order inside: handle, title, consequence paragraph, optional detail card, destructive action, safe action last.
7. Scrim tap and back gesture both resolve to the safe action (dismiss without acting).

### Tab bar (only frames that show it)
Three tabs, each `flex:1`, height `60px`, `13px/800`, `letter-spacing:.06em`, uppercase. Active: `border-top:3px solid #F4EDE0`, full-strength text. Inactive: `border-top:3px solid transparent`, `rgba(244,237,224,.45)`. Labels: `Match`, `Players`, `Standings`.

---

## Frame 23 — Session summary
v2 `1x` "23 Session summary". v1 label adds: "· reachable all night".

### Layout, top to bottom
1. **Top bar**, `padding:14px 18px`, bottom divider, `space-between`: `Close` (`16px/600`) on the **left**, `Tonight` (`17px/700`) on the **right**. The title sits right, the dismiss sits left. That is what the frame shows; do not swap it.
2. **Body**, `flex:1`, `padding:18px`, column, `gap:16px`, `overflow:hidden`:
   - Playfair `26px/600`, `line-height:1.15`: `Wednesday night`
   - **Stat row**, `display:flex; gap:20px`, three cells. Each cell: eyebrow (`12px/700`, `.08em`, uppercase, `.45`) over VT323 `34px`, `line-height:1`.
   - **Champions card**: `1px` card border, radius 6, `padding:14px`, `gap:4px`. Eyebrow `Champions`, then one `18px/700` line per court.
   - **Final standings block**: eyebrow `Final standings, Court 1` with `padding-bottom:8px`, then rows. No header row is drawn. Row: `display:flex; align-items:baseline; padding:9px 0; border-top:1px solid rgba(244,237,224,.1)`; last row also gets `border-bottom`. Columns: rank `width:24px` VT323 22px, name `flex:1` Inter `16px/700`, then three right-aligned VT323 columns `width:34px` / `44px` / `34px`.
3. **Footer**, `padding:14px 18px 20px`, top divider, `gap:10px`: helper line then primary CTA.

### Copy, exactly
- `Close`
- `Tonight`
- `Wednesday night`
- Stat labels: `Played`, `Players`, `Voided`
- Stat values as drawn: `24`, `16`, `01`
- `Champions`
- `Court 1: Timi and Tumi`
- `Court 2: Hamid and Kayode`
- `Final standings, Court 1`
- Rows as drawn: `1  Ade  3  +18  9` / `2  Timi  3  +11  6` / `3  Ayo  3  +4  6` / `4  Tumi  2  +2  3`
- `Plain text, ready to paste. Works any time tonight.`
- `Copy for WhatsApp`

### Column meaning
Cross-referenced against v2 frame 17 (Standings tab, headers `# Player P W L Diff Pts`): the three numeric columns here are **Played, Diff, Pts**. W and L are dropped in the summary. Diff always carries its sign (`+18`, `-3`).

### The one bold element
The stat row plus `Wednesday night`. The lime CTA `Copy for WhatsApp` is the only filled element on the screen.

### Interactive controls
| Control | Behaviour |
|---|---|
| `Close` | Dismiss the summary and return to the screen that opened it. The summary is reachable at any point in the night, including mid-session, so it must not assume the night has ended. |
| `Copy for WhatsApp` | Write the plain-text payload (below) to the clipboard. |

### Clipboard payload
v2 shows only the button. v1 frame 23 renders the exact text in a monospace preview block, so use it as the payload format:

```
Wednesday night
Champions Court 1: Ayo + Kemi
1. Ayo · 9 pts · +14
2. Timi · 9 pts · +14, reached it later
3. Hamid · 9 pts · +11
4. Tumi · 6 pts · +5
5. Dami · 6 pts · +3
...and 10 more
```

Structure: session day line, one `Champions Court N: A + B` line per crowned court, then ranked players as `N. Name · P pts · ±D`, with the tie-break reason appended in plain words when two players share points and diff (`, reached it later`). Beyond 5 rows the payload truncates with `...and 10 more` where the number is the remaining count. Pairs are joined with `+` inside the payload even though on-screen pairs use `and`.

### Data required from the backend
- `session`: `{ id, dayLabel: "Wednesday night", startedAt, endedAt | null }`
- `counts`: `{ matchesPlayed: 24, playersIn: 16, voidedCount: 1 }` (voided count is the number of results voided tonight, rendered zero-padded)
- `champions`: array of `{ courtNumber, playerA, playerB }`, present only for courts whose playoff final has a recorded score
- `finalStandingsByCourt`: for each court, ordered array of `{ rank, playerName, played, diff (signed int), points }`, sorted points then diff then who reached the total first
- `tieBreakNotes`: per-player reason string when their rank was decided by order of arrival (needed for the payload line `reached it later`)
- `remainingPlayerCount` for the payload truncation line

### States not drawn, and the rule for each
- **No champions yet** (playoffs unfinished, summary opened mid-night): no wireframe exists. Omit the Champions card entirely rather than inventing an empty-state string. Flag for copy review.
- **No results yet**: stat values render `00`; standings block renders its eyebrow with no rows. Not drawn; do not invent an empty line.
- **Loading**: not drawn.
- **Copy success/failure**: no toast or confirmation is drawn in either version. Decide and flag; there is no approved copy for it.

### v1 difference
v1 frame 23 showed an eyebrow `Session summary`, two label/value rows (`Champions, Court 1` → `Ayo & Kemi`, `Games played` → `22`), a rendered monospace preview of the paste text, the helper `Plain text, the insurance policy against a dead phone. Send it whenever.`, and a bottom tab bar with `Standings` active. v2 replaces all of that with a stat row, a champions card, a real standings table, a Close bar, and no tab bar.

---

## Frame 24a — Empty, roster search
v2 `1y` "24 Empty, roster search". This is the roster step (frame 06) with a query that matches nobody.

### Layout
1. **Header block**, `padding:18px 18px 12px`, column, `gap:12px`, bottom divider:
   - `24px/700` heading
   - Search field: height `48px`, `2px solid #F4EDE0`, radius 6, `padding:0 14px`, value text `16px/600`
2. **Body**, `flex:1`, `padding:28px 18px`, column, `gap:14px`, `align-items:flex-start` (everything left-aligned, nothing centred):
   - `20px/700`, `line-height:1.3` headline
   - `16px`, `line-height:1.45`, `rgba(244,237,224,.68)` explainer
   - Secondary button, height `56px`, `padding:0 20px`, width fits content
   - Tertiary text link `15px/600`, `rgba(244,237,224,.6)`
3. **Footer**, `padding:14px 18px 20px`, top divider, `gap:10px`: count line then primary CTA.

### Copy, exactly
- `Who is here?`
- Field value as drawn: `Bols`
- `Nobody in the roster matches "Bols".`
- `Walk-ins are normal. Add the name and they play tonight only.`
- `Add "Bols" as a walk-in`
- `Clear the search`
- `15 in tonight.` (the `15` is VT323 22px inside `15px` Inter at `.72`)
- `Next: courts`

The typed query is interpolated into both the headline and the button, wrapped in straight double quotes.

### The one bold element
`Add "Bols" as a walk-in`. The lime `Next: courts` is a fill but is the step-forward action, not the answer to the empty state.

### Interactive controls
| Control | Behaviour |
|---|---|
| Search field | Live filter over tonight's roster. Empty result set renders this frame. |
| `Add "<query>" as a walk-in` | Create a tonight-only player from the raw query string, add to the confirmed list, clear the search, return to the populated roster list. Increments the footer count. |
| `Clear the search` | Empty the field and return to the full roster list. |
| `Next: courts` | Advance to frame 07 Courts. Remains enabled while the search is empty, since 15 players are already in. |

### Data required
- `query: string` (raw, preserved verbatim including case)
- `roster`: tonight's bookable players `{ id, name, isBooked }`, matched case-insensitively; the empty state fires when the match set is length 0
- `confirmedCount: 15` (players marked present tonight)
- Write path: `addWalkIn(name)` creating a player flagged **tonight only**, not added to the permanent roster

### Variants
- Non-empty result set: the normal roster list (frame 06), not this frame.
- Whitespace-only or empty query: show the full list, never this frame.
- Duplicate name already in tonight's list: not drawn. Flag.

### v1 difference
v1 24a centred the copy, carried a wizard step counter `2 of 4`, used the unquoted headline `No one called Sope on tonight's booking list.` and button `Add Sope as a walk-in`, and had no explainer, no `Clear the search`, no footer count and no forward CTA. v2 drops the step counter, left-aligns, and quotes the query.

---

## Frame 24b — Empty, court unassigned
v2 `1z` "25 Empty, court unassigned". v2 moves this out of setup and into the live court view.

### Layout
1. **Court switcher row**, `padding:14px 18px`, bottom divider, `display:flex; gap:10px`. Two tiles, each `flex:1`, radius 6, `padding:10px 12px`, column, `gap:2px`, name `16px/700` over status `13px/600`.
   - Inactive tile: `1px solid rgba(244,237,224,.18)`, transparent.
   - Active tile: `2px solid #F4EDE0`, fill `#D9E270`, text `#0A1810`.
2. **Body**, `flex:1`, `padding:28px 18px`, column, `gap:14px`, `align-items:flex-start`:
   - VT323 `64px`, `line-height:.9`: the assigned-player count, zero-padded
   - `20px/700`, `line-height:1.3` headline
   - `16px`, `line-height:1.45`, `.68`, `text-wrap:pretty` rationale, with the other court's headcount in VT323 20px
3. **Footer**, `padding:14px 18px`, top divider, `gap:10px`: status line `16px/600` then primary CTA at height `56px`.
4. **Tab bar** with `Match` active.

### Copy, exactly
- Tile 1: `Court 1` / `Mid-match`
- Tile 2 (active): `Court 2` / `Nobody assigned`
- `00`
- `Court 2 has nobody on it yet.`
- `Court 1 is carrying 16 players, so the bench is long. Move half of them over and both courts run at once.`
- `Court 2 is empty.`
- `Assign players to Court 2`
- Tabs: `Match`, `Players`, `Standings`

Court numbers and the headcount are interpolated. The CTA always names the specific court.

### The one bold element
The giant `00`. The lime CTA is the only fill in the lower half; the selected court tile is the only lime in the upper half.

### Interactive controls
| Control | Behaviour |
|---|---|
| Court tiles | Switch the active court. Selecting a court with players shows the normal court view (frame 10). |
| `Assign players to Court 2` | Open the assignment flow for that specific court, pre-scoped to the named court. |
| Tabs | Switch between Match, Players, Standings for the active court. |

### Data required
- `courts[]`: `{ courtNumber, assignedPlayerCount, statusLabel }` where `statusLabel` is one of the drawn strings (`Mid-match`, `Nobody assigned`) and the empty state fires on `assignedPlayerCount === 0`
- The **other** court's `assignedPlayerCount` (16) to compose the rationale sentence, and its bench size implicitly
- Active court id, active tab

### Variants
- More than two courts: the switcher row is a flex row of equal tiles; overflow behaviour is not drawn. Flag.
- Court has players: normal court view, not this frame.
- Rationale line: it asserts the other court is overloaded. When the other court is **not** overloaded there is no approved alternate sentence. Flag rather than inventing one.

### v1 difference
v1 24b was a setup-wizard frame: header `How many courts?` with step `3 of 4`, a dashed-border card reading `Court 3`, `No one on Court 3 yet.` and a generic ghost button `Assign players`. v2 relocates the state into the live court view, adds the switcher and tab bar, adds the bench rationale, and names the court in the CTA.

---

## Frame 25a — Error, score did not save
v2 `1aa` "26 Error, score would not save". v2 is a full screen, not a centred message.

### Layout
1. **Top bar**, `padding:14px 18px`, bottom divider, `space-between`: round indicator (uppercase `14px/700`, `.08em`, `rgba(244,237,224,.45)`, numerals VT323 20px) on the left, court name `17px/700` on the right.
2. **Body**, `flex:1`, `padding:20px 18px`, column, `gap:16px`:
   - **Error card**: `2px solid #EF4444`, radius 6, `padding:16px`, `gap:10px`. Headline `20px/700`, `line-height:1.3`, colour `#FF9382`. Sub-line `16px`, `line-height:1.45`, full-strength text.
   - **Queue card**: `1px` card border, radius 6, `padding:14px`, `gap:8px`. Eyebrow, then one row per queued result: `space-between`, `align-items:baseline`, label `16px/600` left, score pair VT323 `24px` right.
   - **Footnote** with `margin-top:auto`: `15px`, `line-height:1.45`, `rgba(244,237,224,.6)`.
3. **Footer**, `padding:14px 18px 20px`, top divider, `gap:10px`: queue count line then primary CTA.

### Copy, exactly
- `Round 2 of 3` (both numerals VT323)
- `Court 1`
- `The score did not save. This phone is offline.`
- `It is held on this phone and goes up as soon as there is signal. Keep scoring.`
- `Waiting to go up`
- `Court 1, match 5` — `21 14`
- `Court 2, match 4` — `21 09`
- `If the phone dies before signal returns, use Copy for WhatsApp at any point to get tonight out in plain text.`
- `2 results are queued.`
- `Try again now`

### The one bold element
The red-bordered error card. The lime `Try again now` is the only fill.

### Behaviour this frame commits you to
This is an **optimistic local queue**, not a failed write. The score is retained on device, the match card already shows the entered result, scoring continues while offline, and the queue drains automatically when signal returns. `Try again now` is a manual flush, not the only recovery path.

### Interactive controls
| Control | Behaviour |
|---|---|
| `Try again now` | Force a flush of the pending queue. On success the screen dismisses back to the court view. On failure it stays, with the queue unchanged. |
| Queue rows | Not drawn as interactive. Treat as read-only. |

### Data required
- `pendingWrites[]`: `{ courtNumber, matchNumber, scoreA, scoreB }`, ordered oldest first, rendered as `Court N, match M` and `AA BB` with both scores zero-padded to two digits
- `pendingWrites.length` for the footer line
- `connectivity`: online/offline flag driving whether this screen appears at all
- Active court `courtNumber`, current `round` and `roundsTotal` for the top bar
- Flush action returning per-item success/failure

### Variants
- Queue empty: this screen must not appear.
- Retry succeeds: dismiss to the court view; no success copy is drawn, flag it.
- Retry fails: remain on this screen unchanged; there is no approved secondary error string.
- Non-network save failure (server rejects the write): not drawn in either version. Flag; do not reuse the offline copy for it, since it names offline explicitly.

### v1 difference
v1 25a said the write was **lost**: `That score did not save.` / `The connection dropped mid save. The match card is unchanged.` with CTA `Tap the score again`. v2 reverses the model, the score is kept locally and syncs later. Build v2's behaviour.

---

## Frame 25b — Error, bookings did not load
v1 only, `25b`. v2 dropped it. Keep v1's copy verbatim, render it in v2's visual language.

### Layout
`flex:1` body, vertically centred, `padding:0 24px`, column, `gap:10px`. Left-aligned text per the v2 body pattern. Footer bar with top divider holding two stacked actions, `gap:10px`, primary first, secondary below.

### Copy, exactly
- `Tonight's bookings did not load.` (headline `20px/800`)
- `You can still run the night. Add everyone by name, or try the list again.` (`15px`, `line-height:1.5`, muted)
- `Try the list again` (primary, lime)
- `Add players by name` (secondary, `2px solid #F4EDE0`)

### The one bold element
The headline. Two actions of clearly different weight, and the fallback is genuinely offered, not buried.

### Interactive controls
| Control | Behaviour |
|---|---|
| `Try the list again` | Refetch tonight's bookings for the selected night. On success go to frame 06 Who is here with the list populated. |
| `Add players by name` | Enter the roster step with an empty list and the search field focused, so every player is added manually as a walk-in. The night is fully runnable from here. |

### Data required
- Bookings fetch state for the selected night: `{ status: 'error', nightId }`
- Manual-entry path that does not depend on the bookings fetch succeeding

### Variants
- Loading: not drawn.
- Fetch returns an empty list (succeeds but zero bookings): different from this frame, not drawn. Flag.

### v1 to v2 port note
v1 used the green accent for the primary and a `1.5px #5A6752` ghost border. Restyle to lime primary and `2px #F4EDE0` secondary, keep every word.

---

## Frame 26a — Confirm, void a result
v1 only, `26a`. Uses the shared bottom-sheet pattern with the destructive red top border.

### Layout
Scrim over the dimmed match list, sheet at the bottom: handle, title, consequence paragraph, destructive action, safe text action.

### Copy, exactly (v1)
- `Void this result?` (title, `17px/800`; render at v2's sheet title scale `22px/700` in `#FF9382`)
- `Ayo & Timi 16, Tumi & Hamid 09 is removed from the standings. All four return to the queue.` (`16px`, `line-height:1.45`)
- `Void the result` (destructive)
- `Keep it` (safe, tertiary text)

Both scores are zero-padded to two digits in the sentence.

### Pair naming note
v1 joins pair names with `&`. v2's language everywhere joins them with `and` (`Timi and Tumi`, `Chizea and Kayode`). Following v2, render `Ayo and Timi 16, Tumi and Hamid 09 is removed from the standings. All four return to the queue.` Flag the swap for copy sign-off rather than shipping both conventions.

### Flow note, one line
v2 folded voiding into frame 16 (Correct or void a result) as an inline red-bordered panel reading `Void this match` / `All four players go back into the queue and this match counts for nothing. Games played drops by one each.` / `Void it`, with no second confirm. If you follow v2 strictly, `Void it` in frame 16 is the destructive action and 26a never appears; keep 26a only if you decide a void needs two steps, and if so use the copy above.

### Interactive controls
| Control | Behaviour |
|---|---|
| `Void the result` | Remove the result. Standings recompute, all four players' `played` count decrements by one, all four return to the queue. Dismiss to the match list. |
| `Keep it` | Dismiss, no change. |
| Scrim tap / back | Same as `Keep it`. |

### Data required
- The target match: `{ matchId, courtNumber, matchNumber, pairA: [name, name], scoreA, pairB: [name, name], scoreB }`
- Void action returning recomputed standings and queue positions for the four players

### Variants
- Voiding a playoff match rather than a group match: not drawn. Flag.
- Void fails (offline): falls under the frame 25a queue model; not drawn separately.

---

## Frame 26b — Confirm, delete a playoff
v1 only, `26b`. Same sheet pattern as 26a.

### Copy, exactly
- `Delete the Court 1 playoff?`
- `The bracket and every playoff score on it are deleted. The night's standings are untouched.`
- `Delete the playoff` (destructive)
- `Keep the bracket` (safe, tertiary text)

The court number is interpolated into the title.

### The one bold element
The title. The reassurance clause (`The night's standings are untouched.`) is load-bearing and must not be trimmed.

### Interactive controls
| Control | Behaviour |
|---|---|
| `Delete the playoff` | Delete the bracket and every playoff match score for that court. Group standings and all group results remain. Return to the standings tab, where `Seed the playoff` becomes available again. |
| `Keep the bracket` | Dismiss, no change. |
| Scrim tap / back | Same as `Keep the bracket`. |

### Data required
- `courtNumber`
- Whether a bracket exists for that court, and the count of recorded playoff scores on it (the copy asserts scores are being destroyed, so the trigger should only be reachable when a bracket exists)
- Delete action scoped to playoff records only, leaving group results and standings intact

### Variants
- Bracket exists but no scores recorded yet: same sheet, copy unchanged (it holds either way).
- A playoff final already crowned a champion: not drawn. Flag, since deleting would also remove a champion that frames 22 and 23 display.

---

## Frame 26c — Confirm, end the night
v2 `1ab` "27 Confirmation, end the night". v2 is much richer than v1 and wins.

### Layout
1. **Dimmed backdrop**: the live screen at `opacity:.35`, `padding:16px 18px`, showing `Tonight` (`20px/700`) over two placeholder cards (heights `90px` and `150px`).
2. **Scrim**: `inset:0`, `rgba(244,237,224,.35)`.
3. **Sheet**, bottom-pinned, `#173724`, `border-top:2px solid #EF4444`, radius `10px 10px 0 0`, `padding:18px 18px 22px`, `gap:14px`:
   - grab handle
   - title `22px/700`, colour `#FF9382`
   - consequence paragraph `16px`, `line-height:1.45`, `text-wrap:pretty`
   - **kept/lost card**: `1px` card border, radius 6, `padding:14px`, `gap:6px`. Eyebrow `What is kept` in `.45`, then a `16px` line. Then eyebrow `What is lost` in **`#FF9382`** with `margin-top:6px`, then a `16px` line.
   - destructive button, height `58px`
   - safe button, height `50px`, **lime fill**, `18px/700`

### Copy, exactly
- `Tonight` (backdrop)
- `End the night?`
- `Court 2 still has its final to play. Ending now closes both courts and no more scores can be recorded.`
- `What is kept`
- `All 24 results, both standings, Court 1 champions`
- `What is lost`
- `The Court 2 final, unplayed`
- `End the night` (destructive, red outline)
- `Keep playing` (safe, lime fill)

### The one bold element
`Keep playing`. The weighting is deliberately inverted: the safe action is the only filled button on the screen, the destructive action is outline-only red. Build it exactly that way.

### Composed lines
The two ledger lines are computed, not fixed strings. From the markup:
- **Kept** = the total result count (`All 24 results`, count not zero-padded), plus each court's standings (`both standings` for two courts), plus champions already crowned (`Court 1 champions`), joined by commas.
- **Lost** = each unfinished item named specifically (`The Court 2 final, unplayed`).
- The consequence paragraph names the specific blocker (`Court 2 still has its final to play.`) then the universal consequence (`Ending now closes both courts and no more scores can be recorded.`).

These are the only approved phrasings. Where the ledger would be empty (nothing unfinished), no copy exists. Flag rather than inventing a "nothing is lost" line.

### Interactive controls
| Control | Behaviour |
|---|---|
| `End the night` | Close every court, freeze standings as they are, cancel unplayed matches, block all further score entry. The session summary (frame 23) stays reachable and copyable afterwards. |
| `Keep playing` | Dismiss, no change. |
| Scrim tap / back | Same as `Keep playing`. |

### Data required
- `resultsCount` (24) across all courts
- `courtsWithStandings` count, to render `both standings` vs a court-specific phrasing
- `championsByCourt`: crowned courts, for the kept line
- `unfinishedWork[]`: per court, whichever of `{ playoff final unplayed, semifinal unplayed, group matches remaining }` is outstanding, with the court number, to compose both the blocker sentence and the lost line
- Terminal action that sets the session to ended and makes all score entry read-only

### Variants
- Nothing unfinished: the blocker sentence and the entire `What is lost` half have no drawn copy. Flag.
- Already ended: this sheet must not be reachable.
- More than one unfinished item: only a single lost line is drawn. Multi-line handling is an open question, flag it.

### v1 difference
v1 26c read: `End Wednesday night?` / `Unplayed games are cancelled and the standings freeze as they are. The summary stays available to copy.` with three actions, a ghost `Copy for WhatsApp first`, then danger `End the night`, then `Keep playing`. v2 drops the day name from the title, drops the `Copy for WhatsApp first` escape hatch, replaces the generic consequence line with the computed kept/lost ledger, and moves the lime fill onto `Keep playing`. Follow v2 and do not reinstate the third button; the summary remains reachable after ending, so the escape hatch is redundant.

---

## Open items for copy sign-off
1. Session summary with no champions crowned yet: no approved empty copy.
2. Clipboard copy success feedback: none drawn anywhere.
3. Frame 26 (25a) non-network save failure: the approved copy names offline explicitly and cannot be reused.
4. Frame 24b rationale sentence when the other court is not overloaded: no alternate approved.
5. Frame 26a pair separator, `&` (v1) vs `and` (v2 language).
6. Whether voiding keeps v1's separate confirm sheet or uses v2's single inline `Void it`.
7. Frame 26c ledger when nothing is unfinished, and when more than one item would be lost.
