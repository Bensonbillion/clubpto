// Court Manager v2 — Setup & Check-In. Two exported surfaces with DIFFERENT
// audiences:
//   • SessionSetup (Roster tab) = ADMIN-ONLY (passcode): add/edit players,
//     assign A/B/C tiers, VIP picks, generate pairs, start the session. Tier
//     badges + VIP mechanics live here because it is never player-facing (§18).
//   • CheckIn (Check-In tab) = HELPER-FACING (no passcode): name + one tap to
//     mark present. NO tiers, NO VIP, NO editing are shown here (§18).
// Tablet-first, winner-tap-only software: no score inputs exist anywhere.

import { useMemo, useRef, useState, type ReactNode } from "react";
import { SESSION_TEMPLATES, type UseSessionV2 } from "@/court-manager/react/useSessionV2";
import type { Pair, Player, Tier } from "@/court-manager/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRightLeft,
  Check,
  FlaskConical,
  Info,
  Lock,
  Pencil,
  Play,
  Plus,
  Search,
  Shuffle,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";

const TIERS: Tier[] = ["A", "B", "C"];

// Tier badge colors: A gold, B silver, C bronze — admin-view styling only (§18.6).
const TIER_BADGE: Record<Tier, string> = {
  A: "bg-gold/10 text-gold border-gold/40",
  B: "bg-slate-400/10 text-slate-300 border-slate-400/40",
  C: "bg-amber-600/10 text-amber-500 border-amber-600/40",
};

// Filled style for the ACTIVE segment of the inline A/B/C tier switcher.
const TIER_ACTIVE: Record<Tier, string> = {
  A: "bg-gold/20 text-gold",
  B: "bg-slate-400/20 text-slate-100",
  C: "bg-amber-600/25 text-amber-300",
};

const NO_PICK = "__none";

/* ── Small shared pieces ─────────────────────────────────────────── */

const TierBadge = ({ tier }: { tier: Tier }) => (
  <span
    className={`inline-flex items-center justify-center w-8 h-8 rounded-full border font-display text-sm flex-shrink-0 ${TIER_BADGE[tier]}`}
  >
    {tier}
  </span>
);

const Chip = ({ children }: { children: ReactNode }) => (
  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-border bg-muted/40 text-muted-foreground">
    {children}
  </span>
);

