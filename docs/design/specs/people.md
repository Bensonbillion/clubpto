# Build spec: people slice

Frames 13 Players tab, 14 Late arrival, 15 Extend, 16 Correct or void a result.

Sources: `/Users/bensonbillions/clubpto/docs/design/manage-wireframes-v2-lime.html` (frames `#1n`, `#1o`, `#1p`, `#1q`) is authoritative. `/Users/bensonbillions/clubpto/docs/design/manage-wireframes-v1-green.html` (`#f13`, `#f14`, `#f15`, `#f16`, plus `26a`) supplies the confirm step v2 dropped and extra state detail. Every disagreement is flagged inline with one line.

---

## 0. Shared shell (applies to all four frames)

**Canvas:** 390 x 780, `box-sizing:border-box`, column flex.

**Tokens (v2 lime, these win):**

| Role | Value |
|---|---|
| Screen background | `#0E2418` |
| Sheet background | `#173724` |
| Scrim over dimmed content | `rgba(244,237,224,.35)` over content set to `opacity:.35` |
| Text primary | `#F4EDE0` |
| Text muted | `rgba(244,237,224,.55)` |
| Text muted-strong | `rgba(244,237,224,.6)` / `.68` / `.72` |
| Label muted (uppercase eyebrows) | `rgba(244,237,224,.45)` |
| Hairline / section divider | `1px solid rgba(244,237,224,.12)` |
| Card border | `1px solid rgba(244,237,224,.18)` |
| Pill border | `1px solid rgba(244,237,224,.2)` |
| Accent (primary button, score band, selected chip) | background `#D9E270`, text `#0A1810` |
| Danger border | `#EF4444` |
| Danger text | `#FF9382` |
| Selected outline | `2px solid #F4EDE0` |

**Type:** Inter (400/500/600/700/800) for all words. **VT323 monospace for every numeral that is a quantity** (games played, scores, counts, targets, match number). Numerals set in VT323 run larger than the words next to them (see per-frame sizes).

**Shape:** `border-radius:6px` on buttons, fields, cards. `999px` on status pills. Sheets are `border-radius:10px 10px 0 0` with `border-top:2px solid #F4EDE0`, `position:absolute;left:0;right:0;bottom:0`, padding `18px 18px 22px`, column flex `gap:14px`, and a grab handle at the top: `44px x 4px`, `border-radius:999px`, `background:rgba(244,237,224,.2)`, `align-self:center`.

**Primary button:** full width, height `56-58px`, `background:#D9E270`, `color:#0A1810`, `font-size:18-19px`, `font-weight:700`, centered.
**Secondary button:** full width, height `52-56px`, `border:2px solid #F4EDE0`, transparent background, `font-size:17-18px/700`.
**Tertiary (dismiss):** text only, height `50px`, centered, `font-size:17px/600`, `color:rgba(244,237,224,.6)`.

**Bottom tab bar** (frame 13 only in this slice): three equal cells, each `height:60px`, centered, `font-size:13px`, `font-weight:800`, `letter-spacing:.06em`, `text-transform:uppercase`, `border-top:3px solid transparent`. Labels exactly: `Match`, `Players`, `Standings`. Active cell gets `border-top:3px solid #F4EDE0` and full-opacity text; inactive cells `color:rgba(244,237,224,.45)`.

**Placeholder tokens in the wireframe** that must be bound to real values: `[[TIME_LEFT]]`, `[[MINUTES_PER_ROUND]]`.

---

## 1. Frame 13 — Players tab

Route: the `Players` tab of the live-night screen. Tab bar shows `Players` active.

### Copy, exactly

Header:
- `Players` (title)
- `16 in` (the `16` is the live count; the word `in` follows it)
- `Fewest games first, so whoever is owed a game is at the top.`

Row content, one per player: games-played number, name, status line, action pill. The seven rows drawn, verbatim, showing every status and pill combination that exists:

| games | name | status line | pill |
|---|---|---|---|
| `0` | `Fiyin` | `Not arrived` | `Mark arrived` |
| `1` | `Tumi` | `Here` | `Mark left` |
| `1` | `Kayode` | `Here` | `Mark left` |
| `2` | `Ade` | `On court now` | `Mark left` |
| `2` | `Timi` | `On court now` | `Mark left` |
| `2` | `Ayo` | `Here` | `Mark left` |
| `3` | `Tamilore` | `Left at [[TIME_LEFT]]` | `Mark here` |

