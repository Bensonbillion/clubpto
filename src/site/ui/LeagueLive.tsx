// The league, live: the ticker, the fixture tickets, the homepage table and
// the League page's matchday hub, all read from the league Sheet.
//
// Server render (and the first paint) shows the static shape: Sundays,
// 3 to 5 PM, District. The live numbers arrive a moment later. If the Sheet
// cannot be reached the static shape is all anyone sees, and nothing breaks.
//
// The divisions are names, not ranks (Atlas, Riviera, Venus). They always
// carry the same badge and the same weight, and nothing here numbers them.

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  DIVISIONS,
  byDivision,
  countdownLabel,
  displayName,
  divisionHasResults,
  divisionLeaders,
  divisionNames,
  lastMatchday,
  loadLeague,
  manualAsOf,
  mergeManual,
  nextMatchday,
  type LeagueSnapshot,
  type StandingRow,
} from "@/site/leagueLive";
import {
  finalsUpcoming,
  isSet,
  leagueFacts,
  longDay,
  nextThursday,
  thursday,
  todayInToronto,
  venue,
} from "@/site/content";

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

/**
 * Merged rows: the Sheet plus any manual table. While the Sheet is still
 * waking up (a cold Apps Script takes a few seconds), the manual tables
 * show straight away so the first paint already has a real table.
 */
const useRows = () => {
  const state = useLeagueLive();
  const ready = state.status === "ready" ? state.data : null;
  const rows: StandingRow[] = mergeManual(ready ? ready.standings : []);
  return { state, ready, rows };
};

