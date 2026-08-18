# Build spec — slice `play`

Frames **10 Court view**, **11 Score entry**, **12 Court switcher**.

Source of truth: `/Users/bensonbillions/clubpto/docs/design/manage-wireframes-v2-lime.html` (anchors `#1k`, `#1l`, `#1m`). Earlier pass `/Users/bensonbillions/clubpto/docs/design/manage-wireframes-v1-green.html` (anchors `#f10`, `#f11`, `#f12`) consulted for state detail only; every v2/v1 conflict is called out inline with the v2 version winning.

These are the three frames of **Job 2, Score the games**. The whole slice exists to make one thing fast: two taps to record a result while standing courtside holding a phone in one hand.

---

## 0. Shared shell (applies to all three frames)

### 0.1 Canvas

Fixed phone viewport, no page scroll. `width: 390px; height: 780px; box-sizing: border-box; display: flex; flex-direction: column;` Four bands stacked top to bottom:

1. header band (round + court, OR the court strip on frame 12)
2. body, `flex: 1`, `padding: 16px 18px`, `display:flex; flex-direction:column; gap:14px`, **`overflow: hidden`** on frame 10
3. action bar, `padding: 14px 18px`, `border-top: 1px solid rgba(244,237,224,.12)`, column, `gap: 10px`
4. tab bar

### 0.2 Tokens (v2 lime)

| Role | Value |
|---|---|
| Ground | `#0E2418` |
| Text | `#F4EDE0` |
| Accent (lime) | `#D9E270` |
| Ink on accent | `#0A1810` |
| Sheet ground | `#173724` |
| Hairline | `rgba(244,237,224,.12)` |
| Card border | `rgba(244,237,224,.18)` |
| Muted text | `rgba(244,237,224,.45)` / `.5` / `.6` / `.68` |
| Error border / error text | `#EF4444` / `#FF9382` |
| Radius | `6px` cards + buttons, `999px` chips, `10px 10px 0 0` sheets |

Type: **Inter** for all words (400/500/600/700/800). **VT323 monospace for every numeral** — round numbers, scores, keypad digits, queue counts. Playfair Display does not appear in this slice.

> Note for the implementer: the repo `CLAUDE.md` design system (sharp corners, gold `#C9A84C`) governs the **public marketing site**. This is the `/manage` tool and it has its own system — lime accent, 6px radii. Build to the wireframe, not to the public-site rules.

### 0.3 Bottom tab bar (identical on frames 10 and 12; absent on 11)

`display:flex; border-top: 1px solid rgba(244,237,224,.12)`. Three equal tabs, each `flex:1; height:60px`, centered, `font-size:13px; font-weight:800; letter-spacing:.06em; text-transform:uppercase`.

Copy, exactly and in order: **`Match`** · **`Players`** · **`Standings`**

- Active tab: `border-top: 3px solid #F4EDE0`, text at full opacity.
- Inactive tab: `border-top: 3px solid transparent`, `color: rgba(244,237,224,.45)`.
- On all three frames of this slice, `Match` is the active tab.

### 0.4 Round header (frames 10 and 11)

`padding:14px 18px; border-bottom:1px solid rgba(244,237,224,.12); display:flex; align-items:center; justify-content:space-between`.

- Left: **`Round 2 of 3`** — `font-size:14px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:rgba(244,237,224,.45)`, with the two numerals (`2`, `3`) rendered in **VT323 at 20px** inside the otherwise-Inter line.
- Right: **`Court 1`** — `font-size:17px; font-weight:700`, full-opacity text.

> v1 difference: v1 showed `Round 1 of 4`; the numerals were plain Inter, not VT323. Follow v2.

### 0.5 Copy rules observed across the slice

- Pair labels join with the **word** "and": `Ade and Timi`, `Ayo and Tumi`. (v1 used `&` — v2 wins, spell it out.)
- Sentences end in a period, including the short helper lines.
- No em dashes anywhere. `Mid-match` is hyphenated.
- `[[PLAYER_10]]`, `[[PLAYER_11]]`, `[[PLAYER_12]]`, `[[POINTS_PER_GAME]]` are unresolved wireframe tokens, not copy. Never ship the brackets.

---

## 1. Frame 10 — Court view

The home screen of the night. It is on screen more than any other frame. One bold thing: **the score slat**.

