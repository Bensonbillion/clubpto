import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useGameState } from "@/hooks/useGameState";
import { Match, Player } from "@/types/courtManager";
import { Trophy, Timer, UserCheck, ArrowRightLeft, Maximize, Minimize, SkipForward, Users, BarChart3, Clock, UserMinus, Swords, Share2, Settings2, Edit3, RefreshCw, Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import GameHistoryLog from "./GameHistoryLog";
import PlayoffBracket from "./PlayoffBracket";
import SessionExport from "./SessionExport";
import ManageRosterDrawer from "./ManageRosterDrawer";
import PairEditor from "./PairEditor";
import { toast } from "sonner";

interface CourtDisplayProps {
  gameState: ReturnType<typeof useGameState>;
  onGoToCheckIn?: () => void;
  isAdmin?: boolean;
}

/* ── Session Countdown Clock ──────────────────────────────────────── */
const SessionClock = ({ startedAt, durationMinutes }: { startedAt?: string; durationMinutes: number }) => {
  const [remaining, setRemaining] = useState("");
  const [pct, setPct] = useState(100);

  useEffect(() => {
    if (!startedAt) { setRemaining("Not started"); return; }
    const totalMs = durationMinutes * 60 * 1000;
    const start = new Date(startedAt).getTime();

    const tick = () => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, totalMs - elapsed);
      const mins = Math.floor(left / 60000);
      const secs = Math.floor((left % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
      setPct(Math.max(0, (left / totalMs) * 100));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [startedAt, durationMinutes]);

  const urgency = pct < 15 ? "text-destructive" : pct < 35 ? "text-yellow-400" : "text-accent";

  return (
    <div className="flex items-center gap-2">
      <Clock className={`w-5 h-5 ${urgency}`} />
      <span className={`font-mono text-lg font-display ${urgency}`}>{remaining}</span>
      {startedAt && (
        <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct < 15 ? "bg-destructive" : pct < 35 ? "bg-yellow-500" : "bg-accent"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
};

/* ── Per-game timer ───────────────────────────────────────────────── */
const GameTimer = ({ startedAt }: { startedAt?: string }) => {
  const [elapsed, setElapsed] = useState("0:00");

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const tick = () => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div className="flex items-center gap-2 text-base text-muted-foreground">
      <Timer className="w-4 h-4" />
      <span className="font-mono text-lg">{elapsed}</span>
    </div>
  );
};

/* ── Winner modal ─────────────────────────────────────────────────── */
const WinnerModal = ({
  match, onSelect, onClose,
}: {
  match: Match; onSelect: (pairId: string) => void; onClose: () => void;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
    <div className="bg-card border border-border rounded-lg p-10 max-w-lg w-full mx-4 space-y-8" onClick={(e) => e.stopPropagation()}>
      <h3 className="font-display text-3xl text-accent text-center">Which team won?</h3>
      <div className="space-y-4">
        <button onClick={() => onSelect(match.pair1.id)} className="w-full rounded-lg border-2 border-border bg-muted p-6 text-center hover:border-accent hover:bg-accent/10 transition-all active:scale-[0.98] min-h-[80px]">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Team A</p>
          <p className="font-display text-xl text-foreground">{match.pair1.player1.name} & {match.pair1.player2.name}</p>
        </button>
        <button onClick={() => onSelect(match.pair2.id)} className="w-full rounded-lg border-2 border-border bg-muted p-6 text-center hover:border-accent hover:bg-accent/10 transition-all active:scale-[0.98] min-h-[80px]">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Team B</p>
          <p className="font-display text-xl text-foreground">{match.pair2.player1.name} & {match.pair2.player2.name}</p>
        </button>
      </div>
      <button onClick={onClose} className="w-full text-muted-foreground text-base hover:text-foreground transition-colors py-2">Cancel</button>
    </div>
  </div>
);

/* ── Court card ───────────────────────────────────────────────────── */
const CourtCard = ({
  courtNum, match, totalGames, onFinish, onSkip, isAdmin,
}: {
  courtNum: number; match: Match | null; totalGames: number; onFinish: (match: Match) => void; onSkip: (match: Match) => void; isAdmin: boolean;
}) => (
  <div className="rounded-lg border border-border bg-card p-4 md:p-6 space-y-4 md:space-y-5 flex-1 min-w-0">
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <h3 className="font-display text-3xl text-accent">Court {courtNum}</h3>
        {match?.gameNumber && totalGames > 0 && (
          <p className="text-sm text-muted-foreground">Game {match.gameNumber} of {totalGames}</p>
        )}
      </div>
      <div className="flex items-center gap-4">
        {match && <GameTimer startedAt={match.startedAt} />}
        {match ? (
          <span className="text-xs uppercase tracking-widest bg-accent/20 text-accent px-4 py-1.5 rounded-full border border-accent/30">Playing</span>
        ) : (
          <span className="text-xs uppercase tracking-widest bg-primary/20 text-primary px-4 py-1.5 rounded-full border border-primary/30">Waiting</span>
        )}
      </div>
    </div>

    {match ? (
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="flex-1 text-center space-y-1 rounded-md bg-muted/50 p-3 md:p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Team A</p>
            <p className="font-display text-lg md:text-xl text-foreground">{match.pair1.player1.name}</p>
            <p className="font-display text-lg md:text-xl text-foreground">{match.pair1.player2.name}</p>
          </div>
          <div className="font-display text-2xl md:text-3xl text-accent">VS</div>
          <div className="flex-1 text-center space-y-1 rounded-md bg-muted/50 p-3 md:p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Team B</p>
            <p className="font-display text-lg md:text-xl text-foreground">{match.pair2.player1.name}</p>
            <p className="font-display text-lg md:text-xl text-foreground">{match.pair2.player2.name}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => onFinish(match)} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/80 min-h-[52px] text-base">
            <Trophy className="w-5 h-5 mr-2" /> Game Finished
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => onSkip(match)} className="border-border text-muted-foreground hover:text-accent hover:border-accent/40 min-h-[52px] text-base">
              <SkipForward className="w-5 h-5 mr-1.5" /> Skip
            </Button>
          )}
        </div>
      </div>
    ) : (
      <p className="text-muted-foreground text-center text-lg py-10">No active match</p>
    )}
  </div>
);

/* ── Swap player popover ──────────────────────────────────────────── */
const SwapPlayerButton = ({
  playerName, playerId, matchId, availablePlayers, onSwap,
}: {
  playerName: string; playerId: string; matchId: string; availablePlayers: { id: string; name: string }[]; onSwap: (matchId: string, oldId: string, newId: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="group inline-flex items-center gap-1.5 hover:text-accent transition-colors min-h-[36px]">
          <span>{playerName}</span>
          <ArrowRightLeft className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2 max-h-60 overflow-y-auto" align="start">
        <p className="text-xs text-muted-foreground mb-2 px-1">Swap with:</p>
        {availablePlayers.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1">No available players</p>
        ) : (
          availablePlayers.map((p) => (
            <button key={p.id} onClick={() => { onSwap(matchId, playerId, p.id); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-base rounded hover:bg-accent/10 hover:text-accent transition-colors min-h-[44px]">{p.name}</button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
};

/* ── Mini standings overlay ───────────────────────────────────────── */
const MiniStandings = ({ roster }: { roster: Player[] }) => {
  const players = roster
    .filter((p) => p.checkedIn && p.gamesPlayed > 0)
    .sort((a, b) => {
      const aPct = a.gamesPlayed > 0 ? a.wins / a.gamesPlayed : 0;
      const bPct = b.gamesPlayed > 0 ? b.wins / b.gamesPlayed : 0;
      if (bPct !== aPct) return bPct - aPct;
      return b.wins - a.wins;
    });

  if (players.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-accent" />
        <h3 className="font-display text-lg text-accent">Live Standings</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
        {players.map((p, i) => {
          const pct = p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0;
          return (
            <div key={p.id} className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-center">
              <p className="font-display text-sm text-foreground">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.wins}W-{p.losses}L</p>
              <p className="font-mono text-xs text-accent">{pct}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── Main CourtDisplay ────────────────────────────────────────────── */
const CourtDisplay = ({ gameState, onGoToCheckIn, isAdmin = false }: CourtDisplayProps) => {
  const { state, court1Match, court2Match, court3Match, pendingMatches, upNextMatches, onDeckMatches, completeMatch, skipMatch, swapPlayer, checkedInPlayers, startPlayoffs, removePlayerMidSession, swapPlayerMidSession, addPlayerMidSession, replacePlayerInPair, startPlayoffMatch, completePlayoffMatch, swapPlayersInPairs, swapWaitlistPlayer, lockPairs, regenerateRemainingSchedule } = gameState;
  const [showExport, setShowExport] = useState(false);
  const [finishingMatch, setFinishingMatch] = useState<Match | null>(null);
  const [showStandings, setShowStandings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showManageRoster, setShowManageRoster] = useState(false);
  const [showEditPairs, setShowEditPairs] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [searchParams] = useSearchParams();
  const courtFilter = searchParams.get("court");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track newly added pair IDs for highlight animation
  const [highlightPairIds, setHighlightPairIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const newIds = state.newlyAddedPairIds || [];
    if (newIds.length > 0) {
      setHighlightPairIds(new Set(newIds));
      const timer = setTimeout(() => setHighlightPairIds(new Set()), 4000);
      return () => clearTimeout(timer);
    }
  }, [state.newlyAddedPairIds]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const showCourt1 = !courtFilter || courtFilter === "1";
  const showCourt2 = !courtFilter || courtFilter === "2";
  const showCourt3 = (!courtFilter || courtFilter === "3") && (state.sessionConfig.courtCount || 2) === 3;
  const totalGames = state.totalScheduledGames;

  const busyPlayerIds = new Set<string>();
  [court1Match, court2Match, court3Match, ...upNextMatches].filter(Boolean).forEach((m) => {
    if (!m) return;
    [m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id].forEach((id) => busyPlayerIds.add(id));
  });
  const availableForSwap = checkedInPlayers.filter((p) => !busyPlayerIds.has(p.id));

  // Use fixed pairs from state instead of deriving from matches
  const allUniquePairs = state.pairs.map((p) => ({
    id: p.id,
    player1: p.player1.name,
    player2: p.player2.name,
    tier: p.skillLevel,
  }));

  const renderPlayerName = (name: string, playerId: string, matchId: string) => {
    if (!isAdmin) return <span>{name}</span>;
    return <SwapPlayerButton playerName={name} playerId={playerId} matchId={matchId} availablePlayers={availableForSwap} onSwap={swapPlayer} />;
  };

  /** Check if a match contains a newly added pair */
  const matchHasNewPair = (m: Match) => highlightPairIds.has(m.pair1.id) || highlightPairIds.has(m.pair2.id);

  // Runtime guard: detect cross-court player conflicts in playing matches
  useEffect(() => {
    const playingMatches = state.matches.filter((m) => m.status === "playing");
    if (playingMatches.length < 2) return;
    const playerCourtMap = new Map<string, { name: string; court: number }>();
    for (const m of playingMatches) {
      const players = [m.pair1.player1, m.pair1.player2, m.pair2.player1, m.pair2.player2];
      for (const p of players) {
        const existing = playerCourtMap.get(p.id);
        if (existing && existing.court !== m.court) {
          toast.error(`⚠️ ${p.name} is on Court ${existing.court} AND Court ${m.court} simultaneously!`, { duration: 10000 });
        }
        if (!existing) playerCourtMap.set(p.id, { name: p.name, court: m.court! });
      }
    }
  }, [state.matches]);

  const hasActiveMatches = state.matches.length > 0;
  const roundRobinInProgress = hasActiveMatches && !state.playoffsStarted;

  // Pending check-in count
  const pendingCheckInCount = state.roster.filter((p) => !p.checkedIn).length;
  const waitlistCount = (state.waitlistedPlayers || []).length;

  const handleRegenerate = () => {
    regenerateRemainingSchedule();
    setShowRegenConfirm(false);
    toast.success("Remaining schedule regenerated");
  };

  return (
    <div ref={containerRef} className={`animate-fade-up ${isFullscreen ? "bg-background min-h-screen p-3 md:p-6 flex flex-col justify-start gap-4 md:gap-5 overflow-y-auto" : "space-y-6 md:space-y-8"}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          {isFullscreen && <h2 className="font-display text-3xl text-accent">Club PTO</h2>}
          {/* Session clock */}
          {hasActiveMatches && (
            <SessionClock startedAt={state.sessionConfig.sessionStartedAt} durationMinutes={state.sessionConfig.durationMinutes} />
          )}
          {/* Pending check-ins badge (admin) */}
          {isAdmin && hasActiveMatches && pendingCheckInCount > 0 && (
            <span className="text-xs bg-accent/20 text-accent px-3 py-1 rounded-full border border-accent/30">
              {pendingCheckInCount} pending
            </span>
          )}
          {/* Late players badge */}
          {isAdmin && waitlistCount > 0 && (
            <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full border border-primary/30">
              {waitlistCount} late
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mini standings toggle — admin only */}
          {isAdmin && hasActiveMatches && (
            <Button variant="outline" size="default" onClick={() => setShowStandings((v) => !v)}
              className={`border-accent/40 text-accent hover:bg-accent/10 min-h-[44px] px-4 text-sm ${showStandings ? "bg-accent/10" : ""}`}>
              <BarChart3 className="w-4 h-4 mr-1.5" /> Standings
            </Button>
          )}
          {/* Game history toggle (admin) */}
          {isAdmin && hasActiveMatches && (
            <Button variant="outline" size="default" onClick={() => setShowHistory((v) => !v)}
              className={`border-accent/40 text-accent hover:bg-accent/10 min-h-[44px] px-4 text-sm ${showHistory ? "bg-accent/10" : ""}`}>
              <Clock className="w-4 h-4 mr-1.5" /> History
            </Button>
          )}
          {/* Export toggle (admin) */}
          {isAdmin && hasActiveMatches && (
            <Button variant="outline" size="default" onClick={() => setShowExport((v) => !v)}
              className={`border-accent/40 text-accent hover:bg-accent/10 min-h-[44px] px-4 text-sm ${showExport ? "bg-accent/10" : ""}`}>
              <Share2 className="w-4 h-4 mr-1.5" /> Export
            </Button>
          )}
          {/* Edit Pairs (admin) */}
          {isAdmin && roundRobinInProgress && (
            <Button variant="outline" size="default" onClick={() => setShowEditPairs(true)}
              className={`border-accent/40 text-accent hover:bg-accent/10 min-h-[44px] px-4 text-sm ${showEditPairs ? "bg-accent/10" : ""}`}>
              <Edit3 className="w-4 h-4 mr-1.5" /> Edit Pairs
            </Button>
          )}
          {/* Regenerate Schedule (admin) */}
          {isAdmin && roundRobinInProgress && (
            <Button variant="outline" size="default" onClick={() => setShowRegenConfirm(true)}
              className="border-accent/40 text-accent hover:bg-accent/10 min-h-[44px] px-4 text-sm">
              <RefreshCw className="w-4 h-4 mr-1.5" /> Regen Schedule
            </Button>
          )}
          {/* Manage Roster (admin) — unified drawer */}
          {isAdmin && roundRobinInProgress && (
            <Button variant="outline" size="default" onClick={() => setShowManageRoster(true)}
              className="border-accent/40 text-accent hover:bg-accent/10 min-h-[44px] px-4 text-sm">
              <Settings2 className="w-4 h-4 mr-1.5" /> Manage Roster
            </Button>
          )}
          {/* Start Playoffs (admin) */}
          {isAdmin && roundRobinInProgress && (
            <Button onClick={() => startPlayoffs()} className="bg-accent text-accent-foreground hover:bg-accent/80 min-h-[44px] px-5 text-sm">
              <Swords className="w-4 h-4 mr-1.5" /> Start Playoffs
            </Button>
          )}
          {onGoToCheckIn && !isFullscreen && (
            <Button variant="outline" size="default" onClick={onGoToCheckIn} className="border-accent/40 text-accent hover:bg-accent/10 min-h-[44px] px-4 text-sm">
              <UserCheck className="w-4 h-4 mr-1.5" /> Check In
            </Button>
          )}
          <Button variant="outline" size="default" onClick={toggleFullscreen} className="border-accent/40 text-accent hover:bg-accent/10 min-h-[44px] px-4 text-sm">
            {isFullscreen ? <Minimize className="w-4 h-4 mr-1.5" /> : <Maximize className="w-4 h-4 mr-1.5" />}
            {isFullscreen ? "Exit" : "Fullscreen"}
          </Button>
        </div>
      </div>

      {/* Conflicts are prevented by scheduling logic — no alert needed */}

      {/* Playoffs bracket on Court Display */}
      {state.playoffsStarted && (state.playoffMatches || []).length > 0 && (
        <div className="space-y-6">
          <div className="rounded-lg border-2 border-accent bg-accent/10 p-4 text-center">
            <p className="font-display text-xl text-accent">🏆 Playoff Mode Active</p>
          </div>

          {/* Playoff courts — show which playoff matches are currently on court */}
          {(() => {
            const playingPlayoff = (state.playoffMatches || []).filter((m) => m.status === "playing");
            if (playingPlayoff.length === 0) return null;
            return (
              <div className="flex flex-col md:flex-row gap-6">
                {playingPlayoff.map((pm) => {
                  const court = pm.court;
                  return (
                    <div key={pm.id} className="rounded-lg border border-border bg-card p-4 md:p-6 space-y-4 flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-3xl text-accent">Court {court || "?"}</h3>
                        <span className="text-xs uppercase tracking-widest bg-accent/20 text-accent px-4 py-1.5 rounded-full border border-accent/30">Playoff</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 text-center space-y-1 rounded-md bg-muted/50 p-3 md:p-4">
                          {pm.seed1 ? <p className="text-accent font-mono text-xs">Seed #{pm.seed1}</p> : null}
                          <p className="font-display text-lg md:text-xl text-foreground">{pm.pair1?.player1.name}</p>
                          <p className="font-display text-lg md:text-xl text-foreground">{pm.pair1?.player2.name}</p>
                        </div>
                        <div className="font-display text-2xl md:text-3xl text-accent">VS</div>
                        <div className="flex-1 text-center space-y-1 rounded-md bg-muted/50 p-3 md:p-4">
                          {pm.seed2 ? <p className="text-accent font-mono text-xs">Seed #{pm.seed2}</p> : null}
                          <p className="font-display text-lg md:text-xl text-foreground">{pm.pair2?.player1.name}</p>
                          <p className="font-display text-lg md:text-xl text-foreground">{pm.pair2?.player2.name}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <PlayoffBracket
            playoffMatches={state.playoffMatches}
            onComplete={completePlayoffMatch}
            isAdmin={isAdmin}
          />
        </div>
      )}

      {courtFilter && (
        <p className="text-sm text-muted-foreground text-center uppercase tracking-widest">Showing Court {courtFilter} only</p>
      )}

      {/* Mini standings panel */}
      {showStandings && isAdmin && <MiniStandings roster={state.roster} />}

      {/* Game history panel (admin) */}
      {showHistory && isAdmin && <GameHistoryLog gameState={gameState} />}

      {/* Session export panel (admin) */}
      {showExport && isAdmin && <SessionExport state={state} />}

      {/* Courts — hide during playoffs */}
      {!state.playoffsStarted && (
        <>
          <div className={`flex flex-col ${!courtFilter ? "md:flex-row" : ""} gap-6`}>
            {showCourt1 && <CourtCard courtNum={1} match={court1Match} totalGames={totalGames} onFinish={setFinishingMatch} onSkip={(m) => skipMatch(m.id)} isAdmin={isAdmin} />}
            {showCourt2 && <CourtCard courtNum={2} match={court2Match} totalGames={totalGames} onFinish={setFinishingMatch} onSkip={(m) => skipMatch(m.id)} isAdmin={isAdmin} />}
            {showCourt3 && <CourtCard courtNum={3} match={court3Match} totalGames={totalGames} onFinish={setFinishingMatch} onSkip={(m) => skipMatch(m.id)} isAdmin={isAdmin} />}
          </div>

          {/* Up Next — Locked */}
          {upNextMatches.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4 md:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl text-accent">Up Next</h3>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest bg-accent/10 text-accent/70 px-2 py-0.5 rounded border border-accent/20">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              </div>
              {upNextMatches.map((m) => (
                <div key={m.id} className={`flex items-center gap-3 text-base text-foreground/80 border-l-2 border-primary/30 pl-4 py-2 ${matchHasNewPair(m) ? "animate-pulse bg-accent/10 rounded-r" : ""}`}>
                  {m.gameNumber && <span className="text-accent font-display text-lg">#{m.gameNumber}</span>}
                  <span className="flex flex-wrap items-center gap-1.5">
                    {renderPlayerName(m.pair1.player1.name, m.pair1.player1.id, m.id)}
                    <span>&</span>
                    {renderPlayerName(m.pair1.player2.name, m.pair1.player2.id, m.id)}
                    <span className="text-muted-foreground mx-2">vs</span>
                    {renderPlayerName(m.pair2.player1.name, m.pair2.player1.id, m.id)}
                    <span>&</span>
                    {renderPlayerName(m.pair2.player2.name, m.pair2.player2.id, m.id)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* On Deck — Locked */}
          {onDeckMatches.length > 0 && (
            <div className="rounded-lg border border-accent/20 bg-accent/5 p-4 md:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl text-accent">🏓 On Deck — Get Ready!</h3>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest bg-accent/10 text-accent/70 px-2 py-0.5 rounded border border-accent/20">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              </div>
              {onDeckMatches.map((m) => (
                <div key={m.id} className={`flex items-center gap-3 text-base text-foreground/80 border-l-2 border-accent/30 pl-4 py-2 ${matchHasNewPair(m) ? "animate-pulse bg-accent/10 rounded-r" : ""}`}>
                  {m.gameNumber && <span className="text-accent font-display text-lg">#{m.gameNumber}</span>}
                  <span>
                    {m.pair1.player1.name} & {m.pair1.player2.name}
                    <span className="text-muted-foreground mx-2">vs</span>
                    {m.pair2.player1.name} & {m.pair2.player2.name}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Projected (future games beyond On Deck) */}
          {pendingMatches.length > (state.sessionConfig.courtCount || 2) * 2 && isAdmin && (
            <div className="rounded-lg border border-border/50 bg-card/50 p-4 md:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl text-muted-foreground">Projected</h3>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest bg-muted/50 text-muted-foreground px-2 py-0.5 rounded border border-border/40">
                  <Zap className="w-3 h-3" /> May shift
                </span>
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {pendingMatches.slice((state.sessionConfig.courtCount || 2) * 2).map((m) => (
                  <div key={m.id} className={`flex items-center gap-3 text-sm text-foreground/60 pl-4 py-1 ${matchHasNewPair(m) ? "animate-pulse bg-accent/10 rounded text-foreground/90" : ""}`}>
                    {m.gameNumber && <span className="text-muted-foreground font-display">#{m.gameNumber}</span>}
                    <span>
                      {m.pair1.player1.name} & {m.pair1.player2.name}
                      <span className="text-muted-foreground mx-1.5">vs</span>
                      {m.pair2.player1.name} & {m.pair2.player2.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Pairs */}
          {allUniquePairs.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4 md:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-accent" />
                <h3 className="font-display text-xl text-accent">All Pairs</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {allUniquePairs.map((pair, i) => (
                  <div key={i} className={`rounded-md border border-border/60 bg-muted/30 px-4 py-3 text-center ${highlightPairIds.has(pair.id) ? "animate-pulse border-accent bg-accent/10" : ""}`}>
                    <p className="font-display text-base text-foreground">{pair.player1}</p>
                    <p className="text-xs text-muted-foreground my-0.5">&</p>
                    <p className="font-display text-base text-foreground">{pair.player2}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {finishingMatch && (
        <WinnerModal
          match={finishingMatch}
          onSelect={(pairId) => { completeMatch(finishingMatch.id, pairId); setFinishingMatch(null); }}
          onClose={() => setFinishingMatch(null)}
        />
      )}

      {/* Regenerate confirmation modal */}
      {showRegenConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setShowRegenConfirm(false)}>
          <div className="bg-card border border-border rounded-lg p-8 max-w-sm w-full mx-4 space-y-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-2xl text-accent">Regenerate Schedule?</h3>
            <p className="text-base text-muted-foreground">
              This will rebuild all future games (after On Deck) to rebalance the schedule. Active games, completed results, and the next queued games will not change.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleRegenerate} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/80 min-h-[48px]">
                <RefreshCw className="w-4 h-4 mr-2" /> Regenerate
              </Button>
              <Button variant="outline" onClick={() => setShowRegenConfirm(false)} className="flex-1 min-h-[48px]">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Roster drawer */}
      <ManageRosterDrawer
        activePlayers={checkedInPlayers.filter((p) => state.pairs.some((pair) => pair.player1.id === p.id || pair.player2.id === p.id))}
        pairs={state.pairs}
        isOpen={showManageRoster}
        onOpenChange={setShowManageRoster}
        onSwapPlayer={(oldId, newName, tier) => swapPlayerMidSession(oldId, newName, tier)}
        onAddPlayer={(name, tier) => addPlayerMidSession(name, tier)}
        onRemovePlayer={(id) => removePlayerMidSession(id)}
      />

      {/* Edit Pairs sheet */}
      <Sheet open={showEditPairs} onOpenChange={setShowEditPairs}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto bg-background">
          <SheetHeader>
            <SheetTitle className="font-display text-xl text-accent flex items-center gap-2">
              <Edit3 className="w-5 h-5" /> Edit Pairs
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <PairEditor
              pairs={state.pairs}
              waitlistedPlayers={state.roster.filter(
                (p) => p.checkedIn && (state.waitlistedPlayers || []).includes(p.id)
              )}
              onSwapPlayers={swapPlayersInPairs}
              onSwapWaitlistPlayer={swapWaitlistPlayer}
              isAdmin={true}
              sessionStarted={state.sessionStarted}
              hasCompletedGames={state.matches.some((m) => m.status === "completed")}
              onLockPairs={lockPairs}
              pairsLocked={state.pairsLocked}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CourtDisplay;