// PTO League admin.
//
// Record matches as they are played. Pick a division, tap four players, type
// two scores, save. Nothing is scheduled in advance and nothing is generated;
// the Sheet does the standings.

import { useEffect, useMemo, useState } from "react";
import {
  addMatch,
  fetchBootstrap,
  type Bootstrap,
  type MatchRow,
  type Player,
} from "@/league/adminApi";
import { MAX_GAMES, gamesPlayed, shownMatches } from "@/league/gamesPlayed";
import "./leagueAdmin.css";

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
  const [division, setDivision] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
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
      setDivision((d) => d || divisionsOf(b.players)[0] || "");
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
  const roster = active.filter((p) => p.division === division);
  // Everyone plays five; anyone at five is greyed out so a sixth game is
  // not recorded by mistake. A sixth game goes in the Sheet by hand, with
  // that player's spot left blank (see gamesPlayed.ts).
  const played = useMemo(() => gamesPlayed(data?.matches || [], division), [data, division]);

  const toggle = (name: string) => {
    setError("");
    setPicked((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : prev.length >= 4
          ? prev
          : [...prev, name],
    );
  };

  const clear = () => {
    setPicked([]);
    setScoreA("");
    setScoreB("");
  };

  const ready =
    picked.length === 4 &&
    scoreA !== "" &&
    scoreB !== "" &&
    Number(scoreA) !== Number(scoreB);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await addMatch(
        {
          sessionId,
          division,
          teamA: [picked[0], picked[1]],
          teamB: [picked[2], picked[3]],
        },
        Number(scoreA),
        Number(scoreB),
        passcode,
      );
      clear();
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

  // Games with a blank spot stay in the Sheet (they keep everyone on five)
  // but are not listed here.
  const recorded = shownMatches(data?.matches || []);

  return (
    <div className="la">
      <header className="la-top">
        <h1>League admin</h1>
        <select
          className="la-week"
          value={sessionId}
          onChange={(e) => {
            clear();
            void load(e.target.value);
          }}
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
      {!data && !error && <p className="la-note">Loading…</p>}

      {data && (
        <>
          <div className="la-divs">
            {divisions.map((d) => (
              <button
                key={d}
                type="button"
                className={`la-tab ${d === division ? "is-on" : ""}`}
                onClick={() => {
                  setDivision(d);
                  clear();
                }}
              >
                {d}
              </button>
            ))}
          </div>

          <p className="la-note">
            {picked.length === 0 &&
              `Tap four players. First two are one team. Five games each, so anyone on ${MAX_GAMES} is greyed out.`}
            {picked.length > 0 && picked.length < 4 &&
              `${4 - picked.length} more to pick`}
            {picked.length === 4 && "Now the scores."}
          </p>

          <div className="la-players">
            {roster.map((p) => {
              const at = picked.indexOf(p.name);
              const games = played[p.name] || 0;
              const done = games >= MAX_GAMES && at < 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`la-player ${at >= 0 ? "is-on" : ""} ${done ? "is-done" : ""}`}
                  onClick={() => toggle(p.name)}
                  disabled={done}
                  aria-label={`${p.name}, ${games} of ${MAX_GAMES} games played`}
                >
                  {at >= 0 && <span className="la-pick">{at < 2 ? "A" : "B"}</span>}
                  {p.name}
                  <span className="la-count">
                    {games}/{MAX_GAMES}
                  </span>
                </button>
              );
            })}
          </div>

          {picked.length === 4 && (
            <div className="la-entry">
              <div className="la-entry__row">
                <span>{picked[0]} + {picked[1]}</span>
                <input
                  className="la-box"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label="Score for team A"
                  value={scoreA}
                  onChange={(e) => setScoreA(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="la-entry__row">
                <span>{picked[2]} + {picked[3]}</span>
                <input
                  className="la-box"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label="Score for team B"
                  value={scoreB}
                  onChange={(e) => setScoreB(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              {scoreA !== "" && scoreA === scoreB && (
                <p className="la-warn">No draws in this league.</p>
              )}
            </div>
          )}

          <div className="la-actions">
            <button
              type="button"
              className="la-btn"
              onClick={() => void save()}
              disabled={!ready || busy}
            >
              {busy ? "Saving…" : "Save match"}
            </button>
            {picked.length > 0 && (
              <button type="button" className="la-btn la-btn--ghost" onClick={clear}>
                Clear
              </button>
            )}
          </div>

          <h2 className="la-recent">
            {recorded.length} recorded this week
          </h2>
          {recorded
            .slice()
            .reverse()
            .map((m, i) => (
              <Row key={`${m.division}-${m.round}-${i}`} match={m} />
            ))}
          {recorded.length === 0 && (
            <p className="la-note">Nothing yet. Matches land in the Sheet as you save them.</p>
          )}
        </>
      )}
    </div>
  );
};

const Row = ({ match }: { match: MatchRow }) => {
  const aWon = (match.scoreA ?? 0) > (match.scoreB ?? 0);
  return (
    <div className="la-row">
      <span className="la-row__div">{match.division}</span>
      <span className={`la-row__team ${aWon ? "is-win" : ""}`}>
        <Team names={match.teamA} />
      </span>
      <span className="la-row__score">
        {match.scoreA}–{match.scoreB}
      </span>
      <span className={`la-row__team ${aWon ? "" : "is-win"}`}>
        <Team names={match.teamB} />
      </span>
    </div>
  );
};

const Team = ({ names }: { names: [string, string] }) => <>{names.join(" + ")}</>;

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

export default LeagueAdmin;
