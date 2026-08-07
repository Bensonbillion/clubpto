// Clubhouse publish transform (PIPE-1..PIPE-4, PRIV-6 resolved).
// Pure and deterministic: same input, same bundle — republish is a clean upsert.
// Tier data enters on input types (engine reality) and is never read; champions
// carry court/title names with openly-published event points (LB-4).

import { finalistPoints } from "./types";
import type {
  PublishBundle,
  PublishChampionInput,
  PublishedChampion,
  PublishedPair,
  PublishedPlayerRef,
  PublishOptions,
  PublishPlayerInput,
  PublishSessionInput,
} from "./types";

const HIDDEN_DISPLAY = "Club member";

function displayNameFor(
  player: PublishPlayerInput,
  hidden: Set<string>,
  pseudonyms: Record<string, string>
): PublishedPlayerRef {
  if (hidden.has(player.id)) return { displayName: HIDDEN_DISPLAY };
  if (pseudonyms[player.id]) return { id: player.id, displayName: pseudonyms[player.id] };
  const last = player.lastName ? ` ${player.lastName.charAt(0).toUpperCase()}.` : "";
  return { id: player.id, displayName: `${player.name}${last}` };
}

export function buildPublishBundle(
  input: PublishSessionInput,
  options: PublishOptions
): PublishBundle {
  const hidden = new Set(options.privacy?.hiddenPlayerIds ?? []);
  const pseudonyms = options.privacy?.pseudonyms ?? {};
  const championOptOut = new Set(options.privacy?.championOptOutIds ?? []);

  const byId = new Map(input.players.map((p) => [p.id, p]));

  const refFor = (playerId: string): PublishedPlayerRef => {
    const p = byId.get(playerId);
    if (!p) return { displayName: HIDDEN_DISPLAY };
    return displayNameFor(p, hidden, pseudonyms);
  };

  const publishedPairs: PublishedPair[] = input.pairs.map((pair) => ({
    pairId: pair.id,
    players: [refFor(pair.playerIds[0]), refFor(pair.playerIds[1])],
  }));
  const pairById = new Map(publishedPairs.map((p) => [p.pairId, p]));

  const practiceOnly = Boolean(input.isPractice);

  const results = practiceOnly
    ? []
    : input.results
        .map((r) => ({
          gameId: r.gameId,
          winnerPairId: r.winnerPairId,
          loserPairId: r.loserPairId,
          completedAt: r.completedAt,
        }))
        .sort((a, b) => a.completedAt - b.completedAt || a.gameId.localeCompare(b.gameId));

  const honor = (c: PublishChampionInput, points: number): PublishedChampion => {
    const pair = pairById.get(c.pairId);
    const base: PublishedPair = pair ?? {
      pairId: c.pairId,
      players: [{ displayName: HIDDEN_DISPLAY }, { displayName: HIDDEN_DISPLAY }],
    };
    // Champion naming opt-out (PRIV-2): the opted-out half is unnamed even
    // though they appear normally elsewhere inside the clubhouse.
    const players = base.players.map((ref) =>
      ref.id && championOptOut.has(ref.id) ? { displayName: HIDDEN_DISPLAY } : ref
    ) as [PublishedPlayerRef, PublishedPlayerRef];
    return { title: c.title, points, pair: { ...base, players } };
  };

  // Event-weighted points, identical for every player (LB-4): the value
  // depends only on the title, never on who won it. Finalists: half the title.
  const champions = practiceOnly
    ? []
    : input.champions.map((c) => honor(c, options.pointsConfig[c.title] ?? 0));
  const finalists = practiceOnly
    ? []
    : (input.finalists ?? []).map((c) =>
        honor(c, finalistPoints(options.pointsConfig[c.title] ?? 0))
      );

  const visiblePlayers = input.players
    .filter((p) => !hidden.has(p.id))
    .map((p) => displayNameFor(p, hidden, pseudonyms))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return {
    session: {
      sessionId: input.sessionId,
      date: input.date,
      venue: input.venue,
      attendanceCount: input.players.length,
      recapNote: options.recapNote?.trim() || undefined,
      shoutouts: options.shoutouts?.map((s) => s.trim()).filter(Boolean),
    },
    players: visiblePlayers,
    pairs: publishedPairs,
    results,
    champions,
    finalists,
    practiceOnly,
  };
}

/**
 * Structural leak guard, callable from tests and the pipeline itself:
 * asserts the serialized bundle carries no tier or division data of any form.
 */
export function assertNoTierLeak(bundle: PublishBundle): void {
  const json = JSON.stringify(bundle);
  if (json.includes('"tier"')) throw new Error("tier key leaked into publish bundle");
  if (json.includes('"division"')) throw new Error("division key leaked into publish bundle");
  for (const entry of [...bundle.champions, ...bundle.finalists]) {
    if (/^[ABC]$/.test(entry.title.trim())) {
      throw new Error(`honor title looks like a tier label: ${entry.title}`);
    }
  }
}
