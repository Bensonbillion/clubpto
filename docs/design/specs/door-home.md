# Build spec — slice `door-home`

Frames 00 Index, 01 Passcode, 02 Passcode failed, 03 Home nothing running, 04 Home night in progress.

Source of truth: `/Users/bensonbillions/clubpto/docs/design/manage-wireframes-v2-lime.html` (frames `1a`, `1b`, `1c`, `1d`, `1e`). v1 green (`/Users/bensonbillions/clubpto/docs/design/manage-wireframes-v1-green.html`, frames `00`–`04`) consulted for state detail only. Every v2/v1 disagreement is called out inline as **v1 differs**.

---

## 0. Shared shell (applies to every frame in this slice)

### Palette (v2 lime, exact values)

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#0E2418` | Screen ground, every frame |
| `--ink` | `#F4EDE0` | Primary text, filled passcode dots |
| `--ink-68` | `rgba(244,237,224,.68)` | Lead paragraph body |
| `--ink-72` | `rgba(244,237,224,.72)` | Footer helper line above the primary button |
| `--ink-60` | `rgba(244,237,224,.6)` | Card sub-line, tertiary action label |
| `--ink-55` | `rgba(244,237,224,.55)` | Delete key label |
| `--ink-50` | `rgba(244,237,224,.5)` | Footer helper on passcode frames, sub-sub line |
| `--ink-45` | `rgba(244,237,224,.45)` | Eyebrow / stat labels |
| `--line` | `rgba(244,237,224,.18)` | Card + keypad key borders |
| `--line-soft` | `rgba(244,237,224,.12)` | Footer top divider |
| `--line-dot` | `rgba(244,237,224,.28)` | Unfilled passcode dot border |
| `--lime` | `#D9E270` | Primary button fill only |
| `--lime-ink` | `#0A1810` | Text on lime |
| `--red` | `#EF4444` | Error dot borders only |

Ground is `#0E2418`, **not** the public-site `#1A1A1A`. Manage runs its own palette.

### Type

- **Inter** 400/500/600/700/800 — all functional text.
- **VT323** — every numeral that is a *value* (stat counts, keypad digits, step numbers). Never for numerals inside a sentence.
- **Playfair Display** 500/600/700 — the big page title on Home only (frames 03, 04).
- Eyebrow recipe: `11px / 800 / letter-spacing .12em / uppercase / --ink-45`.
- Stat label recipe: `12px / 700 / letter-spacing .08em / uppercase / --ink-45`.

### Geometry

- Frame is 390px wide, 780px tall in the wireframe. Build as `100dvh` column flex, `box-sizing:border-box`.
- **Radius is `6px` everywhere.** Buttons, cards, keypad keys. Only the passcode dots and pill chips use `999px`.
  - **v1 differs:** v1 used 12px radius on buttons and cards. v2 flattens everything to 6px. Follow v2.
- Footer action bar pattern, identical on frames 03 and 04: `padding:14px 18px 20px`, `border-top:1px solid --line-soft`, column flex, `gap:10px`, containing one helper line (15px / line-height 1.35 / `--ink-72`) then one 58px lime button (19px / 700).
- Content column padding on Home frames: `34px 20px`. Content column padding on passcode frames: `24px`, vertically and horizontally centred.
- Secondary/tertiary blocks are pushed to the bottom of the content column with `margin-top:auto`, not by fixed spacing.

---

## Frame 00 — Index

v2 `1a`. Full-bleed 390px screen, `padding: 24px 20px 28px`.

**This is the wireframe's own frame index, not an operator screen.** Build it only as a dev/QA navigation page behind the manage route (e.g. `/manage/index`), or skip it. It is listed here because it carries the canonical frame names and job grouping that every other screen's nav copy has to agree with.

### Copy — exact

Title (Playfair 30px / 600 / line-height 1.1): `Manage`
Sub (15px / line-height 1.4 / `--ink-68`, margin-top 6px): `Club PTO court manager. 27 frames, five jobs.`

Then six groups (column flex, `gap:18px`; inside each group `gap:7px`). Group heading uses the eyebrow recipe. Each row is `flex; gap:10px; font-size:15px` — a VT323 19px number in a fixed 24px-wide span, then the link label.

