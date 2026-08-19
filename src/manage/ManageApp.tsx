// The manager, wired.
//
// Every screen under ./screens is presentational and useSession.ts is the only
// writer. This file is the join: it holds the small amount of state that is
// genuinely about NAVIGATION (which step of the wizard, which court, which tab,
// is a sheet open) and nothing about the night itself.
//
// That split is why the wizard can be reordered, or a screen swapped, without
// touching the engine — and why the engine's tests never needed a DOM.

import { useEffect, useMemo, useState } from "react";
import { ensureManageFonts } from "./ui/fonts";
import { T } from "./ui/primitives";
import { useManageSession } from "./useSession";
import { validTargets, totalMatches } from "./engine/rotation";
import { POINTS_PER_WIN } from "./engine/standings";
import { Passcode, PasscodeFailed, HomeNothingRunning, HomeNightInProgress } from "./screens/door-home";
import { WhichNight, WhoIsHere, Courts, MatchesEach, Ready } from "./screens/setup";
import { CourtView, ScoreEntry } from "./screens/play";
import { PlayersTab } from "./screens/people";
import { StandingsTab } from "./screens/standings";
import type { Tab } from "./ui/primitives";

const PASSCODE = "9999";
const NIGHTS = [
  { dayName: "Wednesday", isDefault: true },
  { dayName: "Sunday", isDefault: false },
];

type Step = "night" | "who" | "courts" | "target" | "ready";

