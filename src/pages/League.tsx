// PTO League. Season 1 copy follows the approved Founding Season page
// (scoring, coverage), corrected to the season as it actually runs: three
// divisions (Atlas, Riviera, Venus), seven Sundays. The live table
// comes from the league Sheet (src/site/ui/LeagueLive.tsx), showing first
// names and last initials exactly as the Sheet has them.

import { photos } from "@/site/photos";
import { isSet, leagueFacts, leagueInPlay, season2, venue } from "@/site/content";
import { Head, Photo, Qa, usePagePreview } from "@/site/ui/bits";
import { SiteForm, type FormField } from "@/site/ui/forms";
import { MatchdayBand, Standings } from "@/site/ui/LeagueLive";

const waitlistFields: readonly FormField[] = [
  { name: "first", label: "First name", required: true, autoComplete: "given-name", half: true },
  { name: "last", label: "Last name", required: true, autoComplete: "family-name", half: true },
  { name: "email", label: "Email", type: "email", required: true, autoComplete: "email", placeholder: "you@email.com" },
  { name: "instagram", label: "Instagram handle", placeholder: "@yourhandle" },
  {
    name: "division",
    label: "Division",
    type: "select",
    options: ["Men's Division", "Women's Division"],
    half: true,
  },
  {
    name: "experience",
    label: "Your level",
    type: "select",
    options: ["Played a few times", "Play most weeks", "Intermediate or better"],
    half: true,
  },
  { name: "season1", label: "Played Season 1?", type: "select", options: ["Not yet", "Yes"] },
];

const PlayerCard = () => (
  <article
    aria-label="Example player card"
    style={{
      width: 380,
      maxWidth: "100%",
      background: "#F5EFE3",
      color: "#0E2418",
      transform: "rotate(3deg)",
      boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
      border: "2px solid #D9E270",
    }}
  >
    <div style={{ height: 340, overflow: "hidden", position: "relative" }}>
      <Photo photo={photos.leagueReady} priority sizes="(max-width: 900px) 90vw, 380px" />
      <span
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          background: "#D9E270",
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.12em",
        }}
      >
        PTO · S01
      </span>
    </div>
    <div style={{ padding: "22px 24px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <p className="eyebrow" style={{ color: "#2F5A3A" }}>
          Your division
        </p>
        <p className="disp" style={{ fontSize: 40, color: "#0E2418" }}>
          Your name
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
          borderTop: "2px solid #0E2418",
          paddingTop: 14,
        }}
      >
        {[
          ["Rank", "#?"],
          ["Points", "0"],
          ["Record", "0-0"],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="eyebrow" style={{ fontSize: 11, color: "#0E2418" }}>
              {k}
            </p>
            <p className="disp" style={{ fontSize: 29, color: "#0E2418" }}>
              {v}
            </p>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="eyebrow" style={{ fontSize: 11, marginRight: 6, color: "#0E2418" }}>
          Form
        </span>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} style={{ width: 22, height: 22, border: "2px solid #0E2418", borderRadius: "50%" }} />
        ))}
      </div>
    </div>
  </article>
);

const perks = [
  {
    title: "Your name on the table",
    text: "A real spot in the standings, updated after every Sunday. Screenshot it for the group chat.",
  },
  {
    title: "A new test every Sunday",
    text: "Different partners, different opponents, and a fresh chance to move up the table each week.",
  },
  {
    title: "Your moments",
    text: "Highlights, reactions and player features all season. Play well and you end up on the feed.",
  },
  {
    title: "Your new weekly thing",
    text: "Seven Sundays on the calendar, and no points for the ones you skip. The table keeps you honest.",
  },
  {
    title: "Something to play for",
    text: "Prizes, bragging rights and the very first PTO League trophy in each division.",
    lime: true,
  },
  {
    title: "Bring a friend, if you dare",
    text: "Sign up together, get ranked apart. Just know you might end up across the net.",
  },
];

