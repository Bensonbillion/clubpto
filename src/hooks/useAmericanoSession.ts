// PTO Americano v4 — React orchestration (STEP 3: setup + resume).
// The hook wires persistence and actions; every DECISION lives in
// src/lib/americano/. The whole draft persists on every change, so a refresh
// mid-setup or post-start restores exactly where the admin was.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AmericanoMatch, AmericanoPlayer, AmericanoPool, AmericanoScore, AmericanoSession,
  AmericanoTier, StandingsRow,
} from "@/types/americano";
import {
  courtMatchesNeeded, poolSetupNotices, setupDefaultTarget, validTargets,
  type SetupNotice,
} from "@/lib/americano/config";
import {
  activeMatch, generateNextMatch, matchesPlayed, nextSelectionPreview, pairKey,
} from "@/lib/americano/generator";
import {
  applyCorrection, applyResult, applyVoid, ensureLive, type GenerationEvent,
} from "@/lib/americano/live";
import {
  canMarkNotHere, markArrived, markLeft, markNotHere, restoreLeft,
} from "@/lib/americano/people";
import {
  attemptCoinFlip, pendingFlips, pickFlipWinner, poolStandings, pruneStaleFlips,
} from "@/lib/americano/flips";
import { strengthOfSchedule } from "@/lib/americano/standings";
import { poolPace, type PoolPace } from "@/lib/americano/pace";
import {
  appendSharedRosterEntry, createAmericanoStore, fetchSharedRoster,
  type SessionStore, type SharedRosterEntry, type SyncStatus,
} from "@/lib/americano/storage";

const COURT2 = "court-2";
const COURT1 = "court-1";

const isoToday = () => new Date().toISOString().slice(0, 10);

const emptyPool = (id: string, label: "Court 1" | "Court 2"): AmericanoPool => ({
  id, label, playerIds: [], targetMatches: 4, playoffMode: "undecided",
  status: "setup", matches: [],
});

const DEFAULTS = (): AmericanoSession => ({
  id: `night-${isoToday()}`,
  date: isoToday(),
  sessionName: "",
  players: [],
  pools: [emptyPool(COURT2, "Court 2"), emptyPool(COURT1, "Court 1")],
  isPractice: false,
  status: "setup",
});

/* ── pure draft helpers (module scope — no hook state involved) ──── */

const withPoolDefaults = (s: AmericanoSession): AmericanoSession => ({
  ...s,
  pools: s.pools.map((pool) => {
    const size = pool.playerIds.length;
    if (validTargets(size).includes(pool.targetMatches)) return pool;
    const fallback = setupDefaultTarget(size);
    return fallback === null ? pool : { ...pool, targetMatches: fallback };
  }),
});

const addToDraft = (s: AmericanoSession, entry: SharedRosterEntry): AmericanoSession => {
  if (s.players.some((p) => p.playerId === entry.playerId)) return s;
  const player: AmericanoPlayer = {
    playerId: entry.playerId,
    displayName: entry.displayName,
    tier: entry.tier,
    status: "present",
    joinedAtMatchIndex: null,
    catchUpUsed: false,
  };
  // Seeded by the split rule: A/B → premier Court 2, C → Court 1. The
  // admin's drags override afterwards and are never fought.
  const target = entry.tier === "C" ? COURT1 : COURT2;
  return withPoolDefaults({
    ...s,
    players: [...s.players, player],
    pools: s.pools.map((pool) =>
      pool.id === target ? { ...pool, playerIds: [...pool.playerIds, entry.playerId] } : pool,
    ),
  });
};

const removeFromDraft = (s: AmericanoSession, playerId: string): AmericanoSession =>
  withPoolDefaults({
    ...s,
    players: s.players.filter((p) => p.playerId !== playerId),
    pools: s.pools.map((pool) => ({
      ...pool,
      playerIds: pool.playerIds.filter((id) => id !== playerId),
    })),
  });

export interface PersonRow {
  playerId: string;
  name: string;
  status: AmericanoPlayer["status"];
  played: number;
  target: number;
  /** "Not here" is only offered while it is truthful (zero match history). */
  canNotHere: boolean;
}

