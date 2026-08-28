// The knockout branch: Sunday's Playoff door (frames 30 to 33).
//
// A straight single-elimination bracket over pairs the organiser made by
// hand at the door. The draw order IS the seeding: position one is the top
// of the draw, and the organiser's own pairing is the balance, so no tier
// law runs anywhere in this file. One draw feeds every court, ties go to
// whichever court is free, and there is no divisibility math in the branch:
// byes and the rotating trio absorb any headcount.
//
// The machinery is the playoff engine's, on purpose. A knockout tie is a
// playoff Tie, a knockout match is minted by seedPlayoffMatch, and binding a
// score to a row works the same way it does in frame 21: by stage plus who
// is on court, never by array position. What this file adds is the shape:
// full rounds of any power of two, a partial first round labelled Play-in,
// and the plate, a second small bracket for everyone knocked out in round
// one, so nobody's Sunday is a single game.

import type { KnockoutPair, Match, PlayoffStage } from "../types";
import {
  makeTie, winnerOf,
  type PlayableTie, type SeededPair, type Stage, type Tie,
} from "./playoff";

/** The draw as the bracket machinery reads it: position is the seed. */
export const drawSides = (pairs: readonly KnockoutPair[]): SeededPair[] =>
  pairs.map((p) => ({ seeds: [p.seed], playerIds: [...p.playerIds] }));

/** The largest power of two at most n. The size of the first full round. */
const baseOf = (n: number): number => 2 ** Math.floor(Math.log2(n));

/** Stage keys and names per full-round size, main bracket and plate. */
const ROUND: Record<number, { key: PlayoffStage; label: string; word: string }> = {
  16: { key: "r16", label: "Round of 16", word: "Round of 16 match" },
  8: { key: "quarter", label: "Quarterfinals", word: "Quarterfinal" },
  4: { key: "semi", label: "Semifinals", word: "Semifinal" },
  2: { key: "final", label: "Final", word: "Final" },
};
const PLATE_ROUND: Record<number, { key: PlayoffStage; label: string; word: string }> = {
  8: { key: "plateQuarter", label: "Plate quarterfinals", word: "Plate quarterfinal" },
  4: { key: "plateSemi", label: "Plate semifinals", word: "Plate semifinal" },
  2: { key: "plateFinal", label: "Plate final", word: "Plate final" },
};

/**
 * One single-elimination bracket over `sides`, in order, top of the draw
 * first. Crossing is top against bottom in every round, the same rule the
 * round robin's playoff uses, so the leaders meet last.
 *
 * A partial first round is labelled Play-in and only the bottom of the draw
 * plays it; the top seeds hold byes. A first round that everyone enters is
 * a full round and carries its own name, which is the same honesty the
 * eight-pair bracket learned: nobody has a bye, so nothing is a play-in.
 */
function buildBracket(
  sides: readonly (SeededPair | null)[],
  matches: readonly Match[],
  rounds: Record<number, { key: PlayoffStage; label: string; word: string }>,
  playInKey: PlayoffStage,
  playInLabel: string,
): Stage[] {
  if (sides.length < 2) return [];
  const live = matches.filter((m) => m.status !== "voided");

  const n = sides.length;
  const base = baseOf(n);
  const surplus = n - base;
  const seededThrough = n - surplus * 2;

  const stages: Stage[] = [];
  let field: (SeededPair | null)[] = sides.slice(0, seededThrough);

  if (surplus > 0) {
    const block = sides.slice(seededThrough);
    const ties = Array.from({ length: surplus }, (_, i) =>
      makeTie(playInKey, i, block[i], block[block.length - 1 - i], live));
    stages.push({
      key: playInKey,
      label: ties.length > 1 ? `${playInLabel}s` : playInLabel,
      word: playInLabel,
      ties,
    });
    field = [...field, ...ties.map(winnerOf)];
  }

  while (field.length >= 2) {
    const round = rounds[field.length];
    if (!round) break;
    const half = field.length / 2;
    const ties = Array.from({ length: half }, (_, i) =>
      makeTie(round.key, i, field[i], field[field.length - 1 - i], live));
    stages.push({ key: round.key, label: round.label, word: round.word, ties });
    field = ties.map(winnerOf);
  }

  return stages;
}

/** The main draw's stages. */
export const buildKnockoutStages = (
  pairs: readonly KnockoutPair[],
  matches: readonly Match[],
): Stage[] =>
  buildBracket(drawSides(pairs), matches, ROUND, "playIn", "Play-in");

/**
 * The plate: everyone knocked out in round one plays their own small
 * bracket, in the order they stood in the draw.
 *
 * It forms only once EVERY round-one tie is settled, because until then the
 * field is not known and a bracket over half a field would reshuffle as
 * results land. Callers draw a quiet waiting line instead. Null while the
 * night has no plate to give: the toggle off, round one unfinished, or
 * fewer than two losers.
 */
export function buildPlateStages(
  pairs: readonly KnockoutPair[],
  matches: readonly Match[],
): Stage[] | null {
  const main = buildKnockoutStages(pairs, matches);
  const roundOne = main[0];
  if (!roundOne) return null;
  if (!roundOne.ties.every((t) => t.settled)) return null;
  const losers = roundOne.ties
    .map((t) => {
      const w = winnerOf(t);
      if (!w || !t.sideA || !t.sideB) return null;
      return w === t.sideA ? t.sideB : t.sideA;
    })
    .filter((s): s is SeededPair => s !== null)
    .sort((a, b) => a.seeds[0] - b.seeds[0]);
  if (losers.length < 2) return null;
  return buildBracket(losers, matches, PLATE_ROUND, "platePlayIn", "Plate play-in");
}

/**
 * The ties that can go on court now, in draw order: sides known, no live or
 * settled match on them. One draw feeds every court, so the caller takes as
 * many as it has free courts. Plate ties queue behind main ties of the same
 * moment, because the main draw is the night.
 */
export function playableTies(stages: readonly Stage[]): PlayableTie[] {
  const playable = (t: Tie): t is PlayableTie =>
    t.sideA !== null && t.sideB !== null && !t.live && !t.settled;
  return stages.flatMap((st) => st.ties.filter(playable));
}

/**
 * Frame 32's sentence: the draw's shape, stated plainly before it starts.
 * "A bye for the top pair, three play-ins, then semifinals."
 */
export function knockoutShape(pairCount: number): string | null {
  if (pairCount < 2) return null;
  const base = baseOf(pairCount);
  const surplus = pairCount - base;
  const seededThrough = pairCount - surplus * 2;
  const word = (x: number) =>
    ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"][x] ?? `${x}`;
  const firstFull = ROUND[base].label.toLowerCase();
  if (surplus === 0) {
    return base === 2
      ? "The final, straight away."
      : `Everyone starts together: ${firstFull}, nobody waits.`;
  }
  const byes = seededThrough === 1
    ? "A bye for the top pair"
    : `Byes for the top ${word(seededThrough)} pairs`;
  const playIns = surplus === 1 ? "one play-in" : `${word(surplus)} play-ins`;
  return `${byes}, ${playIns}, then ${firstFull}.`;
}
