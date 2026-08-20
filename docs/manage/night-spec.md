# The night, as it actually runs

Benson's own description of the system, 2026-08-19. This is the authoritative
account of its behaviour. Where this document and the code disagree, the code
is wrong.

The frames it refers to are in `docs/design/v3/frames/` and
`docs/design/v3/wireframes-A.html` / `-B.html`.

## The one line

The round robin is long, so that is where people need protecting. The playoff
is short, earned and partnered, so that is where everyone mixes. Beginners get
a guarded night and still end it in the same tournament as everyone else, and
points are points, so a C who runs their pool clean can top the table over an
A who did not.

## The tiers

A is the competitive end, C is the newest, B is the middle.

**Everyone unassessed counts as B.** That is not a shortcut, it is
load-bearing. B is the only tier with no restrictions on it, so defaulting a
few hundred unknown players to the bridge is the least damaging wrong guess
the system can make.

Tiers are set per night, on the way in (frame 06). Last week's carries over as
a default. B this week can be A the next: form moves, and nothing already
played changes. They are a private note for whoever is splitting the courts.
They show in the roster and on the split screen, and **never on court, in a
game, or in standings** (frame 29).

## The two balance laws

Same shape, one at each end of the room.

**If a match holds both A's and B's, each team has a B.** No B is ever the lone
weaker player being hunted.

**If a match holds any C, there is no A anywhere in it, a C stands on each
team, and at most one B is allowed in.** So legal C matches are exactly two
shapes: four C's, or three C's plus one B.

**That one B is the same person all night.** One designated B rides with the
beginner group for the whole session, so the C's see one consistent stronger
face instead of a rotating cast, and no player ends up playing with more than
one B this way in a night.

Underneath all of it, least-played-first still picks who goes on next, so
nobody drifts behind on games.

The laws hold whether the group is spread over three courts or sharing one.
On a single court for everyone, the A-and-B mixing stays as it is, and C plays
only with other C's or with one B, never in a game with an A (frame 11).

## Courts

The split arrives pre-sorted and you adjust by hand. **Tier suggests, it never
gates.**

The suggestion follows the counts rather than a fixed rule. A typical night
puts A and B together and gives C their own court (frame 07). A night of 16 A,
4 B and 10 C splits as all-A on one court and B-with-C on the other, because B
is the bridge and the C court needs B's to fill it (frame 31). Some nights
have no C at all. The point is flexibility, so nothing here is a gate.

**If fewer than three C's show up, no legal C match can form.** Those C's play
among the B's for the night, still walled off from A's, and the setup screen
says so before the night starts rather than letting it be discovered in round
two.

## Scoring

**Enter both scores** (frame 12). The higher score takes the 3 points, so 7-6
wins exactly like 7-0. The margin only feeds score difference.

A win is 3, a loss is 0. Nobody earns points for sitting out, ever.

## The schedule

Every match is drawn up front and **nothing has to happen in order** (frame
12b). Tap any row to jump straight to it. The arrows on the match screen walk
the same list.

**A skipped game never disappears.** It waits until you come back to it, and
it comes back before the table settles.

## Both courts, one device

**Both courts run at once** (frame 13). The court chips flip instantly, mid
match, mid score, mid anything. Each court keeps its own schedule and picks up
exactly where it was. Finishing one court is never a condition for looking at
the other.

Moving a player mid-night moves them and nothing else (frame 28): everything
they have played stays on the old court's table, and they join the new court's
queue. No points move courts, so both tables stay honest.

## Standings

Ties break on score difference, then on whoever reached the total first,
decided by the order results were recorded. No coin flip and no judgement
call. The table explains itself on the row: "Behind on score difference",
"First to this score". The moment the last score lands, the order is final.

## The playoff, where the walls come down

Seeding comes straight off the standings. Full field, everyone in, and **from
here tier is irrelevant**. You earned your seed; you play whoever the bracket
gives you.

Pairs form by splitting adjacent seeds: 1 with 3, 2 with 4, 5 with 7, 6 with
8. Never 1 with 2, so there is no superteam coronation. The bracket crosses
top against bottom: 1+3 meets 6+8, 2+4 meets 5+7, winners to the final.

A C who scrapes in eighth gets seed six as a partner, and **that partner is
the protection now. The pairing is the shield, not the wall.**

Each court runs its own bracket and crowns its own champions. **There is no
crossover final between courts**, because a crossover would rank the courts
against each other, and that is the hierarchy the whole club refuses.

Any court can instead take the alternative ending: one more round for
everyone, and the top of the table is the individual champion.

## The awkward headcounts

The app states the consequence rather than hiding the maths.

**Twenty, ten a side.** Target must be 4, because ten by three does not divide
into fours. Ten matches per court. The playoff makes five pairs: 9+10 form the
fifth, and pairs four and five play one play-in for the last semi slot.

**Eighteen, nine a side.** Target 4 again. The ninth seed joins the fourth
pair as a rotating trio, so nobody watches the climax.

**Sixteen or twenty-four.** Eight or twelve a side divides cleanly. Nothing to
explain.

## The night menu

One tap from any screen, either court, all night (frame 25b): session summary,
one more round for a court, start tonight over, end the night.

**Start over clears every game and bracket. The roster and tiers stay.**

## The door

No sign-in. The passcode, and nothing else.