**Job 0 · Get in**
- `01` `Passcode`
- `02` `Passcode failed`

**Job 1 · Roster and start**
- `03` `Home, nothing running`
- `04` `Home, night in progress`
- `05` `Which night`
- `06` `Who is here`
- `07` `Courts`
- `08` `How many matches each`
- `09` `Ready`

**Job 2 · Score the games**
- `10` `Court view`
- `11` `Score entry`
- `12` `Court switcher`
- `13` `Players tab`
- `14` `Late arrival`
- `15` `Extend`
- `16` `Correct or void a result`

**Job 3 · Standings**
- `17` `Standings tab`
- `18` `Tie broken by order`

**Job 4 · Playoffs**
- `19` `Playoff readiness, blocked`
- `20` `Bracket`
- `21` `Playoff match`
- `22` `Champion`
- `23` `Session summary`

**States**
- `24` `Empty, roster search`
- `25` `Empty, court unassigned`
- `26` `Error, score would not save`
- `27` `Confirmation, end the night`

### Layout

One column, no bold hero. The Playfair `Manage` is the only large element; everything below is a flat list. Numbers are lime-free here — they are `--ink` VT323, the group headings are the muted eyebrow.

### Controls

Every row is a link to its frame. No other interaction.

### Data

None. Static.

### Variants

None.

### v1 differs

v1 frame `00` is 560px wide, two columns, and collapses states into four rows: `Playoff readiness, both states` (19), `Empty states` (24), `Error states` (25), `Confirmation sheets` (26). v2 splits these into 24/25/26/27 as listed above, and renames 18 from `Tie-breaker, reached it first` to `Tie broken by order` and 20 from `Bracket · vertical stage list, never a tree` to `Bracket`. Use the v2 names — they are what the rest of the app labels these screens.

---

## Frame 01 — Passcode

v2 `1b`. Full-height column: content region `flex:1`, centred both axes, `gap:26px`, `padding:24px`; then a footer strip.

### Copy — exact

Prompt (17px / 600, centred): `Enter tonight's passcode.`
Footer strip (14px / `--ink-50`, centred, `padding:14px 18px 20px`, `border-top:1px solid --line-soft`): `Court view and check-in need no code.`
Keypad labels: `1` `2` `3` `4` `5` `6` `7` `8` `9` (blank) `0` `Delete`

### Layout

Three stacked blocks, vertically centred as a group:

1. **Prompt line.** 17px / 600.
2. **Dot row.** Four dots, `display:flex; gap:16px`. Each 18×18px, `border-radius:999px`. Filled = solid `--ink`. Unfilled = transparent with `2px solid --line-dot`, `box-sizing:border-box`. Wireframe shows 2 filled, 2 unfilled — that is the "two digits entered" state, not a fixed design.
3. **Keypad.** `display:grid; grid-template-columns:repeat(3,84px); gap:14px` (280px total, centred). Each digit key: `height:72px`, `border:1px solid --line`, `border-radius:6px`, centred, **VT323 38px**. Bottom-left cell is an empty div (no border, no label). `Delete` key: same 72px height and 6px radius but **no border**, label Inter 15px / 600 / `--ink-55`.

The one bold element is the dot row — it is the only thing that moves. There is no submit button and no title bar.

**Passcode length is 4.** Four dots, four slots.

### Controls

- **Digit key (0–9)** — appends one digit to the entry buffer. Fills the next dot. Hit target is the full 84×72 cell. Give it a press state (the wireframe shows none; use a brief fill of `--line` at 1px→ filled background, keep it under 120ms — this is a fast-tap surface, the slow public-site easing does not apply).
- **Delete** — removes the last digit, empties the last filled dot. No-op at zero digits. Consider long-press to clear all; not specified in the wireframe, so ship tap-only unless asked.
- **No explicit submit.** On the 4th digit, auto-verify. Success → Home (frame 03 or 04 depending on session state). Failure → frame 02.
- The blank grid cell is not interactive.

### Data

