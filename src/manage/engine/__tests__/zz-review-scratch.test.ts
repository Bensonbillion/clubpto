import { describe, expect, it } from "vitest";
import type { Match, Player } from "../../types";
import { lawContextFor, matchesPlayedBy, nextMatch, validTargets, totalMatches } from "../rotation";
import { judge, type Tier } from "../tiers";

const P = (id: string, over: Partial<Player> = {}): Player => ({
  id, name: id.toUpperCase(), walkIn: false, courtNumber: 1, away: false,
  joinedAtMatchIndex: null, ...over,
});

type Event = { at: number; kind: "walkIn"; player: Player } | { at: number; kind: "away"; id: string } | { at: number; kind: "back"; id: string };

interface Result {
  matches: Match[];
  log: string[];
  maxSpread: number;
  spreadAt: string[];
  illegal: string[];
  stuck: string | null;
  endless: boolean;
  repeats: number;
  finalCounts: Record<string, number>;
}

function sim(roster0: Player[], target: number, events: Event[] = [], maxGames = 60): Result {
  let roster = roster0.map((p) => ({ ...p }));
  const matches: Match[] = [];
  const log: string[] = [];
  let maxSpread = 0;
  const spreadAt: string[] = [];
  const illegal: string[] = [];
  let stuck: string | null = null;
  let endless = false;
  const fours = new Set<string>();
  let repeats = 0;
  const tierOf = (id: string) => roster.find((p) => p.id === id)?.tier ?? "B";
  const total = () => totalMatches(roster.filter((p) => !p.away).length, target);
  for (let g = 1; g <= maxGames; g++) {
    for (const e of events) if (e.at === g) {
      if (e.kind === "walkIn") roster.push({ ...e.player, walkIn: true, joinedAtMatchIndex: g });
      if (e.kind === "away") roster = roster.map((p) => p.id === e.id ? { ...p, away: true } : p);
      if (e.kind === "back") roster = roster.map((p) => p.id === e.id ? { ...p, away: false } : p);
    }
    const playable = roster.filter((p) => !p.away);
    const owedSomeone = playable.some((p) => matchesPlayedBy(matches, p.id) < target);
    const next = nextMatch(roster, matches, 1, target);
    if (!next) {
      if (owedSomeone && playable.length >= 4) stuck = `game ${g}: null while owed: ` + playable.filter((p) => matchesPlayedBy(matches, p.id) < target).map((p) => `${p.id}=${matchesPlayedBy(matches, p.id)}`).join(",");
      break;
    }
    const ids = [...next.teamA, ...next.teamB];
    const key = [...ids].sort().join(",");
    if (fours.has(key)) repeats++;
    fours.add(key);
    // strict judgement using the court's own context
    const ctx = lawContextFor(roster, 1);
    const verdict = judge({ teamA: next.teamA, teamB: next.teamB }, ctx);
    const shape = [next.teamA, next.teamB].map((s) => s.map(tierOf).sort().join("")).join("v");
    if (verdict) illegal.push(`game ${g}: ${verdict} ${shape} ${ids.join(",")}`);
    matches.push({
      id: `sim${g}`, courtNumber: 1, matchIndex: g, teamA: next.teamA, teamB: next.teamB,
      scoreA: 2, scoreB: 0, status: "played", startedAt: 0, completedAt: 0, stage: null,
    });
    const counts = playable.map((p) => matchesPlayedBy(matches, p.id));
    const spread = Math.max(...counts) - Math.min(...counts);
    if (spread > maxSpread) maxSpread = spread;
    if (spread > 1) spreadAt.push(`game ${g}: spread ${spread} [${playable.map((p) => `${p.id}${tierOf(p.id)}=${matchesPlayedBy(matches, p.id)}`).join(" ")}]`);
    log.push(`g${g} ${shape} ${next.teamA.join("+")} v ${next.teamB.join("+")}` + (verdict ? ` ILLEGAL ${verdict}` : ""));
    if (matches.length > total() + 4) { endless = true; break; }
  }
  const finalCounts: Record<string, number> = {};
  for (const p of roster) finalCounts[`${p.id}${p.tier ?? ""}${p.away ? "(away)" : ""}`] = matchesPlayedBy(matches, p.id);
  return { matches, log, maxSpread, spreadAt, illegal, stuck, endless, repeats, finalCounts };
}

