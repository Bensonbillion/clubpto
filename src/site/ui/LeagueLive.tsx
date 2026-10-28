// The league, live: the ticker, the fixture tickets, the homepage table and
// the League page's matchday hub, all read from the league Sheet.
//
// A returning visitor's first paint already has the last table this browser
// saw, and a newer one swaps in quietly if there is one. A first visit shows
// the static shape (Sundays, 3 to 5 PM, District) until the table arrives,
// usually from the copy baked into the build. If nothing can be reached the
// static shape is all anyone sees, and nothing breaks.
//
// The divisions are names, not ranks (Atlas, Riviera, Venus). They always
// carry the same badge and the same weight, and nothing here numbers them.

import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  DIVISIONS,
  byDivision,
  countdownLabel,
  displayName,
  divisionHasResults,
  divisionLeaders,
  divisionNames,
  freshLeague,
  lastMatchday,
  loadLeague,
  manualAsOf,
  mergeManual,
  nextMatchday,
  savedLeague,
  weeksWithTables,
  type LeagueSnapshot,
  type Matchday,
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

/** The table this browser saw last, on the very first render, so a returning visitor never sees the skeleton. */
const initialState = (): State => {
  const saved = savedLeague();
  return saved ? { status: "ready", data: saved } : { status: "loading" };
};

