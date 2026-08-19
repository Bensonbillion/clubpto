// The manager's state, and the only place the screens' callbacks land.
//
// Every screen in src/manage/screens is presentational — props in, callbacks
// out, no fetching. This hook is the other half: it owns the session, derives
// what each screen renders, and is the single writer.
//
// PERSISTENCE reuses src/court-manager/persistence.ts rather than a new store.
// That layer already carries the fix that matters most on a Wednesday: load()
// reconciles local against the server by savedAt and takes whichever is newer,
// so a device that has been away cannot resume a stale night and push it over
// everyone else's. Rewriting that from scratch would have meant rediscovering
// it the hard way.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSessionStore, type SessionStore, type SyncStatus } from "@/court-manager/persistence";
import type { Court, Match, Player, Session } from "./types";
import { buildQueue, nextMatch, courtComplete, matchesPlayedBy } from "./engine/rotation";
import { computeStandings, type PlayedMatch, type StandingsRow } from "./engine/standings";
import { buildStages, champion, orderedPlayerIds, readiness, seedPairs, type Stage } from "./engine/playoff";

const STORAGE_KEY = "cm_manage_session";
const SCHEMA_VERSION = 1;

const emptySession = (): Session => ({
  id: `night-${new Date().toISOString().slice(0, 10)}`,
  dayLabel: "",
  date: new Date().toISOString().slice(0, 10),
  status: "setup",
  players: [],
  courts: [],
  matches: [],
  startedAt: null,
  endedAt: null,
});

/** Group matches only — playoff ties never feed the round-robin table. */
const groupPlayed = (matches: readonly Match[], court: number): PlayedMatch[] =>
  matches
    .filter((m) => m.courtNumber === court && m.status === "played" && m.stage === null)
    .map((m) => ({
      matchIndex: m.matchIndex,
      completedAt: m.completedAt,
      teamA: m.teamA,
      teamB: m.teamB,
      scoreA: m.scoreA ?? 0,
      scoreB: m.scoreB ?? 0,
    }));

export interface CourtView {
  court: Court;
  players: Player[];
  onCourt: Match | null;
  queue: ReturnType<typeof buildQueue>;
  standings: StandingsRow[];
  complete: boolean;
  stages: Stage[] | null;
  champion: [string, string] | null;
  ready: ReturnType<typeof readiness>;
}