const mk = (spec: [Tier | undefined, number][], order: "asGiven" | "interleave" = "asGiven"): Player[] => {
  const out: Player[] = [];
  const groups = spec.map(([t, n], gi) => Array.from({ length: n }, (_, i) => P(`${t ?? "u"}${i + 1}`, t ? { tier: t } : {})));
  if (order === "asGiven") return groups.flat();
  const maxLen = Math.max(...groups.map((g) => g.length));
  for (let i = 0; i < maxLen; i++) for (const g of groups) if (g[i]) out.push(g[i]);
  return out;
};

const report = (name: string, r: Result) => {
  console.log(`\n=== ${name}`);
  console.log(`games ${r.matches.length} maxSpread ${r.maxSpread} repeats ${r.repeats} stuck ${r.stuck} endless ${r.endless}`);
  if (r.illegal.length) console.log("ILLEGAL:", r.illegal.join("\n"));
  if (r.spreadAt.length) console.log("SPREAD>1:", r.spreadAt.slice(0, 6).join("\n"));
  console.log("final", JSON.stringify(r.finalCounts));
  console.log(r.log.join("\n"));
};

describe("review traces", () => {
  it("12A 8B one court target 3, A seats first", () => { report("12A8B A-first", sim(mk([["A", 12], ["B", 8]]), 3)); });
  it("12A 8B, B seats first", () => { report("12A8B B-first", sim(mk([["B", 8], ["A", 12]]), 3)); });
  it("12A 8B, interleaved", () => { report("12A8B interleaved", sim(mk([["A", 12], ["B", 8]], "interleave"), 3)); });
  it("8 with 2 C: 6B 2C", () => { report("6B2C", sim(mk([["B", 6], ["C", 2]]), 3)); });
  it("8 with 2 C: 2A 4B 2C", () => { report("2A4B2C", sim(mk([["A", 2], ["B", 4], ["C", 2]]), 3)); });
  it("8 with 2 C: 3A 3B 2C", () => { report("3A3B2C", sim(mk([["A", 3], ["B", 3], ["C", 2]]), 3)); });
  it("10 with 3 C: 4A 3B 3C target 2", () => { report("4A3B3C t2", sim(mk([["A", 4], ["B", 3], ["C", 3]]), 2)); });
  it("10 with 3 C: 4A 3B 3C target 4", () => { report("4A3B3C t4", sim(mk([["A", 4], ["B", 3], ["C", 3]]), 4)); });
  it("10 with 3 C: 7B 3C target 2", () => { report("7B3C t2", sim(mk([["B", 7], ["C", 3]]), 2)); });
  it("10 with 3 C: 2A 5B 3C target 4", () => { report("2A5B3C t4", sim(mk([["A", 2], ["B", 5], ["C", 3]]), 4)); });
  it("1A 7B target 3", () => { report("1A7B", sim(mk([["A", 1], ["B", 7]]), 3)); });
  it("3A 5B target 3", () => { report("3A5B", sim(mk([["A", 3], ["B", 5]]), 3)); });
  it("7A 1B target 3", () => { report("7A1B", sim(mk([["A", 7], ["B", 1]]), 3)); });
  it("6A 2B target 3", () => { report("6A2B", sim(mk([["A", 6], ["B", 2]]), 3)); });
  it("walk-in B at game 9, 12A8B A-first", () => { report("walkin B g9 A-first", sim(mk([["A", 12], ["B", 8]]), 3, [{ at: 9, kind: "walkIn", player: P("wB", { tier: "B" }) }])); });
  it("walk-in A at game 9, 12A8B A-first", () => { report("walkin A g9 A-first", sim(mk([["A", 12], ["B", 8]]), 3, [{ at: 9, kind: "walkIn", player: P("wA", { tier: "A" }) }])); });
  it("walk-in B at game 9, 12A8B B-first", () => { report("walkin B g9 B-first", sim(mk([["B", 8], ["A", 12]]), 3, [{ at: 9, kind: "walkIn", player: P("wB", { tier: "B" }) }])); });
  it("walk-in A at game 9, 12A8B B-first", () => { report("walkin A g9 B-first", sim(mk([["B", 8], ["A", 12]]), 3, [{ at: 9, kind: "walkIn", player: P("wA", { tier: "A" }) }])); });
  it("walk-in B at game 7, 12A8B A-first", () => { report("walkin B g7 A-first", sim(mk([["A", 12], ["B", 8]]), 3, [{ at: 7, kind: "walkIn", player: P("wB", { tier: "B" }) }])); });
  it("walk-in B at game 4, 12A8B A-first", () => { report("walkin B g4 A-first", sim(mk([["A", 12], ["B", 8]]), 3, [{ at: 4, kind: "walkIn", player: P("wB", { tier: "B" }) }])); });
  it("away A at game 6, 12A8B", () => { report("away A g6", sim(mk([["A", 12], ["B", 8]]), 3, [{ at: 6, kind: "away", id: "A3" }])); });
  it("away B at game 6, 12A8B", () => { report("away B g6", sim(mk([["A", 12], ["B", 8]]), 3, [{ at: 6, kind: "away", id: "B3" }])); });
  it("away B at game 6 back at 10, 12A8B", () => { report("away B g6 back g10", sim(mk([["A", 12], ["B", 8]]), 3, [{ at: 6, kind: "away", id: "B3" }, { at: 10, kind: "back", id: "B3" }])); });
  it("away designated B at game 3, 4A3B3C t4", () => { report("away desig B", sim(mk([["A", 4], ["B", 3], ["C", 3]]), 4, [{ at: 3, kind: "away", id: "B1" }])); });
  it("2A 6B: away one A at game 3", () => { report("2A6B away A2 g3", sim(mk([["A", 2], ["B", 6]]), 3, [{ at: 3, kind: "away", id: "A2" }])); });
});

