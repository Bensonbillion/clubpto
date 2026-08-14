// What a Publish will write, decided before anything is written.
//
// Pure: no React, no Supabase. The RPC in publish.ts takes the payload this
// produces and does nothing but send it, so every refusal is decided here,
// where it can be tested and where it can be shown to an admin before they
// tap rather than after.

import type { SessionV2 } from "@/court-manager/react/useSessionV2";
import type { AmericanoSession } from "@/types/americano";
import { clubDate } from "@/lib/clubDate";
import { courtsStillPlaying, isNightComplete } from "@/lib/americano/playoff";
import { buildPublishBundle } from "./transform";
import { PTO_POINTS_V1, type PublishOptions, type PublishSessionInput } from "./types";
import type { AliasRow } from "./aliases";

/** Exactly the seven arguments publish_session takes. */
export interface PublishPayload {
  session: {
    session_id: string;
    date: string;
    venue: string;
    attendance_count: number;
    recap_note: string | null;
    shoutouts: string[] | null;
    practice_only: boolean;
  };
  pairs: { pair_id: string; players: unknown }[];
  results: { game_id: string; winner_pair_id: string; loser_pair_id: string; completed_at: number }[];
  champions: { title: string; points: number; pair: unknown }[];
  finalists: { title: string; points: number; pair: unknown }[];
  attendance: { player_id: string }[];
  aliases: { kind: string; value: string; player_id: string }[];
}

export type PublishPlan =
  | {
      ok: true;
      payload: PublishPayload;
      /** What this publish deliberately does NOT record. Shown, not hidden. */
      notes: string[];
    }
  | { ok: false; refusals: string[] };

/* ── the session id (C6) ─────────────────────────────────────────── */

/**
 * `night-<date>` was the id, and clubhouse_sessions.session_id is a primary
 * key — so two sessions on one date silently merged into one row and their
 * children collided on (session_id, pair_id) and (session_id, title). The
 * second night overwrote the first and nothing anywhere said so.
 *
 * The start instant fixes both halves at once. It is written once when the
 * night starts and never touched again, so every press of Publish derives
 * the same id; and two nights on one date started at different moments, so
 * their ids differ.
 *
 * Null means the night never started, and Publish refuses rather than
 * inventing an id from the clock — which would mint a NEW id on every press
 * and file one night as several.
 */
export const publishIdOfV3 = (s: SessionV2): string | null =>
  s.sessionStartedAt ? `night-${clubDate(s.sessionStartedAt)}-${s.sessionStartedAt}` : null;

export const publishIdOfV4 = (s: AmericanoSession): string | null =>
  s.startedAtMs ? `night-${clubDate(s.startedAtMs)}-${s.startedAtMs}` : null;

/* ── shared input ────────────────────────────────────────────────── */

export interface PlanInput {
  /** Confirm-screen state, never a re-derivation at write time. */
  venue: string;
  /** engineId -> roster player_id, from the alias step. */
  mapping: Record<string, string>;
  /** The confirmations to commit in the same transaction. */
  aliasRows: AliasRow[];
  recapNote?: string;
  shoutouts?: string[];
}

const venueRefusal = (venue: string, date: string): string | null =>
  venue.trim()
    ? null
    : `This night needs a venue before it can be published. Wednesdays default to The District Padel, Sundays to North Padel — ${date} is neither, so type where you played.`;

/** Names, not ids, when telling an admin who is unaccounted for. */
const unmappedRefusal = (
  people: { id: string; name: string }[],
  mapping: Record<string, string>
): string | null => {
  const missing = people.filter((p) => !mapping[p.id]);
  if (missing.length === 0) return null;
  const names = missing.map((p) => p.name || p.id).join(", ");
  return `${missing.length} ${missing.length === 1 ? "person is" : "people are"} not matched to a roster member yet: ${names}. Match them, then publish.`;
};

/* ── v4: the honest partial ──────────────────────────────────────── */

/**
 * v4 scores PEOPLE. The published record stores PAIRS, and v4 has no pair
 * entity at all — the generator re-pairs every match specifically to avoid
 * repeating tonight's partnerships, so at the default target a player has
 * four different partners in a night.
 *
 * Minting a pair per match would satisfy every type in the pipeline and be
 * false: the room renders pairs as teams, and playerTotals derives attendance
 * credit from pair membership, so a fabricated pair does not stay cosmetic —
 * it becomes an attendance fact. Publishing zero pairs is the truthful shape.
 */
