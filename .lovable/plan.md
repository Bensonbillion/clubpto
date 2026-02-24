

## Plan: 8-Team Single-Elimination Playoff Bracket with Strict Tier Priority

### What's Changing

Currently the system seeds **4 pairs** into a 2-round bracket (Semi-Finals → Final). You want **8 pairs** in a 3-round bracket (Quarter-Finals → Semi-Finals → Final) with strict tier-priority seeding.

### Seeding Rules (Clarified)

The priority order is absolute — tier membership trumps win percentage:

1. **All Tier A pairs** (sorted by Win% among themselves)
2. **Tier B pairs that beat an A pair** in round-robin — promoted above normal B pairs
3. **Normal Tier B pairs** (sorted by Win%)
4. **Tier C pairs that beat a B pair** in round-robin — promoted above normal C pairs
5. **Normal Tier C pairs** (sorted by Win%)

Override logic works both ways:
- A **B pair** that beats an **A pair** gets promoted above other B pairs (but still below all A pairs)
- A **C pair** that beats a **B pair** gets promoted above other C pairs (but still below all B pairs)

Top 8 from this ordered list enter the bracket.

### Bracket Structure (NBA-Style, 8 Teams)

```text
Quarter-Finals          Semi-Finals          Final
  #1 vs #8  ──┐
               ├── Winner vs Winner ──┐
  #4 vs #5  ──┘                       ├── Champion
  #2 vs #7  ──┐                       │
               ├── Winner vs Winner ──┘
  #3 vs #6  ──┘
```

### Files to Modify

**1. `src/components/manage/StatsPlayoffs.tsx`** (seeding logic)
- Change `handleGeneratePlayoffSeeds` to:
  - Add B-beats-A override detection (scan completed cross-tier matches where winner is B and loser is A)
  - Keep existing C-beats-B override detection
  - Reorder priority: A → promoted-B (beat A) → normal-B → promoted-C (beat B) → normal-C
  - Change `.slice(0, 4)` → `.slice(0, 8)` to take top 8 pairs
- Update the descriptive text from "Top pairs" to reflect 8-team bracket
- Update `disabled` check from `totalPairs < 2` to `totalPairs < 2` (keep minimum viable, bracket handles fewer gracefully)

**2. `src/hooks/useGameState.ts`** (`generatePlayoffMatches` function)
- The existing code already handles arbitrary seed counts with NBA-style pairing (`#1 vs #last`, etc.) and auto-generates next rounds when a round completes — so it already supports 8 teams with 3 rounds (QF → SF → Final). **No changes needed here.**

**3. `src/components/manage/PlayoffBracket.tsx`** (round labels)
- Update `getRoundLabel` to handle 3 rounds: Round 1 = "Quarter-Finals", Round 2 = "Semi-Finals", Round 3 = "Final"

### Technical Detail

The `generatePlayoffMatches` function in `useGameState.ts` already uses a generic loop:
```
for (let i = 0; i < numMatches; i++) {
  seeds[i] vs seeds[seeds.length - 1 - i]
}
```
With 8 seeds this produces 4 QF matches. The `completePlayoffMatch` function already auto-creates the next round when all matches in a round complete, pairing winners sequentially. So the bracket progression (4 QF → 2 SF → 1 Final) works automatically.

The only substantive changes are in the **seeding algorithm** (StatsPlayoffs) and **round labels** (PlayoffBracket).