### 1.1 Layout, top to bottom

**Header** — the shared round header (§0.4). Left `Round 2 of 3`, right `Court 1`.

**Body** (`flex:1`, `padding:16px 18px`, `gap:14px`, `overflow:hidden`):

**A. Match card** — the hero. `border: 1px solid rgba(244,237,224,.18); border-radius: 6px; overflow: hidden`. Three horizontal bands:

1. *Side A row* — `padding:16px 18px; display:flex; align-items:center; justify-content:space-between`.
   - Left: **`Ade and Timi`** at `font-size:22px; font-weight:700`.
   - Right: **`Side A`** at `font-size:13px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:rgba(244,237,224,.4)`.
2. *Score slat* — `display:grid; grid-template-columns: 1fr 1px 1fr; background:#D9E270`. Each of the two number cells is `display:flex; align-items:center; justify-content:center; padding:10px 0`, containing a span at **VT323, `font-size:96px`, `line-height:.9`, `color:#0A1810`**, reading **`00`**. The middle 1px column is `background: rgba(10,24,16,.28)`.
3. *Side B row* — mirror of band 1: **`Ayo and Tumi`** + **`Side B`**.

The slat is lime-filled with dark numerals — it is the brightest object on the screen and the only place the accent appears at size on this frame.

> v1 difference: v1's slat was the inverse (near-black ground `#0B0F0A`, cream numerals at 108px), team names were centered at 30px, and there were no `Side A` / `Side B` labels at all. v2 wins on all three.

**B. Waiting block** — `display:flex; flex-direction:column; gap:8px`.

- Section label: **`Waiting`** — `font-size:13px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:rgba(244,237,224,.45)`.
- Chip row: `display:flex; flex-wrap:wrap; gap:7px`. Each chip: `font-size:16px; font-weight:600; border:1px solid rgba(244,237,224,.2); border-radius:999px; padding:8px 13px`. Four chips drawn: **`Fiyin`**, then three unresolved tokens.
  - **The three token chips are drawn at `rgba(244,237,224,.55)` only because they are unresolved `[[PLAYER_nn]]` placeholders — that dimming is NOT a player state.** Render every waiting chip identically at full text opacity.
- Helper line under the chips: **`All four are on next.`** — `font-size:14px; color:rgba(244,237,224,.5)`.

**C. Action bar** (`padding:14px 18px; border-top:1px solid rgba(244,237,224,.12); gap:10px`):

- Instruction: **`Tap the winning side to score.`** — `font-size:16px; font-weight:600; line-height:1.35`.
- Two side-by-side buttons, `display:flex; gap:10px`, each `flex:1; height:56px; border:2px solid #F4EDE0; border-radius:6px`, centered text at `font-size:17px; font-weight:700`. Labels are the two pair names verbatim: **`Ade and Timi`** and **`Ayo and Tumi`**.

**D. Tab bar** — §0.3, `Match` active.

> v1 difference: v1 had the instruction sentence but **no** winner buttons (the side rows themselves were the targets) and no `All four are on next.` line. v2 wins: ship the explicit two-button picker. Making the card's side rows *also* tappable is harmless and matches v1's intent, but the buttons are the drawn affordance and must exist.

### 1.2 Interactive controls

| Control | Behavior |
|---|---|
| Winner button, Side A (`Ade and Timi`) | Marks side A winner, opens Frame 11 with side B as the score subject. |
| Winner button, Side B (`Ayo and Tumi`) | Marks side B winner, opens Frame 11 with side A as the score subject. |
| Tab `Players` | Route to frame 13 (other slice). |
| Tab `Standings` | Route to frame 17 (other slice). |
| Waiting chips | **Not interactive.** No tap affordance is drawn in either pass. Do not wire them. |
| Court label in the header | **Not interactive on this frame.** Court switching lives on frame 12's strip. |

### 1.3 Data required