export function planV4Publish(session: AmericanoSession, input: PlanInput): PublishPlan {
  const refusals: string[] = [];

  const sessionId = publishIdOfV4(session);
  if (!sessionId) {
    refusals.push(
      "This night has not been started, so there is nothing to publish yet. Start the session first."
    );
  }

  if (!isNightComplete(session)) {
    const playing = courtsStillPlaying(session);
    refusals.push(
      playing.length > 0
        ? `${playing.join(" and ")} ${playing.length === 1 ? "has" : "have"} not finished. Crown a champion there, then publish.`
        : "This night has no finished courts to publish."
    );
  }

  const date = session.startedAtMs ? clubDate(session.startedAtMs) : session.date;
  const venueProblem = venueRefusal(input.venue, date);
  if (venueProblem) refusals.push(venueProblem);

  // Everyone who was actually in the room. "not_arrived" means they were
  // expected and never came, which is not attendance.
  const present = session.players.filter((p) => p.status !== "not_arrived");
  const unmapped = unmappedRefusal(
    present.map((p) => ({ id: p.playerId, name: p.displayName })),
    input.mapping
  );
  if (unmapped) refusals.push(unmapped);

  if (refusals.length > 0) return { ok: false, refusals };

  const attendance = present.map((p) => ({ player_id: input.mapping[p.playerId] }));

  return {
    ok: true,
    notes: [
      "Tonight's results are not published. Court 1 and Court 2 score people individually and the club record stores pairs, so a night played this way has no pairs to store.",
      `The room will show that these ${present.length} people were here on ${date} at ${input.venue.trim()}.`,
      "Champions, standings and scores stay on this tablet.",
    ],
    payload: {
      session: {
        session_id: sessionId!,
        date,
        venue: input.venue.trim(),
        attendance_count: present.length,
        recap_note: input.recapNote?.trim() || null,
        shoutouts: input.shoutouts?.length ? input.shoutouts : null,
        practice_only: session.isPractice,
      },
      pairs: [],
      results: [],
      champions: [],
      finalists: [],
      attendance,
      aliases: input.aliasRows.map((a) => ({ kind: a.kind, value: a.value, player_id: a.playerId })),
    },
  };
}

/* ── v3: the full bundle ─────────────────────────────────────────── */

/**
 * v3 is pairs all the way down, so it maps onto the published shape without
 * inventing anything. The bundle still goes through buildPublishBundle so the
 * privacy pass — hidden players, pseudonyms, champion opt-outs — happens
 * exactly where it already happens, rather than being reimplemented here.
 */
export function planV3Publish(
  session: SessionV2,
  input: PlanInput & { privacy?: PublishOptions["privacy"] }
): PublishPlan {
  const refusals: string[] = [];

  const sessionId = publishIdOfV3(session);
  if (!sessionId) {
    refusals.push(
      "This night has not been started, so there is nothing to publish yet. Start the session first."
    );
  }

  const date = session.sessionStartedAt ? clubDate(session.sessionStartedAt) : "";
  const venueProblem = venueRefusal(input.venue, date || "this date");
  if (venueProblem) refusals.push(venueProblem);

  const attended = session.players.filter((p) => p.checkedIn || p.attending);
  const unmapped = unmappedRefusal(
    attended.map((p) => ({ id: p.id, name: p.name })),
    input.mapping
  );
  if (unmapped) refusals.push(unmapped);

  // The champion is a list of PLAYER ids; the published record needs the pair
  // they won as. A stale id left behind by mergeRoster can break that lookup,
  // and a champion row with a dangling pairId is worse than no champion row.
  const championPairId = championPairOf(session);
  if (session.champion?.length && !championPairId) {
    refusals.push(
      "Tonight's champions cannot be matched back to a pair, so the result would be filed against nobody. Check the champion on the Standings tab."
    );
  }

  if (refusals.length > 0) return { ok: false, refusals };

  const voided = new Set(session.voidedGames ?? []);
  const input2: PublishSessionInput = {
    sessionId: sessionId!,
    date,
    venue: input.venue.trim(),
    isPractice: session.practice,
    players: attended.map((p) => ({ id: p.id, name: p.name, lastName: p.lastName })),
    pairs: session.pairs.map((p) => ({ id: p.id, playerIds: p.playerIds })),
    results: session.results
      .filter((r) => !voided.has(r.gameId))
      .map((r) => ({
        gameId: r.gameId,
        winnerPairId: r.winnerPairId,
        loserPairId: r.loserPairId,
        completedAt: r.completedAt,
      })),
    champions: championPairId
      ? [{ title: "Champion of the Week", pairId: championPairId }]
      : [],
  };

  const bundle = buildPublishBundle(input2, {
    pointsConfig: PTO_POINTS_V1,
    privacy: input.privacy,
    recapNote: input.recapNote,
    shoutouts: input.shoutouts,
  });

  return {
    ok: true,
    notes: [],
    payload: {
      session: {
        session_id: bundle.session.sessionId,
        date: bundle.session.date,
        venue: bundle.session.venue,
        attendance_count: attended.length,
        recap_note: bundle.session.recapNote ?? null,
        shoutouts: bundle.session.shoutouts ?? null,
        practice_only: bundle.practiceOnly,
      },
      pairs: bundle.pairs.map((p) => ({ pair_id: p.pairId, players: p.players })),
      results: bundle.results.map((r) => ({
        game_id: r.gameId,
        winner_pair_id: r.winnerPairId,
        loser_pair_id: r.loserPairId,
        completed_at: r.completedAt,
      })),
      champions: bundle.champions.map((c) => ({ title: c.title, points: c.points, pair: c.pair })),
      finalists: bundle.finalists.map((c) => ({ title: c.title, points: c.points, pair: c.pair })),
      attendance: attended.map((p) => ({ player_id: input.mapping[p.id] })),
      aliases: input.aliasRows.map((a) => ({ kind: a.kind, value: a.value, player_id: a.playerId })),
    },
  };
}

/** The pair the champions won as, or null when they cannot be matched back. */
function championPairOf(session: SessionV2): string | null {
  const champions = session.champion;
  if (!champions || champions.length !== 2) return null;
  const want = [...champions].sort().join("|");
  const hit = session.pairs.find((p) => [...p.playerIds].sort().join("|") === want);
  return hit?.id ?? null;
}
