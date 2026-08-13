// PTO Americano v4 — the phone-first skin (STEP G).
//
// One idea per screen. The reference is the app the club actually ran a night
// on: a single match card with huge score boxes, a resting line, a couple of
// bottom tabs. Our engine does what that app cannot; this is that power
// wearing its simplicity.
//
// PRIMARY DEVICE IS A PHONE (390×844, one-handed, in a dark noisy room). The
// tablet gets the same components larger — no separate layout to maintain.
// Every decision still comes from src/lib/americano/; these components hold
// zero game logic.

import { useEffect, useRef, useState } from "react";
import type { AmericanoMatch, MatchFormat } from "@/types/americano";
import type { PoolLiveView, UseAmericanoSession } from "@/hooks/useAmericanoSession";
import { entryOptions, formatLabel, resultNotation } from "@/lib/americano/format";
import { flipPhase } from "@/lib/americano/flips";

/* ── small shared pieces ─────────────────────────────────────────── */

export const formatKey = (f: MatchFormat) =>
  f.kind === "bestOf" ? `bo${f.sets}` : `g${f.targetPoints}`;

/** A bottom sheet. Everything secondary lives in one of these — never a
    modal that hides the court, never a wall of controls on the main screen. */
export const Sheet = ({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
    onClick={onClose}>
    <div className="w-full max-w-lg rounded-t-2xl border-t border-x border-border bg-dark-surface p-4 pb-8 space-y-3 max-h-[85vh] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl text-accent">{title}</h3>
        <button onClick={onClose} aria-label="Close"
          className="min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-cream text-2xl leading-none">
          ×
        </button>
      </div>
      {children}
    </div>
  </div>
);

/** [Court 1 | Court 2] — the only navigation between pools. A dot marks a
    court that is owed a result, so the thumb knows where to go without
    reading anything. */
export const CourtSegment = ({ views, activeId, onPick }: {
  views: PoolLiveView[]; activeId: string; onPick: (id: string) => void;
}) => (
  <div className="flex rounded-lg border border-border bg-dark-elevated p-1 gap-1">
    {views.map((v) => {
      const on = v.pool.id === activeId;
      return (
        <button key={v.pool.id} onClick={() => onPick(v.pool.id)} aria-pressed={on}
          className={`flex-1 min-h-[44px] rounded-md text-sm tracking-wide transition-colors flex items-center justify-center gap-2 ${
            on ? "bg-gold text-dark font-medium" : "text-muted-foreground hover:text-cream"}`}>
          {v.pool.label}
          {v.owesResult && !on && (
            <span aria-label="result owed" className="w-2 h-2 rounded-full bg-gold" />
          )}
        </button>
      );
    })}
  </div>
);

/* ── the match card ──────────────────────────────────────────────── */

/**
 * THE screen. Four names large, two score boxes that ARE the entry surface:
 * tap the winning side, the format's own score row appears inline beneath it,
 * the second tap records. No separate button, no confirm — corrections exist.
 */
export const MatchCard = ({ a, view, match, readOnly, onPlayerTap }: {
  a: UseAmericanoSession;
  view: PoolLiveView;
  match: AmericanoMatch;
  readOnly?: boolean;
  onPlayerTap?: (playerId: string) => void;
}) => {
  const [picked, setPicked] = useState<"A" | "B" | null>(null);
  const format = a.formatOfMatch(view.pool.id, match);
  const fresh = a.freshMatchIds.has(match.id);
  const done = match.result !== null;
  const voided = match.status === "voided";

  const side = (key: "A" | "B") => {
    const ids = key === "A" ? match.teamA : match.teamB;
    const won = done && match.result!.winner === key;
    const chosen = picked === key;
    return (
      <button
        disabled={readOnly}
        onClick={() => !readOnly && setPicked(chosen ? null : key)}
        aria-pressed={chosen}
        className={`w-full rounded-xl border-2 px-4 py-5 text-center transition-all active:scale-[0.99] touch-manipulation ${
          chosen ? "border-gold bg-gold/20"
          : won ? "border-gold/70 bg-gold/10"
          : "border-border bg-dark-elevated"} ${readOnly ? "cursor-default" : ""}`}>
        <span className="block font-display text-2xl sm:text-3xl text-cream leading-tight">
          {ids.map((id, i) => (
            <span key={id}>
              {i > 0 && <span className="text-muted-foreground font-sans text-lg"> + </span>}
              {onPlayerTap && !readOnly ? (
                <span role="button" tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onPlayerTap(id); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onPlayerTap(id); }
                  }}
                  className="underline decoration-dotted decoration-1 decoration-muted-foreground/40 underline-offset-4">
                  {a.playerName(id)}
                </span>
              ) : a.playerName(id)}
            </span>
          ))}
        </span>
        {done && (
          <span className={`mt-2 block font-display text-4xl ${won ? "text-gold" : "text-muted-foreground/50"}`}>
            {won ? resultNotation(format, match.result!).split("–")[0]
                 : resultNotation(format, match.result!).split("–")[1]}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className={`rounded-2xl border-2 p-3 space-y-2 ${
      voided ? "border-border opacity-50"
      : fresh && !done ? "border-gold bg-gold/[0.05]" : "border-border bg-dark-surface"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {voided ? "voided" : done ? `Match ${match.matchIndex}` : fresh ? "Now on court" : `Match ${match.matchIndex}`}
        </span>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground/70">
          {formatLabel(format)}
        </span>
      </div>

      {side("A")}
      <p className="text-center text-muted-foreground text-xs">vs</p>
      {side("B")}

      {picked && !readOnly && (
        <div className="pt-1 space-y-1.5">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground text-center">
            {format.kind === "singleGame"
              ? `Game to ${format.targetPoints} — tap the losers' score`
              : "Tap the score"}
          </p>
          <div className={`gap-1.5 ${format.kind === "bestOf" ? "flex" : "grid grid-cols-4"}`}>
            {entryOptions(format).map((opt) => (
              <button key={opt.label}
                onClick={() => {
                  a.enterResult(match.id, { winner: picked, ...opt.value });
                  setPicked(null);
                }}
                className="flex-1 min-h-[52px] min-w-[44px] rounded-lg bg-gold text-dark font-display text-xl active:scale-[0.98]">
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── history: the same card, paged ───────────────────────────────── */

/** Completed matches ARE the log — swipe through them as read-only cards and
    tap to correct. One mental model, not a card plus a panel. */
export const HistoryPager = ({ a, view, index, onIndex, onEdit }: {
  a: UseAmericanoSession; view: PoolLiveView;
  index: number; onIndex: (i: number) => void;
  onEdit: (m: AmericanoMatch) => void;
}) => {
  const touch = useRef<number | null>(null);
  const total = view.history.length;
  if (total === 0) return null;
  const match = view.history[Math.min(index, total - 1)];
  const go = (d: number) => onIndex(Math.max(0, Math.min(total - 1, index + d)));
  return (
    <div
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
      className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => go(-1)} disabled={index === 0} aria-label="Newer match"
          className="min-h-[44px] min-w-[44px] rounded-lg border border-border text-muted-foreground disabled:opacity-30">‹</button>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {index + 1} of {total} played
        </span>
        <button onClick={() => go(1)} disabled={index >= total - 1} aria-label="Older match"
          className="min-h-[44px] min-w-[44px] rounded-lg border border-border text-muted-foreground disabled:opacity-30">›</button>
      </div>
      <MatchCard a={a} view={view} match={match} readOnly />
      <button onClick={() => onEdit(match)}
        className="w-full min-h-[44px] rounded-lg border border-border text-sm text-muted-foreground hover:text-cream">
        Correct or void this match
      </button>
    </div>
  );
};

/* ── the flip overlay (6.1/6.2 behaviour unchanged) ──────────────── */

export const FlipOverlay = ({ a, poolId, pair, onClose }: {
  a: UseAmericanoSession; poolId: string;
  pair: { a: string; b: string }; onClose: () => void;
}) => {
  const [animationDone, setAnimationDone] = useState(false);
  const [highlight, setHighlight] = useState(pair.a);
  const [tossed, setTossed] = useState<string | null>(null);
  const recordedRef = useRef(false);
  const startNonce = useRef(a.flipOutcome?.nonce ?? 0);
  const key = pair.a < pair.b ? `${pair.a}|${pair.b}` : `${pair.b}|${pair.a}`;
  const outcome =
    a.flipOutcome && a.flipOutcome.pairKey === key && a.flipOutcome.nonce > startNonce.current
      ? { accepted: a.flipOutcome.accepted } : null;
  const phase = flipPhase({ animationDone, outcome });

  useEffect(() => {
    const winner = a.tossCoin(pair.a, pair.b);
    setTossed(winner);
    const steps = [90, 90, 110, 130, 150, 170, 200, 230, 260, 290, 320];
    const timers: number[] = [];
    let elapsed = 0;
    steps.forEach((gap, i) => {
      elapsed += gap;
      timers.push(window.setTimeout(() => setHighlight(i % 2 === 0 ? pair.b : pair.a), elapsed));
    });
    timers.push(window.setTimeout(() => {
      setHighlight(winner);
      setAnimationDone(true);
      if (!recordedRef.current) {
        recordedRef.current = true;
        a.recordCoinFlip(poolId, pair.a, pair.b, winner);
      }
    }, elapsed + 260));
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "declined") return;
    const t = window.setTimeout(onClose, 2600);
    return () => window.clearTimeout(t);
  }, [phase, onClose]);

  const landedId = phase === "landed" ? tossed : null;
  const side = (id: string) => (
    <div className={`w-full rounded-xl border-2 px-4 py-6 text-center font-display text-3xl transition-all duration-150 ${
      landedId === id ? "border-gold bg-gold/20 text-gold scale-105"
      : landedId && landedId !== id ? "border-border text-muted-foreground/50"
      : phase === "declined" ? "border-border text-muted-foreground/60"
      : highlight === id ? "border-gold/70 bg-gold/10 text-cream" : "border-border text-cream"}`}>
      {a.playerName(id)}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-5">
      <div className="w-full max-w-sm space-y-3">
        <p className="text-center text-[11px] uppercase tracking-widest text-muted-foreground">
          {phase === "landed" ? "The coin has landed"
            : phase === "declined" ? "No flip recorded"
            : "Coin flip — everything else was level"}
        </p>
        {side(pair.a)}
        <p className="text-center text-muted-foreground text-sm">vs</p>
        {side(pair.b)}
        {phase === "landed" && landedId ? (
          <>
            <p className="text-center text-base text-cream">
              <span className="text-gold font-display text-xl">{a.playerName(landedId)}</span> takes the higher rank.
            </p>
            <button onClick={onClose}
              className="w-full min-h-[52px] rounded-lg bg-gold text-dark font-display text-lg">Done</button>
          </>
        ) : phase === "declined" ? (
          <>
            <p className="text-center text-sm text-amber-400">Standings changed — no flip recorded.</p>
            <button onClick={onClose}
              className="w-full min-h-[52px] rounded-lg border-2 border-border text-cream font-display text-lg">Close</button>
          </>
        ) : (
          <p className="text-center text-sm text-muted-foreground animate-pulse">
            {phase === "recording" ? "recording…" : "flipping…"}
          </p>
        )}
      </div>
    </div>
  );
};
