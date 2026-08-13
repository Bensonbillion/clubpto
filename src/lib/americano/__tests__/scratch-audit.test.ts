// TEMPORARY AUDIT SCRATCH — delete after reading.
import { describe, expect, it } from "vitest";
import type { AmericanoPlayer, AmericanoSession, AmericanoTier } from "@/types/americano";
import { DEFAULT_FORMAT } from "../format";
import { applyCorrection, applyResult, applyVoid, ensureLive } from "../live";
import { activeMatch, matchesPlayed, nextSelectionPreview, waitOf } from "../generator";
import { computeStandings } from "../standings";

const mkPlayers = (n: number): AmericanoPlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    playerId: `p${String(i).padStart(2, "0")}`,
    displayName: `P${i}`,
    tier: (i < n / 3 ? "A" : i < (2 * n) / 3 ? "B" : "C") as AmericanoTier,
    status: "present" as const,
    joinedAtMatchIndex: null,
    catchUpUsed: false,
  }));

const mkSession = (n: number, target: number): AmericanoSession => {
  const players = mkPlayers(n);
  return {
    id: "night", date: "2026-08-13", sessionName: "", players,
    pools: [{
      id: "court-2", label: "Court 2", playerIds: players.map((p) => p.playerId),
      targetMatches: target, playoffMode: "top8", status: "round_robin",
      matches: [], matchFormat: DEFAULT_FORMAT,
    }],
    defaultMatchFormat: DEFAULT_FORMAT, isPractice: false, status: "active",
  };
};

describe("AUDIT", () => {
  it("owesResult (active!==null) after recording a result + ensureLive", () => {
    let s = ensureLive(mkSession(8, 3), 1000);
    const m = activeMatch(s.pools[0])!;
    expect(m).toBeTruthy();
    // the exact production commit: applyResult then ensureLive, one updater
    s = ensureLive(applyResult(s, m.id, { winner: "A", setsLost: 1 }, 2000), 2000);
    const after = activeMatch(s.pools[0]);
    console.log("AUDIT owesResult after recording:", after !== undefined, "new match id:", after?.id);
    expect(after).toBeTruthy(); // dot never clears
  });

  it("void: players re-enter the queue; correction on a voided match is a NO-OP", () => {
    let s = ensureLive(mkSession(8, 4), 1000);
    const m1 = activeMatch(s.pools[0])!;
    const four = [...m1.teamA, ...m1.teamB];
    s = ensureLive(applyResult(s, m1.id, { winner: "A", setsLost: 0 }, 2000), 2000);
    const m2 = activeMatch(s.pools[0])!;
    console.log("AUDIT m1 four:", four, "m2 four:", [...m2.teamA, ...m2.teamB]);

    const beforePlayed = four.map((id) => matchesPlayed(s.pools[0], id));
    const beforeWait = four.map((id) => waitOf(s.pools[0], id));
    const stBefore = computeStandings(s.pools[0], s.players)
      .map((r) => `${r.playerId}:${r.points}/${r.gameDiff}`);

    // VOID match 1
    let v = ensureLive(applyVoid(s, m1.id), 3000);
    console.log("AUDIT active match unchanged by void:", activeMatch(v.pools[0])!.id === m2.id);
    const afterPlayed = four.map((id) => matchesPlayed(v.pools[0], id));
    const afterWait = four.map((id) => waitOf(v.pools[0], id));
    console.log("AUDIT played before/after void:", beforePlayed, afterPlayed);
    console.log("AUDIT wait before/after void:", beforeWait, afterWait);
    const preview = nextSelectionPreview(v.pools[0], v.players);
    console.log("AUDIT nextSelectionPreview after void:", preview);
    console.log("AUDIT voided four all in Next:", four.every((id) => preview!.includes(id)));

    const stAfter = computeStandings(v.pools[0], v.players)
      .map((r) => `${r.playerId}:${r.points}/${r.gameDiff}`);
    console.log("AUDIT standings before void:", stBefore);
    console.log("AUDIT standings after  void:", stAfter);

    // Now try to CORRECT the voided match (what CorrectionSheet's buttons do)
    const corrected = applyCorrection(v, m1.id, { winner: "B", setsLost: 0 });
    const cm = corrected.pools[0].matches.find((x) => x.id === m1.id)!;
    console.log("AUDIT after correcting a VOIDED match — status:",
      cm.status, "result:", JSON.stringify(cm.result));
    const stCorr = computeStandings(corrected.pools[0], corrected.players)
      .map((r) => `${r.playerId}:${r.points}/${r.gameDiff}`);
    console.log("AUDIT standings after 'correcting' the voided match:", stCorr);
    expect(cm.status).toBe("voided");
  });

  it("correction of a live (completed) match recomputes points and diff", () => {
    let s = ensureLive(mkSession(8, 4), 1000);
    const m1 = activeMatch(s.pools[0])!;
    s = ensureLive(applyResult(s, m1.id, { winner: "A", setsLost: 1 }, 2000), 2000);
    const before = computeStandings(s.pools[0], s.players)
      .filter((r) => [...m1.teamA, ...m1.teamB].includes(r.playerId))
      .map((r) => `${r.playerId}:${r.points}/${r.gameDiff}`);
    const c = applyCorrection(s, m1.id, { winner: "B", setsLost: 0 });
    const after = computeStandings(c.pools[0], c.players)
      .filter((r) => [...m1.teamA, ...m1.teamB].includes(r.playerId))
      .map((r) => `${r.playerId}:${r.points}/${r.gameDiff}`);
    console.log("AUDIT correction before:", before);
    console.log("AUDIT correction after :", after);
  });
});
