// Court Manager v2 — RoundBoard: live round play (phase === "rounds").
// Two courts side by side, winner-tap-only results, calm pace surfaces.
// HELPER-FACING screen (no passcode): tier labels are NEVER shown here (§18) —
// helpers and players only see names. Numeric scores never exist (§9).

import { useMemo, useState } from "react";
import type { UseSessionV2, CourtView } from "@/court-manager/react/useSessionV2";
import type { RoundGame } from "@/court-manager/types";
import {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  Trophy,
  UserPlus,
} from "lucide-react";

/* ── formatting helpers ───────────────────────────────────────────── */

const fmtClock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/* ── tiny sub-components ──────────────────────────────────────────── */

const SyncPill = ({ status }: { status: UseSessionV2["syncStatus"] }) => {
  const view =
    status === "synced"
      ? { dot: "bg-accent", label: "Saved locally", text: "text-muted-foreground" }
      : status === "pending"
        ? { dot: "bg-amber-400", label: "Sync pending", text: "text-amber-400" }
        : { dot: "bg-destructive", label: "Sync error", text: "text-destructive" };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs uppercase tracking-widest ${view.text}`}
    >
      <span className={`w-2 h-2 rounded-full ${view.dot}`} />
      {view.label}
    </span>
  );
};

const PairLine = ({
  pairId,
  s,
  muted,
}: {
  pairId: string;
  s: UseSessionV2;
  muted?: boolean;
}) => (
  // Names only — no tier labels on this helper-facing screen (§18).
  <span className={muted ? "text-muted-foreground" : "text-foreground"}>
    {s.pairName(pairId)}
  </span>
);

/* ── inline confirm guard (§6) — one tap arms, second tap commits ── */

const ConfirmBlock = ({
  message,
  onConfirm,
  onBack,
  className = "flex-1",
}: {
  message: string;
  onConfirm: () => void;
  onBack: () => void;
  className?: string;
}) => (
  <div className={`${className} rounded-lg border-2 border-accent bg-accent/5 px-4 py-3 space-y-3`}>
    <p className="text-sm md:text-base text-foreground">{message}</p>
    <div className="flex gap-2">
      <button
        onClick={onConfirm}
        className="flex-1 min-h-[52px] rounded-lg bg-accent text-accent-foreground border-2 border-accent px-4 font-display text-base md:text-lg hover:bg-accent/90 active:scale-[0.98] transition-all touch-manipulation"
      >
        Confirm
      </button>
      <button
        onClick={onBack}
        className="flex-1 min-h-[52px] rounded-lg border-2 border-border bg-muted px-4 font-display text-base md:text-lg text-foreground hover:border-accent/50 transition-all touch-manipulation"
      >
        Back
      </button>
    </div>
  </div>
);

/* ── projection banner (§8) — information, not alarm ──────────────── */

const PaceLine = ({ s }: { s: UseSessionV2 }) => {
  const p = s.paceInfo;
  if (!p) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
      Averaging {p.avgMinPerGame.toFixed(1)} min/game
      <span className="text-xs ml-1">({p.usingMeasured ? "measured" : "estimated"})</span>
    </div>
  );
};

/* ── one court card ───────────────────────────────────────────────── */

const CourtCard = ({ view, s }: { view: CourtView; s: UseSessionV2 }) => {
  const game = view.nowPlaying;
  // Which game has the abandon choice open — keyed by id so a settled game
  // closing the panel never carries it over to the next game on this court.
  const [abandoning, setAbandoning] = useState<string | null>(null);
  return (
    <div className="rounded-lg border border-border bg-card p-4 md:p-5 space-y-4 min-w-0">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-2xl md:text-3xl text-accent">Court {view.court}</h3>
        {game?.isRematch && (
          <span className="text-xs uppercase tracking-widest text-amber-400">rematch</span>
        )}
      </div>

      {game ? (
        <>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Now playing — tap who won
            </p>
            {game.pairIds.map((pairId) => (
              <button
                key={pairId}
                onClick={() => s.recordWinner(game.id, pairId)}
                className="w-full min-h-[72px] rounded-lg border-2 border-border bg-muted px-5 py-4 flex items-center justify-between gap-3 text-left hover:border-accent hover:bg-accent/10 active:border-accent active:bg-accent/20 active:scale-[0.98] transition-all touch-manipulation"
              >
                <span className="font-display text-xl md:text-2xl text-foreground truncate min-w-0">
                  {s.pairName(pairId)}
                </span>
                <Trophy className="w-5 h-5 shrink-0 text-muted-foreground/50" />
              </button>
            ))}

            {/* END GAME — ABANDONED (§9): void or award, never a fake result */}
            {abandoning === game.id ? (
              <div className="rounded-lg border border-border bg-dark-surface/40 p-3 space-y-2">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  End game — abandoned
                </p>
                <button
                  onClick={() => {
                    setAbandoning(null);
                    s.abandonGame(game.id, "void");
                  }}
                  className="w-full min-h-[44px] rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground text-left hover:border-accent/50 hover:bg-accent/10 transition-colors touch-manipulation"
                >
                  VOID — counts for nobody
                </button>
                {game.pairIds.map((pairId) => (
                  <button
                    key={pairId}
                    onClick={() => {
                      setAbandoning(null);
                      s.abandonGame(game.id, "award", pairId);
                    }}
                    className="w-full min-h-[44px] rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground text-left hover:border-accent/50 hover:bg-accent/10 transition-colors touch-manipulation"
                  >
                    AWARD to {s.pairName(pairId)}
                  </button>
                ))}
                <button
                  onClick={() => setAbandoning(null)}
                  className="w-full min-h-[44px] rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAbandoning(game.id)}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-lg px-2 text-xs uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground transition-colors touch-manipulation"
              >
                <Ban className="w-3.5 h-3.5" />
                End game — abandoned
              </button>
            )}
          </div>

          {view.onDeck && (
            <div className="pt-2 border-t border-border space-y-1.5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">On deck</p>
              <p className="text-base flex flex-wrap items-center gap-x-2 gap-y-1">
                <PairLine pairId={view.onDeck.pairIds[0]} s={s} />
                <span className="text-muted-foreground text-sm">vs</span>
                <PairLine pairId={view.onDeck.pairIds[1]} s={s} />
              </p>
            </div>
          )}

          {view.upcoming.length > 0 && (
            <div className="pt-2 border-t border-border space-y-1.5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Up next</p>
              {view.upcoming.map((g) => (
                <p
                  key={g.id}
                  className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-2"
                >
                  <span className="text-xs w-10 shrink-0">Slot {g.slot}</span>
                  <span>{s.pairName(g.pairIds[0])}</span>
                  <span className="text-xs">vs</span>
                  <span>{s.pairName(g.pairIds[1])}</span>
                </p>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="min-h-[180px] flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-dark-surface/40 text-center px-4">
          <p className="font-display text-lg text-muted-foreground">Court done</p>
          <p className="text-sm text-muted-foreground/70">Waiting on the other court</p>
        </div>
      )}
    </div>
  );
};

/* ── decision point (§6) — prominent but calm ─────────────────────── */

const DecisionPanel = ({ s }: { s: UseSessionV2 }) => {
  // Manual choice at the round boundary: play the next round or jump to
  // playoffs. First tap arms; second confirms (guards a fat-finger).
  const [arming, setArming] = useState<"play" | "playoffs" | null>(null);
  const nextRound = s.session.currentRound + 1;
  const pace = s.paceInfo;
  const message = `Everyone's played ${nextRound - 1} games. Play round ${nextRound}, or jump to playoffs?`;
  const base =
    "flex-1 min-h-[72px] rounded-lg px-6 py-4 font-display text-lg md:text-xl transition-all active:scale-[0.98] touch-manipulation";
  const goldButton = `${base} bg-accent text-accent-foreground hover:bg-accent/90 border-2 border-accent`;
  const quietButton = `${base} border-2 border-border bg-muted text-foreground hover:border-accent/50 hover:bg-accent/10`;
  return (
    <div className="rounded-lg border border-accent/40 bg-dark-elevated/60 p-5 md:p-6 space-y-4 animate-fade-up">
      <p className="text-xs uppercase tracking-widest text-accent">Round {nextRound - 1} complete</p>
      <p className="text-base md:text-lg text-foreground">
        {message}
        {pace && (
          <span className="text-muted-foreground text-sm block mt-1">
            Averaging {pace.avgMinPerGame.toFixed(1)} min/game.
          </span>
        )}
      </p>
      <div className="flex flex-col md:flex-row gap-3">
        {arming === "play" ? (
          <ConfirmBlock
            message={`Play round ${nextRound}?`}
            onConfirm={() => {
              setArming(null);
              s.playNextRound();
            }}
            onBack={() => setArming(null)}
          />
        ) : (
          <button onClick={() => setArming("play")} className={goldButton}>
            PLAY ROUND {nextRound}
          </button>
        )}
        {arming === "playoffs" ? (
          <ConfirmBlock
            message={`Jump to playoffs — everyone at ${nextRound - 1} games?`}
            onConfirm={() => {
              setArming(null);
              s.startPlayoffs();
            }}
            onBack={() => setArming(null)}
          />
        ) : (
          <button onClick={() => setArming("playoffs")} className={quietButton}>
            JUMP TO PLAYOFFS — everyone at {nextRound - 1} games
          </button>
        )}
      </div>
    </div>
  );
};