describe("fuzz", () => {
  it("random rosters", () => {
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const bad: string[] = [];
    for (let trial = 0; trial < 600; trial++) {
      const n = 8 + Math.floor(rnd() * 17);
      const tiers: Tier[] = [];
      const pa = rnd(), pb = rnd();
      for (let i = 0; i < n; i++) {
        const r = rnd();
        tiers.push(r < pa * 0.6 ? "A" : r < pa * 0.6 + pb * 0.6 ? "B" : "C");
      }
      const cnt = (t: Tier) => tiers.filter((x) => x === t).length;
      const roster = tiers.map((t, i) => P(`p${i}${t}`, { tier: t }));
      const targets = validTargets(n);
      const target = targets[Math.floor(rnd() * targets.length)];
      const events: Event[] = [];
      if (rnd() < 0.3) events.push({ at: 2 + Math.floor(rnd() * 8), kind: "walkIn", player: P(`w${trial}`, { tier: (["A", "B", "C"] as Tier[])[Math.floor(rnd() * 3)] }) });
      if (rnd() < 0.3) events.push({ at: 2 + Math.floor(rnd() * 8), kind: "away", id: roster[Math.floor(rnd() * n)].id });
      const r = sim(roster, target, events);
      const desc = `trial ${trial} n=${n} A${cnt("A")} B${cnt("B")} C${cnt("C")} t${target} ev=${JSON.stringify(events.map((e) => e.kind === "walkIn" ? `${e.kind}@${e.at}:${e.player.tier}` : `${e.kind}@${e.at}:${e.id}`))}`;
      if (r.illegal.length) bad.push(`${desc} ILLEGAL ${r.illegal[0]}`);
      if (r.maxSpread > 1) bad.push(`${desc} SPREAD ${r.spreadAt[0]}`);
      if (r.stuck) bad.push(`${desc} STUCK ${r.stuck}`);
      if (r.endless) bad.push(`${desc} ENDLESS final ${JSON.stringify(r.finalCounts)}`);
    }
    console.log(`\n=== FUZZ bad ${bad.length}\n` + bad.slice(0, 60).join("\n"));
  });
});
