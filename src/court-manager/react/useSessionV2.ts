// Court Manager v2 — React orchestration for the Wednesday 2-court flow.
// The hook orchestrates; the pure functions decide (Architectural Law #1).
// Persistence is localStorage-first (§12) under a NEW key — the legacy
// Supabase game_state rows are never touched.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  GameResult,
  Pair,
  PaceState,
  Player,
  PlayoffMatch,
  RoundGame,
  RoundScheduleResult,
  StandingRow,
  Tier,
} from "../types";
import { generatePairs, pairLatecomers, publicCountSummary, swapPairMembers } from "../checkin";
import { buildCourtViews, type CourtView } from "../courtViews";
import { parseRosterCsv } from "../rosterCsv";
import { mergeRoster } from "../rosterMerge";
import { generateRoundSchedule, regenerateFromRound } from "../scheduler/rounds";
import { validateRoundSchedule } from "../scheduler/validate";
import { correctResult } from "../edge";
import { archiveOrThrow } from "../archive";
import { avgGameMs, pausedOverlapMs, type PauseInterval } from "../pace";
import type { CompletedRRGame } from "../playoffs";
import { buildPairH2h, pairStandings, seedWednesdayTop8, sortSeeding, wednesdayBracket } from "../playoffs";
import { buildDisplayNames } from "../displayNames";
import { createSessionStore, type SessionStore, type SyncStatus } from "../persistence";
import { fetchClassicRoster, supabaseRemote } from "../supabase";
import { canAdvanceToNextRound, canMutateSetup, clearTwoCourtSchedule } from "../sessionSafety";

// ---------------------------------------------------------------------------
// Session state (the persisted envelope)
// ---------------------------------------------------------------------------

export type SessionPhase = "setup" | "rounds" | "playoffs" | "done";

export interface SessionV2Config {
  courts: number;
  targetRounds: number;
  sameTierRounds: number;
  /** Baseline used to estimate game length until real durations are measured. */
  assumedGameMinutes: number;
  seed: number;
}

/** Snapshot taken before each playoff winner tap, so a mis-tap can be undone. */
export interface PlayoffUndoEntry {
  matches: PlayoffMatch[];
  winners: Record<string, "a" | "b">;
  champion: string[] | null;
  phase: SessionPhase;
}

export interface PlayoffsState {
  seeds: StandingRow[];
  notes: string[];
  matches: PlayoffMatch[];
  /** matchId → winning side. The final is created when both semis resolve. */
  winners: Record<string, "a" | "b">;
  /** Pre-tap snapshots; undo pops the most recent (courtside mis-taps happen). */
  undoStack: PlayoffUndoEntry[];
}

export interface SessionV2 {
  phase: SessionPhase;
  config: SessionV2Config;
  /** Practice session (§5): identical flow, writes nothing to multi-week records. */
  practice: boolean;
  players: Player[];
  pairs: Pair[];
  unpaired: Record<Tier, string[]>;
  vipRejected: { vipId: string; partnerId: string; reason: string }[];
  /** Seed for pair randomization — bumped by Reshuffle to re-randomize. */
  pairSeed: number;
  schedule: RoundScheduleResult | null;
  currentRound: number;
  results: GameResult[];
  /** Games ended via ABANDONED → VOID: count for nobody, slot recorded unplayed (§9). */
  voidedGames: string[];
  /** gameId → startedAt (stamped when a game reaches NOW PLAYING). */
  gameStarts: Record<string, number>;
  paceSamples: number[];
  /** Pause intervals (§8) — frozen time is excluded from measured durations. */
  pauses: PauseInterval[];
  sessionStartedAt: number | null;
  /**
   * The published session id this night was last filed under, or null.
   * Reset nulls sessionStartedAt, which the publish id is derived from — so
   * resetting before publishing loses the ability to file the night at all.
   * See resetDecision() in src/clubhouse/publish/resetGuard.ts.
   */
  publishedId?: string | null;
  playoffs: PlayoffsState | null;
  /** Winning players' ids once the final resolves. */
  champion: string[] | null;
}

const DEFAULT_CONFIG: SessionV2Config = {
  courts: 2,
  targetRounds: 4,
  sameTierRounds: 2,
  assumedGameMinutes: 9,
  seed: 1,
};

const DEFAULTS = (): SessionV2 => ({
  phase: "setup",
  config: { ...DEFAULT_CONFIG },
  practice: false,
  players: [],
  pairs: [],
  unpaired: { A: [], B: [], C: [] },
  vipRejected: [],
  pairSeed: 1,
  schedule: null,
  currentRound: 0,
  results: [],
  voidedGames: [],
  gameStarts: {},
  paceSamples: [],
  pauses: [],
  sessionStartedAt: null,
  playoffs: null,
  champion: null,
});

/** One-tap presets (§14) — kills setup errors at 7:55. */
export const SESSION_TEMPLATES: Record<string, { label: string; note?: string; patch: Partial<SessionV2Config> }> = {
  wednesday: {
    label: "Wednesday · Mississauga",
    patch: { courts: 2, targetRounds: 4, sameTierRounds: 2, assumedGameMinutes: 9 },
  },
  sunday: {
    label: "Sunday · North York",
    note: "3-court isolated mode UI is still in build — this preset covers timing only.",
    patch: { courts: 2, targetRounds: 3, sameTierRounds: 2, assumedGameMinutes: 8 },
  },
};