/* ── final round done — playoffs with the same confirm guard ──────── */

const FinalRoundPanel = ({ s }: { s: UseSessionV2 }) => {
  const [arming, setArming] = useState(false);
  const { targetRounds } = s.session.config;
  const message = `All ${targetRounds} rounds are in — seed the bracket and start playoffs.`;
  return (
    <div className="rounded-lg border border-accent/40 bg-dark-elevated/60 p-5 md:p-6 space-y-4 animate-fade-up">
      <p className="text-base text-foreground">
        All {targetRounds} rounds are in. Time for playoffs.
      </p>
      {arming ? (
        <ConfirmBlock
          className="w-full"
          message={message}
          onConfirm={() => {
            setArming(false);
            s.startPlayoffs();
          }}
          onBack={() => setArming(false)}
        />
      ) : (
        <button
          onClick={() => setArming(true)}
          className="w-full min-h-[72px] rounded-lg bg-accent text-accent-foreground border-2 border-accent px-6 py-4 font-display text-xl md:text-2xl hover:bg-accent/90 active:scale-[0.98] transition-all touch-manipulation inline-flex items-center justify-center gap-3"
        >
          <Trophy className="w-6 h-6" />
          START PLAYOFFS
        </button>
      )}
    </div>
  );
};

/* ── late arrivals — pair & slot mid-session latecomers into games ─── */

