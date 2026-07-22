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
import { generatePairs, publicCountSummary } from "../checkin";
import { generateRoundSchedule } from "../scheduler/rounds";
import { validateRoundSchedule } from "../scheduler/validate";
import { correctResult } from "../edge";
import { pausedOverlapMs, projectFinish, roundBoundaryDecision, type PauseInterval } from "../pace";
import type { CompletedRRGame } from "../playoffs";
import { playerStandings, seedWednesdayTop8, sortSeeding, wednesdayBracket } from "../playoffs";
import { createSessionStore, type SessionStore, type SyncStatus } from "../persistence";

// ---------------------------------------------------------------------------
// Session state (the persisted envelope)
// ---------------------------------------------------------------------------

export type SessionPhase = "setup" | "rounds" | "playoffs" | "done";

export interface SessionV2Config {
  courts: number;
  targetRounds: number;
  sameTierRounds: number;
  assumedGameMinutes: number;
  playoffBudgetMinutes: number;
  /** "HH:MM" 24h — resolved to an epoch hard stop when the session starts. */
  hardStopTime: string;
  seed: number;
}

export interface PlayoffsState {
  seeds: StandingRow[];
  notes: string[];
  matches: PlayoffMatch[];
  /** matchId → winning side. The final is created when both semis resolve. */
  winners: Record<string, "a" | "b">;
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
  hardStopAt: number | null;
  playoffs: PlayoffsState | null;
  /** Winning players' ids once the final resolves. */
  champion: string[] | null;
}

const DEFAULT_CONFIG: SessionV2Config = {
  courts: 2,
  targetRounds: 4,
  sameTierRounds: 2,
  assumedGameMinutes: 9,
  playoffBudgetMinutes: 22,
  hardStopTime: "22:00",
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
  schedule: null,
  currentRound: 0,
  results: [],
  voidedGames: [],
  gameStarts: {},
  paceSamples: [],
  pauses: [],
  sessionStartedAt: null,
  hardStopAt: null,
  playoffs: null,
  champion: null,
});

/** One-tap presets (§14) — kills setup errors at 7:55. */
export const SESSION_TEMPLATES: Record<string, { label: string; note?: string; patch: Partial<SessionV2Config> }> = {
  wednesday: {
    label: "Wednesday · Mississauga",
    patch: { courts: 2, targetRounds: 4, sameTierRounds: 2, assumedGameMinutes: 9, playoffBudgetMinutes: 20, hardStopTime: "22:00" },
  },
  sunday: {
    label: "Sunday · North York",
    note: "3-court isolated mode UI is still in build — this preset covers timing only.",
    patch: { courts: 2, targetRounds: 3, sameTierRounds: 2, assumedGameMinutes: 8, playoffBudgetMinutes: 15, hardStopTime: "20:40" },
  },
};

const STORAGE_KEY = "cm_v2_session";
const SCHEMA_VERSION = 3; // bump when SessionV2 shape changes — old sessions reset

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

export interface CourtView {
  court: number;
  nowPlaying: RoundGame | null;
  onDeck: RoundGame | null;
  /** Remaining games on this court in the current round, in slot order. */
  upcoming: RoundGame[];
}

function courtViews(s: SessionV2): CourtView[] {
  const done = settledIds(s);
  const views: CourtView[] = [];
  for (let court = 1; court <= s.config.courts; court++) {
    const pending = roundGames(s, s.currentRound)
      .filter((g) => g.court === court && !done.has(g.id))
      .sort((a, b) => a.slot - b.slot);
    views.push({
      court,
      nowPlaying: pending[0] ?? null,
      onDeck: pending[1] ?? null,
      upcoming: pending.slice(2),
    });
  }
  return views;
}

function gamesRemaining(s: SessionV2): number {
  const done = settledIds(s);
  let n = 0;
  for (let r = s.currentRound; r <= (s.schedule?.rounds.length ?? 0); r++) {
    n += roundGames(s, r).filter((g) => !done.has(g.id)).length;
  }
  return n;
}

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------