export interface StandingsRowView {
  playerId: string;
  rank: number;
  name: string;
  wins: number;
  losses: number;
  gameDiff: number;
  sos: number;
  /** h2h / sos / coin / losses / diff — what placed this row above the next. */
  tiebreak: StandingsRow["tiebreakApplied"];
  requiresCoinFlip: boolean;
  /** The unresolved pair this row belongs to, when it is flip-tied. */
  flipWith: string | null;
}

export interface PoolLiveView {
  pool: AmericanoPool;
  active: AmericanoMatch | null;
  /** The four names called next (nextSelectionPreview) — null when blocked. */
  nextUp: string[] | null;
  /** Why the court is idle, when it is. */
  blocked: "all_at_target" | "below_four_present" | null;
  pace: PoolPace;
  /** Every match, newest first (voided included, for the log). */
  log: AmericanoMatch[];
  /** The roster panel rows (STEP 5) — every session player in this pool. */
  people: PersonRow[];
  /** Standings, recomputed every render — never stored (STEP 6). */
  standings: StandingsRowView[];
  /** How many flips are actually offered. NOT flagged-rows/2: a run of four
      tied players shows four flags but offers three flips. */
  pendingFlips: number;
}

export interface PoolSetupView {
  pool: AmericanoPool;
  size: number;
  options: { target: number; label: string }[];
  notices: SetupNotice[];
  courtMatches: number;
  blocked: boolean;
}

export interface UseAmericanoSession {
  session: AmericanoSession;
  loading: boolean;
  syncStatus: SyncStatus;

  // Shared roster
  roster: SharedRosterEntry[];
  rosterLoading: boolean;
  loadRoster(): Promise<void>;
  quickAdd(name: string, tier: AmericanoTier): Promise<void>;
  quickAddBusy: boolean;

  // Session stage
  setDate(date: string): void;
  setSessionName(name: string): void;
  setPractice(on: boolean): void;

  // Roster stage
  togglePlayer(entry: SharedRosterEntry): void;
  isPicked(playerId: string): boolean;

  // Pools stage
  poolViews: PoolSetupView[];
  movePlayer(playerId: string, poolId: string): void;
  setTarget(poolId: string, target: number): void;
  canStart: boolean;
  startSession(): void;
  resetNight(): void;

  // The rolling court loop (STEP 4)
  liveViews: PoolLiveView[];
  playerName(id: string): string;
  enterResult(matchId: string, winner: "A" | "B", score: AmericanoScore): void;
  correctResult(matchId: string, winner: "A" | "B", score: AmericanoScore): void;
  voidMatch(matchId: string): void;
  /** Freshly generated match ids — the "now on court" emphasis. */
  freshMatchIds: Set<string>;
  /** Generator warnings per pool, dismissible, never silent. */
  notices: Record<string, string[]>;
  dismissNotices(poolId: string): void;

  // People logistics (STEP 5)
  /** Record a flip the room just watched land (STEP 6). The verdict comes
      back on `flipOutcome` — a flip either records or visibly declines. */
  recordCoinFlip(poolId: string, a: string, b: string, winner: string): void;
  /** Verdict of the most recent recordCoinFlip, keyed by pair (STEP 6.1). */
  flipOutcome: { pairKey: string; accepted: boolean; nonce: number } | null;
  /** The coin: real entropy, injected here so the lib stays deterministic. */
  tossCoin(a: string, b: string): string;

  playerNotHere(playerId: string): void;
  playerArrived(playerId: string): void;
  playerLeft(playerId: string): void;
  playerRestore(playerId: string): void;
  canNotHere(playerId: string): boolean;
  /** The NOT ARRIVED strip — hidden when empty. */
  notArrived: { playerId: string; name: string; poolLabel: string }[];
}