const LatecomerPanel = ({ s }: { s: UseSessionV2 }) => {
  const late = s.latecomers;
  if (late.length === 0) return null;
  const names = late.map((p) => p.name).join(", ");
  const nextRound = s.session.currentRound + 1;
  const finalRound = s.session.currentRound >= s.session.config.targetRounds;
  // Can we pair anyone? A tier needs at least two waiting players.
  const byTier: Record<string, number> = {};
  for (const p of late) byTier[p.tier] = (byTier[p.tier] ?? 0) + 1;
  const canPair = Object.values(byTier).some((n) => n >= 2);

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 md:p-5 space-y-3">
      <p className="text-xs uppercase tracking-widest text-amber-400">
        Late arrivals ({late.length})
      </p>
      <p className="text-base text-foreground">
        Checked in after the start, not in games yet: <span className="text-cream">{names}</span>.
      </p>
      {finalRound ? (
        <p className="text-sm text-muted-foreground">
          The session is on its final round — they can&apos;t be slotted into more games.
        </p>
      ) : canPair ? (
        <button
          onClick={s.addLatecomers}
          className="min-h-[56px] px-6 rounded-lg bg-accent text-accent-foreground border-2 border-accent font-display text-lg hover:bg-accent/90 active:scale-[0.98] transition-all touch-manipulation inline-flex items-center gap-3"
        >
          <UserPlus className="w-5 h-5" />
          Add to the games — join round {nextRound}
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Waiting on a partner for each — they&apos;ll be ready to add as soon as a matching player checks in.
        </p>
      )}
    </div>
  );
};

/* ── collapsible game history with flip-result corrections (§9) ───── */