- The correct passcode for the current scope. Existing system uses `9999` on `/manage` (4 digits — consistent with the 4-dot design).
- Whether a session is currently in progress, so the post-success route resolves to frame 03 vs frame 04. Fetch this alongside or immediately after verification so the user does not see a flash of the wrong Home.

### Variants

- **Entry states 0–4 digits.** Dots fill left to right.
- **Verifying.** Only reachable for the instant between the 4th tap and the result. If verification is a network round-trip, hold the 4 filled dots and disable the keypad; do not introduce a spinner in this design — no spinner exists anywhere in the wireframe set.
- **Failure** → frame 02.
- No loading variant on first paint: the screen has no server data to render.

### v1 differs

v1 `01` shows the entered digits **in the clear** (`4` `7` `2` over VT323 50px underline slots with a green 3px bottom border), no footer strip, keypad keys 62px with 10px gaps. v2 masks entry behind dots and adds the `Court view and check-in need no code.` footer. Follow v2 — masked dots, footer present.

**Flag:** v1's Job 0 section note reads `Six digits and one line of instruction.` but v1's own frame draws four slots, and v2 draws four dots. Build four. The "six digits" line is stale editorial prose, not screen copy.

---

## Frame 02 — Passcode failed

v2 `1c`. Same shell as frame 01. Only the top block and the footer line change.

### Copy — exact

Error headline, replacing the prompt (17px / 600 / line-height 1.35, `max-width:300px`, centred, `text-wrap:pretty`):
`That passcode did not match. Check tonight's code and try again.`

Footer strip (14px / `--ink-50`, centred): `The code is [[PASSCODE_SCOPE]].`

Keypad copy unchanged from frame 01.

### Layout

Identical geometry to frame 01. Two deltas:

1. The prompt line is **replaced** by the error sentence — the two never appear together. Same weight (600) and size (17px), now two lines inside a 300px measure.
2. All four dots render **empty with `2px solid #EF4444`** — the buffer is cleared on failure, and the red outline is the only red on the screen. No red text, no red banner, no toast.

### Controls

Same keypad, fully live. The first digit tap should return the dots to their normal `--line-dot` / `--ink` treatment and restore the `Enter tonight's passcode.` prompt — the error is transient, cleared by the next input.

### Data

- Same as frame 01, plus the resolved value for `[[PASSCODE_SCOPE]]`.
- **`[[PASSCODE_SCOPE]]` is an unresolved token in the wireframe.** It completes the sentence `The code is ___.` — it names where tonight's code comes from (e.g. who to ask, or which channel it was posted in). Do not ship the literal token. Get the real phrasing from the product owner before build; if it is not available, this footer line must be omitted rather than guessed.
- Consider whether repeated failures need throttling. The wireframe specifies no lockout, no attempt counter, and no "try again in N seconds" copy. Do not invent one.

### Variants

This frame **is** the error variant of frame 01. It has no further states.

### v1 differs

v1 `02` keeps the `Enter tonight's passcode.` prompt at the top, shows all four entered digits in red (`4` `7` `2` `9`) with red underlines, and places the error sentence *below* the digit row at 15px regular weight. v2 clears the digits, promotes the error into the headline slot at 600 weight, and adds the `The code is [[PASSCODE_SCOPE]].` footer. Follow v2.

---

## Frame 03 — Home, nothing running

v2 `1d`. Column: content `flex:1`, `padding:34px 20px`, `gap:16px`; then the standard footer action bar.

### Copy — exact

Eyebrow: `Court manager`
Title (Playfair 40px / 600 / line-height 1.05, hard line break as written): `Nothing` ⏎ `running yet`
Lead (16px / line-height 1.45 / `--ink-68` / `max-width:300px` / `text-wrap:pretty`): `Pick the night, tick off who is here, and Manage builds every match for you.`
Secondary card title (18px / 700): `Copy last Wednesday`
Secondary card sub (15px / `--ink-60`): `Same people, new night.`
Footer helper (15px / line-height 1.35 / `--ink-72`): `Five steps to a running night.`
Primary button (19px / 700, lime fill): `Start tonight`

### Layout

