import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useGameState } from "@/hooks/useGameState";
import { Match } from "@/types/courtManager";
import { Trophy, Timer, UserCheck, ArrowRightLeft, Maximize, Minimize, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface CourtDisplayProps {
  gameState: ReturnType<typeof useGameState>;
  onGoToCheckIn?: () => void;
  isAdmin?: boolean;
}

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


const WinnerModal = ({
  match,
  onSelect,
  onClose,
}: {
  match: Match;
  onSelect: (pairId: string) => void;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
    <div className="bg-card border border-border rounded-lg p-10 max-w-lg w-full mx-4 space-y-8" onClick={(e) => e.stopPropagation()}>
      <h3 className="font-display text-3xl text-accent text-center">Which team won?</h3>
      <div className="space-y-4">
        <button
          onClick={() => onSelect(match.pair1.id)}
          className="w-full rounded-lg border-2 border-border bg-muted p-6 text-center hover:border-accent hover:bg-accent/10 transition-all active:scale-[0.98] min-h-[80px]"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Team A</p>
          <p className="font-display text-xl text-foreground">{match.pair1.player1.name} & {match.pair1.player2.name}</p>
        </button>
        <button
          onClick={() => onSelect(match.pair2.id)}
          className="w-full rounded-lg border-2 border-border bg-muted p-6 text-center hover:border-accent hover:bg-accent/10 transition-all active:scale-[0.98] min-h-[80px]"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Team B</p>
          <p className="font-display text-xl text-foreground">{match.pair2.player1.name} & {match.pair2.player2.name}</p>
        </button>
      </div>
      <button onClick={onClose} className="w-full text-muted-foreground text-base hover:text-foreground transition-colors py-2">
        Cancel
      </button>
    </div>
  </div>
);

const CourtCard = ({
  courtNum,
  match,
  totalGames,
  onFinish,
  onSkip,
  isAdmin,
}: {
  courtNum: number;
  match: Match | null;
  totalGames: number;
  onFinish: (match: Match) => void;
  onSkip: (match: Match) => void;
  isAdmin: boolean;
}) => (
  <div className="rounded-lg border border-border bg-card p-8 space-y-6 flex-1">
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <h3 className="font-display text-3xl text-accent">Court {courtNum}</h3>
        {match?.gameNumber && totalGames > 0 && (
          <p className="text-sm text-muted-foreground">
            Game {match.gameNumber} of {totalGames}
          </p>
        )}
      </div>
      <div className="flex items-center gap-4">
        {match && <GameTimer startedAt={match.startedAt} />}
        {match ? (
          <span className="text-xs uppercase tracking-widest bg-accent/20 text-accent px-4 py-1.5 rounded-full border border-accent/30">
            Playing
          </span>
        ) : (
          <span className="text-xs uppercase tracking-widest bg-primary/20 text-primary px-4 py-1.5 rounded-full border border-primary/30">
            Waiting
          </span>
        )}
      </div>
    </div>

    {match ? (
      <div className="space-y-5">
        <div className="flex items-center gap-6">
          <div className="flex-1 text-center space-y-1.5 rounded-md bg-muted/50 p-5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Team A</p>
            <p className="font-display text-xl text-foreground">{match.pair1.player1.name}</p>
            <p className="font-display text-xl text-foreground">{match.pair1.player2.name}</p>
          </div>
          <div className="font-display text-3xl text-accent">VS</div>
          <div className="flex-1 text-center space-y-1.5 rounded-md bg-muted/50 p-5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Team B</p>
            <p className="font-display text-xl text-foreground">{match.pair2.player1.name}</p>
            <p className="font-display text-xl text-foreground">{match.pair2.player2.name}</p>
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

const SwapPlayerButton = ({
  playerName,
  playerId,
  matchId,
  availablePlayers,
  onSwap,
}: {
  playerName: string;
  playerId: string;
  matchId: string;
  availablePlayers: { id: string; name: string }[];
  onSwap: (matchId: string, oldId: string, newId: string) => void;
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
            <button
              key={p.id}
              onClick={() => { onSwap(matchId, playerId, p.id); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-base rounded hover:bg-accent/10 hover:text-accent transition-colors min-h-[44px]"
            >
              {p.name}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
};

const CourtDisplay = ({ gameState, onGoToCheckIn, isAdmin = false }: CourtDisplayProps) => {
  const { state, court1Match, court2Match, pendingMatches, upNextMatches, onDeckMatches, completeMatch, skipMatch, swapPlayer, checkedInPlayers } = gameState;
  const [finishingMatch, setFinishingMatch] = useState<Match | null>(null);
  const [searchParams] = useSearchParams();
  const courtFilter = searchParams.get("court");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
  const totalGames = state.totalScheduledGames;

  // Players already assigned to upcoming/playing matches
  const busyPlayerIds = new Set<string>();
  [court1Match, court2Match, ...upNextMatches].filter(Boolean).forEach((m) => {
    if (!m) return;
    [m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id].forEach((id) => busyPlayerIds.add(id));
  });
  const availableForSwap = checkedInPlayers.filter((p) => !busyPlayerIds.has(p.id));

  // "On deck" players (from the matches AFTER up-next)
  const onDeckPlayers = onDeckMatches.flatMap((m) => [
    m.pair1.player1.name,
    m.pair1.player2.name,
    m.pair2.player1.name,
    m.pair2.player2.name,
  ]);

  const renderPlayerName = (name: string, playerId: string, matchId: string) => {
    if (!isAdmin) return <span>{name}</span>;
    return (
      <SwapPlayerButton
        playerName={name}
        playerId={playerId}
        matchId={matchId}
        availablePlayers={availableForSwap}
        onSwap={swapPlayer}
      />
    );
  };

  return (
    <div ref={containerRef} className={`animate-fade-up ${isFullscreen ? "bg-background min-h-screen p-8 flex flex-col justify-center gap-8" : "space-y-8"}`}>
      {/* Toolbar: fullscreen + check-in */}
      <div className="flex items-center justify-between">
        <div>
          {isFullscreen && (
            <h2 className="font-display text-3xl text-accent">Club PTO</h2>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onGoToCheckIn && !isFullscreen && (
            <Button variant="outline" size="default" onClick={onGoToCheckIn} className="border-accent/40 text-accent hover:bg-accent/10 min-h-[48px] px-5 text-base">
              <UserCheck className="w-5 h-5 mr-2" /> Check In
            </Button>
          )}
          <Button variant="outline" size="default" onClick={toggleFullscreen} className="border-accent/40 text-accent hover:bg-accent/10 min-h-[48px] px-5 text-base">
            {isFullscreen ? <Minimize className="w-5 h-5 mr-2" /> : <Maximize className="w-5 h-5 mr-2" />}
            {isFullscreen ? "Exit" : "Fullscreen"}
          </Button>
        </div>
      </div>
      {courtFilter && (
        <p className="text-sm text-muted-foreground text-center uppercase tracking-widest">
          Showing Court {courtFilter} only
        </p>
      )}
      <div className={`flex flex-col ${!courtFilter ? "md:flex-row" : ""} gap-6`}>
        {showCourt1 && <CourtCard courtNum={1} match={court1Match} totalGames={totalGames} onFinish={setFinishingMatch} onSkip={(m) => skipMatch(m.id)} isAdmin={isAdmin} />}
        {showCourt2 && <CourtCard courtNum={2} match={court2Match} totalGames={totalGames} onFinish={setFinishingMatch} onSkip={(m) => skipMatch(m.id)} isAdmin={isAdmin} />}
      </div>

      {/* Up Next — the 2 matches going on court next */}
      {upNextMatches.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-8 space-y-4">
          <h3 className="font-display text-xl text-accent">Up Next</h3>
          {upNextMatches.map((m) => (
            <div key={m.id} className="flex items-center gap-3 text-base text-foreground/80 border-l-2 border-primary/30 pl-4 py-2">
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

      {/* On Deck — the matches AFTER up-next */}
      {onDeckPlayers.length > 0 && (
        <div className="rounded-lg border border-accent/20 bg-accent/5 p-8 space-y-4">
          <h3 className="font-display text-xl text-accent">🏓 On Deck — Get Ready!</h3>
          <div className="flex flex-wrap gap-3">
            {[...new Set(onDeckPlayers)].map((name) => (
              <span key={name} className="rounded-full border border-accent/40 bg-accent/10 px-5 py-2 text-base font-display text-foreground">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {finishingMatch && (
        <WinnerModal
          match={finishingMatch}
          onSelect={(pairId) => {
            completeMatch(finishingMatch.id, pairId);
            setFinishingMatch(null);
          }}
          onClose={() => setFinishingMatch(null)}
        />
      )}
    </div>
  );
};

export default CourtDisplay;