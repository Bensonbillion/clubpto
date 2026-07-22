// Court Manager v2 — schedule validator (COURT-MANAGER.md §13, meta-lesson:
// "validate after every generation and print specifics").
//
// The four hard constraints: no double-booking, no back-to-back, no duplicate
// matchups (unless disclosed as rematch), A never faces C — plus the round
// guarantee: equal game counts after every round (± disclosed byes).

import type { Pair, RoundGame, RoundScheduleResult } from "../types";
import { matchupType } from "../types";
import { matchKey } from "./rounds";

export interface Violation {
  code:
    | "double_booking"
    | "pair_twice_in_round"
    | "a_vs_c"
    | "duplicate_matchup"
    | "boundary_back_to_back"
    | "uneven_counts"
    | "unknown_pair"
    | "bye_pair_playing";
  message: string;
  round?: number;
  gameId?: string;
}

export interface ValidateOptions {
  /**
   * Max allowed spread of games-played after any round. 0 for even pair counts;
   * 1 when byes exist; pass a higher value only for disclosed shapes
   * (late joiners legitimately trail by the rounds they missed).
   */
  maxSpread: number;
  /** Pair ids exempt from the count-spread check (late joiners). */
  spreadExempt?: string[];
}

export function validateRoundSchedule(
  pairs: Pair[],
  schedule: RoundScheduleResult,
  opts: ValidateOptions,
): Violation[] {
  const violations: Violation[] = [];
  const byId = new Map(pairs.map((p) => [p.id, p]));
  const seenMatchups = new Set<string>();
  const gamesPlayed = new Map<string, number>(pairs.map((p) => [p.id, 0]));
  const exempt = new Set(opts.spreadExempt ?? []);
  let prevLastSlot = new Set<string>();

  schedule.rounds.forEach((round, i) => {
    const roundNo = i + 1;
    const pairSeen = new Set<string>();
    const courtSlotSeen = new Set<string>();
    const byePairs = new Set(schedule.byes[roundNo] ?? []);

    for (const g of round) {
      const [pa, pb] = g.pairIds.map((id) => byId.get(id));
      if (!pa || !pb) {
        violations.push({
          code: "unknown_pair",
          round: roundNo,
          gameId: g.id,
          message: `Round ${roundNo} game ${g.id} references a pair not in the roster (${g.pairIds.join(", ")}).`,
        });
        continue;
      }

      // A never faces C — the one absolute.
      if (matchupType(pa.tier, pb.tier) === null) {
        violations.push({
          code: "a_vs_c",
          round: roundNo,
          gameId: g.id,
          message: `Round ${roundNo} game ${g.id}: ${pa.id} (A) vs ${pb.id} (C) — A never faces C.`,
        });
      }

      // Double-booking: one court-slot hosts one game; one pair plays once per round.
      const cs = `${g.slot}:${g.court}`;
      if (courtSlotSeen.has(cs)) {
        violations.push({
          code: "double_booking",
          round: roundNo,
          gameId: g.id,
          message: `Round ${roundNo}: two games on court ${g.court}, slot ${g.slot}.`,
        });
      }
      courtSlotSeen.add(cs);
      for (const id of g.pairIds) {
        if (pairSeen.has(id)) {
          violations.push({
            code: "pair_twice_in_round",
            round: roundNo,
            gameId: g.id,
            message: `Round ${roundNo}: pair ${id} is scheduled twice — every pair plays exactly once per round.`,
          });
        }
        pairSeen.add(id);
        if (byePairs.has(id)) {
          violations.push({
            code: "bye_pair_playing",
            round: roundNo,
            gameId: g.id,
            message: `Round ${roundNo}: pair ${id} has a bye but is also scheduled to play.`,
          });
        }
      }

      // Duplicate matchups (rematches must be explicitly flagged).
      const key = matchKey(g.pairIds[0], g.pairIds[1]);
      if (seenMatchups.has(key) && !g.isRematch) {
        violations.push({
          code: "duplicate_matchup",
          round: roundNo,
          gameId: g.id,
          message: `Round ${roundNo} game ${g.id}: ${g.pairIds.join(" vs ")} already played — undisclosed rematch.`,
        });
      }
      seenMatchups.add(key);

      // Boundary back-to-back: last slot of round r → first slot of round r+1.
      // Games explicitly flagged boundaryClash were disclosed by the generator
      // (degenerate roster shapes); undisclosed clashes are violations.
      if (g.slot === 1 && !g.boundaryClash) {
        for (const id of g.pairIds) {
          if (prevLastSlot.has(id)) {
            violations.push({
              code: "boundary_back_to_back",
              round: roundNo,
              gameId: g.id,
              message: `Pair ${id} plays the final slot of round ${roundNo - 1} and the first slot of round ${roundNo} — back-to-back across the boundary.`,
            });
          }
        }
      }

      g.pairIds.forEach((id) => gamesPlayed.set(id, (gamesPlayed.get(id) ?? 0) + 1));
    }

    // Equal counts after every round (the whole point of rounds, §6).
    const counts = pairs.filter((p) => !exempt.has(p.id)).map((p) => gamesPlayed.get(p.id) ?? 0);
    if (counts.length > 0) {
      const spread = Math.max(...counts) - Math.min(...counts);
      if (spread > opts.maxSpread) {
        violations.push({
          code: "uneven_counts",
          round: roundNo,
          message: `After round ${roundNo}, game counts spread by ${spread} (max allowed ${opts.maxSpread}). Counts: ${JSON.stringify(Object.fromEntries(gamesPlayed))}.`,
        });
      }
    }

    if (round.length > 0) {
      const maxSlot = Math.max(...round.map((g) => g.slot));
      prevLastSlot = new Set(round.filter((g) => g.slot === maxSlot).flatMap((g) => g.pairIds));
    }
  });

  return violations;
}
