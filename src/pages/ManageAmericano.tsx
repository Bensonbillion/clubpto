// PTO Americano v4 — /manage4, the phone-first skin (STEP G).
//
// Primary device is a PHONE (390×844, one thumb, dark noisy room). One idea
// per screen: the live screen is a single match card, history is a pager of
// that same card, and everything else lives behind three bottom tabs and a ⋮.
// Setup is a pad — a name field, a row of config chips, one giant START.
//
// Components hold ZERO game logic: every decision comes from
// src/lib/americano/ through useAmericanoSession.

import { useMemo, useState } from "react";
import { Delete, Lock, MoreVertical, Search, Trash2, UserPlus } from "lucide-react";
import type { AmericanoMatch, AmericanoTier, MatchFormat } from "@/types/americano";
import {
  useAmericanoSession, type PoolLiveView, type UseAmericanoSession,
} from "@/hooks/useAmericanoSession";
import {
  DEFAULT_TARGET_POINTS, entryOptions, formatLabel, resultNotation, validTargetPoints,
} from "@/lib/americano/format";
import {
  CourtSegment, FlipOverlay, HistoryPager, MatchCard, Sheet, formatKey,
} from "./manage4/shell";

const ADMIN_PASSCODE = "9999";

/* ── passcode gate ────────────────────────────────────────────────── */

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
    <div className="min-h-screen flex flex-col items-center justify-center gap-7 bg-dark text-cream px-6">
      <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
        <Lock className="w-8 h-8 text-accent" />
      </div>
      <div className="text-center">
        <h1 className="font-display text-2xl text-accent">PTO Americano</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {error ? "Wrong passcode — try again" : "Enter 4-digit passcode"}
        </p>
      </div>
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`w-3 h-3 rounded-full border ${i < code.length ? "bg-accent border-accent" : "border-muted-foreground/40"}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) =>
          k === "" ? <div key={i} /> : k === "del" ? (
            <button key={i} onClick={() => setCode((c) => c.slice(0, -1))} aria-label="Delete digit"
              className="w-16 h-16 rounded-full border border-muted-foreground/30 flex items-center justify-center text-muted-foreground">
              <Delete className="w-5 h-5" />
            </button>
          ) : (
            <button key={i} onClick={() => digit(k)}
              className="w-16 h-16 rounded-full border border-muted-foreground/30 text-2xl text-cream active:bg-accent/10">
              {k}
            </button>
          ))}
      </div>
    </div>
  );
};

/* ── PART 3: setup as a pad ───────────────────────────────────────── */

const Chip = ({ label, value, onClick }: { label: string; value: string; onClick: () => void }) => (
  <button onClick={onClick}
    className="min-h-[44px] px-3 rounded-full border border-border bg-dark-elevated text-left active:scale-95 transition-transform">
    <span className="block text-[10px] uppercase tracking-widest text-muted-foreground/70 leading-none">{label}</span>
    <span className="block text-sm text-cream leading-tight mt-0.5">{value}</span>
  </button>
);

const FormatButtons = ({ value, locked, onChange }: {
  value: MatchFormat; locked: boolean; onChange: (f: MatchFormat) => void;
}) => {
  const isBo = (n: 3 | 5) => value.kind === "bestOf" && value.sets === n;
  const isGame = value.kind === "singleGame";
  const target = isGame ? value.targetPoints : DEFAULT_TARGET_POINTS;
  const cls = (on: boolean) =>
    `min-h-[44px] px-3 rounded-md border-2 text-xs uppercase tracking-widest ${
      on ? "border-gold bg-gold/15 text-gold" : "border-border bg-dark-elevated text-muted-foreground"
    } ${locked ? "opacity-50" : ""}`;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button disabled={locked} onClick={() => onChange({ kind: "bestOf", sets: 3 })}
        aria-pressed={isBo(3)} className={cls(isBo(3))}>Best of 3</button>
      <button disabled={locked} onClick={() => onChange({ kind: "bestOf", sets: 5 })}
        aria-pressed={isBo(5)} className={cls(isBo(5))}>Best of 5</button>
      <button disabled={locked} onClick={() => onChange({ kind: "singleGame", targetPoints: target })}
        aria-pressed={isGame} className={cls(isGame)}>Game to</button>
      <select disabled={locked || !isGame} value={target} aria-label="Points to win the game"
        onChange={(e) => onChange({ kind: "singleGame", targetPoints: Number(e.target.value) })}
        className={`min-h-[44px] rounded-md border-2 px-2 text-sm ${
          isGame ? "border-gold/60 bg-dark-elevated text-cream" : "border-border bg-dark-elevated text-muted-foreground/50"}`}>
        {validTargetPoints().map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      {locked && <span className="text-xs text-amber-400 w-full">Format locked — results recorded.</span>}
    </div>
  );
};

const SetupPad = ({ a }: { a: UseAmericanoSession }) => {
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<null | "format" | "targets" | "pools" | "session">(null);
  const [quickTier, setQuickTier] = useState<AmericanoTier>("B");
  const q = search.trim().toLowerCase();

  // Suggestions are for people NOT yet in the night — the ones already added
  // are listed below with their own remove buttons. Without this, once a
  // dozen names are in, a common letter returns eight chips that are all
  // already picked and the rest of the roster is unreachable.
  const matches = useMemo(() => {
    const hit = (r: { displayName: string; lastName?: string }) =>
      `${r.displayName} ${r.lastName ?? ""}`.toLowerCase().includes(q);
    return a.roster.filter((r) => !a.isPicked(r.playerId) && (!q || hit(r))).slice(0, 8);
  }, [a, q]);
  const missed = q.length > 1 && matches.length === 0;
  const picked = a.session.players;
  const fmt = a.session.defaultMatchFormat;
  const targets = a.poolViews.map((v) => v.pool.targetMatches).join(" & ");

  return (
    <div className="min-h-screen bg-dark text-cream pb-40">
      <header className="sticky top-0 z-20 bg-dark/95 backdrop-blur border-b border-dark-elevated px-4 py-3 flex items-center justify-between gap-2">
        <h1 className="font-display text-lg text-accent">PTO Americano</h1>
        <span className="text-sm">
          <span className="font-display text-xl text-gold">{picked.length}</span>
          <span className="text-muted-foreground"> in</span>
        </span>
      </header>

      <main className="px-4 py-3 space-y-3">
        {a.roster.length === 0 ? (
          <button onClick={() => void a.loadRoster()} disabled={a.rosterLoading}
            className="w-full min-h-[52px] rounded-lg border-2 border-gold/60 text-gold text-sm disabled:opacity-60">
            {a.rosterLoading ? "Loading names…" : "Load the name database"}
          </button>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Add a name…" aria-label="Search names"
                className="w-full min-h-[52px] rounded-xl border border-border bg-dark-elevated pl-11 pr-4 text-base text-cream placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/60" />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {matches.map((r) => (
                <button key={r.playerId} onClick={() => { a.togglePlayer(r); setSearch(""); }}
                  className={`min-h-[44px] px-3 rounded-full border text-sm ${
                    a.isPicked(r.playerId)
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-border bg-dark-elevated text-cream"}`}>
                  {r.displayName}{r.lastName ? ` ${r.lastName[0]}.` : ""}
                </button>
              ))}
            </div>

            {missed && (
              <div className="flex items-center gap-2 flex-wrap rounded-lg border border-border bg-dark-elevated p-2">
                <span className="text-sm text-muted-foreground">No match —</span>
                {(["A", "B", "C"] as const).map((t) => (
                  <button key={t} onClick={() => setQuickTier(t)} aria-pressed={quickTier === t}
                    className={`min-h-[44px] w-11 rounded-md border-2 text-sm ${
                      quickTier === t ? "border-gold text-gold" : "border-border text-muted-foreground"}`}>{t}</button>
                ))}
                <button disabled={a.quickAddBusy}
                  onClick={() => { void a.quickAdd(search.trim(), quickTier); setSearch(""); }}
                  className="min-h-[44px] px-3 rounded-md bg-gold text-dark text-sm flex items-center gap-1.5 disabled:opacity-60">
                  <UserPlus className="w-4 h-4" /> Add &ldquo;{search.trim()}&rdquo;
                </button>
              </div>
            )}
          </>
        )}

        {picked.length > 0 && (
          <div className="rounded-xl border border-border bg-dark-surface divide-y divide-border/40">
            {picked.map((p) => (
              <div key={p.playerId} className="flex items-center gap-2 px-3 py-2">
                <span className="flex-1 text-cream">{p.displayName}</span>
                <button onClick={() => a.togglePlayer({ playerId: p.playerId, displayName: p.displayName, tier: p.tier })}
                  aria-label={`Remove ${p.displayName}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground/70 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 pt-1">
          <Chip label="Courts" value="2" onClick={() => setSheet("pools")} />
          <Chip label="Format" value={formatLabel(fmt)} onClick={() => setSheet("format")} />
          <Chip label="Targets" value={targets || "—"} onClick={() => setSheet("targets")} />
          <Chip label="Pools" value={a.poolViews.map((v) => v.size).join(" / ")} onClick={() => setSheet("pools")} />
          <Chip label="Practice" value={a.session.isPractice ? "On" : "Off"}
            onClick={() => a.setPractice(!a.session.isPractice)} />
          <Chip label="Session" value={a.session.sessionName || a.session.date} onClick={() => setSheet("session")} />
        </div>
      </main>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-dark via-dark to-transparent">
        <button onClick={a.startSession} disabled={!a.canStart}
          className={`w-full min-h-[64px] rounded-xl font-display text-xl uppercase tracking-widest ${
            a.canStart ? "bg-gold text-dark active:scale-[0.99]"
            : "bg-dark-elevated border border-border text-muted-foreground/60"}`}>
          Start
        </button>
      </div>

      {sheet === "format" && (
        <Sheet title="Match format" onClose={() => setSheet(null)}>
          <p className="text-sm text-muted-foreground">Both courts, unless changed below.</p>
          <FormatButtons value={fmt} locked={false} onChange={a.setDefaultFormat} />
          {a.poolViews.map((v) => (
            <div key={v.pool.id} className="pt-2 border-t border-border/50 space-y-1.5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{v.pool.label}</p>
              <FormatButtons value={v.format} locked={v.formatLocked}
                onChange={(f) => a.setPoolFormat(v.pool.id, f)} />
            </div>
          ))}
        </Sheet>
      )}

      {sheet === "targets" && (
        <Sheet title="Matches each" onClose={() => setSheet(null)}>
          {a.poolViews.map((v) => (
            <div key={v.pool.id} className="space-y-1.5 pb-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {v.pool.label} · {v.size} players
              </p>
              <div className="flex flex-wrap gap-1.5">
                {v.options.map((o) => (
                  <button key={o.target} onClick={() => a.setTarget(v.pool.id, o.target)}
                    aria-pressed={o.target === v.pool.targetMatches}
                    className={`min-h-[44px] px-3 rounded-md border-2 text-sm ${
                      o.target === v.pool.targetMatches
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-border bg-dark-elevated text-muted-foreground"}`}>
                    {o.label}
                  </button>
                ))}
                {v.options.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
              </div>
              {v.notices.map((n, i) => (
                <p key={i} className={`text-sm rounded-md border px-2 py-1.5 ${
                  n.level === "block" ? "border-red-500/50 bg-red-500/10 text-red-300"
                  : n.level === "warning" ? "border-amber-500/40 bg-amber-500/5 text-amber-400"
                  : "border-border text-muted-foreground"}`}>{n.message}</p>
              ))}
            </div>
          ))}
        </Sheet>
      )}

      {sheet === "pools" && (
        <Sheet title="Who plays where" onClose={() => setSheet(null)}>
          {a.poolViews.map((v) => {
            const other = a.poolViews.find((x) => x.pool.id !== v.pool.id)!;
            return (
              <div key={v.pool.id} className="space-y-1.5 pb-2">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {v.pool.label} · {v.size} players · {Number.isInteger(v.courtMatches) ? v.courtMatches : "—"} matches
                </p>
                <div className="rounded-lg border border-border divide-y divide-border/40">
                  {v.pool.playerIds.map((id) => (
                    <div key={id} className="flex items-center gap-2 px-2 py-1.5">
                      <span className="flex-1 text-sm text-cream">{a.playerName(id)}</span>
                      <button onClick={() => a.movePlayer(id, other.pool.id)}
                        aria-label={`Move ${a.playerName(id)} to ${other.pool.label}`}
                        className="min-h-[44px] px-3 rounded-md border border-border text-xs text-muted-foreground">
                        → {other.pool.label}
                      </button>
                    </div>
                  ))}
                  {v.size === 0 && <p className="px-2 py-2 text-sm text-muted-foreground">Nobody yet.</p>}
                </div>
                {v.notices.filter((n) => n.level === "block").map((n, i) => (
                  <p key={i} className="text-sm rounded-md border border-red-500/50 bg-red-500/10 text-red-300 px-2 py-1.5">
                    {n.message}
                  </p>
                ))}
              </div>
            );
          })}
        </Sheet>
      )}

      {sheet === "session" && (
        <Sheet title="Session" onClose={() => setSheet(null)}>
          <label className="block space-y-1.5">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Date</span>
            <input type="date" value={a.session.date} onChange={(e) => a.setDate(e.target.value)}
              className="w-full min-h-[48px] rounded-lg border border-border bg-dark-elevated px-3 text-base text-cream" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Name (optional)</span>
            <input value={a.session.sessionName} onChange={(e) => a.setSessionName(e.target.value)}
              placeholder="Wednesday Americano"
              className="w-full min-h-[48px] rounded-lg border border-border bg-dark-elevated px-3 text-base text-cream placeholder:text-muted-foreground/50" />
          </label>
        </Sheet>
      )}
    </div>
  );
};

