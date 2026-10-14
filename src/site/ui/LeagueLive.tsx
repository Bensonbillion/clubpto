// The league, live: standings and matchdays read from the league Sheet.
//
// Server render (and the first paint) shows the static shape: divisions,
// seven Sundays, the time. The live numbers arrive a moment later. If the
// Sheet cannot be reached, the static shape is all anyone sees, and nothing
// on the page breaks.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  DIVISIONS,
  byDivision,
  displayName,
  hasResults,
  leaders,
  loadLeague,
  matchdaysPlayed,
  nextMatchday,
  type LeagueSnapshot,
} from "@/site/leagueLive";
import { leagueFacts, longDay, todayInToronto } from "@/site/content";

type State = { status: "loading" } | { status: "ready"; data: LeagueSnapshot } | { status: "error" };

export const useLeagueLive = (): State => {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    loadLeague()
      .then((data) => alive && setState({ status: "ready", data }))
      .catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
};

const SEASON_SUNDAYS = 7;

const Tile = ({ n, label, sub }: { n: string; label: string; sub?: string }) => (
  <div className="tile">
    <span className="disp tile-n">{n}</span>
    <span className="tile-l">{label}</span>
    {sub ? <span className="tile-s">{sub}</span> : null}
  </div>
);

/** The four headline numbers. Static until the Sheet answers. */
const Tiles = ({ state }: { state: State }) => {
  const today = todayInToronto();
  if (state.status !== "ready") {
    return (
      <div className="tiles">
        <Tile n={String(DIVISIONS.length)} label="Divisions" sub="Men's 1, Men's 2, Women's" />
        <Tile n={String(SEASON_SUNDAYS)} label="Matchdays" sub="Sundays, 3 to 5 PM" />
        <Tile n="1" label="Champion per division" sub="Crowned on Finals Night" />
        <Tile n="Live" label="Standings" sub="Updated as scores go in" />
      </div>
    );
  }
  const { standings, matchdays } = state.data;
  const played = matchdaysPlayed(matchdays);
  const next = nextMatchday(matchdays, today);
  return (
    <div className="tiles">
      <Tile n={String(standings.length)} label="Players" sub="Founding Season roster" />
      <Tile n={String(DIVISIONS.length)} label="Divisions" sub="Men's 1, Men's 2, Women's" />
      <Tile n={`${played}/${matchdays.length || SEASON_SUNDAYS}`} label="Matchdays played" sub="Sundays, 3 to 5 PM" />
      <Tile
        n={next ? longDay(next.date).split(", ")[1] : "Finals"}
        label={next ? `Next: Week ${next.week}` : "Up next"}
        sub={next ? longDay(next.date).split(",")[0] + ` at ${leagueFacts.venueName}` : "Finals Night"}
      />
    </div>
  );
};

const MiniTable = ({ code, rows, results, limit }: { code: string; rows: LeagueSnapshot["standings"]; results: boolean; limit: number }) => {
  const all = byDivision(rows, code);
  const table = all.slice(0, limit);
  const more = all.length - table.length;
  const label = DIVISIONS.find((d) => d.code === code)?.label ?? code;
  return (
    <div className="mini">
      <div className="mini-head">
        <span>{label}</span>
        <span>Pts</span>
      </div>
      {table.map((r, i) => (
        <div key={r.playerId} className={`mini-row${results && i === 0 ? " lead" : ""}`}>
          <span className="mini-pos disp">{results ? i + 1 : "–"}</span>
          <span className="mini-name">{displayName(r.player)}</span>
          <span className="mini-rec">{results ? `${r.wins}-${r.losses}` : ""}</span>
          <span className="mini-pts">{results ? r.leaguePoints : "0"}</span>
        </div>
      ))}
      {more > 0 ? (
        <Link className="mini-more" to="/league#standings">
          + {more} more in the table
        </Link>
      ) : null}
    </div>
  );
};