- `session.currentRound: number` and `session.totalRounds: number` — totalRounds comes from the matches-per-player choice made on frame 08.
- `activeCourt: { number: number, label: string }` — label rendered as `Court {n}`.
- `activeCourt.currentMatch`: `{ matchId, sideA: { pairLabel: string, playerIds: string[] }, sideB: { pairLabel, playerIds }, scoreA: number|null, scoreB: number|null }`. `pairLabel` is the two names joined with ` and `. Scores render **two-digit zero-padded** in the slat; a match with no result yet reads `00` / `00`. No live in-progress score is ever shown — the slat only ever holds a recorded result or `00`.
- `activeCourt.waiting: Array<{ playerId, name, isOnNext: boolean }>` in queue order — display order must equal queue order.
- The helper sentence is derived, not stored: it states how many of the waiting players are in the next match (`All four are on next.` when every waiting player is in the next draw). Backend must expose enough to compute it — i.e. the composition of the next match on this court, or an `isOnNext` flag per waiting player.

### 1.4 Empty / loading / error variants

- **Empty (court has nobody on it):** drawn as frame 25 in the States group, which another slice owns. Its copy, for cross-reference: `Court 2 has nobody on it yet.` / `Court 1 is carrying 16 players, so the bench is long. Move half of them over and both courts run at once.` / footer `Court 2 is empty.` + lime button `Assign players to Court 2`. That frame reuses this slice's court strip and tab bar, so build them as shared components.
- **Loading:** no loading frame is drawn for the court view in either pass. Do not invent a spinner screen; the shell (header, tabs) should render immediately with the match card as the only late-filling region.
- **Error:** see §2.5.

---

## 2. Frame 11 — Score entry (second of two taps)

A bottom sheet over a frozen court view. One bold thing: **the winner card, lime-filled**. Everything behind it recedes.

### 2.1 Layout

**Header** — the same round header as frame 10, wrapped in **`opacity: .35`**.

**Body** (`flex:1; padding:16px 18px; gap:14px`) — the match card is replaced by two stacked result cards:

1. *Winner card*: `border:2px solid #F4EDE0; border-radius:6px; background:#D9E270; color:#0A1810; overflow:hidden`. Inner row `padding:14px 18px; display:flex; align-items:center; justify-content:space-between`:
   - Left: **`Ade and Timi`** at `font-size:22px; font-weight:700`.
   - Right: **`Winner`** at `font-size:13px; font-weight:800; letter-spacing:.08em; text-transform:uppercase`.
2. *Loser card*: `border:1px solid rgba(244,237,224,.14); border-radius:6px; padding:14px 18px; opacity:.4`, containing **`Ayo and Tumi`** at `font-size:22px; font-weight:700`.

**Scrim**: `position:absolute; inset:0; background: rgba(244,237,224,.35)`. Note this is a **cream wash, not a dark dim** — the frame lightens behind the sheet.

> v1 difference: v1 dimmed with near-black `rgba(4,7,3,.62)`, kept the big score slat visible showing `16` against a dimmed `00`, and labeled the banner `Winners` (plural). v2 wins: cream wash, no slat, singular `Winner`.

**Sheet**: `position:absolute; left:0; right:0; bottom:0; background:#173724; border-top:2px solid #F4EDE0; border-radius:10px 10px 0 0; padding:18px 18px 22px; display:flex; flex-direction:column; gap:14px`.

- Grab handle: `width:44px; height:4px; border-radius:999px; background:rgba(244,237,224,.2); align-self:center`.
- Title: **`How many did Ayo and Tumi get?`** — `font-size:20px; font-weight:700`. The name interpolated is always the **losing** pair.
- Keypad: `display:grid; grid-template-columns: repeat(4, 1fr); gap:10px`. Eight keys, each `height:66px; border:1px solid rgba(244,237,224,.18); border-radius:6px`, centered.
  - Keys 1–7: **VT323 at `font-size:38px`**, labels **`0` `1` `2` `3` `4` `5` `6`** (single digit, not zero-padded).
  - Key 8: **`More`** at `font-size:14px; font-weight:700; color:rgba(244,237,224,.55)`.
- Helper: **`One tap records it and draws the next match.`** — `font-size:15px; color:rgba(244,237,224,.6); line-height:1.4`.

> v1 difference: v1's sheet was titled `What did Tumi & Hamid score?`, carried a second line `One more tap records it. Games run to [[POINTS_PER_GAME]].`, offered a full 4×4 grid of zero-padded keys `00`–`15` with no `More` key, and closed with `The next match is already on screen when this closes.` v2 wins: shorter title, 0–6 plus `More`, one helper line, and the points-per-game sentence is dropped.

