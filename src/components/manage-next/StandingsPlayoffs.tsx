// Court Manager v2 — Standings & Playoffs tab (admin-only view).
// Winner-only system: no scores, no point columns, anywhere (§9).
// Tier badges are fine here — this screen is never player-facing (§18).

import type { UseSessionV2 } from "@/court-manager/react/useSessionV2";
import type { PlayoffMatch, StandingRow, Tier } from "@/court-manager/types";
import { Info, Trophy, Undo2 } from "lucide-react";

/* ── Tier badge (admin-only styling: A gold, B silver, C bronze) ──── */
const TIER_BADGE: Record<Tier, string> = {
  A: "bg-accent/15 text-accent border-accent/40",
  B: "bg-zinc-400/10 text-zinc-300 border-zinc-400/40",
  C: "bg-amber-700/15 text-amber-500 border-amber-600/40",
};

const TierBadge = ({ tier }: { tier: Tier }) => (
  <span
    className={`inline-flex items-center justify-center w-7 h-7 rounded-md border text-sm font-display ${TIER_BADGE[tier]}`}
  >
    {tier}
  </span>
);

/* ── Tiebreak annotation (§11) ────────────────────────────────────── */
// The coin flip is honest and visible: a small gold coin that flips a
// few times, then rests in view next to the annotation. Never hidden.
const COIN_FLIP_NOTE = "wins the coin flip";

const COIN_KEYFRAMES = `
@keyframes cm-coin-flip {
  from { transform: rotateY(0deg); }
  to { transform: rotateY(360deg); }
}`;

const Coin = () => (
  <span
    aria-hidden
    className="inline-block w-3.5 h-3.5 rounded-full bg-accent border border-accent/60 shrink-0"
    style={{ animation: "cm-coin-flip 0.7s ease-out 3" }}
  />
);

const TiebreakNote = ({ note }: { note: string }) => (
  <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
    {note === COIN_FLIP_NOTE ? <Coin /> : <Info className="w-3 h-3" />}
    {note}
  </span>
);

/* ── Standings table ──────────────────────────────────────────────── */
const StandingsTable = ({ rows }: { rows: StandingRow[] }) => {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-base text-muted-foreground">
          Standings appear once games are being played.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-x-auto">
      <table className="w-full text-left min-w-[560px]">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-widest text-muted-foreground">
            <th className="px-4 py-3 w-12 font-normal">#</th>
            <th className="px-4 py-3 font-normal">Player</th>
            <th className="px-4 py-3 w-16 font-normal text-center">Tier</th>
            <th className="px-4 py-3 w-20 font-normal text-center">W–L</th>
            <th className="px-4 py-3 w-20 font-normal text-center">Win%</th>
            <th className="px-4 py-3 w-20 font-normal text-center">SOS</th>
            <th className="px-4 py-3 w-20 font-normal text-center">Played</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id}
              className="border-b border-border/50 last:border-b-0 min-h-[44px]"
            >
              <td className="px-4 py-3 font-display text-lg text-muted-foreground">
                {i + 1}
              </td>
              <td className="px-4 py-3">
                <span className="text-base text-foreground">{row.name}</span>
                {row.tiebreakApplied && <TiebreakNote note={row.tiebreakApplied} />}
              </td>
              <td className="px-4 py-3 text-center">
                <TierBadge tier={row.tier} />
              </td>
              <td className="px-4 py-3 text-center font-mono text-base text-foreground">
                {row.wins}–{row.losses}
              </td>
              <td className="px-4 py-3 text-center font-mono text-base text-foreground">
                {Math.round(row.winPct * 100)}%
              </td>
              <td className="px-4 py-3 text-center font-mono text-sm text-muted-foreground">
                {Math.round(row.sos * 100)}%
              </td>
              <td className="px-4 py-3 text-center font-mono text-base text-muted-foreground">
                {row.gamesPlayed}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ── Playoff match card: two large tap-to-win team buttons ────────── */
const STAGE_LABEL: Record<PlayoffMatch["stage"], string> = {
  quarter: "Quarterfinal",
  semi: "Semifinal",
  final: "Final",
  final_challenge: "Final Challenge",
};

const TeamButton = ({
  team,
  names,
  decided,
  isWinner,
  onTap,
}: {
  team: PlayoffMatch["a"];
  names: string;
  decided: boolean;
  isWinner: boolean;
  onTap: () => void;
}) => (
  <button
    onClick={onTap}
    disabled={decided}
    className={`w-full rounded-lg border-2 p-5 text-left transition-all min-h-[76px] touch-manipulation ${
      isWinner
        ? "border-accent bg-accent/15"
        : decided
          ? "border-border bg-muted/30 opacity-50"
          : "border-border bg-muted hover:border-accent hover:bg-accent/10 active:border-accent active:bg-accent/20 active:scale-[0.98]"
    }`}
  >
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
          Seeds {team.seedLabel}
        </p>
        <p
          className={`font-display text-xl ${isWinner ? "text-accent" : "text-foreground"}`}
        >
          {names}
        </p>
      </div>
      {isWinner && <Trophy className="w-6 h-6 text-accent shrink-0" />}
    </div>
  </button>
);