/** A division's badge: its initial in a lime ring. Same for all three. */
export const Crest = ({ code, size = 28 }: { code: string; size?: number }) => {
  const d = DIVISIONS.find((x) => x.code === code);
  return (
    <span className="crest" style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden="true">
      {d ? d.short.charAt(0) : "?"}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Ticker
// ---------------------------------------------------------------------------

/** The scrolling news line under the homepage hero. Facts only. */
export const Ticker = () => {
  const { ready, rows } = useRows();
  const today = todayInToronto();
  const thu = nextThursday();
  const next = ready ? nextMatchday(ready.matchdays, today) : undefined;
  const leaders = divisionLeaders(rows);

  const items: string[] = [
    `Thursday ${longDay(thu).split(", ")[1]} · ${thursday.startTime} · ${venue.short}`,
    next ? `PTO League Week ${next.week} · ${longDay(next.date)}` : `PTO League · Sundays · ${leagueFacts.timeShort}`,
    ...leaders.map((l) => `${l.division.short} leader · ${displayName(l.row.player)} · ${l.row.leaguePoints} pts`),
    "Every level welcome",
    "COURTSIDE · our summer day party",
  ];

  const run = (key: string) => (
    <div className="ticker-run" key={key} aria-hidden={key !== "a"}>
      {items.map((t) => (
        <span key={t} className="ticker-item">
          {t}
        </span>
      ))}
    </div>
  );

  return (
    <div className="ticker" role="marquee" aria-label="What's on at Club PTO">
      <div className="ticker-track">
        {run("a")}
        {run("b")}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Fixture tickets (homepage "Up next")
// ---------------------------------------------------------------------------

const Ticket = ({
  stub,
  tone = "",
  eyebrow,
  title,
  meta,
  foot,
}: {
  stub: ReactNode;
  tone?: "" | "dark" | "lime";
  eyebrow: string;
  title: string;
  meta: string;
  foot: ReactNode;
}) => (
  <article className={`ticket${tone ? ` ticket-${tone}` : ""}`}>
    <div className="stub">{stub}</div>
    <div className="tk-body">
      <p className="eyebrow">{eyebrow}</p>
      <h3 className="disp tk-title">{title}</h3>
      <p className="tk-meta">{meta}</p>
      <div className="tk-foot">{foot}</div>
    </div>
  </article>
);

const DateStub = ({ ymd }: { ymd: string }) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  const wd = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const mo = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return (
    <>
      <span className="stub-wd">{wd}</span>
      <span className="disp stub-day">{d.getUTCDate()}</span>
      <span className="stub-mo">{mo}</span>
    </>
  );
};

export const UpNext = () => {
  const { ready } = useRows();
  const today = todayInToronto();
  const thu = nextThursday();
  const next = ready ? nextMatchday(ready.matchdays, today) : undefined;

  return (
    <section className="upnext">
      <div className="wrap stack" style={{ gap: 22 }}>
        <div className="split">
          <h2 className="disp t-m">Up next</h2>
          <Link className="link-strong" to="/events">
            Everything on
          </Link>
        </div>
        <div className="rail rail-3">
          <Ticket
            stub={<DateStub ymd={thu} />}
            eyebrow={`Weekly meet · ${countdownLabel(thu, today)}`}
            title="Thursday night padel"
            meta={`${thursday.startTime} to ${thursday.endTime} · Three courts, split by level`}
            foot={
              <>
                <span className="tk-price">
                  {thursday.price} <small>incl. HST</small>
                </span>
                <a className="btn btn-dark btn-sm" href={thursday.bookingUrl}>
                  Book
                </a>
              </>
            }
          />
          <Ticket
            tone="dark"
            stub={next ? <DateStub ymd={next.date} /> : <span className="stub-wd">Sundays</span>}
            eyebrow={next ? `PTO League · Week ${next.week} · ${countdownLabel(next.date, today)}` : "PTO League"}
            title="Matchday"
            meta={`${leagueFacts.timeShort} · ${venue.short} · ${divisionNames()}`}
            foot={
              <>
                <span className="tk-price">Live table</span>
                <Link className="btn btn-lime btn-sm" to="/league#standings">
                  Standings
                </Link>
              </>
            }
          />
          {finalsUpcoming() ? (
            <Ticket
              tone="lime"
              stub={
                isSet(leagueFacts.finalsDate) ? (
                  <DateStub ymd={leagueFacts.finalsDate} />
                ) : (
                  <span className="stub-wd">Season 1</span>
                )
              }
              eyebrow="Coming up"
              title="Finals Night"
              meta="Three titles on the line. Trophies, awards and the whole league in one room."
              foot={
                <>
                  <span className="tk-price">{isSet(leagueFacts.finalsDate) ? "Be there" : "Date coming soon"}</span>
                  <Link className="btn btn-dark btn-sm" to="/league">
                    The league
                  </Link>
                </>
              }
            />
          ) : (
            <Ticket
              tone="lime"
              stub={<span className="stub-wd">Season 2</span>}
              eyebrow="Next up"
              title="Season 2"
              meta="Get on the list. You hear the dates before anyone else."
              foot={
                <Link className="btn btn-dark btn-sm" to="/league#season-2">
                  Get on the list
                </Link>
              }
            />
          )}
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// Standings card (shared by the homepage and the League page)
// ---------------------------------------------------------------------------

const DivisionTabs = ({ value, onChange }: { value: string; onChange: (code: string) => void }) => (
  <div className="dtabs" role="tablist" aria-label="Division">
    {DIVISIONS.map((d) => (
      <button
        key={d.code}
        type="button"
        role="tab"
        aria-selected={value === d.code}
        className={`dtab${value === d.code ? " on" : ""}`}
        onClick={() => onChange(d.code)}
      >
        <Crest code={d.code} size={22} />
        {d.short}
      </button>
    ))}
  </div>
);

const EmptyDivision = ({ code }: { code: string }) => {
  const d = DIVISIONS.find((x) => x.code === code);
  return (
    <div className="dempty">
      <Crest code={code} size={56} />
      <p className="disp dempty-t">{d?.label} standings are on the way.</p>
      <p className="body small">They go up here as soon as this division's scores are in.</p>
    </div>
  );
};

/** First division with results, so the card opens on a table, not an empty state. */
const firstWithResults = (rows: StandingRow[]) =>
  DIVISIONS.find((d) => divisionHasResults(rows, d.code))?.code ?? DIVISIONS[0].code;

const ShortTable = ({ rows, code, limit }: { rows: StandingRow[]; code: string; limit?: number }) => {
  const all = byDivision(rows, code);
  const table = limit ? all.slice(0, limit) : all;
  return (
    <div className="stbl" role="table" aria-label={`${DIVISIONS.find((d) => d.code === code)?.label} standings`}>
      <div className="stbl-row stbl-head" role="row">
        <span role="columnheader">#</span>
        <span role="columnheader">Player</span>
        <span role="columnheader" className="c-p">
          P
        </span>
        <span role="columnheader">W-L</span>
        <span role="columnheader">+/-</span>
        <span role="columnheader">Pts</span>
      </div>
      {table.map((r, i) => (
        <div key={r.playerId} role="row" className={`stbl-row${i === 0 ? " lead" : ""}`}>
          <span role="cell" className="disp s-pos">
            {i + 1}
          </span>
          <span role="cell" className="s-name">
            {displayName(r.player)}
          </span>
          <span role="cell" className="c-p">
            {r.matches}
          </span>
          <span role="cell">
            {r.wins}-{r.losses}
          </span>
          <span role="cell">{r.diff > 0 ? `+${r.diff}` : r.diff}</span>
          <span role="cell" className="s-pts">
            {r.leaguePoints}
          </span>
        </div>
      ))}
    </div>
  );
};

const StandingsCard = ({ limit, footLink }: { limit?: number; footLink?: boolean }) => {
  const { state, ready, rows } = useRows();
  const [picked, setPicked] = useState<string | null>(null);
  const code = picked ?? firstWithResults(rows);
  const results = divisionHasResults(rows, code);
  const asOf = manualAsOf(ready ? ready.standings : [], code);
  const short = DIVISIONS.find((d) => d.code === code)?.short;

  return (
    <div className="scard">
      <DivisionTabs value={code} onChange={setPicked} />
      {state.status === "loading" && !results ? (
        <div className="dempty" aria-busy="true">
          <span className="skeleton" style={{ width: "60%" }} />
          <span className="skeleton" style={{ width: "80%" }} />
          <span className="skeleton" style={{ width: "50%" }} />
        </div>
      ) : state.status === "error" && !results ? (
        <div className="dempty">
          <p className="disp dempty-t">The live table is taking a break.</p>
          <p className="body small">Check back after league Sunday.</p>
        </div>
      ) : results ? (
        <>
          <ShortTable rows={rows} code={code} limit={limit} />
          <div className="scard-foot">
            <span>
              {short}
              {asOf ? ` · ${asOf}` : ""}
            </span>
            {footLink ? (
              <Link to="/league#standings" className="link-strong">
                Full table →
              </Link>
            ) : (
              <span>3 points a win</span>
            )}
          </div>
        </>
      ) : (
        <EmptyDivision code={code} />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Homepage league block
// ---------------------------------------------------------------------------

export const LeagueOnHome = () => {
  const { rows } = useRows();
  const leaders = divisionLeaders(rows);

  return (
    <section className="sec-dark league-home">
      <div className="wrap league-home-grid">
        <div className="stack" style={{ gap: 20 }}>
          <p className="eyebrow">PTO League · Season 1 · The Founding Season</p>
          <h2 className="disp t-l">
            Time to see where <span className="it">you actually rank.</span>
          </h2>
          <p className="body" style={{ maxWidth: 420 }}>
            Seven Sundays. Rotating partners. Your name on the table, and every match counts toward Finals Night.
          </p>
          {leaders.length ? (
            <div className="leaders-mini">
              {leaders.map((l) => (
                <div key={l.division.code} className="lm">
                  <Crest code={l.division.code} size={34} />
                  <div className="stack" style={{ gap: 2 }}>
                    <span className="lm-k">{l.division.short} leader</span>
                    <span className="disp lm-v">{displayName(l.row.player)}</span>
                  </div>
                  <span className="lm-p">
                    {l.row.leaguePoints}
                    <small> pts</small>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="cta-row">
            <Link className="btn btn-lime" to="/league#standings">
              See the full table
            </Link>
            <Link className="btn btn-cream" to="/league">
              How the league works
            </Link>
          </div>
        </div>
        <StandingsCard limit={5} footLink />
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// League page: matchday hub and full standings
// ---------------------------------------------------------------------------

export const MatchdayBand = () => {
  const { ready, rows } = useRows();
  const today = todayInToronto();
  const next = ready ? nextMatchday(ready.matchdays, today) : undefined;
  const last = ready ? lastMatchday(ready.matchdays) : undefined;
  const leaders = divisionLeaders(rows);

  return (
    <section className="mband">
      <div className="wrap mband-grid">
        <div className="mcard mcard-next">
          <p className="eyebrow">Next matchday{next ? ` · ${countdownLabel(next.date, today)}` : ""}</p>
          <p className="disp mcard-big">{next ? longDay(next.date) : "Sundays"}</p>
          <p className="mcard-meta">
            {next ? `Week ${next.week} · ` : ""}
            {leagueFacts.timeShort} · {venue.name}
          </p>
        </div>
        <div className="mcard">
          <p className="eyebrow">{last ? `Last time · Week ${last.week} · ${longDay(last.date)}` : "Season 1"}</p>
          {leaders.length ? (
            <div className="stack" style={{ gap: 10 }}>
              {leaders.map((l) => (
                <div key={l.division.code} className="lm lm-light">
                  <Crest code={l.division.code} size={34} />
                  <div className="stack" style={{ gap: 2 }}>
                    <span className="lm-k">{l.division.short} leader</span>
                    <span className="disp lm-v">{displayName(l.row.player)}</span>
                  </div>
                  <span className="lm-p">
                    {l.row.wins}-{l.row.losses} · {l.row.leaguePoints}
                    <small> pts</small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="disp mcard-big">Scores going in</p>
          )}
        </div>
      </div>
    </section>
  );
};

export const Standings = () => {
  const { ready } = useRows();
  const today = todayInToronto();
  const next = ready ? nextMatchday(ready.matchdays, today) : undefined;

  return (
    <section id="standings" className="sec-alt standings-sec">
      <div className="wrap stack" style={{ gap: 28 }}>
        <div className="split">
          <div className="head">
            <p className="eyebrow">Season 1 standings</p>
            <h2 className="disp t-l">The table</h2>
          </div>
          <p className="body" style={{ fontSize: 16, maxWidth: 380 }}>
            Updates after every league Sunday. 3 points a win, and point difference breaks ties. No hiding.
          </p>
        </div>

        <StandingsCard />

        {ready && ready.matchdays.length ? (
          <div className="stack" style={{ gap: 12 }}>
            <p className="eyebrow">Matchdays</p>
            <div className="days">
              {ready.matchdays.map((m) => {
                const tone = m.status === "Played" ? "done" : next && m.id === next.id ? "next" : "";
                return (
                  <div key={m.id} className={`day ${tone}`}>
                    <span className="day-w">Week {m.week}</span>
                    <span className="disp day-d">{longDay(m.date).split(", ")[1]}</span>
                    <span className="day-s">
                      {m.status === "Played" ? "Played" : tone === "next" ? countdownLabel(m.date, today) : "Sunday"}
                    </span>
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