Top of the content column: eyebrow, then the Playfair title, then the lead paragraph. The **Playfair title is the one bold element** — 40px, two lines, breaking exactly between `Nothing` and `running yet`.

Bottom of the content column (`margin-top:auto`): a single bordered card — `border:1px solid --line`, `border-radius:6px`, `padding:16px 18px`, column flex `gap:4px` — holding the title and sub. It is a quiet card, not a lime button.

Footer bar: helper line, then the full-width 58px lime `Start tonight`.

So the visual weight runs: giant serif title → muted lead → (gap) → outlined card → lime button. Exactly two actions on the screen.

### Controls

- **`Start tonight`** (lime, primary) → frame 05 `Which night`, which is `Step 1 of 4`. This begins the four-step setup wizard: 05 Which night → 06 Who is here → 07 Courts → 08 How many matches each → 09 Ready.
- **`Copy last Wednesday`** (outlined card, secondary) → starts a session pre-filled with the previous session's day and roster. The wireframe does not show where it lands; the copy `Same people, new night.` implies it skips the roster step, so route it into the wizard with the day and attendee list already selected (land on the review/`Ready` step or on 07 Courts — confirm with the product owner, do not guess silently).
- Nothing else on the screen is tappable.

### Data

- `lastSession.dayName` — the weekday of the most recent completed session, to fill `Copy last Wednesday`. `Wednesday` is fixture data, not a constant. The wireframe offers only `Wednesday` and `Sunday` as league nights (frame 05), so this resolves to one of those.
- `lastSession.attendeeIds` and the day's roster, so the copy action can pre-fill.
- Confirmation that **no session is currently in progress** — this is the condition that selects this frame over frame 04.

### Variants

- **No previous session** (first ever run, or history cleared): the `Copy last Wednesday` card has nothing to copy. Hide the card entirely and let `Start tonight` sit alone above the footer. Do not render a disabled card with a placeholder weekday — the wireframe has no disabled-card treatment.
- **Loading.** This screen needs one cheap query (is a session live, what was the last one). Render the eyebrow, title and lead immediately — they are static — and hold only the `Copy last Wednesday` card and the footer helper until the answer lands. Never show `Start tonight` and `Resume the night` in sequence.
- **Error fetching session state.** Not drawn in either wireframe. Fail toward this frame (nothing running) rather than blocking the door: an operator who cannot see state must still be able to start a night.

### v1 differs

v1 `03` titles the screen `Club PTO` in Playfair 40px with the lead `No night is running. Start one and the app walks you through it.`, and puts `Start tonight` (solid), `Copy last Wednesday` (ghost button), and the sentence `Same people, new night.` all three inside the bottom bar, in that order. v2 renames the title to `Nothing running yet`, rewrites the lead, lifts `Copy last Wednesday` + `Same people, new night.` into a bordered card in the content column, and puts `Five steps to a running night.` in the footer above the button. Follow v2 throughout.

---

## Frame 04 — Home, night in progress

v2 `1e`. Same shell as frame 03: content `flex:1`, `padding:34px 20px`, `gap:16px`; standard footer action bar.

### Copy — exact

Eyebrow: `Court manager`
Title (Playfair 34px / 600 / line-height 1.1): `Wednesday night`
Status card headline (17px / 600): `Court 2, round 3 of 4.`
Stat labels (12px / 700 / .08em / uppercase / `--ink-45`): `In tonight` · `Played` · `Left`
Stat values (VT323 34px / line-height 1): `16` · `19` · `05`
Tertiary action (16px / 600 / `--ink-60`): `Start a different night`
Tertiary sub (14px / `--ink-50`): `Tonight's results stay saved.`
Footer helper (15px / line-height 1.35 / `--ink-72`): `Court 2 is waiting on a score.`
Primary button (19px / 700, lime fill): `Resume the night`

### Layout

