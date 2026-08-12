// PTO Americano v4 — /manage4 (STEP 3: session setup + resumable stub).
// Same product language as /manage: dark theme, gold accent, passcode gate,
// ≥44px touch targets. Tier chips render HERE only — this is an admin
// surface; tiers appear nowhere player-facing. All decisions come from
// src/lib/americano/ — components hold zero game logic.

import { useMemo, useRef, useState } from "react";
import { Delete, FlaskConical, Lock, RotateCcw, Search, UserPlus } from "lucide-react";
import type { AmericanoTier } from "@/types/americano";
import {
  useAmericanoSession, type PoolLiveView, type PoolSetupView, type UseAmericanoSession,
} from "@/hooks/useAmericanoSession";

const ADMIN_PASSCODE = "9999";

/* ── tier chips (admin-only styling, same palette as /manage) ─────── */

const TIER_CHIP: Record<AmericanoTier, string> = {
  A: "bg-gold/10 text-gold border-gold/40",
  B: "bg-slate-400/10 text-slate-300 border-slate-400/40",
  C: "bg-amber-600/10 text-amber-500 border-amber-600/40",
};

const TierChip = ({ tier }: { tier: AmericanoTier }) => (
  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-xs font-display flex-shrink-0 ${TIER_CHIP[tier]}`}>
    {tier}
  </span>
);

/* ── passcode gate (same pattern as /manage) ──────────────────────── */

const PasscodeGate = ({ onUnlock }: { onUnlock: () => void }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const digit = (d: string) => {
    const next = code + d;
    setError(false);
    if (next.length === 4) {
      if (next === ADMIN_PASSCODE) onUnlock();
      else { setError(true); setCode(""); }
    } else setCode(next);
  };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-dark text-cream">
      <div className="w-20 h-20 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
        <Lock className="w-10 h-10 text-accent" />
      </div>
      <div className="text-center">
        <h1 className="font-display text-3xl text-accent">PTO Americano</h1>
        <p className="mt-2 text-muted-foreground">{error ? "Wrong passcode — try again" : "Enter 4-digit passcode"}</p>
      </div>
      <div className="flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`w-4 h-4 rounded-full border ${i < code.length ? "bg-accent border-accent" : "border-muted-foreground/40"}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) =>
          k === "" ? <div key={i} /> : k === "del" ? (
            <button key={i} onClick={() => setCode((c) => c.slice(0, -1))} aria-label="Delete digit"
              className="w-16 h-16 rounded-full border border-muted-foreground/30 flex items-center justify-center text-muted-foreground hover:border-accent hover:text-accent transition-colors">
              <Delete className="w-6 h-6" />
            </button>
          ) : (
            <button key={i} onClick={() => digit(k)}
              className="w-16 h-16 rounded-full border border-muted-foreground/30 text-2xl text-cream hover:border-accent hover:text-accent transition-colors">
              {k}
            </button>
          ))}
      </div>
    </div>
  );
};

/* ── stage 1: session ─────────────────────────────────────────────── */

const SessionStage = ({ a }: { a: UseAmericanoSession }) => (
  <section className="rounded-lg border border-border bg-dark-surface p-4 md:p-5 space-y-3">
    <h2 className="font-display text-xl text-accent">Session</h2>
    <div className="flex flex-wrap items-end gap-4">
      <label className="space-y-1.5">
        <span className="block text-xs uppercase tracking-widest text-muted-foreground">Date</span>
        <input type="date" value={a.session.date} onChange={(e) => a.setDate(e.target.value)}
          className="min-h-[48px] rounded-md border border-border bg-dark-elevated px-3 text-base text-cream focus:outline-none focus:border-gold/60" />
      </label>
      <label className="flex-1 min-w-[220px] space-y-1.5">
        <span className="block text-xs uppercase tracking-widest text-muted-foreground">Session name (optional)</span>
        <input value={a.session.sessionName} onChange={(e) => a.setSessionName(e.target.value)}
          placeholder="Wednesday Americano"
          className="w-full min-h-[48px] rounded-md border border-border bg-dark-elevated px-3 text-base text-cream placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/60" />
      </label>
      <button onClick={() => a.setPractice(!a.session.isPractice)} aria-pressed={a.session.isPractice}
        className={`min-h-[48px] px-4 rounded-md border-2 flex items-center gap-2 text-xs uppercase tracking-widest transition-all active:scale-95 ${
          a.session.isPractice ? "border-gold bg-gold/15 text-gold" : "border-border bg-dark-elevated text-muted-foreground hover:border-gold/40"}`}>
        <FlaskConical className="w-4 h-4" />
        {a.session.isPractice ? "Practice on" : "Practice off"}
      </button>
    </div>
    {a.session.isPractice && (
      <p className="text-sm text-muted-foreground">Practice night — nothing publishes to the leaderboard or clubhouse.</p>
    )}
  </section>
);

