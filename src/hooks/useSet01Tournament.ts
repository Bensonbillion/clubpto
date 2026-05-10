import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { query } from "@/lib/turso";
import {
  Set01State,
  defaultSet01State,
  KnockoutMatch,
  WomensStanding,
  WomensKnockoutMatch,
} from "@/types/set01";
import {
  applySwaps as applySwapsPure,
  buildMatchMap,
  calculateWomensStandings,
  getKnockoutSeeds as getKnockoutSeedsPure,
  matchWinner as matchWinnerPure,
  womensSFWinnerLabel,
} from "@/lib/set01";

const TOURNAMENT_ID = "set01";
const POLL_INTERVAL_MS = 1500; // multi-device sync via polling Turso

// Stable per-device id so we can ignore our own writes when polling
const DEVICE_ID = (() => {
  try {
    let id = localStorage.getItem("clubpto_set01_deviceId");
    if (!id) {
      id = `device-${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem("clubpto_set01_deviceId", id);
    }
    return id;
  } catch {
    return `device-${Math.random().toString(36).substring(2, 11)}`;
  }
})();

/**
 * useSet01Tournament — single source of truth for the Courtside Social Set 01 tournament.
 *
 * Storage: Turso (the operational DB) via the turso-proxy Supabase Edge Function.
 * Sync: polls every ~1.5s for remote changes. Writes update local state immediately
 * (optimistic) and persist asynchronously. The poller compares updated_at + updated_by
 * to suppress echoes of our own writes.
 */
export function useSet01Tournament() {
  const [state, setState] = useState<Set01State>(defaultSet01State());
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"connecting" | "synced" | "saving" | "error">(
    "connecting",
  );
  const lastUpdatedAtRef = useRef<string | null>(null);
  const pendingWriteRef = useRef(false);

  // ── Initial load ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await query("SELECT state, updated_at FROM tournament_state WHERE id = ?", [
          TOURNAMENT_ID,
        ]);
        if (cancelled) return;

        const row = result.rows?.[0] as { state?: string; updated_at?: string } | undefined;

        if (row?.state) {
          try {
            const parsed = JSON.parse(row.state) as Partial<Set01State>;
            if (parsed && Object.keys(parsed).length > 0) {
              setState({ ...defaultSet01State(), ...parsed });
            }
          } catch (e) {
            console.warn("[set01] could not parse stored state, using defaults", e);
          }
          lastUpdatedAtRef.current = row.updated_at ?? null;
        } else {
          // Row missing — try to insert
          await query(
            "INSERT OR IGNORE INTO tournament_state (id, state, updated_by) VALUES (?, ?, ?)",
            [TOURNAMENT_ID, JSON.stringify(defaultSet01State()), DEVICE_ID],
          );
        }
        setSyncStatus("synced");
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        console.error("[set01] init failed:", e);
        setSyncStatus("error");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Polling for remote updates ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled || pendingWriteRef.current) return;
      try {
        const result = await query(
          "SELECT state, updated_at, updated_by FROM tournament_state WHERE id = ?",
          [TOURNAMENT_ID],
        );
        if (cancelled) return;
        const row = result.rows?.[0] as
          | { state?: string; updated_at?: string; updated_by?: string }
          | undefined;
        if (!row) return;

        // Skip if the write came from us, or if we've already seen this version
        if (row.updated_by === DEVICE_ID) return;
        if (row.updated_at && row.updated_at === lastUpdatedAtRef.current) return;

        if (row.state) {
          try {
            const parsed = JSON.parse(row.state) as Partial<Set01State>;
            setState({ ...defaultSet01State(), ...parsed });
            lastUpdatedAtRef.current = row.updated_at ?? null;
            setSyncStatus("synced");
          } catch (e) {
            console.warn("[set01] poll parse error", e);
          }
        }
      } catch (e) {
        // Network blip — don't flip to error on transient poll failures
        console.warn("[set01] poll failed:", e);
      }
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // ── Persist ──────────────────────────────────────────────
  const persist = useCallback(async (next: Set01State) => {
    pendingWriteRef.current = true;
    setSyncStatus("saving");
    try {
      await query(
        `INSERT INTO tournament_state (id, state, updated_at, updated_by)
         VALUES (?, ?, CURRENT_TIMESTAMP, ?)
         ON CONFLICT(id) DO UPDATE SET
           state = excluded.state,
           updated_at = CURRENT_TIMESTAMP,
           updated_by = excluded.updated_by`,
        [TOURNAMENT_ID, JSON.stringify(next), DEVICE_ID],
      );
      // Refresh our updated_at marker so the poller doesn't re-apply our own write
      const result = await query(
        "SELECT updated_at FROM tournament_state WHERE id = ?",
        [TOURNAMENT_ID],
      );
      const row = result.rows?.[0] as { updated_at?: string } | undefined;
      if (row?.updated_at) lastUpdatedAtRef.current = row.updated_at;
      setSyncStatus("synced");
    } catch (e) {
      console.error("[set01] save failed:", e);
      setSyncStatus("error");
    } finally {
      pendingWriteRef.current = false;
    }
  }, []);

  const update = useCallback(
    (mutator: (s: Set01State) => Set01State) => {
      setState((prev) => {
        const next = mutator(prev);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  // ── Mutations: setup ────────────────────────────────────
  const setMensTeam = useCallback(
    (seed: number, slot: "player1" | "player2", player: { id: string; display: string } | null) => {
      update((s) => ({
        ...s,
        mensTeams: s.mensTeams.map((t) =>
          t.initialSeed === seed ? { ...t, [slot]: player } : t,
        ),
      }));
    },
    [update],
  );

  const setWomensTeam = useCallback(
    (label: string, slot: "player1" | "player2", player: { id: string; display: string } | null) => {
      update((s) => ({
        ...s,
        womensTeams: s.womensTeams.map((t) =>
          t.label === label ? { ...t, [slot]: player } : t,
        ),
      }));
    },
    [update],
  );

  // ── Mutations: scoring ──────────────────────────────────
  const setStage1Score = useCallback(
    (matchIdx: number, side: "A" | "B", score: number | null) => {
      update((s) => ({
        ...s,
        stage1: s.stage1.map((m, i) =>
          i === matchIdx ? { ...m, [side === "A" ? "scoreA" : "scoreB"]: score } : m,
        ),
      }));
    },
    [update],
  );

  const setKnockoutScore = useCallback(
    (round: "r16" | "qf" | "sf" | "f", id: string, side: "A" | "B", score: number | null) => {
      update((s) => {
        const key = side === "A" ? "scoreA" : "scoreB";
        if (round === "f") {
          return { ...s, f: { ...s.f, [key]: score } };
        }
        const list = round === "r16" ? s.r16 : round === "qf" ? s.qf : s.sf;
        const updated = list.map((m) => (m.id === id ? { ...m, [key]: score } : m));
        return round === "r16"
          ? { ...s, r16: updated }
          : round === "qf"
          ? { ...s, qf: updated }
          : { ...s, sf: updated };
      });
    },
    [update],
  );

  const markKnockoutAwarded = useCallback(
    (round: "r16" | "qf" | "sf" | "f", id: string) => {
      update((s) => {
        if (round === "f") {
          return { ...s, f: { ...s.f, pointsAwarded: true } };
        }
        const list = round === "r16" ? s.r16 : round === "qf" ? s.qf : s.sf;
        const updated = list.map((m) => (m.id === id ? { ...m, pointsAwarded: true } : m));
        return round === "r16"
          ? { ...s, r16: updated }
          : round === "qf"
          ? { ...s, qf: updated }
          : { ...s, sf: updated };
      });
    },
    [update],
  );

  const setWomensGroupScore = useCallback(
    (matchIdx: number, side: "A" | "B", score: number | null) => {
      update((s) => ({
        ...s,
        womensGroup: s.womensGroup.map((m, i) =>
          i === matchIdx ? { ...m, [side === "A" ? "scoreA" : "scoreB"]: score } : m,
        ),
      }));
    },
    [update],
  );

  const setWomensSFScore = useCallback(
    (idx: number, side: "A" | "B", score: number | null) => {
      update((s) => ({
        ...s,
        womensSF: s.womensSF.map((m, i) =>
          i === idx ? { ...m, [side === "A" ? "scoreA" : "scoreB"]: score } : m,
        ),
      }));
    },
    [update],
  );

  const setWomensFinalScore = useCallback(
    (side: "A" | "B", score: number | null) => {
      update((s) => ({
        ...s,
        womensF: { ...s.womensF, [side === "A" ? "scoreA" : "scoreB"]: score },
      }));
    },
    [update],
  );

  const assignWomensSF = useCallback(
    (sfIdx: number, slot: "teamA" | "teamB", label: string | null) => {
      update((s) => ({
        ...s,
        womensSF: s.womensSF.map((m, i) =>
          i === sfIdx ? { ...m, [slot]: label } : m,
        ),
      }));
    },
    [update],
  );

  // ── Stage 1 swap (delegates to pure logic) ──────────────
  const applyStage1Swaps = useCallback(() => {
    update((s) => ({
      ...s,
      finalSeeds: applySwapsPure(s.stage1),
    }));
  }, [update]);

  const resetSeeds = useCallback(() => {
    update((s) => ({
      ...s,
      finalSeeds: Array.from({ length: 16 }, (_, i) => ({ seed: i + 1, originalSeed: i + 1 })),
    }));
  }, [update]);

  const resetTournament = useCallback(() => {
    update(() => defaultSet01State());
  }, [update]);

  // ── Derived data ────────────────────────────────────────
  const helpers = useMemo(() => {
    const teamBySeed = (seed: number) => {
      const fs = state.finalSeeds.find((f) => f.seed === seed);
      const orig = fs?.originalSeed ?? seed;
      return state.mensTeams[orig - 1] ?? null;
    };

    const matchMap = buildMatchMap(state);

    const findMatchById = (id: string): KnockoutMatch | null => {
      return matchMap.get(id) ?? null;
    };

    const getKnockoutSeeds = (m: KnockoutMatch) => getKnockoutSeedsPure(m, matchMap);

    const womensStandings = (): WomensStanding[] =>
      calculateWomensStandings(state.womensTeams, state.womensGroup);

    const womensTeamByLabel = (label: string | null) =>
      label ? state.womensTeams.find((t) => t.label === label) ?? null : null;

    const womensSFWinner = (sf: WomensKnockoutMatch): string | null => womensSFWinnerLabel(sf);

    const matchWinner = matchWinnerPure;

    return {
      teamBySeed,
      matchWinner,
      findMatchById,
      getKnockoutSeeds,
      womensStandings,
      womensTeamByLabel,
      womensSFWinner,
    };
  }, [state]);

  return {
    state,
    loading,
    syncStatus,
    setMensTeam,
    setWomensTeam,
    setStage1Score,
    setKnockoutScore,
    markKnockoutAwarded,
    setWomensGroupScore,
    setWomensSFScore,
    setWomensFinalScore,
    assignWomensSF,
    applyStage1Swaps,
    resetSeeds,
    resetTournament,
    ...helpers,
  };
}

export type Set01TournamentApi = ReturnType<typeof useSet01Tournament>;