Eyebrow, then the Playfair title at **34px** (smaller than frame 03's 40px — the title is now data, not a statement). Then the status card: `border:1px solid --line`, `border-radius:6px`, `padding:18px`, column flex `gap:10px`. Inside it, the headline sentence, then a `display:flex; gap:22px` row of three label-over-value stacks.

The **stat row is the one bold element** — three VT323 34px numerals reading left to right, label above each in small caps. Note `05` is **zero-padded to two digits**; `16` and `19` are naturally two digits. Pad every stat value to two characters so the row stays optically even.

Bottom of the content column (`margin-top:auto`): the tertiary action `Start a different night` with its sub-line under it, `gap:10px`. This is plain text, **no border, no button chrome** — deliberately quieter than frame 03's card, because it is destructive-adjacent.

Footer bar: helper naming the specific blocking court, then the lime `Resume the night`.

### Controls

- **`Resume the night`** (lime, primary) → frame 10 `Court view`, opened on the court named in the helper line (Court 2 here — the court that is waiting on a score), Match tab active.
- **`Start a different night`** (plain text link) → abandons the current night's *foreground* and begins the setup wizard at frame 05. The sub-line `Tonight's results stay saved.` is a promise: this must not delete or void the in-progress session's recorded results. If starting a new night ends the current one, this needs the confirmation sheet from frame 27 `Confirmation, end the night` — that frame is outside this slice; wire the route but confirm the destructive semantics before shipping.
- The status card itself is not tappable.

### Data

Everything on this screen is live session state:

- `session.dayName` → `Wednesday`, rendered as `{dayName} night`.
- `attendeeCount` — number of players checked in tonight → `In tonight` = `16`.
- `completedMatchCount` → `Played` = `19`.
- `remainingMatchCount` → `Left` = `05`. (`19 + 5 = 24`, which matches the total in frame 27's `All 24 results` line — so `Left` counts **matches remaining**, not players who went home.)
- The court currently needing attention, and its round position → both the card headline `Court {n}, round {r} of {total}.` and the footer helper `Court {n} is waiting on a score.`
- Per-court status flags, enough to decide *which* court is "waiting on a score" when more than one is. The wireframe assumes exactly one; pick the court whose match finished earliest if several qualify.

### Variants

- **No court is waiting on a score** (every court mid-match): the footer helper must say something true. The wireframe gives no alternate string. Frame 15 `Extend` carries the adjacent pattern `Court 2 is untouched. About [[MINUTES_PER_ROUND]] more minutes.` — reuse that shape rather than inventing a new voice, and get the exact line approved. Do not leave the helper blank; the footer's two-line rhythm depends on it.
- **Multiple courts waiting**: name one court, not a list. The helper line is one court wide by design.
- **Loading.** Hold the whole status card and footer helper; the eyebrow and title can paint as soon as `dayName` is known. Do not render `00` placeholders in the stat slots.
- **Error fetching live state**: no error frame exists for this screen in either wireframe. Keep `Resume the night` enabled — the operator needs the door open even when the summary numbers fail — and suppress the stat row rather than showing stale or zeroed numbers.
- **Round `3 of 4` boundary**: when the last round completes, this frame's headline and helper have no defined copy. Playoff readiness (frame 19) takes over at that point; that is outside this slice.

### v1 differs

v1 `04` titles the screen `Club PTO` in Playfair 40px and puts `Wednesday night` inside the card at 18px/800, paired with a lime `Live` tag chip in the card's top-right and the line `Court 2, round 3 of 4.` beneath. It has **no stat row**, and it places `Start a different night` inside the bottom bar below the primary button. v2 promotes `Wednesday night` to the Playfair page title, **drops the `Live` tag entirely**, adds the three-stat row, moves `Start a different night` up into the content column with the new sub-line `Tonight's results stay saved.`, and adds the footer helper `Court 2 is waiting on a score.` Follow v2 — in particular, do not ship a `Live` badge.

---

## Open items to resolve before build

1. `[[PASSCODE_SCOPE]]` (frame 02 footer) is an unfilled token. Needs real copy or the line gets cut.
2. `Copy last Wednesday` destination inside the setup wizard is not drawn. Confirm which step it lands on.
3. `Start a different night` (frame 04) — confirm whether it ends the current session and therefore needs frame 27's confirmation sheet.
4. Frame 04's footer helper has no copy for the "no court waiting" case.
5. Frame 00 is a wireframe index, not a product screen. Confirm whether it ships at all.