const League = () => {
  usePagePreview("/league");

  const inPlay = leagueInPlay();

  return (
    <>
      <section className="sec-dark sec-hero league-hero">
        <div className="wrap g2" style={{ alignItems: "center" }}>
          <div className="stack" style={{ gap: 26 }}>
            <p className="eyebrow">PTO League · Season 1 · The Founding Season</p>
            {inPlay ? (
              <h1 className="disp t-big">
                The race to the top <span className="it">is on.</span>
              </h1>
            ) : (
              <h1 className="disp t-big">
                A rec league with <span className="it">pro‑sports energy.</span>
              </h1>
            )}
            <p className="lede measure">
              Seven Sundays. Rotating partners. Your own ranking, and a Finals Night at the end of it.
              {inPlay ? " Season 1 is in play now." : ""}
            </p>
            <div className="facts">
              <div className="fact">
                <span>When</span>
                <span>Sundays · {leagueFacts.timeShort}</span>
              </div>
              <div className="fact">
                <span>Where</span>
                <span>
                  {venue.short}, {venue.address}
                </span>
              </div>
              <div className="fact">
                <span>Format</span>
                <span>Americano, a new partner every round. Three divisions: Atlas, Riviera and Venus</span>
              </div>
            </div>
            <div className="cta-row">
              <a className="btn btn-lime" href="#season-2">
                Get on the Season 2 list
              </a>
              <a className="btn btn-cream" href="#how">
                How it works
              </a>
            </div>
          </div>
          <div className="league-hero-card">
            <PlayerCard />
          </div>
        </div>
      </section>

      <MatchdayBand />
      <Standings />

      <section id="how" className="sec" style={{ padding: "100px 0" }}>
        <div className="wrap stack reveal" style={{ gap: 44 }}>
          <Head eyebrow="How it works">
            Sign up solo. <span className="it">Climb the table.</span>
          </Head>
          <div className="g4 steps-2">
            <div className="step">
              <span className="disp num">01</span>
              <h3 className="t-step">Sign up solo</h3>
              <p className="body" style={{ fontSize: 16 }}>
                No partner, no team. You enter the league as you.
              </p>
            </div>
            <div className="step">
              <span className="disp num">02</span>
              <h3 className="t-step">Play your Sundays</h3>
              <p className="body" style={{ fontSize: 16 }}>
                Two hours of Americano every Sunday, with new partners and new opponents every round.
              </p>
            </div>
            <div className="step">
              <span className="disp num">03</span>
              <h3 className="t-step">Stack your points</h3>
              <p className="body" style={{ fontSize: 16 }}>
                3 points a win, and your results follow you, not a partner.
              </p>
            </div>
            <div className="step">
              <span className="disp num">04</span>
              <h3 className="t-step">Make Finals Night</h3>
              <p className="body" style={{ fontSize: 16 }}>
                Finish near the top of your division and you're playing for the title on Finals Night. One champion
                per division.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="sec sec-alt" style={{ padding: "100px 0" }}>
        <div className="wrap stack reveal" style={{ gap: 40 }}>
          <Head eyebrow="What every player gets">
            Not just <span className="it">a court booking.</span>
          </Head>
          <div className="g3 rail-m" role="region" aria-label="What every player gets" tabIndex={0}>
            {perks.map((p) => (
              <div key={p.title} className="perk" style={p.lime ? { background: "#D9E270" } : undefined}>
                <h3>{p.title}</h3>
                <p className="body" style={{ fontSize: 16, color: p.lime ? "#0E2418" : undefined }}>
                  {p.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="season-2" className="sec-dark" style={{ padding: "100px 0" }}>
        <div className="wrap g2" style={{ alignItems: "start" }}>
          <div className="stack" style={{ gap: 24 }}>
            <p className="eyebrow">Season 2{isSet(season2.name) ? ` · ${season2.name}` : ""}</p>
            <h2 className="disp t-xl">
              Missed Season 1? <span className="it">Don't miss Season 2.</span>
            </h2>
            <p className="body" style={{ maxWidth: 480 }}>
              Get on the list and you hear the Season 2 dates and entry before anyone else. Season 1 players get first
              call.
            </p>
            {isSet(season2.start) || isSet(season2.entry) ? (
              <div className="facts">
                {isSet(season2.start) ? (
                  <div className="fact">
                    <span>Starts</span>
                    <span>{season2.start}</span>
                  </div>
                ) : null}
                {isSet(season2.entry) ? (
                  <div className="fact">
                    <span>Entry</span>
                    <span>{season2.entry}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
            {isSet(season2.depositNote) ? <p className="body">{season2.depositNote}</p> : null}
          </div>
          <SiteForm
            form="season-2"
            idPrefix="s2"
            title="Get on the list"
            fields={waitlistFields}
            nameFrom={["first", "last"]}
            subject={(v) => `Season 2 waitlist · ${v.first} ${v.last}`.trim()}
            submitLabel="Put me on the list"
            done={{
              title: "You're on the list.",
              body: "You'll hear the Season 2 dates and entry before anyone else.",
            }}
          />
        </div>
      </section>

      <section className="sec" style={{ padding: "100px 0" }}>
        <div className="wrap g2 reveal" style={{ alignItems: "start" }}>
          <Head eyebrow="Questions">Before you sign</Head>
          <div>
            <Qa q="Do I need a partner?" open>
              No. Everyone registers individually. Partners rotate throughout the season.
            </Qa>
            <Qa q="Do I have to be advanced?">
              No. If you can play a full match and you know how scoring works, you're ready.
            </Qa>
            <Qa q="What if I'm brand new to padel?">
              Start with a Thursday meet first. The league will be here when you're ready.
            </Qa>
            <Qa q="What if I miss a Sunday?">
              Tell us at least 48 hours ahead. An approved reserve player may fill your spot, and you get no points for
              matches you miss.
            </Qa>
            <Qa q="Can I sign up with a friend?">
              Yes, just not as a team. You'll each have your own ranking, which keeps things interesting.
            </Qa>
          </div>
        </div>
      </section>

      <section style={{ padding: "0 0 0" }}>
        <div className="strip strip-45">
          <div>
            <Photo photo={photos.overheadSwing} sizes="33vw" />
          </div>
          <div>
            <Photo photo={photos.leaguePair} sizes="33vw" />
          </div>
          <div>
            <Photo photo={photos.forehandLoad} sizes="33vw" />
          </div>
        </div>
      </section>
    </>
  );
};

export default League;
