// PTO League admin, one screen.
//
// Pick the week, tick who turned up, generate, type scores. One court per
// division. Rounds are not a number you set: they come from how many people
// signed in, because what you actually decide is how many games everyone
// gets, and the rounds needed for that depend on the headcount.

import { useEffect, useMemo, useState } from "react";
import { generateFixtures, type Fixture } from "@/league/fixtures";
import {
  fetchBootstrap,
  saveAttendance,
  saveFixtures,
  saveScore,
  type Bootstrap,
  type MatchRow,
  type Player,
} from "@/league/adminApi";
import "./leagueAdmin.css";

const COURTS = ["Court 4", "Court 5", "Court 6"];
const PASSCODE_KEY = "pto.league.passcode";
const SEATS = 4;
const MIN_ROUNDS = 3;
const MAX_ROUNDS = 12;
/** What we aim to give the biggest division when suggesting a round count. */
const TARGET_GAMES = 3;

/**
 * One round count for the whole session. The three courts run side by side,
 * so round 1 happens on all of them at once and everyone goes home together.
 * Staggering the counts would leave a court standing empty.
 *
 * Suggested from the largest division, since that is the one that struggles
 * for court time. Games per player then differ by division and cannot be
 * made equal: on one court each, a player's games are 4R/N, so the small
 * division always plays more. The screen shows that rather than hiding it.
 */
const suggestRounds = (largestDivision: number) => {
  if (largestDivision < SEATS) return MIN_ROUNDS;
  const wanted = Math.ceil((TARGET_GAMES * largestDivision) / SEATS);
  return Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, wanted));
};

const gamesEachFor = (players: number, rounds: number) =>
  players < SEATS ? 0 : Math.floor((rounds * SEATS) / players);

const shortDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
};

const divisionsOf = (players: Player[]): string[] => {
  const seen: string[] = [];
  for (const p of players) {
    if (p.division && !seen.includes(p.division)) seen.push(p.division);
  }
  return seen;
};