### 2.2 Interactive controls

| Control | Behavior |
|---|---|
| Keys `0`–`6` | One tap commits the whole result: winner's score is the session's points-per-game, loser's score is the tapped digit. Sheet closes, court view reappears already showing the next match. No confirm step, no save button. |
| `More` | Reveals the remaining scores above 6, up to points-per-game. **The expanded state is not drawn in v2.** v1's earlier pass showed the full zero-padded `00`–`15` grid, so implement `More` as swapping the 8-key pad for the full `0…[[POINTS_PER_GAME]]` range in the same 4-column grid. Flagged as inference, not drawn copy. |
| Grab handle | Sheet is drag-dismissible. |
| **Open question** | No Cancel button and no scrim-tap dismissal is drawn. Decide whether tapping the cream scrim returns to frame 10 with the winner selection discarded. Not specified by either pass. |

### 2.3 Data required

- Client state from the frame 10 tap: `winnerSide: 'A' | 'B'`.
- `winnerPairLabel` and `loserPairLabel` (the loser's is what the title interpolates).
- `pointsPerGame: number` — sizes the `More` expansion and supplies the winner's score. This is a session setting, not a per-match value.
- `matchId` and `courtNumber` for the write.
- The write response must return **the next match for that court** (players, side assignments) plus the refreshed waiting queue, because the copy promises the next match is already drawn when the sheet closes. A round trip that leaves the court view blank breaks the frame's stated behavior.

### 2.4 Success behavior

Sheet closes, frame 10 re-renders with the new match, slat back to `00` / `00`, waiting queue updated, `Round n of m` advanced when the round rolls over.

### 2.5 Error variant

Frame 26 in the States group covers a failed save. That frame is another slice's build, but this slice triggers it, so its exact copy for cross-reference:

- Error card (2px `#EF4444` border): headline **`The score did not save. This phone is offline.`** in `#FF9382` at `font-size:20px; font-weight:700`; body **`It is held on this phone and goes up as soon as there is signal. Keep scoring.`** at 16px.
- Queue card, label **`Waiting to go up`**, rows `Court 1, match 5` → `21 14`, `Court 2, match 4` → `21 09` (numerals VT323 24px).
- Tail line: **`If the phone dies before signal returns, use Copy for WhatsApp at any point to get tonight out in plain text.`**
- Footer: **`2 results are queued.`** (count in VT323 22px) + lime button **`Try again now`**.

The design decision this encodes and which this slice must honor: **a failed save never blocks scoring.** The result is queued locally, the sheet still closes, the next match is still drawn. Implement the write as optimistic with a local outbox.

> v1 difference: v1's earlier error was a blocking screen — `That score did not save.` / `The connection dropped mid save. The match card is unchanged.` / button `Tap the score again` — i.e. the result was *discarded*. v2 reverses this to an offline queue. Follow v2; do not build the discard path.

### 2.6 Data required for the error state

`pendingResults: Array<{ courtNumber, matchNumber, winnerScore, loserScore }>` held on device, plus a count for the footer line and a manual retry trigger.

---

## 3. Frame 12 — Court switcher

Not a modal in v2. It is the court view with a **persistent two-court strip replacing the round header**, plus a footer nudge toward the court that owes a score. One bold thing: **the lime `Go to Court 2` button**.

### 3.1 Layout

**Court strip** (replaces the round header): `padding:14px 18px; border-bottom:1px solid rgba(244,237,224,.12); display:flex; gap:10px`. One card per court, each `flex:1; border-radius:6px; padding:10px 12px; display:flex; flex-direction:column; gap:2px`.

- *Active court*: `border:2px solid #F4EDE0; background:#D9E270; color:#0A1810`. Lines: **`Court 1`** at `font-size:16px; font-weight:700`, then **`Mid-match`** at `font-size:13px; font-weight:600`.
- *Other court*: `border:1px solid rgba(244,237,224,.18)`, no fill. Lines: **`Court 2`** at 16/700, then **`Waiting on a score`** at 13/600 **in lime `#D9E270`** — the status color is the alarm.

Status strings observed across v2 frames: **`Mid-match`**, **`Waiting on a score`**, **`Nobody assigned`** (the last from frame 25). Lime status text is reserved for a court that needs the ref's attention.

> Note: in v2 the `Round 2 of 3` line is **not shown** on this frame — the strip takes the whole header band. Open question for the implementer: whether the strip is always present (and the round line lives elsewhere) or appears only in multi-court sessions. Only two courts are ever drawn; a 3+ court strip is not designed.

**Body** (`flex:1; padding:16px 18px; gap:14px`) — same content as frame 10, one notch quieter:

- Match card, `border:1px solid rgba(244,237,224,.18); border-radius:6px; overflow:hidden`:
  - Name row `padding:14px 18px`, **`Ade and Timi`** at `font-size:20px; font-weight:700`. **No `Side A` / `Side B` labels on this frame.**
  - Score slat: same lime grid, numerals **VT323 78px** (smaller than frame 10's 96px), cells `padding:8px 0`, reading `00` / `00`.
  - Name row, **`Ayo and Tumi`**, same styling.
- Waiting block: label **`Waiting`** (13/800, `.1em`, uppercase, `rgba(.45)`) and the same chip row (`Fiyin` + three placeholder chips). **No `All four are on next.` line on this frame.**

**Footer** (`padding:14px 18px; border-top:1px solid rgba(244,237,224,.12); gap:10px`):

- Sentence: **`Court 2 has a score to record.`** — `font-size:16px; font-weight:600`.
- Button: full width, `height:56px; border-radius:6px; background:#D9E270; color:#0A1810`, centered, `font-size:18px; font-weight:700`, label **`Go to Court 2`**.

Note the footer swap: frame 10's footer holds the two outlined winner buttons; frame 12's holds one solid lime nudge. The lime fill on this frame appears twice (active court chip, nudge button) and marks "act here".

**Tab bar** — §0.3, `Match` active.

> v1 difference: v1 built this as a **modal** — a dark scrim `rgba(4,7,3,.62)` with a bottom sheet titled `Switch court`, listing two bordered rows: `Court 1` / `Mid match, round 2` with an outlined tag `You are here`, and `Court 2` / `Waiting on a score` with a lime-filled tag `Score due`, closing on `Switching never loses your place.` v2 replaces the entire modal with the always-visible strip. Build v2; that v1 copy is dropped and should not ship.

### 3.2 Interactive controls

| Control | Behavior |
|---|---|
| Court card (any non-active court) | Switches the focused court. Body, footer, and score-entry target all re-point to that court. Switching must preserve state on the court you leave, including a half-open score sheet. |
| Court card (active) | No-op. |
| `Go to Court 2` | Same as tapping that court's card. Present only when some other court has a score due; its label interpolates that court's number. |
| Tabs | As §0.3. |

### 3.3 Data required

- `courts: Array<{ number, status: 'Mid-match' | 'Waiting on a score' | 'Nobody assigned', scoreDue: boolean }>` — the whole list, since the strip renders every court, not just the active one. Status must be live for the non-focused courts, so it needs to come from a poll or subscription, not only from the focused court's payload.
- `activeCourtNumber`.
- The focused court's `currentMatch` and `waiting` queue, same shape as §1.3.
- Derived: the first court where `scoreDue === true` drives both the footer sentence and the button label. When no court has a score due, neither the sentence nor the button is drawn (no such variant is illustrated — the footer band collapses).

### 3.4 Empty / loading / error variants

- **Empty:** a court with nobody assigned is frame 25 (other slice) and reuses this strip with the empty court active and its status reading `Nobody assigned`. Build the strip as a shared component so that frame can consume it.
- **Loading / error:** none drawn for the switcher. Court statuses that have not loaded yet should render the card with the number only rather than guessing a status string.

---

## 4. Build notes

1. Extract three shared components before anything else: **CourtStrip**, **BottomTabBar**, **MatchCard** (slat size is a prop: 96px on frame 10, 78px on frame 12). Frames 25 and 26 in the States group depend on the first two.
2. The two-tap flow is the product. Winner button → keypad digit → done. Nothing may sit between those two taps, and nothing may block the second one, including a failed network write.
3. Every numeral on these three frames is VT323. Mixing Inter numerals into the round line or the slat is the most likely visual regression.
4. All copy in this spec is quoted verbatim from the wireframes. Sample names (`Ade and Timi`, `Ayo and Tumi`, `Fiyin`) and `Round 2 of 3` are fixture data, not literal copy.