/** The homepage block: the league is on, here is the table. */
export const LeagueOnHome = () => {
  const state = useLeagueLive();
  const ready = state.status === "ready" ? state.data : null;
  const results = ready ? hasResults(ready.standings) : false;

  return (
    <section className="sec-dark" style={{ padding: "96px 0" }}>
      <div className="wrap stack" style={{ gap: 36 }}>
        <div className="split">
          <div className="head">
            <p className="eyebrow">PTO League · Season 1 · The Founding Season</p>
            <h2 className="disp t-l">
              The league <span className="it">is live.</span>
            </h2>
          </div>
          <Link className="btn btn-lime" to="/league#standings">
            Full standings
          </Link>
        </div>
        <Tiles state={state} />
        {ready ? (
          <>
            <div className="g3" style={{ gap: 16 }}>
              {DIVISIONS.map((d) => (
                <MiniTable key={d.code} code={d.code} rows={ready.standings} results={results} limit={5} />
              ))}
            </div>
            <p className="body small">
              {results
                ? "Top five in each division. A win is worth 3 points; point difference breaks ties."
                : "The Founding Season roster, top five per division. The table fills in as Week 1 scores go in."}
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
};

/** The League page's standings: division tabs, the full table, matchdays. */
export const Standings = () => {
  const state = useLeagueLive();
  const [division, setDivision] = useState(DIVISIONS[0].code);
  const ready = state.status === "ready" ? state.data : null;
  const results = ready ? hasResults(ready.standings) : false;
  const table = ready ? byDivision(ready.standings, division) : [];
  const today = todayInToronto();
  const next = ready ? nextMatchday(ready.matchdays, today) : undefined;

  return (
    <section id="standings" className="sec sec-alt" style={{ padding: "96px 0" }}>
      <div className="wrap stack" style={{ gap: 28 }}>
        <div className="split">
          <div className="head">
            <p className="eyebrow">Season 1 standings</p>
            <h2 className="disp t-l">The table</h2>
          </div>
          <p className="body" style={{ fontSize: 16, maxWidth: 380 }}>
            Updated as scores go in on league Sundays. A win is worth 3 points; point difference breaks ties.
          </p>
        </div>

        <div className="tabs" role="tablist" aria-label="Division">
          {DIVISIONS.map((d) => (
            <button
              key={d.code}
              type="button"
              role="tab"
              aria-selected={division === d.code}
              className={`tab${division === d.code ? " tab-on" : ""}`}
              onClick={() => setDivision(d.code)}
            >
              {d.short}
            </button>
          ))}
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>P</th>
                <th>W</th>
                <th>L</th>
                <th>+/-</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {ready
                ? table.map((r, i) => (
                    <tr key={r.playerId} className={results && i === 0 ? "lead" : undefined}>
                      <td className="disp pos">{results ? i + 1 : "–"}</td>
                      <td className="who">{displayName(r.player)}</td>
                      <td>{r.matches}</td>
                      <td>{r.wins}</td>
                      <td>{r.losses}</td>
                      <td>{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                      <td className="pts">{r.leaguePoints}</td>
                    </tr>
                  ))
                : [0, 1, 2, 3, 4].map((i) => (
                    <tr key={i} aria-hidden="true">
                      <td className="disp pos">{i + 1}</td>
                      <td>
                        <span className="skeleton" />
                      </td>
                      <td>0</td>
                      <td>0</td>
                      <td>0</td>
                      <td>0</td>
                      <td className="pts">0</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {state.status === "error" ? (
          <p className="body small">The live table is taking a break. Check back after league night.</p>
        ) : ready && !results ? (
          <p className="body small">Week 1 scores are going in. Positions appear once results land.</p>
        ) : null}

        {ready && results ? (
          <div className="g3" style={{ gap: 16 }}>
            {leaders(ready.standings).map((l) => (
              <div key={l.division} className="leader">
                <span className="eyebrow eyebrow-leaf">{l.title}</span>
                <span className="disp leader-name">{l.player}</span>
                <span className="leader-v">{l.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        {ready && ready.matchdays.length ? (
          <div className="stack" style={{ gap: 12 }}>
            <p className="eyebrow">Matchdays</p>
            <div className="days">
              {ready.matchdays.map((m) => {
                const state = m.status === "Played" ? "done" : next && m.id === next.id ? "next" : "";
                return (
                  <div key={m.id} className={`day ${state}`}>
                    <span className="day-w">Week {m.week}</span>
                    <span className="disp day-d">{longDay(m.date).split(", ")[1]}</span>
                    <span className="day-s">{m.status === "Played" ? "Played" : state === "next" ? "Next up" : "Sunday"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};