Footer block:
- `Someone just walked in?`
- `Add a player` (primary button)

Tab bar: `Match` / `Players` / `Standings`.

### Layout

- **Header** `padding:14px 18px 10px`, bottom hairline, column `gap:8px`. First line is a baseline-aligned space-between row: `Players` at `20px/700` on the left, `16 in` on the right where `16` is VT323 `20px` and ` in` is `14px` in `rgba(244,237,224,.55)`. Second line is the helper at `14px` muted.
- **List** fills the remaining height, `overflow:hidden` in the wireframe; ship it scrollable (`overflow-y:auto`). Each row: `display:flex;align-items:center;gap:12px;padding:12px 18px`, bottom hairline `rgba(244,237,224,.08)`.
  - Games count is **first, on the left**: VT323 `28px`, fixed `width:28px`.
  - Middle block `flex:1`: name `17px/700`, status `14px` in `rgba(244,237,224,.55)`.
  - Action pill on the right: `14px/700`, `border:1px solid rgba(244,237,224,.2)`, `border-radius:999px`, `padding:7px 12px`.
- **Footer** `padding:14px 18px`, top hairline, column `gap:10px`: prompt line `16px/600`, then the lime `Add a player` button at `height:56px`, `18px/700`.
- **Tab bar** last, top hairline.

**The one bold element** is the lime `Add a player` button. Everything else is flat text on the dark ground. Second in weight is the column of VT323 game counts down the left edge, which is what makes "who is owed a game" readable at a glance.

**v1 difference:** v1 put the games number on the right, showed the pill on only some rows, prefixed every status with a tier (`Tier C · Here`, `Not assessed · Here`, `Not assessed · Arrived late`), read `15 in`, used the CTA `Add a walk-in`, and used the shorter helper `Whoever is owed a game is at the top.` Follow v2 on all of these: number left, pill on every row, no tier in the status line, `Add a player`.

### Interactive controls

| Control | Behaviour |
|---|---|
| `Mark arrived` pill (status `Not arrived`) | Marks the player present for tonight. Row status becomes `Here`, pill becomes `Mark left`. Row re-sorts if the sort key changed (it does not; games played stays as is). |
| `Mark left` pill (status `Here` or `On court now`) | Marks the player gone. Row status becomes `Left at HH:MM` stamped at the moment of the tap, pill becomes `Mark here`. |
| `Mark here` pill (status `Left at ...`) | Un-does a departure and returns the player to `Here`, back in the queue. |
| `Add a player` | Opens frame 14. |
| `Match` / `Players` / `Standings` tabs | Switch tab. `Players` is current. |
| Row body | No tap target is drawn on the row body. Do not add one. |

### Data needed

- `attendanceCount: number` for the `N in` chip. The wireframe shows `16` above a list that includes a not-arrived and a departed player, so this is **the number of players currently present**, not the row count. Confirm the definition with the backend before shipping; the wireframe does not settle it.
- `players: Array<{ id, displayName, gamesPlayed: number, status: 'not_arrived' | 'here' | 'on_court' | 'left', leftAt?: ISO timestamp }>` for every player attached to tonight, including not-arrived and departed.
  - `gamesPlayed` is completed matches for that player tonight, integer, rendered in VT323.
  - `status: 'on_court'` renders `On court now` and is distinct from `here` in the copy but takes the **same** pill (`Mark left`).
  - `leftAt` is required whenever `status === 'left'`; it fills `[[TIME_LEFT]]` as a wall-clock time.
- **Sort:** `gamesPlayed` ascending. The frame label in v1 states it outright: `sorted by games played, fewest first`. Tie order must be stable across re-renders so rows do not jump when a score lands. The wireframe does not specify the tiebreak; pick one (arrival order) and keep it deterministic.
- Mutations: `markArrived(playerId)`, `markLeft(playerId)`, `markHere(playerId)`. Each returns the updated player plus a refreshed `attendanceCount`.
- **Unresolved and load-bearing:** the wireframe offers `Mark left` on a player whose status is `On court now` and says nothing about the match in progress. The backend must define whether that forfeits, voids, or blocks. Do not guess in the UI without copy for it.

### Empty, loading, error

- **Empty:** not drawn in either file. A Players tab with zero players is reachable only before setup completes, and no frame covers it. Do not invent copy; raise it.
- **Loading:** not drawn.
- **Error:** not drawn for these three mutations. The only error frame in the set (v2 `26 Error, score would not save`) covers score writes, not attendance writes. If attendance writes can fail offline, the pattern to copy is that frame's held-on-phone treatment, but it needs its own copy written.

