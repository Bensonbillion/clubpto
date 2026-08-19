# The night, as it actually runs

Benson's walkthrough of a full two-court night, 2026-08-19. This is the
authoritative description of the system's behaviour. Where this document and
the code disagree, the code is wrong.

Sixteen people, two courts, real roster names.

## 7:00, the split

Setup asks who is here, then hands you the court screen. You drag names by
feel. Court 2 takes the stronger end of the room, Court 1 takes the rest.

Three tiers onto two courts cannot be a clean sort, so it is a gradient: one
court skews newer, one skews stronger, and the middle goes wherever the counts
need it. The tier chips help exactly where they are honest. A player with a
real assessment carries a real A or C chip; nearly everyone else reads "Not
assessed", because that is the truth of the data.

You are not executing a policy, you are eyeballing two rooms. The screen just
keeps the counts even.

## Why nobody gets buried

Fairness inside a court is the balance rule, and it is worth being precise
about what it does:

**No player is ever on court as the only C-tier player in the match.** If a
C-tier player is up, another C is across the net rather than alongside. The
newest player always has a counterpart on the other team, so no game turns
into three people hunting the weak fourth.

That is the mechanism that lets a gradient court run without anyone having a
bad night, and it is why the courts do not need to be pure.

## The middle two hours

Both courts run the same loop independently.

Eight players at target three is six matches per court: 8 x 3 = 24
player-games, four to a match.

The phone shows one court at a time. The switcher chips say at a glance which
court is mid-match and which is waiting on a score. Each court view is one
card: the pair on the left, the pair on the right, the score slat at 00 00,
and underneath, the four waiting, by name.

On an eight-player court, least-played-first has a hard property worth saying
out loud: **played counts can never drift more than one game apart.** The four
watching are effectively on next. In an earlier test night one player reached
three games while another sat on one. That failure is structurally impossible
here.

Score a match, two taps, and the next card is up before the players have left
the court.

## 9:00, the tables settle

Each court has its own standings. Two players level on points and on score
difference are separated by whoever reached that score first: no flip, no
judgement call. The row says why, and the reason stays on the row for the rest
of the night.

The table is final the moment the last score lands.

## Two endings, chosen per court

Each court decides on the night, and the other court is unaffected.

### The doubles bracket

Readiness says the targets are met, one button: seed.

**Pairing splits adjacent seeds: 1+3, 2+4, 5+7, 6+8.** Seeds 1 and 2 do not
pair. Pairing the top two builds a superteam and makes the final a coronation.
Splitting gives every pair one high seed and one lower, so any pair can beat
any pair.

Semis cross top against bottom: the first pair meets the last, the second
meets the third. Winners meet in the final.

Three matches, everyone on the court plays, about half an hour, same two-tap
scoring. The champion screen keeps "Back to bracket" visible so a mistyped
final stays fixable.

### One more round

No bracket. Everyone plays one more match, and whoever tops the table is the
individual champion. Same length of evening, different flavour.

## The close

Two celebrations, and deliberately **no crossover final** between the courts'
winners. A crossover re-ranks the courts and crowns one court's pair the real
champion, which is the hierarchy the whole design refuses. Court 1's champion
and Court 2's champions are equally the story of the night.

## The awkward headcounts

The app states the consequence rather than hiding the maths.

**Twenty, ten a side.** Target must be 4, because ten by three does not divide
into fours. Ten matches per court. The playoff makes five pairs: seeds 1 to 6
pair normally, 9+10 form the fifth pair, and pairs four and five play one
play-in for the last semi slot.

**Eighteen, nine a side.** Target 4 again. The ninth seed joins the fourth
pair as a rotating trio, so nobody watches the climax.

**Sixteen or twenty-four.** Eight or twelve a side divides cleanly at either
target. Nothing to explain.

## The door

No sign-in to use the manager. The passcode, and nothing else.