/* ── stage 2: tonight's roster ────────────────────────────────────── */

const RosterStage = ({ a }: { a: UseAmericanoSession }) => {
  const [search, setSearch] = useState("");
  const [quickTier, setQuickTier] = useState<AmericanoTier>("B");
  const q = search.trim().toLowerCase();

  // Recently-active-first: the shared roster's source order puts the
  // long-standing club players first — search narrows it, scrolling doesn't.
  const matches = useMemo(
    () =>
      q
        ? a.roster.filter((r) => `${r.displayName} ${r.lastName ?? ""}`.toLowerCase().includes(q)).slice(0, 14)
        : a.roster.slice(0, 14),
    [a.roster, q],
  );

  return (
    <section className="rounded-lg border border-border bg-dark-surface p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display text-xl text-accent">Tonight&apos;s roster</h2>
        <span className="text-sm text-cream">
          <span className="font-display text-xl text-gold">{a.session.players.length}</span>
          <span className="text-muted-foreground"> picked</span>
        </span>
      </div>

      {a.roster.length === 0 ? (
        <button onClick={() => void a.loadRoster()} disabled={a.rosterLoading}
          className="min-h-[52px] px-5 rounded-md border-2 border-gold/60 text-gold text-sm hover:bg-gold/10 transition-colors disabled:opacity-60">
          {a.rosterLoading ? "Loading the name database…" : "Load the name database"}
        </button>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${a.roster.length} names — tap to add or remove…`} aria-label="Search shared roster"
              className="w-full min-h-[48px] rounded-md border border-border bg-dark-elevated pl-11 pr-4 text-base text-cream placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/60" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {matches.map((r) => {
              const picked = a.isPicked(r.playerId);
              return (
                <button key={r.playerId} onClick={() => a.togglePlayer(r)} aria-pressed={picked}
                  className={`min-h-[44px] px-3 rounded-md border-2 flex items-center gap-2 text-sm transition-all active:scale-95 ${
                    picked ? "border-gold bg-gold/15 text-gold" : "border-border bg-dark-elevated text-cream hover:border-gold/40"}`}>
                  <TierChip tier={r.tier} />
                  {r.displayName}{r.lastName ? ` ${r.lastName}` : ""}
                  {picked && <span className="text-xs">✓</span>}
                </button>
              );
            })}
            {q && matches.length === 0 && (
              <div className="flex items-center gap-2 flex-wrap py-1">
                <span className="text-sm text-muted-foreground">New player:</span>
                {(["A", "B", "C"] as AmericanoTier[]).map((t) => (
                  <button key={t} onClick={() => setQuickTier(t)} aria-pressed={quickTier === t}
                    className={`w-11 h-11 rounded-md border-2 font-display text-sm transition-all active:scale-95 ${
                      quickTier === t ? TIER_CHIP[t] + " border-current" : "border-border text-muted-foreground hover:border-gold/40"}`}>
                    {t}
                  </button>
                ))}
                <button onClick={() => { void a.quickAdd(search.trim(), quickTier); setSearch(""); }} disabled={a.quickAddBusy}
                  className="min-h-[44px] px-4 rounded-md bg-gold text-dark font-display text-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                  <UserPlus className="w-4 h-4" />
                  {a.quickAddBusy ? "Adding…" : `Add "${search.trim()}"`}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

/* ── stage 3: pools (drag between columns) ────────────────────────── */

interface DragState {
  playerId: string;
  fromPool: string;
  x: number;
  y: number;
  label: string;
}

const PoolsStage = ({ a }: { a: UseAmericanoSession }) => {
  const [drag, setDrag] = useState<DragState | null>(null);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const playerById = useMemo(
    () => new Map(a.session.players.map((p) => [p.playerId, p] as const)),
    [a.session.players],
  );

  const poolUnder = (x: number, y: number): string | null => {
    for (const [id, el] of Object.entries(columnRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent, playerId: string, fromPool: string, label: string) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ playerId, fromPool, x: e.clientX, y: e.clientY, label });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag) setDrag({ ...drag, x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag) return;
    const target = poolUnder(e.clientX, e.clientY);
    if (target && target !== drag.fromPool) a.movePlayer(drag.playerId, target);
    setDrag(null);
  };

  const Column = ({ view }: { view: PoolSetupView }) => {
    const other = a.poolViews.find((v) => v.pool.id !== view.pool.id)!;
    const highlight = drag !== null && drag.fromPool !== view.pool.id;
    return (
      <div
        ref={(el) => { columnRefs.current[view.pool.id] = el; }}
        className={`flex-1 min-w-0 rounded-lg border-2 p-4 space-y-3 transition-colors ${
          highlight ? "border-gold/70 bg-gold/[0.04]" : "border-border bg-dark-surface"}`}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-display text-2xl text-accent">{view.pool.label}</h3>
          <span className="text-sm text-muted-foreground">
            {view.size} players · {Number.isInteger(view.courtMatches) ? view.courtMatches : "—"} matches
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Matches each</span>
          {view.options.map((o) => (
            <button key={o.target} onClick={() => a.setTarget(view.pool.id, o.target)}
              aria-pressed={o.target === view.pool.targetMatches}
              className={`min-h-[44px] px-3 rounded-md border-2 text-sm transition-all active:scale-95 ${
                o.target === view.pool.targetMatches
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-border bg-dark-elevated text-muted-foreground hover:border-gold/40"}`}>
              {o.label}
            </button>
          ))}
          {view.options.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
        </div>

        {view.notices.map((n, i) => (
          <p key={i} className={`text-sm rounded-md border px-3 py-2 ${
            n.level === "block" ? "border-red-500/50 bg-red-500/10 text-red-300"
            : n.level === "warning" ? "border-amber-500/40 bg-amber-500/5 text-amber-400"
            : "border-border bg-dark-elevated text-muted-foreground"}`}>
            {n.message}
          </p>
        ))}

        <div className="flex flex-wrap gap-1.5 min-h-[52px]">
          {view.pool.playerIds.map((id) => {
            const p = playerById.get(id);
            if (!p) return null;
            const dragging = drag?.playerId === id;
            return (
              <div key={id}
                onPointerDown={(e) => onPointerDown(e, id, view.pool.id, p.displayName)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={{ touchAction: "none" }}
                className={`min-h-[44px] pl-2 pr-1 rounded-md border flex items-center gap-2 select-none cursor-grab active:cursor-grabbing ${
                  dragging ? "opacity-40 border-gold/60" : "border-border bg-dark-elevated"}`}>
                <TierChip tier={p.tier} />
                <span className="text-cream text-sm">{p.displayName}</span>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => a.movePlayer(id, other.pool.id)}
                  aria-label={`Move ${p.displayName} to ${other.pool.label}`}
                  className="w-9 h-9 rounded-md text-muted-foreground/70 hover:text-gold transition-colors text-sm">
                  ⇄
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-col lg:flex-row gap-4">
        {a.poolViews.map((view) => <Column key={view.pool.id} view={view} />)}
      </div>
      {drag && (
        <div className="fixed z-50 pointer-events-none px-3 py-2 rounded-md border border-gold bg-dark-elevated text-cream text-sm shadow-lg"
          style={{ left: drag.x + 12, top: drag.y - 20 }}>
          {drag.label}
        </div>
      )}
    </section>
  );
};

/* ── the rolling court loop (STEP 4) ──────────────────────────────── */

const fmtClock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fmtDur = (ms: number) => {
  const totalSec = Math.round(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
};

/** Two taps: the winning pair, then 2–0 or 2–1. No confirm — corrections exist. */
const ResultEntry = ({ a, match }: { a: UseAmericanoSession; match: import("@/types/americano").AmericanoMatch }) => {
  const [winner, setWinner] = useState<"A" | "B" | null>(null);
  const team = (ids: [string, string]) => ids.map(a.playerName).join(" + ");
  const side = (key: "A" | "B") => (
    <button key={key} onClick={() => setWinner(winner === key ? null : key)} aria-pressed={winner === key}
      className={`w-full min-h-[64px] rounded-lg border-2 px-4 py-3 text-left font-display text-xl md:text-2xl transition-all active:scale-[0.99] touch-manipulation ${
        winner === key ? "border-gold bg-gold/20 text-gold" : "border-border bg-dark-elevated text-cream hover:border-gold/40"}`}>
      {team(key === "A" ? match.teamA : match.teamB)}
    </button>
  );
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {winner ? "Tap the score" : "Tap the winning pair"}
      </p>
      {side("A")}
      <p className="text-center text-muted-foreground text-sm">vs</p>
      {side("B")}
      {winner && (
        <div className="flex gap-2 pt-1">
          {(["2-0", "2-1"] as const).map((score) => (
            <button key={score} onClick={() => { a.enterResult(match.id, winner, score); setWinner(null); }}
              className="flex-1 min-h-[56px] rounded-lg bg-gold text-dark font-display text-xl transition-all active:scale-[0.98] hover:bg-gold/90">
              {score.replace("-", "–")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Per-pool match log, newest first, with corrections + void (§6 note). */
const MatchLog = ({ a, view }: { a: UseAmericanoSession; view: PoolLiveView }) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  if (view.log.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-dark-elevated/50">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full min-h-[44px] px-3 text-left text-xs uppercase tracking-widest text-muted-foreground">
        Match log ({view.log.length}) {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="border-t border-border/60 divide-y divide-border/40">
          {view.log.map((m) => {
            const voided = m.status === "voided";
            const winIds = m.result ? (m.result.winner === "A" ? m.teamA : m.teamB) : null;
            const loseIds = m.result ? (m.result.winner === "A" ? m.teamB : m.teamA) : null;
            return (
              <div key={m.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className={`text-sm min-w-0 ${voided ? "line-through text-muted-foreground/50" : ""}`}>
                    <span className="text-muted-foreground/70">#{m.matchIndex} </span>
                    {m.result && winIds && loseIds ? (
                      <>
                        <span className="text-cream">{winIds.map(a.playerName).join(" + ")}</span>
                        <span className="text-gold mx-1">{m.result.score.replace("-", "–")}</span>
                        <span className="text-muted-foreground">{loseIds.map(a.playerName).join(" + ")}</span>
                      </>
                    ) : (
                      <span className="text-cream">
                        {m.teamA.map(a.playerName).join(" + ")} vs {m.teamB.map(a.playerName).join(" + ")}
                        <span className="text-muted-foreground text-xs ml-1">on court</span>
                      </span>
                    )}
                    {voided && <span className="no-underline text-[10px] uppercase tracking-widest text-muted-foreground ml-1">void</span>}
                  </p>
                  {m.status === "completed" && (
                    <button onClick={() => setEditing(editing === m.id ? null : m.id)}
                      className="h-9 px-2 rounded border border-border text-xs text-muted-foreground hover:text-cream transition-colors">
                      {editing === m.id ? "close" : "edit"}
                    </button>
                  )}
                </div>
                {editing === m.id && m.status === "completed" && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {(["A", "B"] as const).flatMap((w) =>
                      (["2-0", "2-1"] as const).map((score) => (
                        <button key={`${w}${score}`}
                          onClick={() => { a.correctResult(m.id, w, score); setEditing(null); }}
                          className="min-h-[44px] px-2 rounded border border-border text-xs text-muted-foreground hover:text-gold hover:border-gold/50 transition-colors">
                          {(w === "A" ? m.teamA : m.teamB).map(a.playerName).join("+")} {score.replace("-", "–")}
                        </button>
                      )),
                    )}
                    <button onClick={() => { a.voidMatch(m.id); setEditing(null); }}
                      className="min-h-[44px] px-3 rounded border border-red-500/50 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                      VOID — counts for nothing
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PoolColumn = ({ a, view }: { a: UseAmericanoSession; view: PoolLiveView }) => {
  const fresh = view.active !== null && a.freshMatchIds.has(view.active.id);
  const poolNotices = a.notices[view.pool.id] ?? [];
  return (
    <div className="flex-1 min-w-0 rounded-lg border border-border bg-dark-surface p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-display text-2xl md:text-3xl text-accent">{view.pool.label}</h3>
        <div className="text-right">
          <p className="text-sm text-cream">match {Math.min(view.pace.done + 1, view.pace.total)} of {view.pace.total}</p>
          {view.pace.avgMs !== null && view.pace.projectedEndMs !== null && (
            <p className="text-xs text-muted-foreground">
              avg {fmtDur(view.pace.avgMs)} · RR ends ~{fmtClock(view.pace.projectedEndMs)}
            </p>
          )}
        </div>
      </div>

      {poolNotices.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 space-y-1">
          {poolNotices.map((w, i) => (
            <p key={i} className="text-sm text-amber-400">{w}</p>
          ))}
          <button onClick={() => a.dismissNotices(view.pool.id)}
            className="h-8 px-2 rounded text-xs text-muted-foreground hover:text-cream transition-colors">
            dismiss
          </button>
        </div>
      )}

      {view.active ? (
        <div className={`rounded-lg border-2 p-3 space-y-2 transition-colors ${fresh ? "border-gold bg-gold/[0.06]" : "border-border"}`}>
          {fresh && (
            <p className="text-xs uppercase tracking-widest text-gold">Now on court — call the names</p>
          )}
          <ResultEntry a={a} match={view.active} />
        </div>
      ) : view.blocked === "all_at_target" ? (
        <div className="rounded-lg border border-gold/40 bg-gold/5 p-5 text-center space-y-3">
          <p className="font-display text-xl text-cream">Round robin complete</p>
          <p className="text-sm text-muted-foreground">
            {view.pace.done} played, everyone at {view.pool.targetMatches}.
          </p>
          <button disabled
            className="min-h-[52px] px-5 rounded-lg border-2 border-border text-muted-foreground/60 text-sm uppercase tracking-widest cursor-not-allowed">
            Start playoff — Step 7
          </button>
        </div>
      ) : view.blocked === "below_four_present" ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-5 text-center">
          <p className="text-sm text-amber-400">
            Fewer than four players available on {view.pool.label} — the court pauses here.
            The other court is untouched.
          </p>
        </div>
      ) : null}

      {view.nextUp && (
        <div className="rounded-lg border border-border bg-dark-elevated px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Next up</p>
          <p className="text-base md:text-lg text-cream mt-1">{view.nextUp.join(", ")}</p>
        </div>
      )}

      <MatchLog a={a} view={view} />
    </div>
  );
};

const LiveScreen = ({ a }: { a: UseAmericanoSession }) => (
  <div className="space-y-4">
    <div className="rounded-lg border border-border bg-dark-surface px-4 py-3 flex items-center gap-3 flex-wrap">
      <h2 className="font-display text-xl text-accent">{a.session.sessionName || "Americano night"}</h2>
      {a.session.isPractice && (
        <span className="text-[10px] uppercase tracking-widest border border-gold/50 text-gold rounded-full px-2 py-1">practice</span>
      )}
      <span className="text-sm text-muted-foreground">{a.session.date}</span>
      <span className={`ml-auto inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-widest ${
        a.syncStatus === "synced" ? "text-muted-foreground" : a.syncStatus === "pending" ? "text-amber-400" : "text-red-400"}`}>
        <span className={`w-2 h-2 rounded-full ${
          a.syncStatus === "synced" ? "bg-gold" : a.syncStatus === "pending" ? "bg-amber-400" : "bg-red-500"}`} />
        {a.syncStatus === "synced" ? "Saved locally" : a.syncStatus === "pending" ? "Sync pending" : "Sync error"}
      </span>
    </div>
    {a.session.integrityErrors && a.session.integrityErrors.length > 0 && (
      <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 space-y-1">
        {a.session.integrityErrors.map((e, i) => (
          <p key={i} className="text-sm text-red-300">{e}</p>
        ))}
      </div>
    )}
    <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
      {a.liveViews.map((view) => (
        <PoolColumn key={view.pool.id} a={a} view={view} />
      ))}
    </div>
    {/* Step 5's NOT ARRIVED strip slots here; Step 6's standings attach per pool. */}
  </div>
);

/* ── the page ─────────────────────────────────────────────────────── */

const ManageAmericanoInner = () => {
  const a = useAmericanoSession();

  if (a.loading) {
    return (
      <div className="min-h-screen bg-dark text-muted-foreground flex items-center justify-center animate-pulse">
        Loading session…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark text-cream">
      <header className="sticky top-0 z-20 bg-dark/95 backdrop-blur border-b border-dark-elevated">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <h1 className="font-display text-xl text-accent whitespace-nowrap">PTO Americano</h1>
          <div className="flex items-center gap-2">
            {a.session.isPractice && (
              <span className="text-[10px] uppercase tracking-widest border border-gold/50 text-gold rounded-full px-2 py-1">practice</span>
            )}
            <button
              onClick={() => {
                if (window.confirm("Reset the whole night? The setup and any matches are discarded.")) a.resetNight();
              }}
              className="min-h-[44px] px-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-cream transition-colors">
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5 pb-16">
        {a.session.status === "setup" ? (
          <>
            <SessionStage a={a} />
            <RosterStage a={a} />
            <PoolsStage a={a} />
            <button onClick={a.startSession} disabled={!a.canStart}
              className={`w-full min-h-[72px] rounded-lg font-display text-xl uppercase tracking-widest transition-all active:scale-[0.99] ${
                a.canStart ? "bg-gold text-dark hover:bg-gold/90"
                : "bg-dark-elevated border border-border text-muted-foreground/60 cursor-not-allowed"}`}>
              Start session
            </button>
          </>
        ) : (
          <LiveScreen a={a} />
        )}
      </main>
    </div>
  );
};

const ManageAmericano = () => {
  const [unlocked, setUnlocked] = useState(false);
  if (!unlocked) return <PasscodeGate onUnlock={() => setUnlocked(true)} />;
  return <ManageAmericanoInner />;
};

export default ManageAmericano;