const MatchCard = ({
  s,
  match,
  label,
}: {
  s: UseSessionV2;
  match: PlayoffMatch;
  label: string;
}) => {
  const winner = s.session.playoffs?.winners[match.id];
  const decided = winner !== undefined;
  const teamNames = (team: PlayoffMatch["a"]) =>
    team.ids.map(s.playerName).join(" & ");

  return (
    <div className="rounded-lg border border-border bg-card p-4 md:p-5 space-y-3 flex-1">
      <div className="flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </h4>
        {!decided && (
          <span className="text-xs text-muted-foreground">Tap the winners</span>
        )}
      </div>
      <TeamButton
        team={match.a}
        names={teamNames(match.a)}
        decided={decided}
        isWinner={winner === "a"}
        onTap={() => s.recordPlayoffWinner(match.id, "a")}
      />
      <TeamButton
        team={match.b}
        names={teamNames(match.b)}
        decided={decided}
        isWinner={winner === "b"}
        onTap={() => s.recordPlayoffWinner(match.id, "b")}
      />
    </div>
  );
};

/* ── Champion banner ──────────────────────────────────────────────── */
const ChampionBanner = ({ s }: { s: UseSessionV2 }) => {
  const champion = s.session.champion;
  if (!champion) return null;
  return (
    <div className="rounded-lg border-2 border-accent bg-accent/10 p-8 text-center space-y-3 animate-fade-up">
      <Trophy className="w-10 h-10 text-accent mx-auto" />
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Champions of the week
      </p>
      <h2 className="font-display text-3xl md:text-4xl text-accent">
        {champion.map(s.playerName).join(" & ")}
      </h2>
      <p className="text-base text-muted-foreground">
        Well played. See you next week.
      </p>
    </div>
  );
};

/* ── Seeds + notes ────────────────────────────────────────────────── */
const SeedsList = ({ s }: { s: UseSessionV2 }) => {
  const playoffs = s.session.playoffs;
  if (!playoffs) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-4 md:p-5 space-y-4">
      <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
        Seeds
      </h3>
      <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
        {playoffs.seeds.slice(0, 8).map((seed, i) => (
          <li key={seed.id} className="flex items-center gap-3 min-h-[44px]">
            <span className="font-display text-lg text-accent w-6 text-right">
              {i + 1}
            </span>
            <TierBadge tier={seed.tier} />
            <span className="text-base text-foreground">{seed.name}</span>
            {seed.tiebreakApplied && <TiebreakNote note={seed.tiebreakApplied} />}
          </li>
        ))}
      </ol>
      {playoffs.notes.length > 0 && (
        <ul className="space-y-1 border-t border-border/50 pt-3">
          {playoffs.notes.map((note, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-muted-foreground"
            >
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ── Bracket ──────────────────────────────────────────────────────── */
const Bracket = ({ s }: { s: UseSessionV2 }) => {
  const playoffs = s.session.playoffs;
  if (!playoffs) return null;

  const quarters = playoffs.matches.filter((m) => m.stage === "quarter");
  const semis = playoffs.matches.filter((m) => m.stage === "semi");
  const finals = playoffs.matches.filter(
    (m) => m.stage === "final" || m.stage === "final_challenge",
  );

  return (
    <div className="space-y-4">
      {s.canUndoPlayoff && (
        <div className="flex justify-end">
          <button
            onClick={s.undoPlayoffWinner}
            className="min-h-[44px] px-4 rounded-md border border-border text-muted-foreground text-sm flex items-center gap-2 hover:text-cream hover:border-gold/40 transition-colors"
          >
            <Undo2 className="w-4 h-4" />
            Undo last result
          </button>
        </div>
      )}
      {quarters.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quarters.map((m, i) => (
            <MatchCard
              key={m.id}
              s={s}
              match={m}
              label={`${STAGE_LABEL.quarter} ${i + 1}`}
            />
          ))}
        </div>
      )}
      {semis.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {semis.map((m, i) => (
            <MatchCard
              key={m.id}
              s={s}
              match={m}
              label={semis.length > 1 ? `${STAGE_LABEL.semi} ${i + 1}` : STAGE_LABEL.semi}
            />
          ))}
        </div>
      )}
      {finals.length > 0 ? (
        <div className="max-w-xl mx-auto w-full">
          {finals.map((m) => (
            <MatchCard key={m.id} s={s} match={m} label={STAGE_LABEL[m.stage]} />
          ))}
        </div>
      ) : (
        semis.length > 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-6 text-center max-w-xl mx-auto w-full">
            <p className="text-base text-muted-foreground">
              The final forms when both semifinals are decided.
            </p>
          </div>
        )
      )}
    </div>
  );
};

/* ── Main component ───────────────────────────────────────────────── */
const StandingsPlayoffs = ({ s }: { s: UseSessionV2 }) => {
  const playoffs = s.session.playoffs;

  return (
    <div className="space-y-8 animate-fade-up">
      <style>{COIN_KEYFRAMES}</style>
      <ChampionBanner s={s} />

      <section className="space-y-3">
        <h2 className="font-display text-2xl md:text-3xl text-foreground">
          Standings
        </h2>
        {s.session.practice && (
          <p className="inline-flex items-center rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground">
            Practice — results don&apos;t count
          </p>
        )}
        <StandingsTable rows={s.standings} />
      </section>

      {playoffs ? (
        <section className="space-y-4">
          <h2 className="font-display text-2xl md:text-3xl text-foreground">
            Playoffs
          </h2>
          <SeedsList s={s} />
          <Bracket s={s} />
        </section>
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-base text-muted-foreground">
            Playoffs start from the Courts tab, at a round boundary.
          </p>
        </div>
      )}
    </div>
  );
};

export default StandingsPlayoffs;