/* ── PART 1 + 2: the live shell ───────────────────────────────────── */

const fmtClock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fmtDur = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const PlayerSheet = ({ a, playerId, onClose }: {
  a: UseAmericanoSession; playerId: string; onClose: () => void;
}) => {
  const p = a.session.players.find((x) => x.playerId === playerId);
  if (!p) return null;
  const act = (fn: () => void) => { fn(); onClose(); };
  return (
    <Sheet title={p.displayName} onClose={onClose}>
      {a.canNotHere(playerId) && (
        <button onClick={() => act(() => a.playerNotHere(playerId))}
          className="w-full min-h-[52px] rounded-lg border-2 border-amber-500/50 text-amber-400">
          Not here — take them off
        </button>
      )}
      {p.status === "present" && (
        <button onClick={() => act(() => a.playerLeft(playerId))}
          className="w-full min-h-[52px] rounded-lg border-2 border-border text-cream">
          Left for the night
        </button>
      )}
      {p.status === "not_arrived" && (
        <button onClick={() => act(() => a.playerArrived(playerId))}
          className="w-full min-h-[52px] rounded-lg bg-gold text-dark font-display text-lg">Arrived</button>
      )}
      {p.status === "left" && (
        <button onClick={() => { if (window.confirm(`Bring ${p.displayName} back into the rotation?`)) act(() => a.playerRestore(playerId)); }}
          className="w-full min-h-[52px] rounded-lg border-2 border-border text-cream">Back in</button>
      )}
    </Sheet>
  );
};

