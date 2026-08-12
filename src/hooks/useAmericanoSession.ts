// PTO Americano v4 — React orchestration (STEP 3: setup + resume).
// The hook wires persistence and actions; every DECISION lives in
// src/lib/americano/. The whole draft persists on every change, so a refresh
// mid-setup or post-start restores exactly where the admin was.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AmericanoPlayer, AmericanoPool, AmericanoSession, AmericanoTier,
} from "@/types/americano";
import {
  courtMatchesNeeded, poolSetupNotices, setupDefaultTarget, validTargets,
  type SetupNotice,
} from "@/lib/americano/config";
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
}

export function useAmericanoSession(): UseAmericanoSession {
  const [session, setSession] = useState<AmericanoSession>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [roster, setRoster] = useState<SharedRosterEntry[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [quickAddBusy, setQuickAddBusy] = useState(false);
  const storeRef = useRef<SessionStore<AmericanoSession> | null>(null);

  useEffect(() => {
    const store = createAmericanoStore({ defaults: DEFAULTS, onSyncStatusChange: setSyncStatus });
    storeRef.current = store;
    void store.load().then(({ state }) => {
      setSession(state);
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

  const startSession = useCallback(() => {
    commit((s) => {
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
  }, [commit]);

  const resetNight = useCallback(() => {
    commit(() => DEFAULTS());
  }, [commit]);

  return {
    session, loading, syncStatus,
    roster, rosterLoading, loadRoster, quickAdd, quickAddBusy,
    setDate, setSessionName, setPractice,
    togglePlayer, isPicked,
    poolViews, movePlayer, setTarget, canStart, startSession, resetNight,
  };
}
