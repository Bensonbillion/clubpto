// Clubhouse sections (Wave 3). Every section renders from the pure
// view-model only — no Supabase reads in here, no tier data anywhere.
// Empty states are first-class: the room is warm before the first publish.

import { useState } from "react";
import type { ClubhouseView, MyView, ProfileView, RecapView } from "./viewmodel";
import type { MemberPrefs } from "../data/reads";
import { milestoneClubName } from "../derive/stats";

// The archive is permanent (REC-5), so the year is always shown.
const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="clb-empty">{children}</p>
);

const SectionHead = ({ kicker, title }: { kicker: string; title: React.ReactNode }) => (
  <>
    <p className="clb-kicker">{kicker}</p>
    <h2 className="clb-title">{title}</h2>
  </>
);

// ---------------------------------------------------------------------------
// Dashboard (DASH-1..7)
// ---------------------------------------------------------------------------

export function Dashboard({
  me,
  prefs,
  onPrefs,
  saving,
  notice,
}: {
  me: MyView;
  prefs: MemberPrefs;
  onPrefs: (p: MemberPrefs) => void;
  saving: boolean;
  notice?: string | null;
}) {
  return (
    <section className="clb-section" id="you">
      <SectionHead kicker="Your seat" title={<>The numbers, {me.name}.</>} />
      <div className="clb-statgrid">
        <div className="clb-stat"><b>{me.sessions}</b><span>Sessions</span></div>
        <div className="clb-stat"><b>{me.games}</b><span>Games</span></div>
        <div className="clb-stat"><b>{me.wins}-{me.losses}</b><span>Won-Lost</span></div>
        <div className="clb-stat clb-stat--spark"><b>{me.championships}</b><span>Titles</span></div>
        <div className="clb-stat clb-stat--spark"><b>{me.ptoPoints}</b><span>PTO Points</span></div>
        {me.weekStreak.current > 1 && (
          <div className="clb-stat"><b>{me.weekStreak.current}</b><span>Week streak</span></div>
        )}
        {me.rank !== null && (
          <div className="clb-stat"><b>#{me.rank}</b><span>Points rank</span></div>
        )}
      </div>

      <div style={{ marginTop: "1.4rem", display: "grid", gap: "0.6rem" }}>
        {me.nextClub && (
          <p className="clb-dim" style={{ fontSize: 15.5 }}>
            {me.nextClub.toGo === 1
              ? `One session from ${me.nextClub.name}.`
              : `${me.nextClub.toGo} sessions from ${me.nextClub.name}.`}{" "}
            Whether you win or lose, you're in.
          </p>
        )}
        {me.weekStreak.best > 1 && (
          <p className="clb-dim" style={{ fontSize: 15.5 }}>
            Personal best: {me.weekStreak.best} weeks in a row.
          </p>
        )}
        {me.winPctDisplay && (
          <p className="clb-dim" style={{ fontSize: 15.5 }}>Win rate: {me.winPctDisplay}.</p>
        )}
      </div>

      <div style={{ marginTop: "1.8rem", display: "grid", gap: "0.7rem" }}>
        <label className="clb-toggle">
          <input
            type="checkbox"
            checked={prefs.showWinpct}
            disabled={saving}
            onChange={(e) => onPrefs({ ...prefs, showWinpct: e.target.checked })}
          />
          Show my win rate to other members
        </label>
        <label className="clb-toggle">
          <input
            type="checkbox"
            checked={prefs.showRank}
            disabled={saving}
            onChange={(e) => onPrefs({ ...prefs, showRank: e.target.checked })}
          />
          Show me my points rank (private, only you see it)
        </label>
        {notice && (
          <p className="rly-mono" style={{ fontSize: 15, color: "var(--volt)" }} role="alert">
            {notice}
          </p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Recaps (REC-1..5) — expandable archive, newest first
// ---------------------------------------------------------------------------

function Recap({ r, open, onToggle }: { r: RecapView; open: boolean; onToggle: () => void }) {
  return (
    <article className="clb-recap">
      <header onClick={onToggle}>
        <h3>{fmtDate(r.date)}</h3>
        <span className="meta">{r.venue}</span>
        <span className="meta">{r.attendanceCount} in the room</span>
        {r.practiceOnly ? (
          <span className="meta">Practice night</span>
        ) : (
          <span className="meta">{r.gamesPlayed} games</span>
        )}
      </header>
      {open && (
        <div style={{ marginTop: "1rem" }}>
          {r.recapNote && (
            <p style={{ fontSize: 15.5, lineHeight: 1.65, marginBottom: "0.9rem" }}>{r.recapNote}</p>
          )}
          {r.honors.map((h, i) => (
            <div key={i} className={`clb-honor${h.finalist ? " clb-honor--finalist" : ""}`}>
              <span className="t">{h.finalist ? `${h.title} · Finalists` : h.title}</span>
              <span>{h.names.join(" + ")}</span>
              <span className="pts">+{h.points} pts each</span>
            </div>
          ))}
          {r.notables.map((n, i) => (
            <p key={i} className="clb-notable">{n.text}</p>
          ))}
          {r.shoutouts?.map((s, i) => (
            <p key={`s${i}`} className="clb-notable">{s}</p>
          ))}
          {r.practiceOnly && (
            <p className="clb-dim" style={{ fontSize: 15 }}>
              Practice nights stay off the boards. Good hits, no scores.
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export function Recaps({ recaps }: { recaps: RecapView[] }) {
  const [open, setOpen] = useState<string | null>(recaps[0]?.sessionId ?? null);
  return (
    <section className="clb-section" id="recaps">
      <SectionHead kicker="Session recaps" title="How the nights went." />
      {recaps.length === 0 ? (
        <Empty>Your first recap lands here after the next session. Play Wednesday.</Empty>
      ) : (
        recaps.map((r) => (
          <Recap
            key={r.sessionId}
            r={r}
            open={open === r.sessionId}
            onToggle={() => setOpen(open === r.sessionId ? null : r.sessionId)}
          />
        ))
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Champions wall + records (CHW-1..3) — the one cream beat
// ---------------------------------------------------------------------------

export function WallRecords({ view }: { view: ClubhouseView }) {
  const withHonors = view.recaps.filter((r) => r.honors.length > 0);
  return (
    <div className="clb-chalk">
      <section className="clb-section" id="wall">
        <SectionHead kicker="The champions wall" title="Names go up. They stay up." />
        {withHonors.length === 0 ? (
          <Empty>
            The wall is waiting for its first names. Every champion from every
            session lives here, forever.
          </Empty>
        ) : (
          withHonors.map((r) => (
            <div key={r.sessionId} style={{ marginBottom: "1.6rem" }}>
              <p className="clb-dim" style={{ fontFamily: "var(--f-mono)", fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.3rem" }}>
                {fmtDate(r.date)} · {r.venue}
              </p>
              {r.honors.map((h, i) => (
                <div key={i} className={`clb-honor${h.finalist ? " clb-honor--finalist" : ""}`}>
                  <span className="t">{h.finalist ? `${h.title} · Finalists` : h.title}</span>
                  <span>{h.names.join(" + ")}</span>
                  <span className="pts">+{h.points}</span>
                </div>
              ))}
            </div>
          ))
        )}

        {view.records.length > 0 && (
          <div style={{ marginTop: "2.6rem" }}>
            <p className="clb-kicker">The records book</p>
            {view.records.map((rec) => (
              <div key={rec.label} className="clb-honor">
                <span className="t">{rec.label}</span>
                <span>{rec.holder}</span>
                <span className="pts">{rec.value}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Boards + milestone clubs (LB-1..4, MILE-1)
// ---------------------------------------------------------------------------

function Board({ title, rows, unit }: { title: string; rows: ClubhouseView["boards"]["points"]; unit?: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="clb-board">
      <h3>{title}</h3>
      <ol>
        {rows.map((r, i) => (
          <li key={r.playerId}>
            <span className="n">{i + 1}.</span>
            <span>{r.name}</span>
            <span className="dots" />
            <span className="v">{r.display}{unit}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Boards({ view }: { view: ClubhouseView }) {
  const { points, attendance, games, winpct } = view.boards;
  const anything = points.length + attendance.length + games.length + winpct.length > 0;
  return (
    <section className="clb-section" id="boards">
      <SectionHead kicker="Top ten only" title="Boards for the top. Clubs for everyone." />
      {!anything ? (
        <Empty>The boards start counting at the first session.</Empty>
      ) : (
        <div className="clb-boards">
          <Board title="PTO Points" rows={points} />
          <Board title="Sessions" rows={attendance} />
          <Board title="Games played" rows={games} />
          <Board title="Win rate · 8 games min" rows={winpct} />
        </div>
      )}

      <div style={{ marginTop: "2.6rem" }}>
        <p className="clb-kicker">Milestone clubs</p>
        <div className="clb-clubs">
          {view.milestoneClubs.map((c) => (
            <div key={c.threshold} className="clb-club">
              <b>{c.threshold}</b>
              <h4>{c.name}</h4>
              <p>
                {c.members.length === 0
                  ? "Doors open. Show up, you're in."
                  : c.members.join(", ")}
              </p>
            </div>
          ))}
        </div>
        <p className="clb-dim" style={{ marginTop: "0.9rem", fontSize: 14.5 }}>
          Earned by showing up, never by winning.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Players + profiles + rivalries (PROF-1..3)
// ---------------------------------------------------------------------------

function Profile({ p }: { p: ProfileView }) {
  return (
    <div className="clb-profile">
      <div className="clb-statgrid">
        <div className="clb-stat"><b>{p.sessions}</b><span>Sessions</span></div>
        <div className="clb-stat"><b>{p.games}</b><span>Games</span></div>
        <div className="clb-stat"><b>{p.championships}</b><span>Titles</span></div>
        <div className="clb-stat clb-stat--spark"><b>{p.ptoPoints}</b><span>PTO Points</span></div>
      </div>
      <div style={{ marginTop: "0.9rem", display: "grid", gap: "0.3rem" }}>
        {p.winPctDisplay && <p className="clb-dim" style={{ fontSize: 15 }}>Win rate {p.winPctDisplay}</p>}
        {p.bestWinStreak > 1 && <p className="clb-dim" style={{ fontSize: 15 }}>Best win streak {p.bestWinStreak}</p>}
      </div>
      {p.rivalries.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <p className="clb-kicker" style={{ fontSize: 14 }}>Rivalries</p>
          {p.rivalries.slice(0, 5).map((r) => (
            <p key={r.vsName} className="clb-rivalry">
              vs {r.vsName} <span className="rec">{r.wins}-{r.losses}</span> in {r.meetings} meetings
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function Players({ view }: { view: ClubhouseView }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const filtered = view.profiles.filter((p) =>
    p.name.toLowerCase().includes(search.trim().toLowerCase())
  );
  return (
    <section className="clb-section" id="players">
      <SectionHead kicker="The room" title="Everyone who plays." />
      <div className="rly-form" style={{ marginBottom: "1.2rem", maxWidth: 420 }}>
        <label>
          Find a player
          <input type="text" value={search} placeholder="First name" onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>
      <div className="clb-players">
        {filtered.slice(0, 40).map((p) => (
          <div key={p.playerId}>
            <button
              className="clb-player"
              style={{ width: "100%" }}
              onClick={() => setOpen(open === p.playerId ? null : p.playerId)}
            >
              <span>{p.name}</span>
              <span className="badges">
                {p.milestones.length > 0 && (
                  <span
                    className="clb-badge"
                    title={`Member of ${milestoneClubName(Math.max(...p.milestones))}`}
                  >
                    {Math.max(...p.milestones)} Club
                  </span>
                )}
                {p.championships > 0 && (
                  <span
                    className="clb-badge clb-badge--title"
                    title={`${p.championships} ${p.championships === 1 ? "title" : "titles"}`}
                  >
                    ★ {p.championships}
                  </span>
                )}
              </span>
            </button>
            {open === p.playerId && <Profile p={p} />}
          </div>
        ))}
        {filtered.length === 0 && <Empty>No match. Fewer letters usually does it.</Empty>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Mosaic (MOS-1/2) — every attendee is one pixel of the P
// ---------------------------------------------------------------------------

export function Mosaic({ view, myPlayerId }: { view: ClubhouseView; myPlayerId: string | null }) {
  const cols = view.mosaic[0]?.length ?? 5;
  const anyFilled = view.mosaic.flat().some((c) => c.filled);
  // Touch has no hover, so the name is also a tap target (phone-first).
  const [tapped, setTapped] = useState<string | null>(null);
  return (
    <section className="clb-section" id="mosaic">
      <SectionHead kicker="The mosaic" title="You're a pixel of the P." />
      <div className="clb-mosaic" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {view.mosaic.flat().map((c, i) => {
          const off = (c as { off?: boolean }).off;
          const cls = off
            ? "clb-cell clb-cell--off"
            : c.filled
              ? c.playerId === myPlayerId
                ? "clb-cell clb-cell--filled clb-cell--me"
                : "clb-cell clb-cell--filled"
              : "clb-cell";
          if (off) return <div key={i} className={cls} aria-hidden="true" />;
          return (
            <button
              key={i}
              type="button"
              className={cls}
              data-name={c.name}
              title={c.name}
              aria-label={c.name ?? "Empty square"}
              disabled={!c.filled}
              onClick={() => setTapped(c.name ?? null)}
            />
          );
        })}
      </div>
      {tapped && (
        <p className="rly-mono" style={{ marginTop: "0.8rem", fontSize: 17, color: "var(--volt)" }} role="status">
          {tapped}
        </p>
      )}
      <p className="clb-dim" style={{ marginTop: "1rem", fontSize: 14.5 }}>
        {anyFilled
          ? "One square per player, in order of first night. Tap a square for the name."
          : "Squares fill as sessions land. Yours will glow."}
      </p>
    </section>
  );
}
