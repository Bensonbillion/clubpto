// Notable lines per session (REC-2): 2-4 auto-computed story beats from
// published data. Positive framing only (DASH-3) — no "streak broken",
// no loss language, ever. Pure functions over bundles, oldest-first.

import type { PublishBundle, PublishedPlayerRef } from "../publish/types";
import { MILESTONE_TIERS, milestoneClubName, playerTotals } from "./stats";

export interface NotableLine {
  /** Short kind tag for styling ("first-title" | "undefeated" | "milestone" | "series"). */
  kind: string;
  text: string;
}

const named = (ref: PublishedPlayerRef): string | null =>
  ref.id ? ref.displayName : null; // hidden players never get story lines

/**
 * Compute notable lines for ONE session given everything published before it.
 * `history` must be all bundles strictly older than `current` (any order).
 */
export function notableLines(current: PublishBundle, history: PublishBundle[]): NotableLine[] {
  const lines: NotableLine[] = [];
  if (current.practiceOnly) return lines;

  const before = playerTotals(history);
  const after = playerTotals([...history, current]);

  // First championship ever (the biggest beat — leads).
  for (const champ of current.champions) {
    for (const ref of champ.pair.players) {
      const name = named(ref);
      if (!name || !ref.id) continue;
      const prev = before.get(ref.id);
      if ((prev?.championships ?? 0) === 0) {
        lines.push({ kind: "first-title", text: `${name} takes a first career title: ${champ.title}.` });
      }
    }
  }

  // Undefeated night: played 2+ games, won them all.
  const pairPlayers = new Map(
    current.pairs.map((p) => [p.pairId, p.players.filter((r) => r.id)])
  );
  const played = new Map<string, { name: string; games: number; wins: number }>();
  for (const r of current.results) {
    for (const [pairId, win] of [
      [r.winnerPairId, true],
      [r.loserPairId, false],
    ] as const) {
      for (const ref of pairPlayers.get(pairId) ?? []) {
        const entry = played.get(ref.id!) ?? { name: ref.displayName, games: 0, wins: 0 };
        entry.games++;
        if (win) entry.wins++;
        played.set(ref.id!, entry);
      }
    }
  }
  for (const p of played.values()) {
    if (p.games >= 2 && p.wins === p.games) {
      lines.push({ kind: "undefeated", text: `${p.name} went undefeated: ${p.wins} for ${p.games}.` });
    }
  }

  // Milestone reached tonight (MILE-2): crossed a club threshold this session.
  for (const [id, t] of after) {
    const prev = before.get(id);
    const tier = MILESTONE_TIERS.find(
      (m) => t.sessions >= m && (prev?.sessions ?? 0) < m
    );
    if (tier) {
      const ref = current.pairs.flatMap((p) => p.players).find((r) => r.id === id);
      const name = ref ? named(ref) : null;
      if (name) {
        lines.push({ kind: "milestone", text: `${name} joins ${milestoneClubName(tier)}: session number ${t.sessions}.` });
      }
    }
  }

  return lines.slice(0, 4); // REC-2: 2-4 lines, never a wall of text
}