---

## 2. Frame 14 — Late arrival

Reached from `Add a player` on frame 13. Full screen, not a sheet.

### Copy, exactly

Top bar:
- `Cancel` (left)
- `Add a player` (title, right of Cancel)

Body:
- `Name` (uppercase field label)
- `Hamid` (the value typed or picked; this is data, not fixed copy)
- `Found in the roster. Marked here for tonight.`
- `Court` (uppercase field label)
- `Court 1` with `8 playing`
- `Court 2` with `7 playing`
- `Hamid joins the Court 2 queue and is in the next match. He gets one back-to-back to catch up, and starts on 0 games played.`

Footer:
- `Nothing already played changes.`
- `Add Hamid to Court 2` (primary button)

The explanation sentence and the button label are both templated on the entered name and the selected court. Template them as: `{name} joins the {court} queue and is in the next match. He gets one back-to-back to catch up, and starts on {0} games played.` and `Add {name} to {court}`. The pronoun `He` is hardcoded in the wireframe; replace it with a name-safe rewrite (`They get one back-to-back to catch up`) rather than shipping a gendered guess, and flag the copy change.

### Layout

- **Top bar** `padding:14px 18px`, bottom hairline, `display:flex;align-items:center;justify-content:space-between`: `Cancel` at `16px/600`, title `Add a player` at `17px/700`. There is no right-side action.
- **Body** `flex:1`, `padding:20px 18px`, column `gap:16px`.
  - Name group, column `gap:8px`: label `14px/700`, `letter-spacing:.06em`, uppercase, `rgba(244,237,224,.45)`. Field `height:52px`, `border:2px solid #F4EDE0`, `border-radius:6px`, `padding:0 14px`, value `18px/600`. The 2px cream border is the focused state; this field is focused on entry with the keyboard up. Helper under it at `14px` muted.
  - Court group, column `gap:8px`: same uppercase label, then a two-up row `gap:10px` of equal-width cards, each `padding:14px`, `border-radius:6px`, column `gap:2px`: court name `17px/700`, then the count line where the number is VT323 `19px` and the word `playing` is `14px`.
    - Unselected card: `border:1px solid rgba(244,237,224,.18)`, count line `rgba(244,237,224,.55)`.
    - Selected card: `border:2px solid #F4EDE0`, `background:#D9E270`, `color:#0A1810`.
  - Consequence paragraph sits under a top hairline with `padding-top:16px`, `font-size:16px`, `line-height:1.45`, `text-wrap:pretty`. The `0` in `0 games played` is VT323 `20px`.
- **Footer** `padding:14px 18px 20px`, top hairline, column `gap:10px`: reassurance line `15px` at `rgba(244,237,224,.72)`, then the lime button `height:58px`, `19px/700`.

**The one bold element** is the lime `Add Hamid to Court 2` button, with the selected lime court card echoing it. Secondary is the consequence paragraph, which is deliberately full-size body text (16px) rather than fine print, because it is the thing that stops a bad tap.

**v1 difference:** v1 was a bottom sheet titled `Add a walk-in` with a `Which court` label, chips reading `Court 1 · 8` and `Court 2 · 7`, and a different promise: `Nkem joins the Court 2 queue and gets the next open game. Nobody loses a match.` v2 replaces this with the back-to-back catch-up wording and adds `Nothing already played changes.` Follow v2, including the full-screen treatment and the `Cancel` affordance.

### Interactive controls

| Control | Behaviour |
|---|---|
| `Cancel` | Dismisses without adding. Returns to frame 13. |
| Name field | Text input, focused on open. Typing looks the name up against tonight's roster and drives the helper line under it. |
| Court card (one per active court) | Radio behaviour, exactly one selected. Selecting re-renders the consequence paragraph and the button label with the new court. |
| `Add {name} to {court}` | Commits. Adds the player to that court's queue at 0 games played, slots them into the next match, and grants one back-to-back. Dismisses to frame 13, where the new player appears at the top of the list with `0`. |

Disabled state: the button must be inert until a name is entered and a court is selected. Not drawn; use `opacity` reduction on the lime fill rather than a new colour.

### Data needed