// New key (was "cm_v2_session"): a fresh key means a tablet with stale local
// state pulls the loss-proof roster from Supabase on next load instead of
// resuming a broken/empty local session.
const STORAGE_KEY = "cm_v3_session";
// v6: publishedId — what stops Reset from clearing an unpublished night.
const SCHEMA_VERSION = 6;

/**
 * Schema migration — NEVER discard older state on a version bump (the v3 bump
 * silently dropped the roster; that class of loss is banned). Any recognizable
 * older SessionV2 shape is upgraded by layering it over fresh defaults.
 */
export function migrateSession(oldState: unknown, _oldVersion: number): SessionV2 | null {
  if (typeof oldState !== "object" || oldState === null) return null;
  const old = oldState as Partial<SessionV2>;
  if (!Array.isArray(old.players)) return null; // unrecognizable — nothing worth keeping
  const base = DEFAULTS();
  return {
    ...base,
    ...old,
    config: { ...base.config, ...(old.config ?? {}) },
    unpaired: { ...base.unpaired, ...(old.unpaired ?? {}) },
    // `attending` (picked-for-today) was added after the earliest builds. A
    // player already checked in is by definition attending — normalize so they
    // don't vanish from the Check-In tab (which filters on attending).
    players: old.players.map((p) => ({ ...p, attending: p.attending ?? p.checkedIn ?? false })),
    pairs: old.pairs ?? [],
    results: old.results ?? [],
    voidedGames: old.voidedGames ?? [],
    gameStarts: old.gameStarts ?? {},
    paceSamples: old.paceSamples ?? [],
    pauses: old.pauses ?? [],
    vipRejected: old.vipRejected ?? [],
    // Normalize a playoffs object from an older build that predates undoStack,
    // so canUndoPlayoff and undoPlayoffWinner never hit an undefined stack.
    playoffs: old.playoffs ? { ...old.playoffs, undoStack: old.playoffs.undoStack ?? [] } : old.playoffs ?? null,
  };
}

// ---------------------------------------------------------------------------
// Derived helpers (pure)
// ---------------------------------------------------------------------------

function toPace(s: SessionV2): PaceState {
  return { samples: s.paceSamples, assumedGameMs: s.config.assumedGameMinutes * 60_000, minSamples: 4 };
}

function rrGames(s: SessionV2): CompletedRRGame[] {
  const byGame = new Map(s.results.map((r) => [r.gameId, r]));
  const out: CompletedRRGame[] = [];
  for (const round of s.schedule?.rounds ?? []) {
    for (const g of round) {
      const r = byGame.get(g.id);
      if (r) out.push({ pairIds: g.pairIds, winnerPairId: r.winnerPairId });
    }
  }
  return out;
}

function roundGames(s: SessionV2, round: number): RoundGame[] {
  return s.schedule?.rounds[round - 1] ?? [];
}

/** Results + voided games — everything that no longer needs a court. */
function settledIds(s: SessionV2): Set<string> {
  return new Set([...s.results.map((r) => r.gameId), ...s.voidedGames]);
}

function isRoundComplete(s: SessionV2, round: number): boolean {
  const games = roundGames(s, round);
  const done = settledIds(s);
  return games.length > 0 && games.every((g) => done.has(g.id));
}

// Per-court queues (now playing / on deck / next round) live in the pure
// courtViews module so the sim suite can exercise them headlessly.
export type { CourtView };

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------

export interface UseSessionV2 {
  session: SessionV2;
  loading: boolean;
  syncStatus: SyncStatus;

  // Setup & check-in
  addPlayer(
    name: string,
    tier: Tier,
    opts?: { isVip?: boolean; isCoach?: boolean; checkIn?: boolean; attending?: boolean; email?: string },
  ): void;
  removePlayer(playerId: string): void;
  /** Pick / un-pick a player for TODAY's session (adds them to the check-in list). */
  setAttending(playerId: string, on: boolean): void;
  toggleCheckIn(playerId: string): void;
  setVipPick(vipId: string, partnerId: string | null): void;
  setFlag(playerId: string, flag: "isVip" | "isCoach", value: boolean): void;
  /** Edit a player's name or tier (admin, any time — stable IDs never change). */
  updatePlayer(playerId: string, patch: { name?: string; tier?: Tier }): void;
  /** Pull the classic manager's shared roster (read-only) into this roster. */
  importClassicRoster(): Promise<{ added: number; updated: number }>;
  /** Import a contacts CSV (preferred name = first name; phone/email attached). */
  importCsv(csvText: string): { added: number; updated: number };
  /** Full roster wipe — separate from resetSession, which keeps the roster. */
  clearRoster(): void;
  updateConfig(patch: Partial<SessionV2Config>): void;
  /** One-tap preset (§14). Key of SESSION_TEMPLATES. Setup phase only. */
  applyTemplate(key: string): void;
  /** Practice flag (§5) — locked once the first result exists. */
  setPractice(on: boolean): void;
  buildPairs(): void;
  /** Re-randomize the pairs (VIP locks stay). Setup phase only. */
  reshufflePairs(): void;
  /** Hand-swap two players between their pairs (same tier). Setup phase only. */
  swapPlayers(playerIdA: string, playerIdB: string): void;
  startSession(): void;
  /** Async since C7: archives the night first and rejects if that fails. */
  resetSession(): Promise<void>;
  /** Record that this night was filed under `id`, which releases Reset. */
  markPublished(id: string): void;