export interface UseSessionV2 {
  session: SessionV2;
  loading: boolean;
  syncStatus: SyncStatus;

  // Setup & check-in
  addPlayer(name: string, tier: Tier, opts?: { isVip?: boolean; isCoach?: boolean }): void;
  removePlayer(playerId: string): void;
  toggleCheckIn(playerId: string): void;
  setVipPick(vipId: string, partnerId: string | null): void;
  setFlag(playerId: string, flag: "isVip" | "isCoach", value: boolean): void;
  updateConfig(patch: Partial<SessionV2Config>): void;
  /** One-tap preset (§14). Key of SESSION_TEMPLATES. Setup phase only. */
  applyTemplate(key: string): void;
  /** Practice flag (§5) — locked once the first result exists. */
  setPractice(on: boolean): void;
  loadDemoRoster(): void;
  buildPairs(): void;
  startSession(): void;
  resetSession(): void;

  // Rounds
  courts: CourtView[];
  countSummary: { checkedIn: number; total: number };
  roundComplete: boolean;
  /** True only at the boundary before the final round (§6 decision point). */
  atDecisionPoint: boolean;
  decision: ReturnType<typeof roundBoundaryDecision> | null;
  /** Live projection banner (visible from mid-session onward). */
  projection: ReturnType<typeof projectFinish> | null;
  scheduleWarnings: string[];
  recordWinner(gameId: string, winnerPairId: string): void;
  correctGame(gameId: string, winnerPairId: string): void;
  playNextRound(): void;
  /** END GAME — ABANDONED (§9): VOID (counts for nobody) or AWARD to a pair. */
  abandonGame(gameId: string, outcome: "void" | "award", awardPairId?: string): void;
  /** Pause (§8): freezes measured time for interruptions. */
  isPaused: boolean;
  pauseSession(): void;
  resumeSession(): void;
  /** Hard stop is editable mid-session (§5) — projections update instantly. */
  setHardStopLive(hhmm: string): void;

  // Playoffs
  standings: StandingRow[];
  startPlayoffs(): void;
  recordPlayoffWinner(matchId: string, side: "a" | "b"): void;

  // Lookups for rendering
  pairName(pairId: string): string;
  playerName(playerId: string): string;
}

let idCounter = 0;
function freshId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function resolveHardStop(hhmm: string, nowMs: number): number {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(nowMs);
  d.setHours(h ?? 22, m ?? 0, 0, 0);
  if (d.getTime() < nowMs) d.setDate(d.getDate() + 1); // sessions can cross midnight
  return d.getTime();
}