- `roster` lookup by typed name: whether the typed string matches a player on tonight's booking list, and the matched player's id. Drives the helper `Found in the roster. Marked here for tonight.`
- `courts: Array<{ courtNumber, label: 'Court 1' | 'Court 2' | ..., playingCount: number }>` where `playingCount` is the number of players currently attached to that court (the wireframe shows `8` and `7`). Two courts are drawn; the layout is a flex row, so three courts must still fit or wrap.
- Default selection: the wireframe preselects `Court 2`, the court with the **lower** playing count. Implement as "preselect the court with the fewest players; break ties by lowest court number".
- Mutation `addPlayerToCourt({ playerId | walkInName, courtNumber })` returning the updated players list and the updated court queue. Server side it must: start the player at `gamesPlayed = 0`, place them in the next match on that court, allow exactly one back-to-back for catch-up, and leave all completed matches and their standings untouched.

### Empty, loading, error

- **Name not in roster:** not drawn on this frame. The equivalent state exists on a different screen, v2 frame `24 Empty, roster search`, whose copy is `Nobody in the roster matches "Bols".` / `Walk-ins are normal. Add the name and they play tonight only.` / button `Add "Bols" as a walk-in` / `Clear the search`. Reuse that wording pattern here for the helper and the confirm, but note it is borrowed from frame 24 and needs sign-off, since frame 14's own helper (`Found in the roster. Marked here for tonight.`) has no drawn counterpart.
- **Loading:** not drawn. The court cards need real `playingCount` values; render them only once the counts resolve.
- **Error:** not drawn.

---

## 3. Frame 15 — Extend

A bottom sheet over the Court view (frame 10). The content behind it is the court screen at `opacity:.35` under a `rgba(244,237,224,.35)` scrim.

### Copy, exactly

- `Add a round?`
- `Everyone on Court 1 gets one more match.`
- `Target now` / `3`
- `Target after` / `4`
- `Court 2 is untouched. About [[MINUTES_PER_ROUND]] more minutes.`
- `Add the round` (primary button)
- `Leave it at three` (dismiss)

`Court 1` and `Court 2` are the acting court and the other court. `Leave it at three` spells the current target as a word, so it must be generated from `targetNow` (`Leave it at four`, and so on).

### Layout

- Behind: dimmed court screen. In the wireframe this is `Court 1` at `20px/700` plus two empty bordered blocks (200px and 120px tall). Real implementation just dims the live court view.
- Sheet, bottom-anchored, `#173724`, `border-top:2px solid #F4EDE0`, radius `10px 10px 0 0`, padding `18px 18px 22px`, column `gap:14px`:
  1. Grab handle.
  2. Title `Add a round?` at `22px/700`.
  3. Explanation `Everyone on Court 1 gets one more match.` at `17px`, `line-height:1.45`. This is body-size, not fine print.
  4. A two-row ledger, column with no gap:
     - Row 1: `border-top:1px solid rgba(244,237,224,.12)`, `padding:12px 0`, baseline space-between. Left `Target now` at `16px` in `rgba(244,237,224,.6)`, right the value in VT323 `28px`.
     - Row 2: same, plus `border-bottom:1px solid rgba(244,237,224,.12)`. Left `Target after`, right the value in VT323 `28px`.
  5. Caveat line at `15px`, `rgba(244,237,224,.6)`, `line-height:1.4`.
  6. Lime `Add the round`, `height:58px`, `19px/700`.
  7. `Leave it at three`, `height:50px`, `17px/600`, `rgba(244,237,224,.6)`.

**The one bold element** is the lime `Add the round`. The second-loudest thing is the VT323 `3` to `4` pair in the ledger, which is the whole decision expressed as two numbers.

**v1 difference:** v1 titled it `Add one more round`, carried no numeric ledger, explained it in prose (`The target moves from 4 to 5 for the 8 players on this court. Standings keep counting as normal.`), and dismissed with `Not now`. v2 replaces the prose with the `Target now` / `Target after` ledger and the `Court 2 is untouched` caveat, and changes the dismiss to `Leave it at three`. Follow v2. Keep v1's fact that the change applies only to the players on this court; v2 encodes it as `Everyone on Court 1` plus `Court 2 is untouched`.

### Interactive controls

| Control | Behaviour |
|---|---|
| `Add the round` | Raises this court's target games per player by exactly 1 and schedules the extra round for everyone on that court. Sheet dismisses back to the court view, whose round counter header (`Round 2 of 3`) becomes `Round 2 of 4`. |
| `Leave it at {targetNow as word}` | Dismisses, no change. |
| Scrim / grab handle drag-down | Same as dismiss. |

