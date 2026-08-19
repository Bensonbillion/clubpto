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
import { CourtView, ScoreEntry, CourtSwitcher } from "./screens/play";
import { PlayersTab, LateArrival, Extend, CorrectOrVoid } from "./screens/people";
import { StandingsTab } from "./screens/standings";
import { PlayoffReadiness, Bracket, PlayoffMatch, Champion } from "./screens/playoffs";
import { SessionSummary, ConfirmVoidResult } from "./screens/summary-states";
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
  // Overlays and side-trips. All navigation, none of it part of the night.
  const [sheet, setSheet] = useState<null | "extend" | "late" | "switcher" | "summary">(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmVoid, setConfirmVoid] = useState<string | null>(null);
  const [lateName, setLateName] = useState("");
  const [lateCourt, setLateCourt] = useState<number | null>(null);
  const [playoffScreen, setPlayoffScreen] = useState<null | "bracket" | "match">(null);

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
  const pair = (ids: readonly string[]) => [s.playerName(ids[0]), s.playerName(ids[1])] as [string, string];
  const other = s.views.filter((v) => v.court.number !== view.court.number);
  const playoffOn = view.court.playoffSeeded;

  /* ── the summary, reachable once the night has ended ─────────── */

  if (sheet === "summary") {
    return (
      <SessionSummary
        dayLabel={s.session.dayLabel || night}
        matchesPlayed={s.session.matches.filter((m) => m.status === "played").length}
        playersIn={s.session.players.length}
        voidedCount={s.session.matches.filter((m) => m.status === "voided").length}
        champions={s.views.flatMap((v) => v.champion
          ? [{ courtNumber: v.court.number, playerA: s.playerName(v.champion[0]), playerB: s.playerName(v.champion[1]) }]
          : [])}
        standingsByCourt={s.views.map((v) => ({
          courtNumber: v.court.number,
          rows: v.standings.map((r) => ({
            rank: r.rank, playerName: s.playerName(r.playerId),
            played: r.matchesPlayed, diff: r.scoreDiff, points: r.points,
            tieBreakNote: r.separatedBy === "reachedFirst" ? "reached it later" : null,
          })),
        }))}
        onClose={() => setSheet(null)}
        onCopy={(payload) => void navigator.clipboard?.writeText(payload)}
      />
    );
  }

  /* ── playoffs ─────────────────────────────────────────────────── */

  if (playoffScreen === "match" && playoffOn) {
    const live = s.session.matches.find(
      (m) => m.courtNumber === view.court.number && m.stage !== null && m.status === "onCourt");
    if (live) {
      return (
        <PlayoffMatch
          courtNumber={view.court.number}
          stageLabel="Final"
          stageMatchNumber={null}
          teamA={{ name: pairLabel(live.teamA), seedLabel: "1+4" }}
          teamB={{ name: pairLabel(live.teamB), seedLabel: "2+3" }}
          scoreA={live.scoreA}
          scoreB={live.scoreB}
          winnerMeetsTeamName={null}
          othersOnSecondCourt={other[0]?.court.number ?? null}
          onPickWinner={(side) => { s.recordScore(live.id, side, 0, 21); setPlayoffScreen("bracket"); }}
          onBackToBracket={() => setPlayoffScreen("bracket")}
        />
      );
    }
  }

  if (playoffOn && view.champion) {
    const finalMatch = s.session.matches.find(
      (m) => m.courtNumber === view.court.number && m.stage === "final" && m.status === "played");
    const won = Math.max(finalMatch?.scoreA ?? 0, finalMatch?.scoreB ?? 0);
    const lost = Math.min(finalMatch?.scoreA ?? 0, finalMatch?.scoreB ?? 0);
    return (
      <Champion
        courtNumber={view.court.number}
        championNames={pair(view.champion)}
        scoreWinner={won}
        scoreLoser={lost}
        runnerUpTeamName={finalMatch
          ? pairLabel(finalMatch.scoreA! > finalMatch.scoreB! ? finalMatch.teamB : finalMatch.teamA)
          : ""}
        otherCourtStillPlaying={other.find((v) => !v.complete)?.court.number ?? null}
        onGoToOtherCourt={() => { const o = other[0]; if (o) setCourt(o.court.number); }}
        onBackToBracket={() => setPlayoffScreen("bracket")}
      />
    );
  }

  if (playoffScreen === "bracket" && playoffOn && view.stages) {
    const liveId = s.session.matches.find(
      (m) => m.courtNumber === view.court.number && m.stage !== null && m.status === "onCourt")?.id ?? null;
    return (
      <Bracket
        courtNumber={view.court.number}
        playersInPlayoff={4}
        seedPairs={[[1, 4], [2, 3]]}
        stages={view.stages.map((st) => ({
          name: st.label,
          matches: st.ties.map((t, i) => ({
            matchId: `${st.key}-${i}`,
            teamA: t.sideA ? { name: pairLabel(t.sideA), seedLabel: "1+4" } : null,
            teamB: t.sideB ? { name: pairLabel(t.sideB), seedLabel: "2+3" } : null,
            scoreA: t.scoreA, scoreB: t.scoreB,
            status: t.settled ? ("complete" as const)
              : t.sideA && t.sideB ? ("live" as const) : ("pending" as const),
            winnerSide: t.settled && t.scoreA != null && t.scoreB != null
              ? (t.scoreA > t.scoreB ? ("A" as const) : ("B" as const)) : null,
          })),
        }))}
        matchOnCourtId={liveId}
        onOpenMatch={() => setPlayoffScreen("match")}
        onScoreMatchOnCourt={() => setPlayoffScreen("match")}
      />
    );
  }

  if (tab === "standings" && playoffOn && view.stages) {
    setPlayoffScreen("bracket");
  }

  /* ── tabs ─────────────────────────────────────────────────────── */

  if (tab === "players") {
    return (
      <>
        <PlayersTab
          players={s.session.players.map((p) => ({
            id: p.id, displayName: p.name, gamesPlayed: s.matchesPlayedBy(p.id),
            status: p.away ? ("left" as const) : ("here" as const),
          }))}
          attendanceCount={s.session.players.filter((p) => !p.away).length}
          onMarkArrived={(id) => s.setAway(id, false)}
          onMarkLeft={(id) => s.setAway(id, true)}
          onMarkHere={(id) => s.setAway(id, false)}
          onAddPlayer={() => { setLateName(""); setLateCourt(view.court.number); setSheet("late"); }}
          onChangeTab={setTab}
        />
        {sheet === "late" && (
          <LateArrival
            name={lateName}
            onNameChange={setLateName}
            foundInRoster={false}
            courts={s.views.map((v) => ({
              courtNumber: v.court.number, label: `Court ${v.court.number}`,
              playingCount: v.players.filter((p) => !p.away).length,
            }))}
            selectedCourtNumber={lateCourt}
            onSelectCourt={setLateCourt}
            onCancel={() => setSheet(null)}
            onAdd={() => {
              const n = lateName.trim();
              if (n) { s.addPlayer(n, true); }
              setSheet(null); setLateName("");
            }}
          />
        )}
      </>
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
        onSeedPlayoff={() => { s.seedPlayoff(view.court.number); setPlayoffScreen("bracket"); }}
        onSelectTab={setTab}
      />
    );
  }

  /* ── the court ────────────────────────────────────────────────── */

  const live = view.onCourt;

  if (!live && view.complete && !playoffOn) {
    return (
      <PlayoffReadiness
        courtNumber={view.court.number}
        otherCourtNumbers={other.map((v) => v.court.number)}
        liveMatchOnCourt={false}
        playersOwedMatches={[]}
        blocker={view.ready.blocker === "matchesOutstanding"
          ? { kind: "owedMatches", playerNames: view.queue.filter((q) => q.owed > 0).map((q) => q.name),
              othersMatchesPlayed: view.court.targetMatches, canDrawMatch: true }
          : null}
        firstStageName="Straight to the final"
        onResolveBlocker={() => s.ensureOnCourt(view.court.number)}
        onSeedPlayoff={() => { s.seedPlayoff(view.court.number); setPlayoffScreen("bracket"); }}
      />
    );
  }

  if (!live) {
    s.ensureOnCourt(view.court.number);
    return <div style={{ background: T.bg, minHeight: "100dvh" }} />;
  }

  if (sheet === "switcher" && s.views.length > 1) {
    return (
      <CourtSwitcher
        courts={s.views.map((v) => ({
          number: v.court.number,
          scoreDue: v.onCourt != null,
        }))}
        activeCourtNumber={view.court.number}
        sideA={{ pairLabel: pairLabel(live.teamA), score: live.scoreA }}
        sideB={{ pairLabel: pairLabel(live.teamB), score: live.scoreB }}
        waiting={view.queue.slice(0, 6).map((q, i) => ({ playerId: q.playerId, name: q.name, isOnNext: i < 4 }))}
        onSelectCourt={(n) => { setCourt(n); setSheet(null); }}
        activeTab={tab}
        onTabChange={setTab}
      />
    );
  }

  const lastPlayed = [...s.session.matches]
    .filter((m) => m.courtNumber === view.court.number && m.status === "played" && m.stage === null)
    .sort((a, b) => b.matchIndex - a.matchIndex)[0];

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
      {sheet === "extend" && (
        <Extend
          courtLabel={`Court ${view.court.number}`}
          targetNow={view.court.targetMatches}
          otherCourtLabels={other.map((v) => `Court ${v.court.number}`)}
          minutesPerRound={12}
          onAddRound={() => { s.extend(view.court.number, 1); setSheet(null); }}
          onDismiss={() => setSheet(null)}
        />
      )}
      {editing && lastPlayed && (
        <CorrectOrVoid
          match={{
            id: lastPlayed.id, matchNumber: lastPlayed.matchIndex,
            courtLabel: `Court ${view.court.number}`,
            sideA: pair(lastPlayed.teamA), sideB: pair(lastPlayed.teamB),
            scoreA: lastPlayed.scoreA ?? 0, scoreB: lastPlayed.scoreB ?? 0,
          }}
          onChangeScore={() => { setEditing(null); setScoring("A"); }}
          onVoid={() => { setConfirmVoid(lastPlayed.id); setEditing(null); }}
          onDismiss={() => setEditing(null)}
        />
      )}
      {confirmVoid && lastPlayed && (
        <ConfirmVoidResult
          pairA={pair(lastPlayed.teamA)} scoreA={lastPlayed.scoreA ?? 0}
          pairB={pair(lastPlayed.teamB)} scoreB={lastPlayed.scoreB ?? 0}
          onVoid={() => { s.voidMatch(confirmVoid); setConfirmVoid(null); }}
          onKeep={() => setConfirmVoid(null)}
        />
      )}
    </>
  );
}