export const useLeagueLive = (): State => {
  const [state, setState] = useState<State>(initialState);
  useEffect(() => {
    let alive = true;
    // With a saved copy, loadLeague answers at once from it with no request
    // (the state already has it). Without one, it is the quickest of the
    // baked copy and the network. It is called either way so that a copy
    // another component saved after this one first rendered still shows.
    loadLeague()
      .then(
        (data) => {
          if (alive) setState((s) => (s.status === "ready" ? s : { status: "ready", data }));
          return freshLeague();
        },
        () => {
          // Nothing at all to show. The network read just failed, so it is
          // not asked again; a table already showing is never replaced.
          if (alive) setState((s) => (s.status === "ready" ? s : { status: "error" }));
          return null;
        },
      )
      .then((newer) => {
        // A newer table from the background read. A failed one is null, and
        // whatever is showing stays.
        if (alive && newer) setState({ status: "ready", data: newer });
      });
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
            All events
          </Link>
        </div>
        <div className="rail rail-3" role="region" aria-label="Up next" tabIndex={0}>
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
                  Grab a pass
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

const EmptyDivision = ({ code, week }: { code: string; week?: Matchday | null }) => {
  const d = DIVISIONS.find((x) => x.code === code);
  return (
    <div className="dempty">
      <Crest code={code} size={56} />
      <p className="disp dempty-t">
        {d?.label} {week ? `Week ${week.week} ` : ""}standings are on the way.
      </p>
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

/**
 * The table card. With a `week`, it shows only that matchday's games
 * (LeagueSnapshot.weeks); without one, the season so far.
 */
const StandingsCard = ({ limit, footLink, week }: { limit?: number; footLink?: boolean; week?: Matchday | null }) => {
  const { state, ready, rows: seasonRows } = useRows();
  const rows: StandingRow[] = week ? (ready?.weeks?.[week.id] ?? []) : seasonRows;
  const [picked, setPicked] = useState<string | null>(null);
  const code = picked ?? firstWithResults(rows);
  const results = divisionHasResults(rows, code);
  const last = ready ? lastMatchday(ready.matchdays) : undefined;
  const asOf = week
    ? `Week ${week.week} only · ${longDay(week.date).split(", ")[1]}`
    : (manualAsOf(ready ? ready.standings : [], code) ?? (results && last ? `After Week ${last.week}` : null));
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
        <EmptyDivision code={code} week={week} />
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

/** The page's own address for one week's table, for posting: clubpto.com/league?week=3. */
export const weekLink = (week: number, origin = typeof window === "undefined" ? "https://clubpto.com" : window.location.origin) =>
  `${origin}/league?week=${week}#standings`;

/** "Copy link" for the week on show. Says "Copied" for a moment, or nothing if the browser won't copy. */
const CopyWeekLink = ({ week }: { week: number }) => {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [week]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(weekLink(week));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (an old browser, or permission refused): the address bar has the link anyway.
    }
  };
  return (
    <button type="button" className="link-strong wcopy" onClick={copy}>
      {copied ? "Link copied" : `Copy the Week ${week} link`}
    </button>
  );
};

/**
 * The League page's table. Season by default; pick a week (the buttons, a
 * played matchday below, or ?week=3 in the address) to see only that
 * Sunday's games. The week goes in the address so each week has a link of
 * its own to share.
 */
export const Standings = () => {
  const { ready } = useRows();
  const today = todayInToronto();
  const next = ready ? nextMatchday(ready.matchdays, today) : undefined;
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const weeks = ready ? weeksWithTables(ready) : [];
  const asked = Number(params.get("week"));
  const week = weeks.find((m) => m.week === asked) ?? null;

  // The hash stays as it is: the layout scrolls to the top whenever the hash
  // changes, and picking a week should leave the page where it is.
  const show = (w: Matchday | null) => {
    const out = new URLSearchParams(params);
    if (w) out.set("week", String(w.week));
    else out.delete("week");
    const search = out.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "", hash: location.hash }, { replace: true });
  };

  return (
    <section id="standings" className="sec-alt standings-sec">
      <div className="wrap stack" style={{ gap: 28 }}>
        <div className="split">
          <div className="head">
            <p className="eyebrow">{week ? `Week ${week.week} · ${longDay(week.date)}` : "Season 1 standings"}</p>
            <h2 className="disp t-l">{week ? `Week ${week.week} table` : "The table"}</h2>
          </div>
          <p className="body" style={{ fontSize: 16, maxWidth: 380 }}>
            {week
              ? `Just the games from Week ${week.week}. 3 points a win, and point difference breaks ties.`
              : "Updates after every league Sunday. 3 points a win, and point difference breaks ties. No hiding."}
          </p>
        </div>

        {weeks.length ? (
          <div className="wbar">
            <div className="wtabs" role="tablist" aria-label="Season or one week">
              <button
                type="button"
                role="tab"
                aria-selected={!week}
                className={`wtab${!week ? " on" : ""}`}
                onClick={() => show(null)}
              >
                Season
              </button>
              {weeks.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={week?.id === m.id}
                  className={`wtab${week?.id === m.id ? " on" : ""}`}
                  onClick={() => show(m)}
                >
                  Week {m.week}
                </button>
              ))}
            </div>
            {week ? <CopyWeekLink week={week.week} /> : null}
          </div>
        ) : null}

        <StandingsCard week={week} />

        {ready && ready.matchdays.length ? (
          <div className="stack" style={{ gap: 12 }}>
            <p className="eyebrow">Matchdays</p>
            <div className="days" role="region" aria-label="Matchdays" tabIndex={0}>
              {ready.matchdays.map((m) => {
                const tone = m.status === "Played" ? "done" : next && m.id === next.id ? "next" : "";
                const body = (
                  <>
                    <span className="day-w">Week {m.week}</span>
                    <span className="disp day-d">{longDay(m.date).split(", ")[1]}</span>
                    <span className="day-s">
                      {m.status === "Played" ? "Played" : tone === "next" ? countdownLabel(m.date, today) : "Sunday"}
                    </span>
                  </>
                );
                // A played Sunday with a table opens that week's table.
                return weeks.some((w) => w.id === m.id) ? (
                  <button
                    key={m.id}
                    type="button"
                    className={`day ${tone} day-btn${week?.id === m.id ? " on" : ""}`}
                    aria-pressed={week?.id === m.id}
                    aria-label={`Week ${m.week} table`}
                    onClick={() => {
                      show(m);
                      document.getElementById("standings")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
                    }}
                  >
                    {body}
                  </button>
                ) : (
                  <div key={m.id} className={`day ${tone}`}>
                    {body}
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