There is no stepper. The sheet adds one round per confirmation, and only one.

### Data needed

- `courtNumber` and label of the acting court (`Court 1`).
- `targetNow: number`, the current target matches per player on that court.
- `targetAfter: number`. It is always `targetNow + 1`; render it, do not make the user compute it.
- Label of every other running court for the caveat sentence (`Court 2 is untouched`). With more than two courts this sentence must pluralise; the wireframe only covers the two-court case, so the multi-court wording needs writing.
- `minutesPerRound: number` to fill `[[MINUTES_PER_ROUND]]`, an estimate of added wall-clock time for one more round on this court.
- v1 additionally showed the headcount on the court (`the 8 players on this court`). v2 does not render it, so it is not required, but the mutation still needs it server side.
- Mutation `extendCourt({ courtNumber })` which increments only that court's target and regenerates only that court's remaining schedule. Standings keep counting as normal (v1 states this explicitly; v2 drops the line).

### Empty, loading, error

- Not drawn. The sheet has no empty case. If `minutesPerRound` is unavailable, the caveat sentence must degrade to `Court 2 is untouched.` alone rather than printing an empty placeholder.
- Nothing covers "the night is nearly over" or "this court has already finished". Both are plausible reasons to hide the entry point instead of showing this sheet.

---

## 4. Frame 16 — Correct or void a result

A bottom sheet over a list of already-played matches. The background drawn in v2 is a screen headed `Court 1 · played` with three stacked 70px result cards at `opacity:.35`, under the same `rgba(244,237,224,.35)` scrim. That implies a played-matches list on the court screen, and this sheet opens by tapping one of its rows. The list itself is not specified in either file beyond that header string.

### Copy, exactly

- `Court 1 · played` (the dimmed background header)
- `Match 4, Court 1` (sheet title; `4` in VT323)
- `Chizea and Kayode` (side A)
- `21` / `14` (the two scores)
- `Tamilore and Tumi` (side B)
- `Change the score` (secondary button)
- `Void this match` (danger block heading)
- `All four players go back into the queue and this match counts for nothing. Games played drops by one each.`
- `Void it` (danger button)

Pair names join with the word `and`, not an ampersand. v1 used `&`; v2 uses `and` and v2 wins. This matches the court view (`Ade and Timi`).

### Layout

Sheet, same chrome as frame 15 (`#173724`, 2px cream top border, radius `10px 10px 0 0`, padding `18px 18px 22px`, column `gap:14px`, grab handle first).

1. Title `Match 4, Court 1` at `22px/700`, with the match number in VT323 `26px`.
2. **Result card**, `border:1px solid rgba(244,237,224,.18)`, `border-radius:6px`, `overflow:hidden`, three bands:
   - Side A name, `padding:12px 14px`, `17px/700`.
   - Score band: `display:grid;grid-template-columns:1fr 1px 1fr`, `background:#D9E270`. Each cell centers a VT323 `56px` numeral at `line-height:.9` in `#0A1810`, `padding:6px 0`. The 1px middle column is `rgba(10,24,16,.28)`.
   - Side B name, same as side A.
   This is a smaller restatement of the score band from the court view, which uses the same lime block at 96px. The lime block is what makes the card read as "the recorded result", so keep it lime even here.
3. `Change the score`, secondary style: `height:56px`, `border:2px solid #F4EDE0`, `18px/700`.
4. **Danger block**, `border:1px solid #EF4444`, `border-radius:6px`, `padding:14px`, column `gap:8px`:
   - `Void this match` at `17px/700` in `#FF9382`.
   - Consequence paragraph at `15px`, `line-height:1.45`, in normal cream (not red, not muted).
   - `Void it` button: `height:52px`, `border:2px solid #EF4444`, transparent fill, `17px/700`, `#FF9382`.

**The one bold element** is the lime score band, because the first job of this sheet is to let the user confirm they are looking at the right match. There is no lime button here on purpose: the two actions are a cream outline and a red outline, so neither reads as the happy path. Secondary is the danger block, boxed off so the destructive action cannot be hit while aiming for `Change the score`.