const GameHistory = ({ s }: { s: UseSessionV2 }) => {
  const [open, setOpen] = useState(false);
  const results = s.session.results;
  const voided = s.session.voidedGames;
  const flipDisabled = s.session.playoffs !== null;

  const gameById = useMemo(() => {
    const map = new Map<string, RoundGame>();
    for (const round of s.session.schedule?.rounds ?? []) {
      for (const g of round) map.set(g.id, g);
    }
    return map;
  }, [s.session.schedule]);

  if (results.length === 0 && voided.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full min-h-[52px] px-4 md:px-5 py-3 flex items-center justify-between text-left touch-manipulation"
      >
        <span className="text-sm uppercase tracking-widest text-muted-foreground">
          Game history ({results.length + voided.length})
        </span>
        {open ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="border-t border-border divide-y divide-border/60">
          {[...results].reverse().map((r) => {
            const g = gameById.get(r.gameId);
            return (
              <div
                key={r.gameId}
                className="px-4 md:px-5 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-base truncate">
                    <span className="text-foreground">{s.pairName(r.winnerPairId)}</span>
                    <span className="text-accent text-sm ml-2">
                      {r.awarded === true ? "awarded" : "won"}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      vs {s.pairName(r.loserPairId)}
                    </span>
                  </p>
                  {g && (
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      Round {g.round} · Court {g.court} · Slot {g.slot} ·{" "}
                      {fmtClock(r.completedAt)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => s.correctGame(r.gameId, r.loserPairId)}
                  disabled={flipDisabled}
                  title={
                    flipDisabled
                      ? "Corrections are locked once playoffs are seeded"
                      : "Flip this result"
                  }
                  className="shrink-0 min-h-[44px] min-w-[44px] inline-flex items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors disabled:opacity-40 disabled:pointer-events-none touch-manipulation"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span className="hidden md:inline">Flip</span>
                </button>
              </div>
            );
          })}
          {[...voided].reverse().map((gameId) => {
            const g = gameById.get(gameId);
            return (
              <div key={gameId} className="px-4 md:px-5 py-3">
                <p className="text-base truncate text-muted-foreground">
                  {g ? (
                    <>
                      {s.pairName(g.pairIds[0])}
                      <span className="text-sm mx-2">vs</span>
                      {s.pairName(g.pairIds[1])}
                    </>
                  ) : (
                    gameId
                  )}
                  <span className="text-sm ml-2 uppercase tracking-widest text-muted-foreground/70">
                    VOID — unplayed
                  </span>
                </p>
                {g && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    Round {g.round} · Court {g.court} · Slot {g.slot}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── the board ────────────────────────────────────────────────────── */

export default function RoundBoard({ s }: { s: UseSessionV2 }) {
  const { session } = s;
  if (session.phase !== "rounds") return null;

  const { currentRound } = session;
  const { targetRounds } = session.config;
  const finalRoundDone = s.roundComplete && currentRound === targetRounds;

  return (
    <div className="space-y-5 md:space-y-6 animate-fade-up">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl md:text-4xl text-foreground">
          Round {currentRound}{" "}
          <span className="text-muted-foreground text-2xl md:text-3xl">of {targetRounds}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {session.practice && (
            <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground">
              Practice — results don't count
            </span>
          )}
          <SyncPill status={s.syncStatus} />
          {!s.isPaused && (
            <button
              onClick={s.pauseSession}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors touch-manipulation"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}
        </div>
      </div>

      {/* paused (§8) — prominent and calm; winner taps stay enabled */}
      {s.isPaused && (
        <div className="rounded-lg border border-accent/40 bg-dark-elevated/60 p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-up">
          <p className="font-display text-xl md:text-2xl text-foreground text-center md:text-left">
            SESSION PAUSED{" "}
            <span className="font-body text-base text-muted-foreground">
              — game timers frozen
            </span>
          </p>
          <button
            onClick={s.resumeSession}
            className="w-full md:w-auto min-h-[72px] rounded-lg bg-accent text-accent-foreground border-2 border-accent px-8 py-4 font-display text-xl hover:bg-accent/90 active:scale-[0.98] transition-all touch-manipulation inline-flex items-center justify-center gap-3"
          >
            <Play className="w-6 h-6" />
            RESUME
          </button>
        </div>
      )}

      {/* late arrivals — pair & slot them into the remaining rounds */}
      <LatecomerPanel s={s} />

      {/* measured pace — informational, no deadline */}
      <PaceLine s={s} />

      {/* schedule disclosures — quiet amber */}
      {s.scheduleWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 space-y-1">
          {s.scheduleWarnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-400/90 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}

      {/* decision point — before the final round only */}
      {s.atDecisionPoint && <DecisionPanel s={s} />}

      {/* final round complete — playoffs are the only move (confirm-guarded) */}
      {finalRoundDone && <FinalRoundPanel s={s} />}

      {/* both courts, side by side */}
      <div className="grid grid-cols-2 gap-4 md:gap-5">
        {s.courts.map((view) => (
          <CourtCard key={view.court} view={view} s={s} />
        ))}
      </div>

      {/* collapsible history + corrections */}
      <GameHistory s={s} />
    </div>
  );
}