  // Rounds
  courts: CourtView[];
  /** checkedIn = present · attending = picked for today · total = whole roster. */
  countSummary: { checkedIn: number; attending: number; total: number };
  roundComplete: boolean;
  /** True only at the boundary before the final round — a manual play/jump choice. */
  atDecisionPoint: boolean;
  /** Measured game pace (informational only — there is no hard-stop deadline). */
  paceInfo: { avgMinPerGame: number; usingMeasured: boolean } | null;
  scheduleWarnings: string[];
  recordWinner(gameId: string, winnerPairId: string): void;
  correctGame(gameId: string, winnerPairId: string): void;
  playNextRound(): void;
  /** Checked-in players who arrived after Start and aren't paired into games yet. */
  latecomers: Player[];
  /** Pair the latecomers and slot them into the remaining rounds (join next round). */
  addLatecomers(): void;
  /** END GAME — ABANDONED (§9): VOID (counts for nobody) or AWARD to a pair. */
  abandonGame(gameId: string, outcome: "void" | "award", awardPairId?: string): void;
  /** Pause (§8): freezes measured time for interruptions. */
  isPaused: boolean;
  pauseSession(): void;
  resumeSession(): void;

  // Playoffs
  standings: StandingRow[];
  startPlayoffs(): void;
  /** Undo a premature jump to playoffs (only before any playoff game is decided). */
  returnToRounds(): void;
  /** True while the jump to playoffs can still be reversed. */
  canReturnToRounds: boolean;
  recordPlayoffWinner(matchId: string, side: "a" | "b"): void;
  /** Reverse the last playoff winner tap (mis-taps happen courtside). */
  undoPlayoffWinner(): void;
  /** True when there is a playoff result to undo. */
  canUndoPlayoff: boolean;

  // Lookups for rendering
  pairName(pairId: string): string;
  playerName(playerId: string): string;
}