**v1 difference:** v1 labelled the sheet `Round 1 · Court 1` rather than by match number, laid the result out as one horizontal row (`Ayo & Timi  16 09  Tumi & Hamid`) with no lime band, used the button labels `Change the score` and `Void this result`, and put the consequence in muted fine print below both buttons: `Voiding removes this game from the standings and returns Ayo, Timi, Tumi and Hamid to the queue.` v2 wins: match-numbered title, stacked lime score card, boxed danger block, `Void this match` / `Void it`, and the consequence promoted to full-size text inside the box.

### Confirm step (from v1 frame `26a`, which v2 dropped)

`Void it` opens a second, smaller sheet before anything is destroyed. Copy, exactly, from v1:

- `Void this result?`
- `Ayo & Timi 16, Tumi & Hamid 09 is removed from the standings. All four return to the queue.`
- `Void the result` (danger button, filled)
- `Keep it` (dismiss, `15px/600`, centered, `min-height:44px`)

Ship it with v2's visual language: `#173724` sheet on a scrim, red-bordered filled danger button, `Keep it` as muted centered text. Convert the ampersands to `and` for consistency with v2 (`Ayo and Timi 16, Tumi and Hamid 09 is removed from the standings. All four return to the queue.`) and flag the change. The body sentence is templated from the two pair names and the two scores.

Do not skip this step. v2 shows the void action but never shows what happens after the tap, and v1 is explicit that a confirmation stands between the tap and the deletion.

### Interactive controls

| Control | Behaviour |
|---|---|
| Row in the dimmed `Court 1 · played` list | Opens this sheet for that match. |
| `Change the score` | Opens the score entry flow (frame 11) preloaded with this match, so the existing score can be overwritten. Saving returns here or to the played list. |
| `Void it` | Opens the `Void this result?` confirmation. Nothing is changed yet. |
| `Void the result` (confirm) | Commits the void. The match is removed from standings, all four players return to the queue, and each of their `gamesPlayed` decrements by 1. Both sheets close. |
| `Keep it` (confirm) | Closes the confirmation, returns to this sheet, nothing changed. |
| Scrim / handle drag | Dismisses the sheet with no change. |

### Data needed

- `match: { id, matchNumber: number, courtNumber: number, sideA: { players: string[] }, sideB: { players: string[] }, scoreA: number, scoreB: number, status: 'played' }`. `matchNumber` is the per-night match number used in the title (`Match 4`), not a round number. v1 used the round number instead; v2 needs the match number, so the backend must expose it.
- Pair display strings are the two player names joined by ` and `. Both sides are exactly two players.
- Scores render as two-digit VT323 values (`21`, `14`, `09`). Zero-pad single digits, matching `09` in both files.
- For the confirmation body: the same four names and two scores.
- Mutation `updateMatchScore({ matchId, scoreA, scoreB })` and mutation `voidMatch({ matchId })`. `voidMatch` must, atomically: remove the result from standings, decrement `gamesPlayed` by 1 for all four players, and return all four to their court's queue. The UI states all three effects, so all three must actually happen or the copy is a lie.
- The dimmed background list needs `matchesPlayed` for the court: id, match number, both pair names, both scores, in play order.

### Empty, loading, error

- **Empty:** implied by the background. A court with no completed matches has an empty `Court 1 · played` list and no way to reach this sheet. No copy is drawn for that empty list. It needs writing.
- **Loading:** not drawn.
- **Error:** no failure copy exists for a void or a score correction. The nearest precedent is v2 frame `26 Error, score would not save`, which holds writes on the phone and shows a `Waiting to go up` queue with a `Try again now` button. A void is destructive and should not be optimistically applied under that pattern without new copy; treat a failed void as a hard error and leave the match untouched.

---

## 5. Cross-frame notes for the implementer

1. **Numerals are the design.** Every count, score, target, and match number is VT323 and is set noticeably larger than the Inter text beside it. Getting this wrong flattens all four frames.
2. **One lime element per screen, maximum.** Frame 13: the `Add a player` button. Frame 14: the primary button plus the selected court card. Frame 15: `Add the round`. Frame 16: the score band, and no lime button at all.
3. **Consequence copy is body text, not fine print.** Frames 14, 15, and 16 each carry a sentence at 15px to 17px explaining what the tap will do. v1 set these muted and small; v2 promoted them. Keep them promoted.
4. **No em dashes anywhere in this copy.** The wireframes comply; separators are `·` or plain commas. Keep it that way through implementation, per the house voice rule.
5. **Every destructive or scheduling action names its scope.** `Court 2 is untouched.` `Nothing already played changes.` `Games played drops by one each.` These lines are load-bearing, not decoration. Do not trim them for space.