export function useSessionV2(): UseSessionV2 {
  const [session, setSession] = useState<SessionV2>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const storeRef = useRef<SessionStore<SessionV2> | null>(null);

  useEffect(() => {
    const store = createSessionStore<SessionV2>({
      storageKey: STORAGE_KEY,
      schemaVersion: SCHEMA_VERSION,
      storage: window.localStorage,
      remote: null, // Supabase adapter lands later — NEW row, never legacy game_state
      defaults: DEFAULTS,
      onSyncStatusChange: setSyncStatus,
    });
    storeRef.current = store;
    void store.load().then(({ state }) => {
      setSession(state);
      setLoading(false);
    });
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
          checkedIn: false,
        },
      ],
    }));
  }, [commit]);

  const removePlayer = useCallback((playerId: string) => {
    commit((s) => ({ ...s, players: s.players.filter((p) => p.id !== playerId) }));
  }, [commit]);

  const toggleCheckIn = useCallback((playerId: string) => {
    commit((s) => ({
      ...s,
      players: s.players.map((p) =>
        p.id === playerId
          ? { ...p, checkedIn: !p.checkedIn, checkInTime: !p.checkedIn ? Date.now() : undefined }
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
    commit((s) => ({ ...s, config: { ...s.config, ...patch } }));
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

  const loadDemoRoster = useCallback(() => {
    const first = ["Maya", "Leo", "Ana", "Owen", "Zara", "Kai", "Nina", "Theo", "Iris", "Finn", "Lila", "Ezra",
      "Ruby", "Jude", "Vera", "Sam", "Tess", "Remy", "Cleo", "Nash", "Faye", "Cruz", "Wren", "Beck"];
    const players: Player[] = first.map((name, i) => ({
      id: `demo-${i + 1}`,
      name,
      tier: (["A", "B", "C"] as Tier[])[Math.floor(i / 8)],
      isVip: false,
      isCoach: i === 8, // one coach in B
      checkedIn: true,
      checkInTime: Date.now() - (24 - i) * 1000,
    }));
    commit((s) => ({ ...s, players, pairs: [], unpaired: { A: [], B: [], C: [] } }));
  }, [commit]);

  const buildPairs = useCallback(() => {
    commit((s) => {
      const gen = generatePairs(s.players, s.config.seed);
      return { ...s, pairs: gen.pairs, unpaired: gen.unpaired, vipRejected: gen.vip.rejected };
    });
  }, [commit]);

  const startSession = useCallback(() => {
    commit((s) => {
      if (s.pairs.length < 4) return s;
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
        hardStopAt: resolveHardStop(s.config.hardStopTime, now),
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

  const resetSession = useCallback(() => {
    storeRef.current?.clearLocal();
    commit(() => DEFAULTS());
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
      const complete = roundGames(next, next.currentRound).every((g) => done.has(g.id));
      if (complete && next.currentRound < next.config.targetRounds - 1) {
        next = advanceRound(next, now);
      }
      return next;
    });
  }, [commit]);

  const playNextRound = useCallback(() => {
    commit((s) => {
      if (!isRoundComplete(s, s.currentRound)) return s; // rounds are atomic
      if (s.currentRound >= s.config.targetRounds) return s;
      return advanceRound(s, Date.now());
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
      const complete = roundGames(next, next.currentRound).every((g) => done.has(g.id));
      if (complete && next.currentRound < next.config.targetRounds - 1) {
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

  const setHardStopLive = useCallback((hhmm: string) => {
    commit((s) => ({
      ...s,
      config: { ...s.config, hardStopTime: hhmm },
      hardStopAt: s.sessionStartedAt !== null ? resolveHardStop(hhmm, Date.now()) : s.hardStopAt,
    }));
  }, [commit]);

  // --- playoffs ------------------------------------------------------------

  const startPlayoffs = useCallback(() => {
    commit((s) => {
      if (s.phase !== "rounds" || !isRoundComplete(s, s.currentRound)) return s; // §6: boundary-only
      const checkedIn = s.players.filter((p) => p.checkedIn);
      const games = rrGames(s);
      const { seeds, notes } = seedWednesdayTop8(checkedIn, s.pairs, games);
      let matches: PlayoffMatch[];
      if (seeds.length >= 8) {
        matches = wednesdayBracket(seeds.slice(0, 8));
      } else if (seeds.length >= 4) {
        // Small-session fallback: one final, seeds 1&4 vs 2&3.
        matches = [{
          id: "final",
          stage: "final",
          court: 1,
          a: { seedLabel: "1 & 4", ids: [seeds[0].id, seeds[3].id] },
          b: { seedLabel: "2 & 3", ids: [seeds[1].id, seeds[2].id] },
        }];
      } else {
        return s;
      }
      return { ...s, phase: "playoffs", playoffs: { seeds, notes, matches, winners: {} } };
    });
  }, [commit]);

  const recordPlayoffWinner = useCallback((matchId: string, side: "a" | "b") => {
    commit((s) => {
      if (!s.playoffs) return s;
      const match = s.playoffs.matches.find((m) => m.id === matchId);
      if (!match || s.playoffs.winners[matchId]) return s;
      const winners = { ...s.playoffs.winners, [matchId]: side };
      let matches = s.playoffs.matches;
      let champion = s.champion;
      let phase = s.phase;

      const semis = matches.filter((m) => m.stage === "semi");
      const bothSemisDone = semis.length === 2 && semis.every((m) => winners[m.id]);
      const finalExists = matches.some((m) => m.stage === "final");
      if (bothSemisDone && !finalExists) {
        const winTeam = (m: PlayoffMatch) => (winners[m.id] === "a" ? m.a : m.b);
        matches = [
          ...matches,
          { id: "final", stage: "final", court: 1, a: winTeam(semis[0]), b: winTeam(semis[1]) },
        ];
      }
      const final = matches.find((m) => m.stage === "final");
      if (final && winners[final.id]) {
        champion = (winners[final.id] === "a" ? final.a : final.b).ids;
        phase = "done";
      }
      return { ...s, phase, champion, playoffs: { ...s.playoffs, matches, winners } };
    });
  }, [commit]);

  // --- derived -------------------------------------------------------------

  const courts = useMemo(() => courtViews(session), [session]);
  const countSummary = useMemo(() => publicCountSummary(session.players), [session.players]);
  const isPaused = session.pauses.some((p) => p.end === null);
  const roundComplete = useMemo(
    () => isRoundComplete(session, session.currentRound),
    [session],
  );
  const atDecisionPoint =
    session.phase === "rounds" &&
    roundComplete &&
    session.currentRound === session.config.targetRounds - 1;

  const decision = useMemo(() => {
    if (!atDecisionPoint || !session.hardStopAt) return null;
    return roundBoundaryDecision({
      nowMs: Date.now(),
      gamesRemaining: roundGames(session, session.currentRound + 1).length,
      courts: session.config.courts,
      hardStopAt: session.hardStopAt,
      playoffBudgetMs: session.config.playoffBudgetMinutes * 60_000,
      pace: toPace(session),
      nextRoundLabel: `round ${session.currentRound + 1}`,
    });
  }, [session, atDecisionPoint]);

  const projection = useMemo(() => {
    if (session.phase !== "rounds" || !session.hardStopAt || session.results.length === 0) return null;
    return projectFinish({
      nowMs: Date.now(),
      gamesRemaining: gamesRemaining(session),
      courts: session.config.courts,
      hardStopAt: session.hardStopAt,
      playoffBudgetMs: session.config.playoffBudgetMinutes * 60_000,
      pace: toPace(session),
    });
  }, [session]);

  const scheduleWarnings = useMemo(() => {
    if (!session.schedule) return [];
    const violations = validateRoundSchedule(session.pairs, session.schedule, {
      maxSpread: Object.keys(session.schedule.byes).length > 0 ? 1 : 0,
    });
    return [...session.schedule.disclosures, ...violations.map((v) => v.message)];
  }, [session.schedule, session.pairs]);

  const standings = useMemo(() => {
    const checkedIn = session.players.filter((p) => p.checkedIn);
    const rows = playerStandings(checkedIn, session.pairs, rrGames(session));
    return sortSeeding(rows, () => 0);
  }, [session]);

  const playerName = useCallback(
    (playerId: string) => session.players.find((p) => p.id === playerId)?.name ?? playerId,
    [session.players],
  );
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
    toggleCheckIn,
    setVipPick,
    setFlag,
    updateConfig,
    applyTemplate,
    setPractice,
    loadDemoRoster,
    buildPairs,
    startSession,
    resetSession,
    courts,
    countSummary,
    roundComplete,
    atDecisionPoint,
    decision,
    projection,
    scheduleWarnings,
    recordWinner,
    correctGame,
    playNextRound,
    abandonGame,
    isPaused,
    pauseSession,
    resumeSession,
    setHardStopLive,
    standings,
    startPlayoffs,
    recordPlayoffWinner,
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