export function useAmericanoSession(): UseAmericanoSession {
  const [session, setSession] = useState<AmericanoSession>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [roster, setRoster] = useState<SharedRosterEntry[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [quickAddBusy, setQuickAddBusy] = useState(false);
  const storeRef = useRef<SessionStore<AmericanoSession> | null>(null);
  // The committed session, readable outside a state updater. Timers (the flip
  // overlay lands on one) need the current truth synchronously.
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; });

  useEffect(() => {
    const store = createAmericanoStore({ defaults: DEFAULTS, onSyncStatusChange: setSyncStatus });
    storeRef.current = store;
    void store.load().then(({ state }) => {
      // Resume: if an active session arrives without a match on a court
      // (e.g. started on the Step 3 stub), get it rolling immediately.
      const ready = ensureLive(state, Date.now(), (e) => pendingEventsRef.current.push(e));
      if (ready !== state) store.save(ready, Date.now());
      setSession(ready);
      setLoading(false);
    });
    const retry = window.setInterval(() => void store.flush(), 20_000);
    const onOnline = () => void store.flush();
    window.addEventListener("online", onOnline);
    return () => {
      window.clearInterval(retry);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const commit = useCallback((updater: (prev: AmericanoSession) => AmericanoSession) => {
    setSession((prev) => {
      const next = updater(prev);
      storeRef.current?.save(next, Date.now());
      return next;
    });
  }, []);

  /* ── shared roster ─────────────────────────────────────────────── */

  const loadRoster = useCallback(async () => {
    setRosterLoading(true);
    try {
      // Source order is the activity proxy: the long-standing club players
      // sit at the head of the shared roster, imports at the tail.
      setRoster(await fetchSharedRoster());
    } finally {
      setRosterLoading(false);
    }
  }, []);

  const togglePlayer = useCallback((entry: SharedRosterEntry) => {
    commit((s) => {
      if (s.status !== "setup") return s;
      return s.players.some((p) => p.playerId === entry.playerId)
        ? removeFromDraft(s, entry.playerId)
        : addToDraft(s, entry);
    });
  }, [commit]);

  const quickAdd = useCallback(async (name: string, tier: AmericanoTier) => {
    setQuickAddBusy(true);
    try {
      const entry = await appendSharedRosterEntry(name, tier);
      setRoster((r) => [entry, ...r]);
      commit((s) => (s.status === "setup" ? addToDraft(s, entry) : s));
    } finally {
      setQuickAddBusy(false);
    }
  }, [commit]);

  const isPicked = useCallback(
    (playerId: string) => session.players.some((p) => p.playerId === playerId),
    [session.players],
  );

  /* ── session stage ─────────────────────────────────────────────── */

  const setDate = useCallback((date: string) => {
    commit((s) => (s.status === "setup" ? { ...s, date, id: `night-${date}` } : s));
  }, [commit]);

  const setSessionName = useCallback((sessionName: string) => {
    commit((s) => (s.status === "setup" ? { ...s, sessionName } : s));
  }, [commit]);

  const setPractice = useCallback((on: boolean) => {
    commit((s) => (s.status === "setup" ? { ...s, isPractice: on } : s));
  }, [commit]);

  /* ── pools stage ───────────────────────────────────────────────── */

  const movePlayer = useCallback((playerId: string, poolId: string) => {
    commit((s) => {
      if (s.status !== "setup") return s;
      if (!s.pools.some((p) => p.id === poolId)) return s;
      return withPoolDefaults({
        ...s,
        pools: s.pools.map((pool) => ({
          ...pool,
          playerIds:
            pool.id === poolId
              ? pool.playerIds.includes(playerId)
                ? pool.playerIds
                : [...pool.playerIds, playerId]
              : pool.playerIds.filter((id) => id !== playerId),
        })),
      });
    });
  }, [commit]);

  const setTarget = useCallback((poolId: string, target: number) => {
    commit((s) => {
      const pool = s.pools.find((p) => p.id === poolId);
      if (s.status !== "setup" || !pool) return s;
      if (!validTargets(pool.playerIds.length).includes(target)) return s;
      return {
        ...s,
        pools: s.pools.map((p) => (p.id === poolId ? { ...p, targetMatches: target } : p)),
      };
    });
  }, [commit]);

  const poolViews = useMemo<PoolSetupView[]>(
    () =>
      session.pools.map((pool) => {
        const size = pool.playerIds.length;
        return {
          pool,
          size,
          options: validTargets(size).map((target) => ({
            target,
            label: `${target} each · ${courtMatchesNeeded(size, target)} matches`,
          })),
          notices: poolSetupNotices(size),
          courtMatches: courtMatchesNeeded(size, pool.targetMatches),
          blocked: size < 4,
        };
      }),
    [session.pools],
  );

  const canStart =
    session.status === "setup" &&
    poolViews.length === 2 && // never vacuously true over missing pools
    poolViews.every(
      (v) => !v.blocked && validTargets(v.size).includes(v.pool.targetMatches),
    );

  /* ── the rolling court loop (STEP 4) ───────────────────────────── */

  const [freshMatchIds, setFreshMatchIds] = useState<Set<string>>(new Set());
  const [notices, setNotices] = useState<Record<string, string[]>>({});
  const [nowTick, setNowTick] = useState(() => Date.now());

  // A slow tick keeps the pace projection honest while the screen sits open.
  useEffect(() => {
    if (session.status !== "active") return;
    const t = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [session.status]);

  const surface = useCallback((events: GenerationEvent[]) => {
    if (events.length === 0) return;
    setFreshMatchIds((prev) => {
      const next = new Set(prev);
      for (const e of events) next.add(e.matchId);
      return next;
    });
    setNowTick(Date.now());
    const withWarnings = events.filter((e) => e.warnings.length > 0);
    if (withWarnings.length > 0) {
      setNotices((n) => {
        const next = { ...n };
        for (const e of withWarnings) {
          next[e.poolId] = [...new Set([...(next[e.poolId] ?? []), ...e.warnings])];
        }
        return next;
      });
    }
  }, []);

  // React executes state updaters at RENDER time, not inside setSession —
  // so generation events are queued on a ref by the updater and drained by
  // an effect after the commit. (Deterministic match ids keep StrictMode's
  // double-invoked updater from queueing two different ids.)
  const pendingEventsRef = useRef<GenerationEvent[]>([]);

  /** commit + keep the courts rolling + surface generation events.
      Every commit also prunes coin flips whose tie no longer exists (STEP 6):
      a correction or void that separates a flipped pair retires the flip on
      the spot, so a stale toss can never quietly keep deciding a rank. */
  const commitLive = useCallback((updater: (prev: AmericanoSession) => AmericanoSession) => {
    setSession((prev) => {
      const next = pruneStaleFlips(ensureLive(updater(prev), Date.now(), (e) => {
        const q = pendingEventsRef.current;
        if (!q.some((x) => x.matchId === e.matchId)) q.push(e);
      }));
      storeRef.current?.save(next, Date.now());
      return next;
    });
  }, []);

  // Replacement notices ("X steps in for Y") queue the same way generation
  // events do — pushed by the updater, drained after the commit.
  const pendingPeopleNoticesRef = useRef<{ poolId: string; text: string }[]>([]);

  useEffect(() => {
    if (pendingEventsRef.current.length > 0) {
      const events = pendingEventsRef.current;
      pendingEventsRef.current = [];
      surface(events);
    }
    if (pendingPeopleNoticesRef.current.length > 0) {
      const items = pendingPeopleNoticesRef.current;
      pendingPeopleNoticesRef.current = [];
      setNotices((n) => {
        const next = { ...n };
        for (const it of items) {
          next[it.poolId] = [...new Set([...(next[it.poolId] ?? []), it.text])];
        }
        return next;
      });
    }
  }, [session, surface]);

  const startSession = useCallback(() => {
    commitLive((s) => {
      if (s.status !== "setup") return s;
      for (const pool of s.pools) {
        if (pool.playerIds.length < 4) return s;
        if (!validTargets(pool.playerIds.length).includes(pool.targetMatches)) return s;
      }
      return {
        ...s,
        status: "active",
        pools: s.pools.map((pool) => ({ ...pool, status: "round_robin" as const })),
      };
    });
  }, [commitLive]);

  const enterResult = useCallback((matchId: string, winner: "A" | "B", score: AmericanoScore) => {
    commitLive((s) => applyResult(s, matchId, winner, score, Date.now()));
  }, [commitLive]);

  const correctResult = useCallback((matchId: string, winner: "A" | "B", score: AmericanoScore) => {
    commitLive((s) => applyCorrection(s, matchId, winner, score));
  }, [commitLive]);

  const voidMatch = useCallback((matchId: string) => {
    commitLive((s) => applyVoid(s, matchId));
  }, [commitLive]);

  const dismissNotices = useCallback((poolId: string) => {
    setNotices((n) => ({ ...n, [poolId]: [] }));
  }, []);

  /* ── the visible coin flip (STEP 6) ────────────────────────────── */

  // The entropy lives here, at the edge: crypto.getRandomValues is the coin,
  // the library only says which name that lands on. Falls back to Math.random
  // only where WebCrypto is absent, never silently preferring it.
  const tossCoin = useCallback((a: string, b: string) => {
    const rand = () => {
      const c = globalThis.crypto;
      if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0];
      return Math.floor(Math.random() * 0xffffffff);
    };
    return pickFlipWinner(a, b, rand);
  }, []);

  const [flipOutcome, setFlipOutcome] =
    useState<{ pairKey: string; accepted: boolean; nonce: number } | null>(null);
  const flipNonceRef = useRef(0);

  /**
   * The verdict is decided EAGERLY, against the current session, and published
   * on its own state — deliberately not through the updater-plus-drain-effect
   * road the generation events take.
   *
   * A refusal is a no-op state change: the updater would hand React the very
   * same object, React would bail out without running effects, and the drain
   * would never fire — leaving the overlay stuck mid-flip instead of
   * declining. The one outcome that MUST reach the screen is the one that
   * changes nothing, so it cannot ride on a state change.
   */
  const recordCoinFlip = useCallback((poolId: string, a: string, b: string, winner: string) => {
    const attempt = attemptCoinFlip(sessionRef.current, poolId, a, b, winner, Date.now());
    flipNonceRef.current += 1;
    setFlipOutcome({ pairKey: pairKey(a, b), accepted: attempt.accepted, nonce: flipNonceRef.current });
    if (attempt.accepted) commitLive(() => attempt.session);
  }, [commitLive]);

  /* ── people logistics (STEP 5) ─────────────────────────────────── */

  // Commit a status reducer; when it discards the on-court match, regenerate
  // HERE (commitLive's own ensureLive then no-ops) so the replacement can be
  // named in a notice — the discard-and-recall must never be silent.
  const peopleCommit = useCallback((playerId: string, reduce: (s: AmericanoSession) => AmericanoSession) => {
    commitLive((s) => {
      const pool = s.pools.find((p) => p.playerIds.includes(playerId));
      const hadActive = pool ? activeMatch(pool) : undefined;
      const next = reduce(s);
      if (next === s) return s;
      const discarded =
        pool && hadActive &&
        [...hadActive.teamA, ...hadActive.teamB].includes(playerId) &&
        !next.pools.find((p) => p.id === pool.id)!.matches.some((m) => m.id === hadActive.id);
      if (!discarded) return next;
      const rolled = ensureLive(next, Date.now(), (e) => {
        const q = pendingEventsRef.current;
        if (!q.some((x) => x.matchId === e.matchId)) q.push(e);
      });
      const newActive = activeMatch(rolled.pools.find((p) => p.id === pool.id)!);
      if (newActive) {
        const nameOf = (id: string) => s.players.find((p) => p.playerId === id)?.displayName ?? id;
        const old = new Set([...hadActive.teamA, ...hadActive.teamB]);
        const stepIn = [...newActive.teamA, ...newActive.teamB].filter((id) => !old.has(id));
        const text =
          stepIn.length > 0
            ? `${stepIn.map(nameOf).join(" and ")} step${stepIn.length === 1 ? "s" : ""} in for ${nameOf(playerId)} — call the new names.`
            : `The court re-called without ${nameOf(playerId)}.`;
        const q = pendingPeopleNoticesRef.current;
        if (!q.some((x) => x.poolId === pool.id && x.text === text)) q.push({ poolId: pool.id, text });
      }
      return rolled;
    });
  }, [commitLive]);

  const playerNotHere = useCallback(
    (id: string) => peopleCommit(id, (s) => markNotHere(s, id)), [peopleCommit]);
  const playerArrived = useCallback(
    (id: string) => peopleCommit(id, (s) => markArrived(s, id)), [peopleCommit]);
  const playerLeft = useCallback(
    (id: string) => peopleCommit(id, (s) => markLeft(s, id)), [peopleCommit]);
  const playerRestore = useCallback(
    (id: string) => peopleCommit(id, (s) => restoreLeft(s, id)), [peopleCommit]);
  const canNotHere = useCallback(
    (id: string) => canMarkNotHere(session, id), [session]);

  const notArrived = useMemo(() => {
    if (session.status === "setup") return [];
    return session.players
      .filter((p) => p.status === "not_arrived")
      .map((p) => ({
        playerId: p.playerId,
        name: p.displayName,
        poolLabel:
          session.pools.find((pool) => pool.playerIds.includes(p.playerId))?.label ?? "",
      }));
  }, [session]);

  const playerName = useCallback(
    (id: string) => session.players.find((p) => p.playerId === id)?.displayName ?? id,
    [session.players],
  );

  const liveViews = useMemo<PoolLiveView[]>(() => {
    if (session.status === "setup") return [];
    return session.pools.map((pool) => {
      const active = activeMatch(pool) ?? null;
      let blocked: PoolLiveView["blocked"] = null;
      if (!active && pool.status === "round_robin") {
        const gen = generateNextMatch(pool, session.players);
        if ("blocked" in gen && gen.blocked !== "match_active") blocked = gen.blocked;
      }
      const previewIds = nextSelectionPreview(pool, session.players);
      return {
        pool,
        active,
        nextUp: previewIds
          ? previewIds.map(playerName).sort((a, b) => a.localeCompare(b))
          : null,
        blocked,
        pace: poolPace(pool, session.players, nowTick),
        log: [...pool.matches].reverse(),
        people: pool.playerIds
          .map((id) => session.players.find((p) => p.playerId === id))
          .filter((p): p is AmericanoPlayer => !!p)
          .map((p) => ({
            playerId: p.playerId,
            name: p.displayName,
            status: p.status,
            played: matchesPlayed(pool, p.playerId),
            target: pool.targetMatches,
            canNotHere: canMarkNotHere(session, p.playerId),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        // Coins still to toss before every group on this court is ordered —
        // the honest count, not flagged-rows halved.
        pendingFlips: pendingFlips(pool, session.players)
          .reduce((n, f) => n + f.remaining, 0),
        standings: (() => {
          const pending = pendingFlips(pool, session.players);
          // Only the NEXT flip of each group is offerable: the procedure is an
          // insertion, so each answer decides what is asked next.
          const partner = new Map<string, string>();
          for (const { a, b } of pending) { partner.set(a, b); partner.set(b, a); }
          return poolStandings(pool, session.players).map((r) => ({
            playerId: r.playerId,
            rank: r.rank,
            name: playerName(r.playerId),
            wins: r.wins,
            losses: r.losses,
            gameDiff: r.gameDiff,
            sos: strengthOfSchedule(pool, r.playerId),
            tiebreak: r.tiebreakApplied,
            requiresCoinFlip: r.requiresCoinFlip,
            flipWith: partner.get(r.playerId) ?? null,
          }));
        })(),
      };
    });
  }, [session, playerName, nowTick]);

  const resetNight = useCallback(() => {
    // Ephemera must not leak into the next session: pool ids are constant,
    // so stale notices would render on next week's fresh courts.
    setNotices({});
    setFlipOutcome(null);
    setFreshMatchIds(new Set());
    pendingEventsRef.current = [];
    pendingPeopleNoticesRef.current = [];
    commit(() => DEFAULTS());
  }, [commit]);

  return {
    session, loading, syncStatus,
    roster, rosterLoading, loadRoster, quickAdd, quickAddBusy,
    setDate, setSessionName, setPractice,
    togglePlayer, isPicked,
    poolViews, movePlayer, setTarget, canStart, startSession, resetNight,
    liveViews, playerName, enterResult, correctResult, voidMatch,
    freshMatchIds, notices, dismissNotices, recordCoinFlip, tossCoin, flipOutcome,
    playerNotHere, playerArrived, playerLeft, playerRestore, canNotHere, notArrived,
  };
}
