# The Sunday formats, as the wireframes draw them

Imported 2026-08-29 from the claude.ai/design project "UI mockups for sports
dashboard" (ClubPTO Manage Wireframes.dc.html, sections "The knockout branch"
and "Sunday formats"). Where this document and the code disagree, the
wireframes win.

## The knockout branch (frames 30 to 33), BUILT

Sunday's Playoff door. No divisibility math anywhere: byes and the rotating
trio absorb any headcount.

- **Frame 30, Pair up.** "Who plays together?" Tap one name, tap a second,
  the pair moves up into the draw. Tap a pair to break it. "The draw, in
  order" with numbered pairs and tier chips (the last setup surface that
  shows tiers); "Shuffle the draw"; an Unpaired cloud; the counts line; the
  held state ("Timi is held. Tap a second name to pair."). Reused as drawn
  by the Set teammate branch.
- **Frame 31, Courts available.** "How many courts are free?" One draw feeds
  every court; each tie goes to whichever court is free, in draw order. No
  player assignment. Chips 1 / 2 / 3. "No divisibility math in this branch.
  Any headcount works." Reused by the Set teammate branch, which continues
  to frame 35 instead.
- **Frame 32, Knockout ready.** "The draw, as it will run." Seven pairs: "A
  bye for the top pair, three play-ins, then semifinals." The first round
  listed whole (byes named, play-ins with empty slats), then "Semifinals and
  the final, drawn as play-in winners land." The plate toggle: "Plate for
  first-round losers: everyone knocked out in round one plays their own
  small bracket." Footer: "Byes and the trio absorb whatever the pairing
  leaves." Start the knockout.
- **Frame 33, Knockout play.** The pager pages through the draw. Eyebrow
  "Sunday · Play-in · Court 1". The live card scores like a league game
  (both numbers, one tap each), with "Change this match" and "Opponent
  advances" (confirm-gated, records a walkover) beneath. "Up next, any free
  court: X & Y against Z & W." The Bracket tab replaces Standings. Partial
  first rounds are labelled Play-in; full rounds carry round names.

## Sunday formats (frames 34 to 37)

- **Frame 34, Sunday hub, BUILT with two doors.** Appears only when the night
  is Sunday, immediately after the day is chosen. "Three shapes tonight. The
  roster is built inside the door you choose." Round robin / Playoff / Set
  teammate. "Switching doors keeps the roster." The Set teammate door is not
  yet drawn in the app, because it opens onto nothing until the branch below
  is built.

### The Set teammate branch (frames 35 to 37), NOT BUILT YET

Pick partners and play the night as teams. Reuses frames 30 (pair up) and
31 (courts), then:

- **Frame 35, Games per pair.** The target step in the teams shape, with the
  arithmetic stated the same way as frame 08. Five pairs: "4: Preselected.
  5 pairs, 10 matches." / "5: 5 pairs needs an even total." / "6: 5 pairs,
  15 matches." "Least-played-first runs over pairs, and opponents vary
  before any rematch." Footer: "Teams stay together all night. Start the
  night."
- **Frame 36, Team standings.** The standings table over PAIRS: "1 Fiyin &
  Kayode P4 W3 L1 +10 9", tiebreak wording as frame 17 ("Behind on score
  difference." / "First to this score."). Copy for WhatsApp. "No tier letter
  anywhere, the night is tier-blind, the organiser's own pairing is the
  balance."
- **Frame 37, Team endings.** "The table is settled. How do the teams end?"
  Two doors: "Crown the table: the top pair are the champions as they
  stand." / "Seed the bracket: a straight pairs knockout from the table,
  first against last." With 5 pairs: a play-in between fourth and fifth,
  byes to the top three by the power-of-two rule. Readiness in the shape of
  frame 21, two doors instead of one.

## Where the built branch lives

- `src/manage/engine/knockout.ts`: the bracket shapes, the plate, dispatch
  order, the shape sentence. Reuses the playoff engine's tie machinery
  (makeTie, winnerOf, seedPlayoffMatch), so scores bind by stage plus
  membership, never array position.
- `src/manage/screens/knockout/`: SundayHub, PairUp, CourtsFree,
  KnockoutReady, KnockoutPlay.
- `src/manage/useSession.ts`: setFormat, setKnockoutPairs, setPlate,
  startKnockout, dispatchKnockout, walkoverMatch, parkKnockoutTie, and the
  derived `knockout` view.
- `Session.format` is absent on every night saved before the branch existed,
  which is what keeps old phones resuming their round robins untouched.