const LeagueAdmin = () => {
  const [passcode, setPasscode] = useState(
    () => localStorage.getItem(PASSCODE_KEY) || "",
  );
  const [data, setData] = useState<Bootstrap | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [rounds, setRounds] = useState(0); // 0 until suggested from turnout
  const [card, setCard] = useState<Fixture[] | null>(null);
  const [seed, setSeed] = useState(1);
  const [scoring, setScoring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "League admin · Club PTO";
  }, []);

  const load = async (id?: string) => {
    setBusy(true);
    setError("");
    try {
      const b = await fetchBootstrap(id);
      setData(b);
      setSessionId(b.sessionId);
      const next: Record<string, boolean> = {};
      for (const p of b.players) {
        if (p.status !== "Active") continue;
        next[p.id] = b.attendance[p.id] !== "Out";
      }
      setPresent(next);
      setCard(null);
      setScoring(b.matches.length > 0);
      // Suggest a round count from the biggest division; the admin can move it.
      const sizes = divisionsOf(b.players.filter((p) => p.status === "Active")).map(
        (d) =>
          b.players.filter(
            (p) => p.status === "Active" && p.division === d && next[p.id],
          ).length,
      );
      setRounds(suggestRounds(Math.max(0, ...sizes)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = useMemo(
    () => (data?.players || []).filter((p) => p.status === "Active"),
    [data],
  );
  const divisions = useMemo(() => divisionsOf(active), [active]);
  const presentIn = (div: string) =>
    active.filter((p) => p.division === div && present[p.id]);
  const totalIn = active.filter((p) => present[p.id]).length;

  const build = () => {
    setError("");
    const out: Fixture[] = [];
    const problems: string[] = [];
    divisions.forEach((div, i) => {
      const players = presentIn(div).map((p) => p.name);
      const result = generateFixtures({
        division: div,
        players,
        courts: [COURTS[i] || `Court ${i + 1}`],
        rounds,
        seed,
      });
      if (result.error) problems.push(result.error);
      else out.push(...result.fixtures);
    });
    setError(problems.join("   "));
    setCard(out.length ? out : null);
  };

  const commit = async () => {
    if (!card) return;
    setBusy(true);
    setError("");
    try {
      await saveAttendance(
        sessionId,
        active.map((p) => ({
          playerId: p.id,
          status: present[p.id] ? ("In" as const) : ("Out" as const),
        })),
        passcode,
      );
      await saveFixtures(sessionId, card, passcode);
      await load(sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!passcode) {
    return (
      <PasscodeGate
        onUnlock={(code) => {
          localStorage.setItem(PASSCODE_KEY, code);
          setPasscode(code);
        }}
      />
    );
  }

  return (
    <div className="la">
      <header className="la-top">
        <h1>League admin</h1>
        <select
          className="la-week"
          value={sessionId}
          onChange={(e) => void load(e.target.value)}
          disabled={busy}
        >
          {(data?.sessions || []).map((s) => (
            <option key={s.id} value={s.id}>
              Wk {s.week} · {shortDate(s.date)}
            </option>
          ))}
        </select>
      </header>

      {error && <p className="la-error">{error}</p>}
      {busy && <p className="la-note">Working…</p>}
      {!data && !error && <p className="la-note">Loading…</p>}

      {data && scoring && (
        <Scoring
          matches={data.matches}
          sessionId={sessionId}
          passcode={passcode}
          onBack={() => setScoring(false)}
        />
      )}

      {data && !scoring && (
        <>
          <div className="la-summary">
            <div className="la-summary__count">
              <b>{totalIn}</b> here
            </div>
            <div className="la-stepper">
              <span>Rounds</span>
              <button
                type="button"
                aria-label="Fewer rounds"
                onClick={() => setRounds((r) => Math.max(MIN_ROUNDS, r - 1))}
              >
                −
              </button>
              <b>{rounds}</b>
              <button
                type="button"
                aria-label="More rounds"
                onClick={() => setRounds((r) => Math.min(MAX_ROUNDS, r + 1))}
              >
                +
              </button>
            </div>
          </div>

          {divisions.map((div, i) => {
            const roster = active.filter((p) => p.division === div);
            const here = presentIn(div).length;
            const viable = here >= SEATS;
            const games = gamesEachFor(here, rounds);
            return (
              <section key={div} className="la-div">
                <div className="la-div__head">
                  <h2>{div}</h2>
                  <span className="la-div__court">{COURTS[i]}</span>
                  <span className="la-div__count">
                    {here}/{roster.length}
                  </span>
                </div>
                <p className={`la-div__calc ${viable ? "" : "is-short"}`}>
                  {viable
                    ? `${games} games each · ${here - SEATS} sitting out each round`
                    : `Needs ${SEATS - here} more to play doubles`}
                </p>
                <div className="la-players">
                  {roster.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`la-player ${present[p.id] ? "is-in" : "is-out"}`}
                      aria-pressed={!!present[p.id]}
                      onClick={() =>
                        setPresent((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                      }
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}

          {card && <CardPreview fixtures={card} />}

          <div className="la-actions">
            {!card && (
              <button type="button" className="la-btn" onClick={build} disabled={busy}>
                Generate fixtures
              </button>
            )}
            {card && (
              <>
                <button
                  type="button"
                  className="la-btn la-btn--ghost"
                  onClick={() => {
                    setSeed((s) => s + 1);
                    setTimeout(build, 0);
                  }}
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  className="la-btn"
                  onClick={() => void commit()}
                  disabled={busy}
                >
                  Save to Sheet
                </button>
              </>
            )}
            {!card && data.matches.length > 0 && (
              <button
                type="button"
                className="la-btn la-btn--ghost"
                onClick={() => setScoring(true)}
              >
                Back to scores
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

/* ── passcode ─────────────────────────────────────────────────── */

const PasscodeGate = ({ onUnlock }: { onUnlock: (code: string) => void }) => {
  const [code, setCode] = useState("");
  return (
    <div className="la la-gate">
      <h1>League admin</h1>
      <p className="la-note">Enter the admin passcode.</p>
      <input
        className="la-input"
        type="password"
        inputMode="numeric"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoFocus
      />
      <button
        type="button"
        className="la-btn"
        onClick={() => code.trim() && onUnlock(code.trim())}
      >
        Unlock
      </button>
    </div>
  );
};

/* ── the card, before saving ──────────────────────────────────── */

const byRound = <T extends { round: number }>(items: T[]) => {
  const rounds = [...new Set(items.map((i) => i.round))].sort((a, b) => a - b);
  return rounds.map((r) => ({ round: r, items: items.filter((i) => i.round === r) }));
};

const CardPreview = ({ fixtures }: { fixtures: Fixture[] }) => (
  <div className="la-preview">
    <h2 className="la-preview__title">{fixtures.length} matches</h2>
    {byRound(fixtures).map(({ round, items }) => (
      <section key={round} className="la-rnd">
        <h3>Round {round}</h3>
        {items.map((f) => (
          <p key={`${f.division}-${f.court}`} className="la-fx">
            <span className="la-fx__div">{f.division}</span>
            {f.teamA.join(" + ")} <i>v</i> {f.teamB.join(" + ")}
          </p>
        ))}
      </section>
    ))}
  </div>
);

/* ── scoring ──────────────────────────────────────────────────── */

const Scoring = ({
  matches,
  sessionId,
  passcode,
  onBack,
}: {
  matches: MatchRow[];
  sessionId: string;
  passcode: string;
  onBack: () => void;
}) => {
  const [done, setDone] = useState(
    () => matches.filter((m) => m.scoreA !== null).length,
  );
  return (
    <div className="la-scoring">
      <div className="la-summary">
        <div className="la-summary__count">
          <b>
            {done}/{matches.length}
          </b>{" "}
          scored
        </div>
        <button type="button" className="la-link" onClick={onBack}>
          Check-in
        </button>
      </div>

      {byRound(matches).map(({ round, items }) => (
        <section key={round} className="la-rnd">
          <h3>Round {round}</h3>
          {items.map((m) => (
            <ScoreCard
              key={`${m.division}-${m.court}-${m.round}`}
              match={m}
              sessionId={sessionId}
              passcode={passcode}
              onFirstSave={() => setDone((d) => d + 1)}
            />
          ))}
        </section>
      ))}
    </div>
  );
};

const ScoreCard = ({
  match,
  sessionId,
  passcode,
  onFirstSave,
}: {
  match: MatchRow;
  sessionId: string;
  passcode: string;
  onFirstSave: () => void;
}) => {
  const [a, setA] = useState(match.scoreA === null ? "" : String(match.scoreA));
  const [b, setB] = useState(match.scoreB === null ? "" : String(match.scoreB));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    match.scoreA === null ? "idle" : "saved",
  );
  const [message, setMessage] = useState("");
  const [counted, setCounted] = useState(match.scoreA !== null);

  const submit = async (nextA: string, nextB: string) => {
    if (nextA === "" || nextB === "") return;
    const na = Number(nextA);
    const nb = Number(nextB);
    if (!Number.isFinite(na) || !Number.isFinite(nb)) return;
    if (na === nb) {
      setState("error");
      setMessage("No draws in this league");
      return;
    }
    setState("saving");
    setMessage("");
    try {
      await saveScore(
        {
          sessionId,
          division: match.division,
          round: match.round,
          court: match.court,
          teamA: match.teamA,
          teamB: match.teamB,
        },
        na,
        nb,
        passcode,
      );
      setState("saved");
      if (!counted) {
        setCounted(true);
        onFirstSave();
      }
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className={`la-sc la-sc--${state}`}>
      <div className="la-sc__row">
        <span className="la-sc__team">{match.teamA.join(" + ")}</span>
        <input
          className="la-sc__box"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={`Score for ${match.teamA.join(" and ")}`}
          value={a}
          onChange={(e) => setA(e.target.value.replace(/\D/g, ""))}
          onBlur={() => void submit(a, b)}
        />
      </div>
      <div className="la-sc__row">
        <span className="la-sc__team">{match.teamB.join(" + ")}</span>
        <input
          className="la-sc__box"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={`Score for ${match.teamB.join(" and ")}`}
          value={b}
          onChange={(e) => setB(e.target.value.replace(/\D/g, ""))}
          onBlur={() => void submit(a, b)}
        />
      </div>
      <div className="la-sc__foot">
        <span className="la-sc__div">
          {match.division} · {match.court}
        </span>
        <span className="la-sc__state">
          {state === "saving" && "saving…"}
          {state === "saved" && "saved"}
          {state === "error" && (message || "not saved")}
        </span>
      </div>
    </div>
  );
};

export default LeagueAdmin;