const Section = ({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) => (
  <section className="rounded-lg border border-border bg-dark-surface p-4 md:p-6 space-y-4">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <h2 className="font-display text-xl md:text-2xl text-accent">{title}</h2>
      {aside}
    </div>
    {children}
  </section>
);

/* ── Config strip ────────────────────────────────────────────────── */

const TemplatesRow = ({ s }: { s: UseSessionV2 }) => (
  <div className="space-y-1.5">
    <span className="block text-xs uppercase tracking-widest text-muted-foreground">
      Templates
    </span>
    <div className="flex flex-wrap gap-2.5">
      {Object.entries(SESSION_TEMPLATES).map(([key, template]) => (
        <button
          key={key}
          onClick={() => s.applyTemplate(key)}
          className="min-h-[52px] px-4 py-2 rounded-md border-2 border-border bg-dark-elevated text-left transition-all active:scale-95 hover:border-gold/40"
        >
          <span className="block font-display text-base text-cream">{template.label}</span>
          {template.note && (
            <span className="block text-[11px] text-muted-foreground mt-0.5 max-w-[280px]">
              {template.note}
            </span>
          )}
        </button>
      ))}
    </div>
  </div>
);

const PracticeToggle = ({ s }: { s: UseSessionV2 }) => {
  const locked = s.session.results.length > 0 || s.session.voidedGames.length > 0;
  const on = s.session.practice;
  return (
    <div className="space-y-1.5">
      <span className="block text-xs uppercase tracking-widest text-muted-foreground">
        Practice session
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => s.setPractice(!on)}
          aria-pressed={on}
          disabled={locked}
          className={`h-12 px-4 rounded-md border-2 flex items-center gap-2 text-xs uppercase tracking-widest transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
            on
              ? "border-gold bg-gold/15 text-gold"
              : "border-border bg-dark-elevated text-muted-foreground hover:border-gold/40"
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          {on ? "Practice on" : "Practice off"}
        </button>
        <p className="text-sm text-muted-foreground max-w-[420px]">
          {locked ? (
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 flex-shrink-0" />
              Locked — the first result has been recorded.
            </span>
          ) : (
            "Results don't count toward leaderboards or multi-week records."
          )}
        </p>
      </div>
    </div>
  );
};

const ConfigStrip = ({ s }: { s: UseSessionV2 }) => (
  <Section title="Session Setup">
    <TemplatesRow s={s} />

    <div className="flex flex-wrap items-end gap-6">
      <div className="space-y-1.5">
        <span className="block text-xs uppercase tracking-widest text-muted-foreground">
          Target rounds
        </span>
        <div className="flex gap-2">
          {[3, 4].map((n) => {
            const active = s.session.config.targetRounds === n;
            return (
              <button
                key={n}
                onClick={() => s.updateConfig({ targetRounds: n })}
                aria-pressed={active}
                className={`w-14 h-12 rounded-md border-2 font-display text-lg transition-all active:scale-95 ${
                  active
                    ? "border-gold bg-gold/15 text-gold"
                    : "border-border bg-dark-elevated text-muted-foreground hover:border-gold/40"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs uppercase tracking-widest text-muted-foreground">
          Courts
        </span>
        <div className="h-12 px-5 flex items-center rounded-md border border-border bg-dark-elevated text-cream font-display text-lg">
          2
          <span className="ml-2 text-xs text-muted-foreground tracking-wide">fixed</span>
        </div>
      </div>
    </div>

    <PracticeToggle s={s} />
  </Section>
);

/* ── Add a NEW person to the system (name + optional email + tier) ─── */

const AddPersonForm = ({ s }: { s: UseSessionV2 }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState<Tier>("B");
  const [isVip, setIsVip] = useState(false);

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // New person → stored in the system AND added to today's check-in list.
    s.addPlayer(trimmed, tier, { isVip, email: email.trim() || undefined, attending: true });
    setName("");
    setEmail("");
    setIsVip(false);
    setTier("B");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="h-11 px-4 rounded-md border-2 border-gold/60 text-gold text-sm hover:bg-gold/10 transition-colors flex items-center gap-2"
      >
        <UserPlus className="w-4 h-4" />
        Add new person
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-gold/40 bg-dark-elevated p-3 space-y-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Add someone not in the system</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          autoFocus
          placeholder="Name (e.g. James)"
          className="flex-1 min-w-[160px] min-h-[48px] rounded-md border border-border bg-dark-surface px-4 text-base text-cream placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold/60"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          type="email"
          placeholder="Email (optional)"
          className="flex-1 min-w-[160px] min-h-[48px] rounded-md border border-border bg-dark-surface px-4 text-base text-cream placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold/60"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {TIERS.map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              aria-pressed={tier === t}
              className={`w-12 h-11 rounded-md border-2 font-display text-base transition-all active:scale-95 ${
                tier === t
                  ? TIER_BADGE[t] + " border-current"
                  : "border-border bg-dark-surface text-muted-foreground hover:border-gold/40"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={() => setIsVip((v) => !v)}
          aria-pressed={isVip}
          className={`h-11 px-4 rounded-md border-2 text-xs uppercase tracking-widest transition-all active:scale-95 ${
            isVip ? "border-gold bg-gold/15 text-gold" : "border-border bg-dark-surface text-muted-foreground hover:border-gold/40"
          }`}
        >
          VIP
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setOpen(false)}
          className="h-11 px-4 rounded-md text-sm text-muted-foreground hover:text-cream transition-colors"
        >
          Close
        </button>
        <button
          onClick={add}
          disabled={!name.trim()}
          className="h-11 px-5 rounded-md bg-gold text-dark font-display text-base flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gold/90"
        >
          <Plus className="w-5 h-5" />
          Add to today
        </button>
      </div>
    </div>
  );
};

/* ── Inline A/B/C tier switcher — one tap moves a player between tiers ── */

const TierSwitch = ({ player, s }: { player: Player; s: UseSessionV2 }) => (
  <div className="flex rounded-md border border-border overflow-hidden flex-shrink-0">
    {TIERS.map((tier) => (
      <button
        key={tier}
        onClick={() => s.updatePlayer(player.id, { tier })}
        aria-label={`Move ${player.name} to tier ${tier}`}
        aria-pressed={player.tier === tier}
        className={`w-9 h-11 font-display text-sm border-r border-border last:border-r-0 transition-colors active:scale-95 ${
          player.tier === tier
            ? TIER_ACTIVE[tier]
            : "text-muted-foreground/50 hover:text-cream hover:bg-muted/30"
        }`}
      >
        {tier}
      </button>
    ))}
  </div>
);

/* ── Player row — compact, one line, iPad-first. Used in the Check-In tab
   (with the check toggle) and the Roster tab (showCheckIn=false: manage only). */

const CheckInRow = ({
  player,
  s,
  mode = "checkin",
}: {
  player: Player;
  s: UseSessionV2;
  // "checkin" = present toggle (Check-In tab); "roster" = Add-to-today toggle.
  mode?: "checkin" | "roster";
}) => {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(player.name);

  const saveEdit = () => {
    s.updatePlayer(player.id, { name: draftName });
    setEditing(false);
  };

  // CHECK-IN tab (helper-facing, no passcode): the whole row is one big tap
  // target — tap the name to check the person in, tap again to undo. NO tier,
  // NO VIP, NO edit are shown here (§18 — tiers are admin-eyes-only).
  if (mode === "checkin") {
    return (
      <button
        onClick={() => s.toggleCheckIn(player.id)}
        aria-pressed={player.checkedIn}
        aria-label={player.checkedIn ? `Check out ${player.name}` : `Check in ${player.name}`}
        className={`w-full flex items-center gap-3 rounded-md border-2 px-3 min-h-[60px] text-left transition-all active:scale-[0.99] touch-manipulation ${
          player.checkedIn
            ? "border-gold bg-gold/15"
            : "border-border bg-dark-elevated hover:border-gold/40"
        }`}
      >
        <span
          className={`flex items-center justify-center w-10 h-10 rounded-md border-2 flex-shrink-0 transition-colors ${
            player.checkedIn ? "border-gold bg-gold/25 text-gold" : "border-muted-foreground/40 text-transparent"
          }`}
        >
          <Check className="w-5 h-5" />
        </span>
        {/* Disambiguated name: shared first names carry a last-name initial
            ("Timi A.") so a helper can tell two Timis apart at a glance. */}
        <span className="flex-1 min-w-0 truncate text-lg text-cream font-body leading-tight">
          {s.playerName(player.id)}
        </span>
        {player.checkedIn && (
          <span className="text-[10px] uppercase tracking-widest text-gold flex-shrink-0">In</span>
        )}
      </button>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded-md border-2 border-gold/50 bg-dark-elevated px-2 py-1.5 flex-wrap">
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && saveEdit()}
          autoFocus
          className="flex-1 min-w-[120px] h-11 px-3 rounded-md border border-border bg-dark-surface text-cream text-base focus:border-gold focus:outline-none"
        />
        <button
          onClick={() => s.setFlag(player.id, "isVip", !player.isVip)}
          className={`h-11 px-3 rounded-md border text-xs uppercase tracking-wider transition-all active:scale-95 ${player.isVip ? "border-gold bg-gold/15 text-gold" : "border-border text-muted-foreground"}`}
        >
          VIP
        </button>
        <button
          onClick={() => s.removePlayer(player.id)}
          aria-label={`Remove ${player.name}`}
          className="w-11 h-11 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={saveEdit}
          className="h-11 px-4 rounded-md border-2 border-gold bg-gold/15 text-gold text-xs uppercase tracking-wider transition-all active:scale-95"
        >
          Done
        </button>
      </div>
    );
  }

  // Roster row (admin): tier switch + Add-to-today toggle + edit. (Check-in
  // mode returned above with just a name + check button — no tiers there.)
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors ${
        player.attending ? "border-gold/40 bg-gold/[0.06]" : "border-border bg-dark-elevated"
      }`}
    >
      {/* Admin row keeps the FULL last name — this is the screen where you
          identify and fix people; the short form is for the live screens. */}
      <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
        <span className="text-cream font-body text-base leading-tight truncate">
          {player.name}
          {player.lastName && <span className="text-muted-foreground font-normal"> {player.lastName}</span>}
        </span>
        {player.isVip && <span className="text-[10px] text-gold flex-shrink-0">VIP</span>}
      </div>
      <TierSwitch player={player} s={s} />
      <button
        onClick={() => s.setAttending(player.id, !player.attending)}
        aria-pressed={!!player.attending}
        className={`h-11 px-3 rounded-md border-2 text-xs uppercase tracking-wider flex-shrink-0 transition-all active:scale-95 ${
          player.attending
            ? "border-gold bg-gold/15 text-gold"
            : "border-border bg-dark-surface text-muted-foreground hover:border-gold/40"
        }`}
      >
        {player.attending ? "✓ Today" : "+ Today"}
      </button>
      <button
        onClick={() => {
          setDraftName(player.name);
          setEditing(true);
        }}
        aria-label={`Edit ${player.name}`}
        className="w-9 h-11 flex items-center justify-center rounded-md text-muted-foreground/70 hover:text-cream hover:bg-muted/40 transition-colors flex-shrink-0"
      >
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  );
};

/* ── Classic roster import (Supabase, read-only source) ──────────── */

const summarize = (r: { added: number; updated: number }) =>
  r.added === 0 && r.updated === 0
    ? "Roster up to date"
    : [r.added ? `added ${r.added}` : "", r.updated ? `updated ${r.updated}` : ""].filter(Boolean).join(", ");

const ImportClassicButton = ({ s }: { s: UseSessionV2 }) => {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const run = async () => {
    setState("loading");
    try {
      setMsg(summarize(await s.importClassicRoster()));
      setState("done");
    } catch {
      setState("error");
    }
  };

  return (
    <button
      onClick={run}
      disabled={state === "loading"}
      className="h-11 px-4 rounded-md border-2 border-gold/60 text-gold text-sm hover:bg-gold/10 transition-colors disabled:opacity-60 flex items-center gap-2"
    >
      <Users className="w-4 h-4" />
      {state === "idle" && "Import classic roster"}
      {state === "loading" && "Importing…"}
      {state === "done" && msg}
      {state === "error" && "Import failed — check wifi, tap to retry"}
    </button>
  );
};

/* ── CSV contacts import (browser file picker — reads a user-selected file) ── */

const ImportCsvButton = ({ s }: { s: UseSessionV2 }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setMsg(summarize(s.importCsv(String(reader.result ?? ""))));
      } catch {
        setMsg("Could not read that CSV");
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        className="h-11 px-4 rounded-md border-2 border-gold/60 text-gold text-sm hover:bg-gold/10 transition-colors flex items-center gap-2"
      >
        <Upload className="w-4 h-4" />
        {msg || "Import contacts CSV"}
      </button>
      <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
    </>
  );
};

/* ── VIP picks (admin-only — never player-facing, §18.3) ─────────── */

const VipPicks = ({ s }: { s: UseSessionV2 }) => {
  const vips = useMemo(
    () =>
      s.session.players
        .filter((p) => p.isVip && p.attending)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [s.session.players],
  );

  if (vips.length === 0) return null;

  return (
    <Section title="VIP Picks" aside={<Chip>Admin only</Chip>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {vips.map((vip) => {
          // Same-tier candidates who are also on today's list.
          const candidates = s.session.players
            .filter((p) => p.attending && p.tier === vip.tier && p.id !== vip.id)
            .sort(
              (a, b) =>
                Number(b.checkedIn) - Number(a.checkedIn) || a.name.localeCompare(b.name),
            );
          return (
            <div
              key={vip.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-dark-elevated p-3"
            >
              <TierBadge tier={vip.tier} />
              {/* Disambiguated: with six players called "Temi", raw first names
                  would let the admin lock a VIP to the wrong person. */}
              <p className="text-cream font-body text-base min-w-0 truncate">{s.playerName(vip.id)}</p>
              <div className="ml-auto w-[200px] flex-shrink-0">
                <Select
                  value={vip.vipPartnerId ?? NO_PICK}
                  onValueChange={(v) => s.setVipPick(vip.id, v === NO_PICK ? null : v)}
                >
                  <SelectTrigger className="min-h-[48px] bg-dark-surface border-border text-cream">
                    <SelectValue placeholder="Partner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PICK}>No pick</SelectItem>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {s.playerName(c.id)}
                        {c.checkedIn ? "" : " (not checked in)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>

      {s.session.vipRejected.length > 0 && (
        <div className="rounded-lg border border-amber-600/30 bg-amber-600/5 p-4 space-y-2">
          {s.session.vipRejected.map((r) => (
            <p
              key={`${r.vipId}-${r.partnerId}`}
              className="flex items-start gap-2 text-sm text-amber-400/90"
            >
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                {s.playerName(r.vipId)} → {s.playerName(r.partnerId)}: {r.reason}
              </span>
            </p>
          ))}
        </div>
      )}
    </Section>
  );
};

/* ── Pairs & waitlist ────────────────────────────────────────────── */

const PairsPanel = ({ s }: { s: UseSessionV2 }) => {
  // Manual swap: tap a player to select, tap another in the SAME tier to trade
  // them between pairs. Setup-only affordance (pairs lock once the game starts).
  const [swapSel, setSwapSel] = useState<string | null>(null);

  const pairsByTier = useMemo(() => {
    const grouped: Record<Tier, Pair[]> = { A: [], B: [], C: [] };
    for (const pair of s.session.pairs) grouped[pair.tier].push(pair);
    return grouped;
  }, [s.session.pairs]);

  const selTier = useMemo(
    () => (swapSel ? s.session.pairs.find((p) => p.playerIds.includes(swapSel))?.tier ?? null : null),
    [swapSel, s.session.pairs],
  );

  const hasUnpaired = TIERS.some((t) => s.session.unpaired[t].length > 0);

  if (s.session.pairs.length === 0 && !hasUnpaired) return null;

  const pick = (playerId: string, tier: Tier) => {
    if (swapSel === null) {
      setSwapSel(playerId);
      return;
    }
    if (swapSel === playerId) {
      setSwapSel(null); // tapped the same player — deselect
      return;
    }
    if (tier !== selTier) return; // different tier — ignore (kept out of reach visually too)
    s.swapPlayers(swapSel, playerId);
    setSwapSel(null);
  };

  return (
    <Section
      title="Pairs"
      aside={
        <span className="text-sm text-muted-foreground">
          {s.session.pairs.length} pair{s.session.pairs.length === 1 ? "" : "s"}
        </span>
      }
    >
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-md border border-border bg-dark-elevated/60 px-3 py-2">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 flex-shrink-0" />
          {swapSel ? (
            <span className="text-cream">
              Swapping <span className="text-gold">{s.playerName(swapSel)}</span> — tap another Tier {selTier} player
              to trade.
            </span>
          ) : (
            "Tap a player, then another in the same tier, to swap them."
          )}
        </p>
        {swapSel && (
          <button
            onClick={() => setSwapSel(null)}
            className="h-9 px-3 rounded-md border border-border text-xs uppercase tracking-wider text-muted-foreground hover:text-cream transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TIERS.map((tier) => (
          <div key={tier} className="space-y-2">
            <div className="flex items-center gap-2">
              <TierBadge tier={tier} />
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Tier {tier}
              </span>
            </div>
            {pairsByTier[tier].length === 0 ? (
              <p className="text-sm text-muted-foreground/60 px-1">No pairs</p>
            ) : (
              pairsByTier[tier].map((pair) => (
                <div
                  key={pair.id}
                  className="flex items-center gap-1 rounded-md border border-border bg-dark-elevated px-2 py-2 min-h-[52px]"
                >
                  {pair.playerIds.map((pid, i) => {
                    const selected = swapSel === pid;
                    const dimmed = swapSel !== null && !selected && selTier !== tier;
                    return (
                      <span key={pid} className="flex items-center min-w-0">
                        <button
                          onClick={() => pick(pid, tier)}
                          aria-pressed={selected}
                          className={`px-2 py-1.5 rounded-md text-base truncate transition-colors active:scale-95 ${
                            selected
                              ? "bg-gold/25 text-gold ring-1 ring-gold"
                              : dimmed
                                ? "text-muted-foreground/40"
                                : "text-cream hover:bg-gold/10"
                          }`}
                        >
                          {s.playerName(pid)}
                        </button>
                        {i === 0 && <span className="text-muted-foreground text-sm px-0.5">&</span>}
                      </span>
                    );
                  })}
                  {pair.vipLocked && (
                    <Lock className="w-4 h-4 text-muted-foreground/70 ml-auto flex-shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
        ))}
      </div>

      {hasUnpaired && (
        <div className="rounded-lg border border-border bg-dark-elevated p-4 space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Waitlist / sub candidates
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {TIERS.flatMap((tier) =>
              s.session.unpaired[tier].map((playerId) => (
                <span key={playerId} className="flex items-center gap-2">
                  <TierBadge tier={tier} />
                  <span className="text-cream/90 font-body">{s.playerName(playerId)}</span>
                </span>
              )),
            )}
          </div>
        </div>
      )}
    </Section>
  );
};

/* ── Balance warnings (§14 — advisory, never blocking) ───────────── */

const BalanceWarnings = ({ s }: { s: UseSessionV2 }) => {
  const warnings = useMemo(() => {
    const out: string[] = [];
    if (s.session.pairs.length === 0) return out;

    const counts: Record<Tier, number> = { A: 0, B: 0, C: 0 };
    for (const pair of s.session.pairs) counts[pair.tier] += 1;

    for (const tier of TIERS) {
      const n = counts[tier];
      if (n > 0 && n < 3) {
        out.push(
          `Tier ${tier}: ${n} pair${n === 1 ? "" : "s"} — limited variety, max ${n - 1} game${
            n - 1 === 1 ? "" : "s"
          } without repeats`,
        );
      }
    }

    const waitlist = TIERS.flatMap((tier) =>
      s.session.unpaired[tier].map((playerId) => s.playerName(playerId)),
    );
    if (waitlist.length > 0) {
      out.push(`Sub rotation likely — waitlist: ${waitlist.join(", ")}`);
    }

    const active = TIERS.map((tier) => counts[tier]).filter((n) => n > 0);
    if (active.length >= 2 && Math.max(...active) > 2 * Math.min(...active)) {
      out.push(
        `Heavy tier imbalance — pairs: A ${counts.A} · B ${counts.B} · C ${counts.C}`,
      );
    }
    return out;
  }, [s]);

  if (warnings.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-600/30 bg-amber-600/5 p-4 space-y-2">
      <p className="text-xs uppercase tracking-widest text-amber-500/80">
        Balance notes — advisory only
      </p>
      {warnings.map((w) => (
        <p key={w} className="flex items-start gap-2 text-sm text-amber-400/90">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{w}</span>
        </p>
      ))}
    </div>
  );
};

/* ── Main component ──────────────────────────────────────────────── */

/* ── Session tab: config + roster (the searchable name database) ──── */

export function SessionSetup({ s }: { s: UseSessionV2 }) {
  const [search, setSearch] = useState("");
  const isSetup = s.session.phase === "setup";
  const canStart = s.session.pairs.length >= 4;

  const sortedPlayers = useMemo(
    () => [...s.session.players].sort((a, b) => a.name.localeCompare(b.name)),
    [s.session.players],
  );
  const q = search.trim().toLowerCase();
  const matches = useMemo(
    () =>
      q
        ? sortedPlayers.filter((p) => `${p.name} ${p.lastName ?? ""}`.toLowerCase().includes(q))
        : [],
    [sortedPlayers, q],
  );

  return (
    <div className="space-y-6 animate-fade-up">
      <ConfigStrip s={s} />

      <Section
        title="Roster"
        aside={
          <span className="text-sm text-muted-foreground">
            <span className="font-display text-lg text-gold">{s.countSummary.attending}</span> picked for today ·{" "}
            <span className="text-cream">{s.countSummary.total}</span> in system
          </span>
        }
      >
        <div className="flex items-center gap-2 flex-wrap">
          <AddPersonForm s={s} />
          <ImportCsvButton s={s} />
          <ImportClassicButton s={s} />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a name, then tap + Today to add them to check-in…"
            aria-label="Search roster"
            className="w-full min-h-[48px] rounded-md border border-border bg-dark-elevated pl-11 pr-4 text-base text-cream placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold/60"
          />
        </div>
        {!q ? (
          <p className="text-muted-foreground text-sm py-4 text-center">
            Search a name to find them, set A/B/C, and tap <span className="text-gold">+ Today</span> to add them
            to today&apos;s check-in. New person? Use <span className="text-gold">Add new person</span> above.
          </p>
        ) : matches.length === 0 ? (
          <p className="text-muted-foreground text-base py-6 text-center">
            No one in the system matches “{search.trim()}” — tap <span className="text-gold">Add new person</span> to add them.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
            {matches.map((p) => (
              <CheckInRow key={p.id} player={p} s={s} mode="roster" />
            ))}
          </div>
        )}
      </Section>

      {/* ── Build the play (admin-only): VIP picks → pairs → start ─── */}
      <VipPicks s={s} />

      {isSetup ? (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={s.buildPairs}
              disabled={s.countSummary.checkedIn < 2}
              className="flex-1 min-h-[64px] rounded-lg border-2 border-gold/60 text-gold font-display text-lg uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-[0.99] hover:bg-gold/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <Users className="w-6 h-6" />
              Generate Pairs
            </button>
            {s.session.pairs.length > 0 && (
              <button
                onClick={s.reshufflePairs}
                className="min-h-[64px] px-6 rounded-lg border-2 border-border text-cream font-display text-base uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.99] hover:border-gold/40"
              >
                <Shuffle className="w-5 h-5" />
                Reshuffle
              </button>
            )}
          </div>

          {s.countSummary.checkedIn < 2 && (
            <p className="text-sm text-muted-foreground text-center">
              Check players in first (Check-In tab), then generate pairs here.
            </p>
          )}

          <PairsPanel s={s} />

          <BalanceWarnings s={s} />

          <div className="space-y-2 pb-8">
            <button
              onClick={s.startSession}
              disabled={!canStart}
              className={`w-full min-h-[72px] rounded-lg font-display text-xl uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-[0.99] ${
                canStart
                  ? "bg-gold text-dark hover:bg-gold/90"
                  : "bg-dark-elevated border border-border text-muted-foreground/60 cursor-not-allowed"
              }`}
            >
              <Play className="w-6 h-6" />
              Start Session
            </button>
            {!canStart && (
              <p className="text-sm text-muted-foreground text-center">
                Generate at least 4 pairs to start — {s.session.pairs.length} so far.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-5 text-center space-y-1 mb-8">
          <p className="font-display text-lg text-gold">Session is live</p>
          <p className="text-sm text-muted-foreground">
            Run the games from the Courts tab. Re-pairing is locked so tonight&apos;s results stay safe.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Check-In tab: attendance (search → tap in) + pairs + start ───── */

export function CheckIn({ s }: { s: UseSessionV2 }) {
  const [search, setSearch] = useState("");

  // Default view = TODAY's picked players (attending). But a SEARCH falls
  // through to the WHOLE system, so a helper (no passcode) can find and check
  // in anyone who wasn't pre-marked "+ Today" — tapping them checks them in AND
  // adds them to today's list (toggleCheckIn sets attending). No tiers shown.
  const todaysPlayers = useMemo(
    () => s.session.players.filter((p) => p.attending).sort((a, b) => a.name.localeCompare(b.name)),
    [s.session.players],
  );
  const allPlayers = useMemo(
    () => [...s.session.players].sort((a, b) => a.name.localeCompare(b.name)),
    [s.session.players],
  );
  const q = search.trim().toLowerCase();
  const visiblePlayers = useMemo(
    () =>
      q
        ? allPlayers.filter((p) => `${p.name} ${p.lastName ?? ""}`.toLowerCase().includes(q))
        : todaysPlayers,
    [allPlayers, todaysPlayers, q],
  );
  const hasRoster = s.session.players.length > 0;

  return (
    <div className="space-y-6 animate-fade-up">
      <Section
        title="Check-In"
        aside={
          <span className="text-base text-cream">
            <span className="font-display text-xl text-gold">{s.countSummary.checkedIn}</span>
            <span className="text-muted-foreground"> of {s.countSummary.attending} here</span>
          </span>
        }
      >
        {hasRoster && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search any name to check them in…"
              aria-label="Search to check someone in"
              className="w-full min-h-[48px] rounded-md border border-border bg-dark-elevated pl-11 pr-4 text-base text-cream placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold/60"
            />
          </div>
        )}
        {q ? (
          visiblePlayers.length === 0 ? (
            <p className="text-muted-foreground text-base py-6 text-center">
              No one in the system matches “{search.trim()}”. New face? Add them on the{" "}
              <span className="text-gold">Roster</span> tab.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
              {visiblePlayers.map((p) => (
                <CheckInRow key={p.id} player={p} s={s} mode="checkin" />
              ))}
            </div>
          )
        ) : todaysPlayers.length === 0 ? (
          <p className="text-muted-foreground text-base py-8 text-center">
            No one picked for today yet — search a name above to check someone in, or pick players on the{" "}
            <span className="text-gold">Roster</span> tab.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
            {todaysPlayers.map((p) => (
              <CheckInRow key={p.id} player={p} s={s} mode="checkin" />
            ))}
          </div>
        )}
      </Section>

      {s.session.phase !== "setup" && (
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-5 text-center space-y-1">
          <p className="font-display text-lg text-gold">Session is live</p>
          <p className="text-sm text-muted-foreground">
            Keep checking people in here — late arrivals get slotted into the games from the Courts tab.
          </p>
        </div>
      )}
    </div>
  );
}

export default SessionSetup;