const CorrectionSheet = ({ a, view, match, onClose }: {
  a: UseAmericanoSession; view: PoolLiveView; match: AmericanoMatch; onClose: () => void;
}) => {
  const format = a.formatOfMatch(view.pool.id, match);
  return (
    <Sheet title={`Match ${match.matchIndex}`} onClose={onClose}>
      <p className="text-sm text-muted-foreground">
        {match.status === "voided" ? "Voided — counts for nothing." : "Re-enter the result:"}
      </p>
      {(["A", "B"] as const).map((w) => (
        <div key={w} className="space-y-1.5">
          <p className="text-sm text-cream">{(w === "A" ? match.teamA : match.teamB).map(a.playerName).join(" + ")}</p>
          <div className={`gap-1.5 ${format.kind === "bestOf" ? "flex" : "grid grid-cols-4"}`}>
            {entryOptions(format).map((opt) => (
              <button key={opt.label}
                onClick={() => { a.correctResult(match.id, { winner: w, ...opt.value }); onClose(); }}
                className="flex-1 min-h-[48px] min-w-[44px] rounded-lg border border-border text-cream text-sm">
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      {match.status !== "voided" && (
        <button onClick={() => { a.voidMatch(match.id); onClose(); }}
          className="w-full min-h-[52px] rounded-lg border-2 border-red-500/50 text-red-400 text-sm">
          VOID — counts for nothing
        </button>
      )}
    </Sheet>
  );
};

const MatchTab = ({ a, view, onPlayerTap }: {
  a: UseAmericanoSession; view: PoolLiveView; onPlayerTap: (id: string) => void;
}) => {
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<AmericanoMatch | null>(null);
  const notices = a.notices[view.pool.id] ?? [];
  return (
    <div className="space-y-3">
      {notices.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 space-y-1">
          {notices.map((w, i) => <p key={i} className="text-sm text-amber-400">{w}</p>)}
          <button onClick={() => a.dismissNotices(view.pool.id)}
            className="min-h-[44px] text-xs text-muted-foreground">dismiss</button>
        </div>
      )}

      {view.active ? (
        <MatchCard key={`${view.active.id}:${view.active.teamA.join()}:${view.active.teamB.join()}:${formatKey(view.format)}`}
          a={a} view={view} match={view.active} onPlayerTap={onPlayerTap} />
      ) : view.blocked === "all_at_target" ? (
        <div className="rounded-2xl border-2 border-gold/40 bg-gold/5 p-6 text-center space-y-3">
          <p className="font-display text-xl text-cream">Round robin complete</p>
          <p className="text-sm text-muted-foreground">Everyone at {view.pool.targetMatches}.</p>
          <button disabled className="w-full min-h-[52px] rounded-lg border-2 border-border text-muted-foreground/60 text-sm uppercase tracking-widest">
            Start playoff — Step 7
          </button>
        </div>
      ) : view.blocked === "below_four_present" ? (
        <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/5 p-6 text-center">
          <p className="text-sm text-amber-400">
            Fewer than four available on {view.pool.label} — this court pauses. The other is untouched.
          </p>
        </div>
      ) : null}

      {view.nextUp && (
        <p className="text-sm text-cream px-1">
          <span className="text-muted-foreground">Next: </span>{view.nextUp.join(", ")}
        </p>
      )}
      {view.resting.length > 0 && (
        <p className="text-sm text-muted-foreground/70 px-1">Resting: {view.resting.join(", ")}</p>
      )}

      <HistoryPager a={a} view={view} index={page} onIndex={setPage} onEdit={setEditing} />
      {editing && <CorrectionSheet a={a} view={view} match={editing} onClose={() => setEditing(null)} />}
    </div>
  );
};

const PlayersTab = ({ a, views, onPlayerTap }: {
  a: UseAmericanoSession; views: PoolLiveView[]; onPlayerTap: (id: string) => void;
}) => (
  <div className="space-y-3">
    {a.notArrived.length > 0 && (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
        <p className="text-[11px] uppercase tracking-widest text-amber-400">Not arrived</p>
        <div className="flex flex-wrap gap-1.5">
          {a.notArrived.map((p) => (
            <button key={p.playerId} onClick={() => a.playerArrived(p.playerId)}
              className="min-h-[44px] px-3 rounded-full border border-amber-500/50 text-sm text-amber-300">
              {p.name} · arrived?
            </button>
          ))}
        </div>
      </div>
    )}
    {views.map((v) => (
      <div key={v.pool.id} className="rounded-xl border border-border bg-dark-surface">
        <p className="px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground border-b border-border/50">
          {v.pool.label}
        </p>
        <div className="divide-y divide-border/40">
          {v.people.map((p) => (
            <button key={p.playerId} onClick={() => onPlayerTap(p.playerId)}
              className="w-full min-h-[48px] px-3 py-2 flex items-center gap-2 text-left">
              <span className={`flex-1 ${p.status === "present" ? "text-cream" : "text-muted-foreground/60 line-through"}`}>
                {p.name}
              </span>
              <span className="text-xs text-muted-foreground">{p.played}/{p.target}</span>
              {p.status !== "present" && (
                <span className="text-[10px] uppercase tracking-widest text-amber-400">
                  {p.status === "left" ? "left" : "not here"}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const TIEBREAK_CHIP: Record<string, string> = {
  h2h: "H2H", sos: "SOS", coinflip: "COIN", losses: "L", diff: "DIFF",
};

const StandingsTab = ({ a, view, onFlip }: {
  a: UseAmericanoSession; view: PoolLiveView;
  onFlip: (pair: { a: string; b: string }) => void;
}) => (
  <div className="rounded-xl border border-border bg-dark-surface">
    <div className="px-3 py-2 flex items-center gap-2 border-b border-border/50">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Standings</span>
      {view.pendingFlips > 0 && (
        <span className="text-[10px] tracking-widest text-gold border border-gold/50 rounded-full px-2">
          {view.pendingFlips} flip{view.pendingFlips === 1 ? "" : "s"} to run
        </span>
      )}
    </div>
    <div className="px-3 py-1.5 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground/70">
      <span className="w-5">#</span><span className="flex-1">Player</span>
      <span className="w-10 text-right">W–L</span><span className="w-10 text-right">Diff</span>
      <span className="w-8 text-right">SOS</span>
    </div>
    <div className="divide-y divide-border/40">
      {view.standings.map((r, i) => {
        const tiedBelow = r.requiresCoinFlip && r.flipWith === view.standings[i + 1]?.playerId;
        return (
          <div key={r.playerId} className={`px-3 py-2 flex items-center gap-2 ${r.requiresCoinFlip ? "bg-gold/[0.05]" : ""}`}>
            <span className="w-5 text-sm text-muted-foreground/70">{r.rank}</span>
            <span className="flex-1 min-w-0 text-sm text-cream truncate">
              {r.name}
              {r.tiebreak && (
                <span className="ml-1.5 text-[9px] uppercase tracking-widest text-muted-foreground border border-border rounded px-1">
                  {TIEBREAK_CHIP[r.tiebreak] ?? r.tiebreak}
                </span>
              )}
            </span>
            <span className="w-10 text-right text-sm text-cream">{r.wins}–{r.losses}</span>
            <span className="w-10 text-right text-sm text-muted-foreground">{r.gameDiff >= 0 ? "+" : ""}{r.gameDiff}</span>
            <span className="w-8 text-right text-sm text-muted-foreground/70">{r.sos}</span>
            {tiedBelow && r.flipWith && (
              <button onClick={() => onFlip({ a: r.playerId, b: r.flipWith! })}
                className="min-h-[36px] px-2 rounded border border-gold/60 text-[10px] uppercase tracking-widest text-gold">
                Flip
              </button>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

type Tab = "match" | "players" | "standings";

const LiveShell = ({ a }: { a: UseAmericanoSession }) => {
  const [tab, setTab] = useState<Tab>("match");
  const [courtId, setCourtId] = useState(a.liveViews[0]?.pool.id ?? "court-2");
  const [sheetPlayer, setSheetPlayer] = useState<string | null>(null);
  const [flip, setFlip] = useState<{ poolId: string; pair: { a: string; b: string } } | null>(null);
  const [more, setMore] = useState(false);

  const view = a.liveViews.find((v) => v.pool.id === courtId) ?? a.liveViews[0];
  if (!view) return null;
  const notArrivedCount = a.notArrived.length;

  return (
    <div className="min-h-screen bg-dark text-cream pb-24">
      <header className="sticky top-0 z-20 bg-dark/95 backdrop-blur border-b border-dark-elevated px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="flex-1 min-w-0 truncate text-sm text-cream">
            {a.session.sessionName || "Americano"}
            {a.session.isPractice && (
              <span className="ml-1.5 text-[9px] uppercase tracking-widest text-gold border border-gold/50 rounded-full px-1.5 py-0.5">practice</span>
            )}
          </span>
          <span className={`w-2 h-2 rounded-full ${
            a.syncStatus === "synced" ? "bg-gold" : a.syncStatus === "pending" ? "bg-amber-400" : "bg-red-500"}`}
            aria-label={`sync ${a.syncStatus}`} />
          <span className="text-xs text-muted-foreground">
            {view.pace.done}/{view.pace.total}
          </span>
          <button onClick={() => setMore(true)} aria-label="More"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-3 space-y-3">
        {a.session.integrityErrors && a.session.integrityErrors.length > 0 && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 space-y-1">
            {a.session.integrityErrors.map((e, i) => <p key={i} className="text-sm text-red-300">{e}</p>)}
          </div>
        )}

        {tab !== "players" && (
          <CourtSegment views={a.liveViews} activeId={view.pool.id} onPick={setCourtId} />
        )}

        {tab === "match" && <MatchTab a={a} view={view} onPlayerTap={setSheetPlayer} />}
        {tab === "players" && <PlayersTab a={a} views={a.liveViews} onPlayerTap={setSheetPlayer} />}
        {tab === "standings" && (
          <StandingsTab a={a} view={view} onFlip={(pair) => setFlip({ poolId: view.pool.id, pair })} />
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-dark/95 backdrop-blur flex">
        {([["match", "Match"], ["players", "Players"], ["standings", "Standings"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id}
            className={`flex-1 min-h-[56px] text-sm relative ${tab === id ? "text-gold" : "text-muted-foreground"}`}>
            {label}
            {id === "players" && notArrivedCount > 0 && (
              <span className="absolute top-2 right-1/4 min-w-[18px] h-[18px] rounded-full bg-amber-500 text-dark text-[10px] flex items-center justify-center px-1">
                {notArrivedCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {sheetPlayer && <PlayerSheet a={a} playerId={sheetPlayer} onClose={() => setSheetPlayer(null)} />}
      {flip && <FlipOverlay a={a} poolId={flip.poolId} pair={flip.pair} onClose={() => setFlip(null)} />}
      {more && (
        <Sheet title="Session" onClose={() => setMore(false)}>
          <p className="text-sm text-muted-foreground">{a.session.date} · {view.pool.label} · {formatLabel(view.format)}</p>
          <p className="text-sm text-cream">
            Match {Math.min(view.pace.done + 1, view.pace.total)} of {view.pace.total}
            {view.pace.avgMs !== null && view.pace.projectedEndMs !== null && (
              <> · avg {fmtDur(view.pace.avgMs)} · ends ~{fmtClock(view.pace.projectedEndMs)}</>
            )}
          </p>
          <button disabled
            className="w-full min-h-[48px] rounded-lg border border-border text-muted-foreground/50 text-sm">
            Playoff controls — Step 7
          </button>
          <button onClick={() => {
              if (window.confirm("Reset the whole night? Setup and every match are discarded.")) {
                a.resetNight(); setMore(false);
              }
            }}
            className="w-full min-h-[48px] rounded-lg border border-red-500/40 text-red-400 text-sm">
            End session and reset
          </button>
        </Sheet>
      )}
    </div>
  );
};

/* ── the page ─────────────────────────────────────────────────────── */

const ManageAmericanoInner = () => {
  const a = useAmericanoSession();
  if (a.loading) {
    return <div className="min-h-screen bg-dark text-muted-foreground flex items-center justify-center animate-pulse">Loading…</div>;
  }
  return a.session.status === "setup" ? <SetupPad a={a} /> : <LiveShell a={a} />;
};

const ManageAmericano = () => {
  const [unlocked, setUnlocked] = useState(false);
  if (!unlocked) return <PasscodeGate onUnlock={() => setUnlocked(true)} />;
  return <ManageAmericanoInner />;
};

export default ManageAmericano;