export default function ManageApp() {
  useEffect(ensureManageFonts, []);

  const s = useManageSession();

  // Navigation only. Nothing here is part of the night.
  const [entered, setEntered] = useState("");
  const [failed, setFailed] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [inSetup, setInSetup] = useState(false);
  const [step, setStep] = useState<Step>("night");
  const [night, setNight] = useState("Wednesday");
  const [query, setQuery] = useState("");
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [courtCount, setCourtCount] = useState(2);
  const [target, setTargetLocal] = useState(4);
  const [court, setCourt] = useState(1);
  const [tab, setTab] = useState<Tab>("match");
  const [scoring, setScoring] = useState<"A" | "B" | null>(null);
  // Home is a destination you choose, not somewhere Start throws you.
  const [atCourt, setAtCourt] = useState(false);

  /* ── the door ──────────────────────────────────────────────────── */

  const digit = (d: string) => {
    setFailed(false);
    const next = entered + d;
    if (next.length < 4) { setEntered(next); return; }
    setEntered("");
    if (next === PASSCODE) setUnlocked(true);
    else setFailed(true);
  };

  if (!unlocked) {
    return failed
      ? <PasscodeFailed onDigit={digit} onDelete={() => setEntered((e) => e.slice(0, -1))} />
      : <Passcode entered={entered.length} onDigit={digit} onDelete={() => setEntered((e) => e.slice(0, -1))} />;
  }

  const running = s.session.status === "running";
  const view = s.views.find((v) => v.court.number === court) ?? s.views[0];

  /* ── home ──────────────────────────────────────────────────────── */

  if (!inSetup && !running) {
    return (
      <HomeNothingRunning
        loading={s.loading}
        lastSessionDayName={null}
        onStartTonight={() => { setInSetup(true); setStep("night"); }}
      />
    );
  }

  if (!inSetup && running && !atCourt) {
    const waiting = view?.onCourt
      ? { courtNumber: view.court.number, round: view.onCourt.matchIndex, roundsTotal: view.court.targetMatches }
      : undefined;
    return (
      <HomeNightInProgress
        dayName={s.session.dayLabel || night}
        waiting={waiting}
        onResume={() => setAtCourt(true)}
        onStartDifferentNight={() => { setInSetup(true); setStep("night"); }}
      />
    );
  }

  /* ── the wizard ────────────────────────────────────────────────── */

  if (inSetup) {
    if (step === "night") {
      return (
        <WhichNight
          nights={NIGHTS}
          selected={night}
          onSelect={setNight}
          onBack={() => setInSetup(false)}
          onNext={() => { s.setDayLabel(night); setStep("who"); }}
        />
      );
    }

    if (step === "who") {
      const rows = s.session.players.map((p) => ({
        playerId: p.id, displayName: p.name, ticked: ticked[p.id] ?? true,
      }));
      return (
        <WhoIsHere
          rows={rows}
          query={query}
          onQueryChange={setQuery}
          onToggle={(id) => setTicked((t) => ({ ...t, [id]: !(t[id] ?? true) }))}
          onAddWalkIn={() => { const n = query.trim(); if (n) { s.addPlayer(n, true); setQuery(""); } }}
          onAddWalkInNamed={(name) => { s.addPlayer(name, true); setQuery(""); }}
          onClearSearch={() => setQuery("")}
          onBack={() => setStep("night")}
          onNext={() => {
            // Untick removes them from the night entirely — the wizard's list
            // IS the night, so there is nothing else for an unticked row to mean.
            s.session.players.forEach((p) => { if (ticked[p.id] === false) s.removePlayer(p.id); });
            const numbers = Array.from({ length: courtCount }, (_, i) => i + 1);
            s.setCourts(numbers);
            setStep("courts");
          }}
        />
      );
    }

    if (step === "courts") {
      const chips = (n: number) => s.session.players
        .filter((p) => p.courtNumber === n)
        .map((p) => ({ playerId: p.id, displayName: p.name, seedLetter: null }));
      const courts = Array.from({ length: courtCount }, (_, i) => ({
        courtNumber: i + 1, label: `Court ${i + 1}`, players: chips(i + 1),
      }));
      return (
        <Courts
          courts={courts}
          courtCount={courtCount}
          onCourtCountChange={(c) => {
            setCourtCount(c);
            s.setCourts(Array.from({ length: c }, (_, i) => i + 1));
          }}
          onMovePlayer={(id) => {
            const p = s.session.players.find((x) => x.id === id);
            const now = p?.courtNumber ?? 0;
            s.assignCourt(id, now >= courtCount ? 1 : now + 1);
          }}
          onAssignPlayers={(n) => {
            // Deal the unassigned round-robin so no court starts empty.
            const loose = s.session.players.filter((p) => p.courtNumber == null);
            loose.forEach((p, i) => s.assignCourt(p.id, ((i % courtCount) + 1)));
            void n;
          }}
          onBack={() => setStep("who")}
          onNext={() => setStep("target")}
        />
      );
    }

    if (step === "target") {
      const size = s.session.players.filter((p) => p.courtNumber === 1).length;
      return (
        <MatchesEach
          courtLabel="Court 1"
          courtSize={size}
          selected={target}
          minutesPerMatch={12}
          onSelect={(t) => { setTargetLocal(t); s.session.courts.forEach((c) => s.setTarget(c.number, t)); }}
          onBack={() => setStep("courts")}
          onNext={() => setStep("ready")}
        />
      );
    }

    const size = s.session.players.filter((p) => p.courtNumber === 1).length;
    return (
      <Ready
        dayName={night}
        playersIn={s.session.players.length}
        courtCount={courtCount}
        matchesEach={target}
        matchesInTotal={validTargets(size).includes(target) ? totalMatches(size, target) * courtCount : 0}
        pointsForAWin={POINTS_PER_WIN}
        onBack={() => setStep("target")}
        onStart={() => {
          s.start();
          s.session.courts.forEach((c) => s.ensureOnCourt(c.number));
          setInSetup(false);
          setAtCourt(true);
          setTab("match");
        }}
      />
    );
  }

  /* ── the night ─────────────────────────────────────────────────── */

  if (!view) return <div style={{ background: T.bg, minHeight: "100dvh" }} />;

  const pairLabel = (ids: readonly string[]) => ids.map(s.playerName).join(" and ");

  if (tab === "players") {
    return (
      <PlayersTab
        players={s.session.players.map((p) => ({
          id: p.id, displayName: p.name, gamesPlayed: s.matchesPlayedBy(p.id),
          status: p.away ? ("left" as const) : ("here" as const),
        }))}
        attendanceCount={s.session.players.filter((p) => !p.away).length}
        onMarkArrived={(id) => s.setAway(id, false)}
        onMarkLeft={(id) => s.setAway(id, true)}
        onMarkHere={(id) => s.setAway(id, false)}
        onAddPlayer={() => { setInSetup(true); setStep("who"); }}
        onChangeTab={setTab}
      />
    );
  }

  if (tab === "standings") {
    return (
      <StandingsTab
        courtLabel={`Court ${view.court.number}`}
        pointsPerWin={POINTS_PER_WIN}
        rows={view.standings.map((r) => ({
          position: r.rank, playerId: r.playerId, displayName: s.playerName(r.playerId),
          matchesPlayed: r.matchesPlayed, wins: r.wins, losses: r.losses,
          pointDifference: r.scoreDiff, points: r.points,
          reachedTotalAtMatchNumber: r.reachedAt ?? 0,
          reason: r.separatedBy === "reachedFirst" && r.reachedAt != null
            ? { kind: "gotThereFirst" as const, matchNumber: r.reachedAt }
            : null,
          tiedWithPlayerId: null as string | null,
        }))}
        shortfall={null}
        seedingEnabled={view.ready.ready}
        onSeedPlayoff={() => s.seedPlayoff(view.court.number)}
        onSelectTab={setTab}
      />
    );
  }

  const live = view.onCourt;
  if (!live) {
    // Nothing on court yet — put the next four up rather than showing a blank.
    s.ensureOnCourt(view.court.number);
    return <div style={{ background: T.bg, minHeight: "100dvh" }} />;
  }

  return (
    <>
      <CourtView
        round={live.matchIndex}
        totalRounds={view.court.targetMatches}
        courtNumber={view.court.number}
        sideA={{ pairLabel: pairLabel(live.teamA), score: live.scoreA }}
        sideB={{ pairLabel: pairLabel(live.teamB), score: live.scoreB }}
        waiting={view.queue.slice(0, 6).map((q, i) => ({
          playerId: q.playerId, name: q.name, isOnNext: i < 4,
        }))}
        onPickWinner={setScoring}
        activeTab={tab}
        onTabChange={setTab}
      />
      {scoring && (
        <ScoreEntry
          round={live.matchIndex}
          totalRounds={view.court.targetMatches}
          courtNumber={view.court.number}
          winnerPairLabel={pairLabel(scoring === "A" ? live.teamA : live.teamB)}
          loserPairLabel={pairLabel(scoring === "A" ? live.teamB : live.teamA)}
          pointsPerGame={21}
          onDismiss={() => setScoring(null)}
          onRecord={(loserScore) => {
            s.recordScore(live.id, scoring, loserScore, 21);
            setScoring(null);
            setTimeout(() => s.ensureOnCourt(view.court.number), 0);
          }}
        />
      )}
    </>
  );
}