export function useManageSession() {
  const [session, setSession] = useState<Session>(emptySession);
  const [loading, setLoading] = useState(true);
  const [sync, setSync] = useState<SyncStatus>("synced");
  const storeRef = useRef<SessionStore<Session> | null>(null);

  useEffect(() => {
    const store = createSessionStore<Session>({
      storageKey: STORAGE_KEY,
      schemaVersion: SCHEMA_VERSION,
      storage: window.localStorage,
      remote: null, // wired to Supabase once the route ships; local-first works today
      defaults: emptySession,
      onSyncStatusChange: setSync,
    });
    storeRef.current = store;
    void store.load().then(({ state }) => {
      setSession(state);
      setLoading(false);
    });
  }, []);

  /** Every mutation goes through here, so nothing can write without saving. */
  const commit = useCallback((next: (s: Session) => Session) => {
    setSession((prev) => {
      const updated = next(prev);
      storeRef.current?.save(updated, Date.now());
      return updated;
    });
  }, []);

  /* ── setup ─────────────────────────────────────────────────────── */

  const setDayLabel = useCallback((dayLabel: string) =>
    commit((s) => ({ ...s, dayLabel })), [commit]);

  const addPlayer = useCallback((name: string, walkIn = false) =>
    commit((s) => ({
      ...s,
      players: [...s.players, {
        id: `p-${Date.now().toString(36)}-${s.players.length}`,
        name, walkIn, courtNumber: null, away: false,
        joinedAtMatchIndex: s.status === "running" ? s.matches.length + 1 : null,
      }],
    })), [commit]);

  const removePlayer = useCallback((playerId: string) =>
    commit((s) => ({ ...s, players: s.players.filter((p) => p.id !== playerId) })), [commit]);

  const assignCourt = useCallback((playerId: string, courtNumber: number | null) =>
    commit((s) => ({
      ...s,
      players: s.players.map((p) => (p.id === playerId ? { ...p, courtNumber } : p)),
    })), [commit]);

  const setCourts = useCallback((numbers: number[]) =>
    commit((s) => ({
      ...s,
      courts: numbers.map((number) =>
        s.courts.find((c) => c.number === number) ??
        { number, targetMatches: 4, playoffSeeded: false, champion: null }),
    })), [commit]);

  const setTarget = useCallback((courtNumber: number, targetMatches: number) =>
    commit((s) => ({
      ...s,
      courts: s.courts.map((c) => (c.number === courtNumber ? { ...c, targetMatches } : c)),
    })), [commit]);

  /** Frame 15. Raising the target owes everyone one more; no special case. */
  const extend = useCallback((courtNumber: number, by = 1) =>
    commit((s) => ({
      ...s,
      courts: s.courts.map((c) =>
        c.number === courtNumber ? { ...c, targetMatches: c.targetMatches + by } : c),
    })), [commit]);

  const start = useCallback(() =>
    commit((s) => ({ ...s, status: "running", startedAt: Date.now() })), [commit]);

  /* ── play ──────────────────────────────────────────────────────── */

  /** Put the next four on court if that court has nobody playing. */
  const ensureOnCourt = useCallback((courtNumber: number) =>
    commit((s) => {
      const court = s.courts.find((c) => c.number === courtNumber);
      if (!court) return s;
      const live = s.matches.find((m) => m.courtNumber === courtNumber && m.status === "onCourt");
      if (live) return s;
      const four = nextMatch(s.players, s.matches, courtNumber, court.targetMatches);
      if (!four) return s;
      const index = s.matches.filter((m) => m.courtNumber === courtNumber).length + 1;
      const match: Match = {
        id: `m-${courtNumber}-${index}-${Date.now().toString(36)}`,
        courtNumber, matchIndex: index,
        teamA: four.teamA, teamB: four.teamB,
        scoreA: null, scoreB: null, status: "onCourt",
        startedAt: Date.now(), completedAt: null, stage: null,
      };
      return { ...s, matches: [...s.matches, match] };
    }), [commit]);

  /**
   * Two taps: the winning side, then the loser's score. The winner's score is
   * the target the court plays to, so only the loser's number is ever entered.
   */
  const recordScore = useCallback((matchId: string, winner: "A" | "B", loserScore: number, pointsPerGame: number) =>
    commit((s) => ({
      ...s,
      matches: s.matches.map((m) => m.id !== matchId ? m : {
        ...m,
        scoreA: winner === "A" ? pointsPerGame : loserScore,
        scoreB: winner === "B" ? pointsPerGame : loserScore,
        status: "played" as const,
        completedAt: Date.now(),
      }),
    })), [commit]);

  const correctScore = useCallback((matchId: string, scoreA: number, scoreB: number) =>
    commit((s) => ({
      ...s,
      matches: s.matches.map((m) => m.id !== matchId ? m : { ...m, scoreA, scoreB }),
    })), [commit]);

  /** Voided counts for nothing: all four go back in the queue. */
  const voidMatch = useCallback((matchId: string) =>
    commit((s) => ({
      ...s,
      matches: s.matches.map((m) => m.id !== matchId ? m : { ...m, status: "voided" as const }),
    })), [commit]);

  const setAway = useCallback((playerId: string, away: boolean) =>
    commit((s) => ({
      ...s,
      players: s.players.map((p) => (p.id === playerId ? { ...p, away } : p)),
    })), [commit]);

  /* ── playoffs ──────────────────────────────────────────────────── */

  const seedPlayoff = useCallback((courtNumber: number) =>
    commit((s) => {
      const ordered = orderedPlayerIds(s.players, s.matches, courtNumber);
      const pairs = seedPairs(ordered);
      if (!pairs) return s;
      const index = s.matches.filter((m) => m.courtNumber === courtNumber).length + 1;
      const semi: Match = {
        id: `po-${courtNumber}-semi-${Date.now().toString(36)}`,
        courtNumber, matchIndex: index,
        teamA: pairs[0].playerIds, teamB: pairs[1].playerIds,
        scoreA: null, scoreB: null, status: "onCourt",
        startedAt: Date.now(), completedAt: null, stage: "semi",
      };
      return {
        ...s,
        courts: s.courts.map((c) => c.number === courtNumber ? { ...c, playoffSeeded: true } : c),
        matches: [...s.matches, semi],
      };
    }), [commit]);

  const deletePlayoff = useCallback((courtNumber: number) =>
    commit((s) => ({
      ...s,
      courts: s.courts.map((c) =>
        c.number === courtNumber ? { ...c, playoffSeeded: false, champion: null } : c),
      matches: s.matches.filter((m) => !(m.courtNumber === courtNumber && m.stage !== null)),
    })), [commit]);

  const endNight = useCallback(() =>
    commit((s) => ({ ...s, status: "ended", endedAt: Date.now() })), [commit]);

  /* ── derived ───────────────────────────────────────────────────── */

  const views: CourtView[] = useMemo(() => session.courts.map((court) => {
    const players = session.players.filter((p) => p.courtNumber === court.number);
    const ids = players.filter((p) => !p.away).map((p) => p.id);
    const playoffMatches = session.matches.filter(
      (m) => m.courtNumber === court.number && m.stage !== null,
    );
    const pairs = court.playoffSeeded
      ? seedPairs(orderedPlayerIds(session.players, session.matches, court.number))
      : null;
    const stages = pairs ? buildStages(pairs, playoffMatches) : null;
    return {
      court,
      players,
      onCourt: session.matches.find(
        (m) => m.courtNumber === court.number && m.status === "onCourt",
      ) ?? null,
      queue: buildQueue(session.players, session.matches, court.number, court.targetMatches),
      standings: computeStandings(ids, groupPlayed(session.matches, court.number)),
      complete: courtComplete(session.players, session.matches, court.number, court.targetMatches),
      stages,
      champion: stages ? champion(stages) : null,
      ready: readiness(session.players, session.matches, court.number, court.targetMatches),
    };
  }), [session]);

  const playerName = useCallback(
    (id: string) => session.players.find((p) => p.id === id)?.name ?? id,
    [session.players],
  );

  return {
    session, loading, sync, views, playerName,
    matchesPlayedBy: (id: string) => matchesPlayedBy(session.matches, id),
    setDayLabel, addPlayer, removePlayer, assignCourt, setCourts, setTarget, extend, start,
    ensureOnCourt, recordScore, correctScore, voidMatch, setAway,
    seedPlayoff, deletePlayoff, endNight,
  };
}

export type UseManageSession = ReturnType<typeof useManageSession>;
