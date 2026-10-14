// PTO League admin, one screen.
//
// Pick the week, tick who turned up, generate, type scores. One court per
// division, which is what 7/9/5 across three courts comes to every week.
// Standings are in the Sheet; this does not duplicate them.

import { useEffect, useMemo, useState } from "react";
import { generateFixtures, type Fixture } from "@/league/fixtures";
import {
  fetchBootstrap,
  saveAttendance,
  saveFixtures,
  saveScore,
  type Bootstrap,
  type MatchRow,
} from "@/league/adminApi";
import "./leagueAdmin.css";

const COURTS = ["Court 4", "Court 5", "Court 6"];
const PASSCODE_KEY = "pto.league.passcode";

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

/** Divisions in the order they appear on the roster, so M1, M2, W. */
const divisionsOf = (players: { division: string }[]): string[] => {
  const seen: string[] = [];
  for (const p of players) {
    if (p.division && !seen.includes(p.division)) seen.push(p.division);
  }
  return seen;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const LeagueAdmin = () => {
  const [passcode, setPasscode] = useState(
    () => localStorage.getItem(PASSCODE_KEY) || "",
  );
  const [data, setData] = useState<Bootstrap | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [rounds, setRounds] = useState(6);
  const [card, setCard] = useState<Fixture[] | null>(null);
  const [seed, setSeed] = useState(1);
  const [committed, setCommitted] = useState<MatchRow[] | null>(null);
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
      setCommitted(b.matches.length ? b.matches : null);
      setCard(null);
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

  const inDivision = (div: string) =>
    active.filter((p) => p.division === div && present[p.id]);

  const totalIn = active.filter((p) => present[p.id]).length;

  const build = () => {
    setError("");
    const out: Fixture[] = [];
    const problems: string[] = [];
    divisions.forEach((div, i) => {
      const players = inDivision(div).map((p) => p.name);
      const result = generateFixtures({
        division: div,
        players,
        courts: [COURTS[i] || `Court ${i + 1}`],
        rounds,
        seed,
      });
      if (result.error) {
        problems.push(result.error);
        return;
      }
      out.push(...result.fixtures);
    });
    if (problems.length) setError(problems.join("  "));
    setCard(out.length ? out : null);
  };

  const commit = async () => {
    if (!card || !passcode) return;
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

  const session = data?.sessions.find((s) => s.id === sessionId);

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
              Week {s.week} · {shortDate(s.date)}
            </option>
          ))}
        </select>
      </header>

      {error && <p className="la-error">{error}</p>}
      {busy && <p className="la-busy">Working…</p>}

      {!data && !error && <p className="la-busy">Loading…</p>}

      {data && !committed && (
        <>
          <div className="la-bar">
            <span>{totalIn} in</span>
            <label className="la-rounds">
              Rounds
              <button
                type="button"
                onClick={() => setRounds((r) => Math.max(3, r - 1))}
              >
                −
              </button>
              <b>{rounds}</b>
              <button
                type="button"
                onClick={() => setRounds((r) => Math.min(10, r + 1))}
              >
                +
              </button>
            </label>
          </div>

          {divisions.map((div, i) => {
            const roster = active.filter((p) => p.division === div);
            const count = inDivision(div).length;
            return (
              <section key={div} className="la-div">
                <h2>
                  {div} <span>{COURTS[i]}</span>
                  <em className={count < 4 ? "la-short" : ""}>
                    {count} of {roster.length}
                    {count < 4 ? " · need 4" : ""}
                  </em>
                </h2>
                <div className="la-players">
                  {roster.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`la-player ${present[p.id] ? "is-in" : ""}`}
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

          {!card && (
            <button className="la-cta" type="button" onClick={build} disabled={busy}>
              Generate fixtures
            </button>
          )}

          {card && (
            <>
              <Card fixtures={card} />
              <div className="la-actions">
                <button
                  type="button"
                  className="la-cta la-cta--ghost"
                  onClick={() => {
                    setSeed((s) => s + 1);
                    setTimeout(build, 0);
                  }}
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  className="la-cta"
                  onClick={() => void commit()}
                  disabled={busy}
                >
                  Commit to Sheet
                </button>
              </div>
            </>
          )}
        </>
      )}

      {data && committed && (
        <Scoring
          matches={committed}
          passcode={passcode}
          sessionId={sessionId}
          onReload={() => void load(sessionId)}
        />
      )}

      {session && (
        <p className="la-foot">
          {session.status} · {session.courts} courts
        </p>
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
      <p>Enter the admin passcode.</p>
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
        className="la-cta"
        onClick={() => code.trim() && onUnlock(code.trim())}
      >
        Unlock
      </button>
    </div>
  );
};

/* ── the generated card, before committing ────────────────────── */

const Card = ({ fixtures }: { fixtures: Fixture[] }) => {
  const rounds = [...new Set(fixtures.map((f) => f.round))].sort((a, b) => a - b);
  return (
    <div className="la-card">
      {rounds.map((r) => (
        <section key={r} className="la-round">
          <h3>Round {r}</h3>
          {fixtures
            .filter((f) => f.round === r)
            .map((f) => (
              <div key={`${f.division}-${f.court}`} className="la-match">
                <span className="la-court">{f.division}</span>
                <span>
                  {f.teamA.join(" + ")} <i>v</i> {f.teamB.join(" + ")}
                </span>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
};

/* ── scoring ──────────────────────────────────────────────────── */

const Scoring = ({
  matches,
  passcode,
  sessionId,
  onReload,
}: {
  matches: MatchRow[];
  passcode: string;
  sessionId: string;
  onReload: () => void;
}) => {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const [index, setIndex] = useState(() => {
    const firstUnscored = rounds.find((r) =>
      matches.some((m) => m.round === r && m.scoreA === null),
    );
    return Math.max(0, rounds.indexOf(firstUnscored ?? rounds[0]));
  });
  const round = rounds[index];
  const inRound = matches.filter((m) => m.round === round);
  const done = inRound.filter((m) => m.scoreA !== null).length;

  return (
    <div className="la-scoring">
      <div className="la-nav">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          ←
        </button>
        <span>
          Round {round} of {rounds.length}
        </span>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(rounds.length - 1, i + 1))}
          disabled={index >= rounds.length - 1}
        >
          →
        </button>
      </div>
      <p className="la-progress">
        {done} of {inRound.length} done
      </p>

      {inRound.map((m) => (
        <ScoreRow
          key={`${m.division}-${m.court}-${m.round}`}
          match={m}
          passcode={passcode}
          sessionId={sessionId}
        />
      ))}

      <button type="button" className="la-cta la-cta--ghost" onClick={onReload}>
        Reload from Sheet
      </button>
    </div>
  );
};

const ScoreRow = ({
  match,
  passcode,
  sessionId,
}: {
  match: MatchRow;
  passcode: string;
  sessionId: string;
}) => {
  const [a, setA] = useState(match.scoreA === null ? "" : String(match.scoreA));
  const [b, setB] = useState(match.scoreB === null ? "" : String(match.scoreB));
  const [state, setState] = useState<SaveState>(
    match.scoreA === null ? "idle" : "saved",
  );
  const [message, setMessage] = useState("");

  const commit = async () => {
    if (a === "" || b === "") return;
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isFinite(na) || !Number.isFinite(nb)) return;
    if (na === nb) {
      setState("error");
      setMessage("No draws in this league.");
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
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className={`la-score la-score--${state}`}>
      <div className="la-score__head">
        {match.division} · {match.court}
      </div>
      <label className="la-score__side">
        <span>{match.teamA.join(" + ")}</span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={a}
          onChange={(e) => setA(e.target.value.replace(/\D/g, ""))}
          onBlur={() => void commit()}
        />
      </label>
      <label className="la-score__side">
        <span>{match.teamB.join(" + ")}</span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={b}
          onChange={(e) => setB(e.target.value.replace(/\D/g, ""))}
          onBlur={() => void commit()}
        />
      </label>
      <div className="la-score__state">
        {state === "saving" && "saving…"}
        {state === "saved" && "saved"}
        {state === "error" && (message || "not saved")}
      </div>
    </div>
  );
};

export default LeagueAdmin;