let idCounter = 0;
function freshId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function useSessionV2(): UseSessionV2 {
  const [session, setSession] = useState<SessionV2>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const storeRef = useRef<SessionStore<SessionV2> | null>(null);
  // Always-current snapshot so import helpers can report accurate counts
  // without depending on React's async setState timing.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    const store = createSessionStore<SessionV2>({
      storageKey: STORAGE_KEY,
      schemaVersion: SCHEMA_VERSION,
      storage: window.localStorage,
      // Background mirror on the NEW cm_v3_session row (§13) — the tablet's
      // localStorage stays the live source of truth.
      remote: supabaseRemote<SessionV2>(),
      defaults: DEFAULTS,
      migrate: migrateSession,
      onSyncStatusChange: setSyncStatus,
    });
    storeRef.current = store;
    void store.load().then(({ state }) => {
      setSession(state);
      setLoading(false);
    });
    // Catch-up loop: retry any unsynced write when the wifi comes back.
    const retry = window.setInterval(() => void store.flush(), 20_000);
    const onOnline = () => void store.flush();
    window.addEventListener("online", onOnline);
    return () => {
      window.clearInterval(retry);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  /** Every mutation goes through commit: local write FIRST, then React state. */
  const commit = useCallback((updater: (prev: SessionV2) => SessionV2) => {
    setSession((prev) => {
      const next = updater(prev);
      storeRef.current?.save(next, Date.now());
      return next;
    });
  }, []);

  // --- setup & check-in ----------------------------------------------------

  const addPlayer = useCallback<UseSessionV2["addPlayer"]>((name, tier, opts) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const checkedIn = opts?.checkIn ?? false;
    commit((s) => ({
      ...s,
      players: [
        ...s.players,
        {
          id: freshId("pl"),
          name: trimmed,
          tier,
          isVip: opts?.isVip ?? false,
          isCoach: opts?.isCoach ?? false,
          email: opts?.email?.trim() || undefined,
          // A newly-added person is picked for TODAY by default (attending).
          // A walk-in is also checked in immediately.
          attending: opts?.attending ?? true,
          checkedIn,
          checkInTime: checkedIn ? Date.now() : undefined,
        },
      ],
    }));
  }, [commit]);

  const removePlayer = useCallback((playerId: string) => {
    commit((s) => {
      // Setup only. Removing a player mid-session would leave a "ghost pair" in
      // the live schedule (a pair referencing someone who no longer exists),
      // which renders half-blank and still gets scheduled games. Blocked.
      if (!canMutateSetup(s.phase)) return s;
      // Their pair has to go, but the PARTNER must not vanish with it: put them
      // back on the waitlist so they're visibly awaiting a new partner instead
      // of silently dropping out of the night with zero games.
      const brokenPair = s.pairs.find((pr) => pr.playerIds.includes(playerId));
      const partnerId = brokenPair?.playerIds.find((id) => id !== playerId);
      const unpaired = { ...s.unpaired };
      if (brokenPair && partnerId) {
        const tier = brokenPair.tier;
        if (!unpaired[tier].includes(partnerId)) unpaired[tier] = [...unpaired[tier], partnerId];
      }
      return {
        ...s,
        players: s.players
          .filter((p) => p.id !== playerId)
          // Anyone who had picked them as a VIP partner loses that dangling
          // pick (it would otherwise resolve to a raw internal id).
          .map((p) => (p.vipPartnerId === playerId ? { ...p, vipPartnerId: undefined } : p)),
        // Drop any pair they were in so a stale pairing can't reach the schedule.
        pairs: s.pairs.filter((pr) => !pr.playerIds.includes(playerId)),
        // Never leave a removed player's id lingering on the waitlist or as
        // someone else's VIP pick — both render raw internal ids on screen.
        unpaired: {
          A: unpaired.A.filter((id) => id !== playerId),
          B: unpaired.B.filter((id) => id !== playerId),
          C: unpaired.C.filter((id) => id !== playerId),
        },
      };
    });
  }, [commit]);

  // Pick / un-pick a player for TODAY's session (the check-in list). Removing
  // from today also clears their check-in.
  const setAttending = useCallback((playerId: string, on: boolean) => {
    commit((s) => ({
      ...s,
      players: s.players.map((p) =>
        p.id === playerId
          ? { ...p, attending: on, checkedIn: on ? p.checkedIn : false, checkInTime: on ? p.checkInTime : undefined }
          : p,
      ),
    }));
  }, [commit]);

  const toggleCheckIn = useCallback((playerId: string) => {
    commit((s) => ({
      ...s,
      players: s.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              checkedIn: !p.checkedIn,
              checkInTime: !p.checkedIn ? Date.now() : undefined,
              // Checking someone in implies they're on today's list.
              attending: !p.checkedIn ? true : p.attending,
            }
          : p,
      ),
    }));
  }, [commit]);

  const setVipPick = useCallback((vipId: string, partnerId: string | null) => {
    commit((s) => ({
      ...s,
      players: s.players.map((p) => (p.id === vipId ? { ...p, vipPartnerId: partnerId ?? undefined } : p)),
    }));
  }, [commit]);

  const setFlag = useCallback((playerId: string, flag: "isVip" | "isCoach", value: boolean) => {
    commit((s) => ({
      ...s,
      players: s.players.map((p) => (p.id === playerId ? { ...p, [flag]: value } : p)),
    }));
  }, [commit]);

  const updateConfig = useCallback((patch: Partial<SessionV2Config>) => {
    // Court count / round targets / format reshape the schedule — setup only.
    commit((s) => (canMutateSetup(s.phase) ? { ...s, config: { ...s.config, ...patch } } : s));
  }, [commit]);

  const applyTemplate = useCallback((key: string) => {
    const template = SESSION_TEMPLATES[key];
    if (!template) return;
    commit((s) => (s.phase === "setup" ? { ...s, config: { ...s.config, ...template.patch } } : s));
  }, [commit]);

  const setPractice = useCallback((on: boolean) => {
    commit((s) => {
      if (s.results.length > 0 || s.voidedGames.length > 0) return s; // locked after first result
      return { ...s, practice: on };
    });
  }, [commit]);

  const buildPairs = useCallback(() => {
    commit((s) => {
      if (!canMutateSetup(s.phase)) return s; // re-pairing mid-session orphans the schedule
      const gen = generatePairs(s.players, s.pairSeed ?? s.config.seed);
      return { ...s, pairs: gen.pairs, unpaired: gen.unpaired, vipRejected: gen.vip.rejected };
    });
  }, [commit]);

  // Re-randomize the pairs — bump the seed so the non-VIP players shuffle into
  // new partners (VIP locks are hard constraints and stay put).
  const reshufflePairs = useCallback(() => {
    commit((s) => {
      if (!canMutateSetup(s.phase)) return s;
      const pairSeed = (s.pairSeed ?? s.config.seed) + 1;
      const gen = generatePairs(s.players, pairSeed);
      return { ...s, pairSeed, pairs: gen.pairs, unpaired: gen.unpaired, vipRejected: gen.vip.rejected };
    });
  }, [commit]);

  // Hand-swap two players between their pairs (admin day-of override). Setup
  // only — the pure function keeps both pairs same-tier and valid, and no-ops
  // on an invalid pick so the schedule is never left with a broken pairing.
  const swapPlayers = useCallback((idA: string, idB: string) => {
    commit((s) => {
      if (!canMutateSetup(s.phase)) return s;
      const pairs = swapPairMembers(s.pairs, idA, idB);
      if (pairs === s.pairs) return s; // invalid swap → no-op, leave everything alone
      // A hand-swap overrides any VIP pick involving the two moved players. Clear
      // vipPartnerId on them AND on anyone who picked them, so a later Reshuffle
      // (which honors VIP picks) can't silently snap the old pairing back.
      const players = s.players.map((p) =>
        p.id === idA || p.id === idB || p.vipPartnerId === idA || p.vipPartnerId === idB
          ? { ...p, vipPartnerId: undefined }
          : p,
      );
      return { ...s, pairs, players };
    });
  }, [commit]);

  const startSession = useCallback(() => {
    commit((s) => {
      // Setup only — a mid-session tap here would wipe every recorded result.
      if (!canMutateSetup(s.phase) || s.pairs.length < 4) return s;
      const now = Date.now();
      const schedule = generateRoundSchedule(s.pairs, {
        rounds: s.config.targetRounds,
        sameTierRounds: s.config.sameTierRounds,
        courts: s.config.courts,
        seed: s.config.seed,
      });
      const gameStarts: Record<string, number> = {};
      for (const g of schedule.rounds[0] ?? []) {
        if (g.slot === 1) gameStarts[g.id] = now;
      }
      return {
        ...s,
        phase: "rounds",
        schedule,
        currentRound: 1,
        sessionStartedAt: now,
        results: [],
        voidedGames: [],
        paceSamples: [],
        pauses: [],
        gameStarts,
        playoffs: null,
        champion: null,
      };
    });
  }, [commit]);


  // Written after publish_session returns. Lives in the session so it syncs
  // to the other tablet and is archived with the night (Step 2b).
  const markPublished = useCallback((id: string) => {
    commit((s) => (s.publishedId === id ? s : { ...s, publishedId: id }));
  }, [commit]);

  const resetSession = useCallback(async () => {
    // C7: copy the night into game_state_archive BEFORE clearing it. If the
    // archive cannot be written, the throw propagates and nothing below runs
    // — the session survives and the caller shows the error. Never clear on
    // a failed archive.
    //
    // C7a: pass this device's envelope too. If pushes have been failing, the
    // remote row is stale or absent and this is the only copy of the night.
    await archiveOrThrow(STORAGE_KEY, {
      local: storeRef.current?.snapshot() ?? null,
      label: "v3 resetSession",
    });

    // End-of-night reset: the ROSTER survives (it's the multi-week asset);
    // the schedule and all of tonight's derived data clear via the single
    // clearTwoCourtSchedule source of truth. Check-ins reset too.
    commit((s) => ({
      ...s,
      ...clearTwoCourtSchedule(s),
      phase: "setup",
      pauses: [],
      paceSamples: [],
      vipRejected: [],
      pairSeed: 1,
      // A practice night must not silently carry into the next real session —
      // its results are excluded from records, which would be invisible here.
      practice: false,
      unpaired: { A: [], B: [], C: [] },
      sessionStartedAt: null,
      players: s.players.map((p) => ({
        ...p,
        attending: false,
        checkedIn: false,
        checkInTime: undefined,
        vipPartnerId: undefined,
      })),
    }));
  }, [commit]);

  const clearRoster = useCallback(() => {
    commit((s) => ({ ...s, players: [], pairs: [], unpaired: { A: [], B: [], C: [] } }));
  }, [commit]);

  const updatePlayer = useCallback((playerId: string, patch: { name?: string; tier?: Tier }) => {
    commit((s) => ({
      ...s,
      players: s.players.map((p) =>
        p.id === playerId
          ? { ...p, ...(patch.name?.trim() ? { name: patch.name.trim() } : {}), ...(patch.tier ? { tier: patch.tier } : {}) }
          : p,
      ),
    }));
  }, [commit]);

  const importClassicRoster = useCallback(async (): Promise<{ added: number; updated: number }> => {
    const imported = await fetchClassicRoster();
    const merged = mergeRoster(sessionRef.current.players, imported);
    commit((s) => ({ ...s, players: mergeRoster(s.players, imported).players }));
    return { added: merged.added, updated: merged.updated };
  }, [commit]);

  const importCsv = useCallback((csvText: string): { added: number; updated: number } => {
    // Preferred (display) name = first name. New CSV people default to tier B —
    // the admin assigns real tiers at check-in. Email/phone are intentionally
    // dropped: session state syncs to a world-readable Supabase row, so contact
    // PII must not be persisted here (see Player.lastName note).
    const parsed = parseRosterCsv(csvText);
    const incoming: Player[] = parsed.map((c) => ({
      id: c.sourceKey,
      name: c.preferredName,
      tier: "B" as Tier,
      isVip: false,
      isCoach: false,
      checkedIn: false,
      lastName: c.lastName ?? undefined,
    }));
    const merged = mergeRoster(sessionRef.current.players, incoming);
    commit((s) => ({ ...s, players: mergeRoster(s.players, incoming).players }));
    return { added: merged.added, updated: merged.updated };
  }, [commit]);

  // --- rounds --------------------------------------------------------------

  const recordWinner = useCallback((gameId: string, winnerPairId: string) => {
    commit((s) => {
      const game = roundGames(s, s.currentRound).find((g) => g.id === gameId);
      if (!game || !game.pairIds.includes(winnerPairId)) return s;
      if (s.results.some((r) => r.gameId === gameId)) return s;
      const now = Date.now();
      const startedAt = s.gameStarts[gameId] ?? now;
      const loserPairId = game.pairIds[0] === winnerPairId ? game.pairIds[1] : game.pairIds[0];
      const result: GameResult = { gameId, winnerPairId, loserPairId, startedAt, completedAt: now };

      // Frozen (paused) time never counts as game duration (§8).
      const durationMs = now - startedAt - pausedOverlapMs(startedAt, now, s.pauses);
      const sane = durationMs >= 2 * 60_000 && durationMs <= 40 * 60_000;
      const paceSamples = sane ? [...s.paceSamples, durationMs] : s.paceSamples;

      // The court frees up — its next game in this round goes NOW PLAYING.
      const done = new Set([...s.results.map((r) => r.gameId), ...s.voidedGames, gameId]);
      const nextOnCourt = roundGames(s, s.currentRound)
        .filter((g) => g.court === game.court && !done.has(g.id))
        .sort((a, b) => a.slot - b.slot)[0];
      const gameStarts = { ...s.gameStarts };
      if (nextOnCourt && !gameStarts[nextOnCourt.id]) gameStarts[nextOnCourt.id] = now;

      let next: SessionV2 = { ...s, results: [...s.results, result], paceSamples, gameStarts };

      // Round boundary handling (§6): auto-advance early boundaries; hold at
      // the decision point (before the final round) and after the last round.
      // Auto-advance only PAST early boundaries and only if the next round
      // really exists; hold at the decision point (before the final round) and
      // at the end. Never advance into an empty/absent round.
      const complete = roundGames(next, next.currentRound).every((g) => done.has(g.id));
      if (
        complete &&
        next.currentRound < next.config.targetRounds - 1 &&
        canAdvanceToNextRound(next.schedule?.rounds, next.currentRound)
      ) {
        next = advanceRound(next, now);
      }
      return next;
    });
  }, [commit]);

  const playNextRound = useCallback(() => {
    commit((s) => {
      if (!isRoundComplete(s, s.currentRound)) return s; // rounds are atomic
      // Bound against the ACTUAL generated schedule, not the config target —
      // advancing into a round the scheduler never produced hard-stalls the board.
      if (!canAdvanceToNextRound(s.schedule?.rounds, s.currentRound)) return s;
      return advanceRound(s, Date.now());
    });
  }, [commit]);

  // Slot mid-session latecomers into the session: pair the checked-in players
  // who aren't in a pair yet, then regenerate the FUTURE rounds (keeping the
  // current and completed rounds untouched) so the newcomers play the rest of
  // the night. They join from the next round — earliest-arrived paired first.
  const addLatecomers = useCallback(() => {
    commit((s) => {
      if (s.phase !== "rounds" || !s.schedule) return s;
      // No future rounds left to add anyone into.
      if (s.currentRound >= s.config.targetRounds) return s;
      const alreadyPaired = new Set(s.pairs.flatMap((p) => p.playerIds));
      const { pairs: newPairs } = pairLatecomers(s.players, alreadyPaired);
      if (newPairs.length === 0) return s; // nobody to add (or only unpaired singles)

      const allPairs = [...s.pairs, ...newPairs];
      // Keep rounds 1..currentRound (played / in progress); regenerate the rest.
      const keep = s.currentRound;
      const completedRounds = s.schedule.rounds.slice(0, keep);
      const completedByes: Record<number, string[]> = {};
      for (const [r, ids] of Object.entries(s.schedule.byes)) {
        if (Number(r) <= keep) completedByes[Number(r)] = ids;
      }
      const schedule = regenerateFromRound(allPairs, completedRounds, completedByes, {
        rounds: s.config.targetRounds,
        sameTierRounds: s.config.sameTierRounds,
        courts: s.config.courts,
        seed: s.config.seed,
      });
      return { ...s, pairs: allPairs, schedule };
    });
  }, [commit]);

  const correctGame = useCallback((gameId: string, winnerPairId: string) => {
    commit((s) => {
      if (s.playoffs) return s; // corrections after seeding need a re-seed — not silently
      try {
        return { ...s, results: correctResult(s.results, gameId, winnerPairId) };
      } catch {
        return s;
      }
    });
  }, [commit]);

  const abandonGame = useCallback((gameId: string, outcome: "void" | "award", awardPairId?: string) => {
    commit((s) => {
      const game = roundGames(s, s.currentRound).find((g) => g.id === gameId);
      if (!game || settledIds(s).has(gameId)) return s;
      const now = Date.now();

      let next: SessionV2;
      if (outcome === "void") {
        // Counts for nobody; the slot is recorded as unplayed. Never fake a result.
        next = { ...s, voidedGames: [...s.voidedGames, gameId] };
      } else {
        if (!awardPairId || !game.pairIds.includes(awardPairId)) return s;
        const loserPairId = game.pairIds[0] === awardPairId ? game.pairIds[1] : game.pairIds[0];
        const result: GameResult = {
          gameId,
          winnerPairId: awardPairId,
          loserPairId,
          startedAt: s.gameStarts[gameId] ?? now,
          completedAt: now,
          awarded: true,
        };
        // No pace sample — an abandoned game's duration isn't representative.
        next = { ...s, results: [...s.results, result] };
      }

      const done = settledIds(next);
      const nextOnCourt = roundGames(next, next.currentRound)
        .filter((g) => g.court === game.court && !done.has(g.id))
        .sort((a, b) => a.slot - b.slot)[0];
      if (nextOnCourt && !next.gameStarts[nextOnCourt.id]) {
        next = { ...next, gameStarts: { ...next.gameStarts, [nextOnCourt.id]: now } };
      }
      // Same boundary rule as recordWinner: auto-advance only past early
      // boundaries, and never into an empty/absent round (would hard-stall).
      const complete = roundGames(next, next.currentRound).every((g) => done.has(g.id));
      if (
        complete &&
        next.currentRound < next.config.targetRounds - 1 &&
        canAdvanceToNextRound(next.schedule?.rounds, next.currentRound)
      ) {
        next = advanceRound(next, now);
      }
      return next;
    });
  }, [commit]);

  const pauseSession = useCallback(() => {
    commit((s) =>
      s.pauses.some((p) => p.end === null) ? s : { ...s, pauses: [...s.pauses, { start: Date.now(), end: null }] },
    );
  }, [commit]);

  const resumeSession = useCallback(() => {
    commit((s) => ({
      ...s,
      pauses: s.pauses.map((p) => (p.end === null ? { ...p, end: Date.now() } : p)),
    }));
  }, [commit]);

  // --- playoffs ------------------------------------------------------------

  const startPlayoffs = useCallback(() => {
    commit((s) => {
      if (s.phase !== "rounds" || !isRoundComplete(s, s.currentRound)) return s; // §6: boundary-only
      const games = rrGames(s);
      // Pass the FULL roster: seeding is driven by s.pairs (who actually played),
      // while `players` is used only to resolve display names. Passing just the
      // checked-in subset made names disagree with the Courts cards, and a
      // paired player who got un-checked-in by a stray tap rendered as a raw id.
      const { seeds, notes } = seedWednesdayTop8(s.players, s.pairs, games);
      // Standard knockout, pair vs pair: 1v8, 4v5, 2v7, 3v6 → semis → final.
      // Short fields degrade inside wednesdayBracket; too few eligible → no-op.
      const matches = wednesdayBracket(seeds, s.pairs);
      if (matches.length === 0) return s;
      return { ...s, phase: "playoffs", playoffs: { seeds, notes, matches, winners: {}, undoStack: [] } };
    });
  }, [commit]);

  // Back out of a premature "jump to playoffs". The trigger lives on the OPEN
  // Courts tab, so a helper can end the round-robin with two taps; without this
  // the only way back was Reset, which wipes the entire night's results. Safe
  // because it only clears the (as-yet unplayed) bracket — the schedule, the
  // recorded results and the round pointer are untouched.
  const returnToRounds = useCallback(() => {
    commit((s) => {
      if (s.phase !== "playoffs") return s;
      // Once a playoff game has been decided, the bracket is real history.
      if (Object.keys(s.playoffs?.winners ?? {}).length > 0) return s;
      return { ...s, phase: "rounds", playoffs: null, champion: null };
    });
  }, [commit]);

  const recordPlayoffWinner = useCallback((matchId: string, side: "a" | "b") => {
    commit((s) => {
      if (!s.playoffs) return s;
      const match = s.playoffs.matches.find((m) => m.id === matchId);
      if (!match || s.playoffs.winners[matchId]) return s;

      // Snapshot BEFORE mutating so a mis-tap is one tap to reverse.
      const snapshot: PlayoffUndoEntry = {
        matches: s.playoffs.matches,
        winners: s.playoffs.winners,
        champion: s.champion,
        phase: s.phase,
      };

      const winners = { ...s.playoffs.winners, [matchId]: side };
      let matches = s.playoffs.matches;
      let champion = s.champion;
      let phase = s.phase;

      const winTeam = (m: PlayoffMatch) => (winners[m.id] === "a" ? m.a : m.b);

      // Each semi is created the MOMENT its half of the bracket is decided —
      // quarters[0..1] (1v8, 4v5) feed semi 1, quarters[2..3] (2v7, 3v6) feed
      // semi 2. Waiting for all four quarters left a freed court idle for a
      // whole game while semi 1's players stood beside it; creating the semi
      // early puts it in the queue (its matchup visible under "Up next"), and
      // the court normalization below sends it straight onto a free court.
      const quarters = matches.filter((m) => m.stage === "quarter");
      if (quarters.length === 4) {
        const halfDone = (i: number, j: number) =>
          Boolean(winners[quarters[i].id] && winners[quarters[j].id]);
        if (halfDone(0, 1) && !matches.some((m) => m.id === "semi1")) {
          matches = [
            ...matches,
            { id: "semi1", stage: "semi", court: 1, a: winTeam(quarters[0]), b: winTeam(quarters[1]) },
          ];
        }
        if (halfDone(2, 3) && !matches.some((m) => m.id === "semi2")) {
          matches = [
            ...matches,
            { id: "semi2", stage: "semi", court: 2, a: winTeam(quarters[2]), b: winTeam(quarters[3]) },
          ];
        }
      }

      const semis = matches.filter((m) => m.stage === "semi");
      const bothSemisDone = semis.length === 2 && semis.every((m) => winners[m.id]);
      const finalExists = matches.some((m) => m.stage === "final");
      if (bothSemisDone && !finalExists) {
        matches = [
          ...matches,
          { id: "final", stage: "final", court: 1, a: winTeam(semis[0]), b: winTeam(semis[1]) },
        ];
      }

      // Court assignment for the live window (games run in waves of
      // `config.courts`): a game already IN PLAY never changes courts; a game
      // entering the window — promoted from the queue, or a semi/final created
      // while a court stands free — takes an unclaimed court. This keeps every
      // label truthful and puts the next game on the court that actually freed.
      const courtCount = Math.max(1, s.config.courts);
      const wasLive = new Set(
        s.playoffs.matches
          .filter((m) => !s.playoffs!.winners[m.id])
          .slice(0, courtCount)
          .map((m) => m.id),
      );
      const liveNow = matches.filter((m) => !winners[m.id]).slice(0, courtCount);
      const claimed = new Set(liveNow.filter((m) => wasLive.has(m.id)).map((m) => m.court));
      const freeCourts: number[] = [];
      for (let c = 1; c <= courtCount; c++) if (!claimed.has(c)) freeCourts.push(c);
      const entering = new Set(liveNow.filter((m) => !wasLive.has(m.id)).map((m) => m.id));
      if (entering.size > 0) {
        matches = matches.map((m) => {
          if (!entering.has(m.id)) return m;
          const court = freeCourts.shift();
          return court !== undefined && m.court !== court ? { ...m, court } : m;
        });
      }
      const final = matches.find((m) => m.stage === "final");
      if (final && winners[final.id]) {
        champion = (winners[final.id] === "a" ? final.a : final.b).ids;
        phase = "done";
      }
      return {
        ...s,
        phase,
        champion,
        playoffs: { ...s.playoffs, matches, winners, undoStack: [...(s.playoffs.undoStack ?? []), snapshot] },
      };
    });
  }, [commit]);

  const undoPlayoffWinner = useCallback(() => {
    commit((s) => {
      if (!s.playoffs) return s;
      const stack = s.playoffs.undoStack ?? [];
      const prev = stack[stack.length - 1];
      if (!prev) return s;
      return {
        ...s,
        phase: prev.phase,
        champion: prev.champion,
        playoffs: {
          ...s.playoffs,
          matches: prev.matches,
          winners: prev.winners,
          undoStack: stack.slice(0, -1),
        },
      };
    });
  }, [commit]);

  // --- derived -------------------------------------------------------------

  const courts = useMemo(() => buildCourtViews(session), [session]);
  const countSummary = useMemo(
    () => ({
      ...publicCountSummary(session.players),
      attending: session.players.filter((p) => p.attending).length,
    }),
    [session.players],
  );
  const isPaused = session.pauses.some((p) => p.end === null);
  // Checked-in players who joined after the pairs were set and aren't in any
  // pair yet — the mid-session latecomers waiting to be slotted into games.
  const latecomers = useMemo(() => {
    if (session.phase !== "rounds") return [];
    const paired = new Set(session.pairs.flatMap((p) => p.playerIds));
    return session.players.filter((p) => p.checkedIn && !paired.has(p.id));
  }, [session.phase, session.pairs, session.players]);
  const roundComplete = useMemo(
    () => isRoundComplete(session, session.currentRound),
    [session],
  );
  const atDecisionPoint =
    session.phase === "rounds" &&
    roundComplete &&
    session.currentRound === session.config.targetRounds - 1;

  // Measured game pace — shown as plain information (how long games run). No
  // deadline, no recommendation: the admin decides when to jump to playoffs.
  const paceInfo = useMemo(() => {
    if (session.phase !== "rounds" || session.results.length === 0) return null;
    const { value, usingMeasured } = avgGameMs(toPace(session));
    return { avgMinPerGame: value / 60_000, usingMeasured };
  }, [session]);

  const scheduleWarnings = useMemo(() => {
    if (!session.schedule) return [];
    // Late-joiner pairs (added mid-session) legitimately play fewer games than
    // the pairs that started in round 1. Exempt them from the even-count check
    // so slotting someone in doesn't spray false "uneven counts" alarms across
    // the helper-facing board.
    const earlyPairs = new Set((session.schedule.rounds[0] ?? []).flatMap((g) => g.pairIds));
    const spreadExempt = session.pairs.map((p) => p.id).filter((id) => !earlyPairs.has(id));
    const violations = validateRoundSchedule(session.pairs, session.schedule, {
      maxSpread: Object.keys(session.schedule.byes).length > 0 ? 1 : 0,
      spreadExempt,
    });
    return [...session.schedule.disclosures, ...violations.map((v) => v.message)];
  }, [session.schedule, session.pairs]);

  // Unambiguous names everywhere (shared first names get a last-name initial).
  const displayNames = useMemo(() => buildDisplayNames(session.players), [session.players]);

  const playerName = useCallback(
    (playerId: string) =>
      displayNames.get(playerId) ?? session.players.find((p) => p.id === playerId)?.name ?? playerId,
    [displayNames, session.players],
  );

  // Standings are per PAIR, not per player: the night is played in fixed pairs
  // and the playoffs seed pairs, so the pair IS the unit that has a record.
  // (Listing individuals also made every partner tie with their own partner,
  // which pushed the coin-flip tiebreaker into almost every row.)
  const standings = useMemo(() => {
    const games = rrGames(session);
    const rows = pairStandings(session.pairs, games).map((r) => {
      const pair = session.pairs.find((p) => p.id === r.id);
      return {
        ...r,
        name: pair
          ? pair.playerIds
              .map((id) => displayNames.get(id) ?? session.players.find((p) => p.id === id)?.name ?? id)
              .join(" & ")
          : r.id,
      };
    });
    return sortSeeding(rows, buildPairH2h(games));
  }, [session, displayNames]);
  const pairName = useCallback(
    (pairId: string) => {
      const pair = session.pairs.find((p) => p.id === pairId);
      if (!pair) return pairId;
      return pair.playerIds.map(playerName).join(" & ");
    },
    [session.pairs, playerName],
  );

  return {
    session,
    loading,
    syncStatus,
    addPlayer,
    removePlayer,
    setAttending,
    toggleCheckIn,
    setVipPick,
    setFlag,
    updatePlayer,
    importClassicRoster,
    importCsv,
    clearRoster,
    updateConfig,
    applyTemplate,
    setPractice,
    buildPairs,
    reshufflePairs,
    swapPlayers,
    startSession,
    resetSession,
    markPublished,
    courts,
    countSummary,
    roundComplete,
    atDecisionPoint,
    paceInfo,
    scheduleWarnings,
    recordWinner,
    correctGame,
    playNextRound,
    latecomers,
    addLatecomers,
    abandonGame,
    isPaused,
    pauseSession,
    resumeSession,
    standings,
    startPlayoffs,
    returnToRounds,
    canReturnToRounds:
      session.phase === "playoffs" && Object.keys(session.playoffs?.winners ?? {}).length === 0,
    recordPlayoffWinner,
    undoPlayoffWinner,
    // Optional-chain undoStack too: a stale playoffs object (loaded from an
    // older build before undoStack existed) would otherwise throw during render
    // and white-screen the whole page with no in-UI recovery.
    canUndoPlayoff: (session.playoffs?.undoStack?.length ?? 0) > 0,
    pairName,
    playerName,
  };
}

function advanceRound(s: SessionV2, now: number): SessionV2 {
  const nextRound = s.currentRound + 1;
  const gameStarts = { ...s.gameStarts };
  for (const g of roundGames(s, nextRound)) {
    if (g.slot === 1 && !gameStarts[g.id]) gameStarts[g.id] = now;
  }
  return { ...s, currentRound: nextRound, gameStarts };
}
