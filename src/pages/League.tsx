// PTO League. Season 1 copy follows the approved Founding Season page
// (scoring, coverage), corrected to the season as it actually runs: three
// divisions (Atlas, Riviera, Venus), seven Sundays. The live table
// comes from the league Sheet (src/site/ui/LeagueLive.tsx), showing first
// names and last initials exactly as the Sheet has them.

import { photos } from "@/site/photos";
import { isSet, leagueFacts, leagueInPlay, season2, venue } from "@/site/content";
import { Head, Photo, Qa, usePageMeta } from "@/site/ui/bits";
import { MailtoForm, type MailtoField } from "@/site/ui/forms";
import { Standings } from "@/site/ui/LeagueLive";

const waitlistFields: readonly MailtoField[] = [
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
    label: "Experience",
    type: "select",
    options: ["Played a few times", "Developing", "Intermediate+"],
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
        <p className="disp" style={{ fontSize: 44, color: "#0E2418" }}>
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
            <p className="disp" style={{ fontSize: 30, color: "#0E2418" }}>
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
    text: "An individual position in the PTO League standings, updated every week.",
  },
  {
    title: "Your weekly matchups",
    text: "New partners. New opponents. New chances to move up. Every Sunday is a different test.",
  },
  {
    title: "Your moments",
    text: "Highlights, reactions, player features and league content throughout the season.",
  },
  {
    title: "Your shot at Finals Night",
    text: "Finish at the top of your division and your season continues at the PTO Tournament. Everyone else watches.",
  },
  {
    title: "Something to play for",
    text: "Prizes, and the inaugural PTO League Championship trophy for each division winner.",
    lime: true,
  },
  {
    title: "A league you join solo",
    text: "Everyone registers on their own. Bring a friend if you like; you'll both compete independently.",
  },
];

const League = () => {
  usePageMeta(
    "PTO League · Club PTO",
    "PTO League: Americano padel on Sundays at District Padel, Mississauga. Live standings in three divisions, Finals Night to crown each champion. Join the Season 2 waitlist.",
    "/league",
  );

  return (
    <>
      <section className="sec-dark sec-hero" style={{ padding: "88px 0 100px" }}>
        <div className="wrap g2" style={{ alignItems: "center" }}>
          <div className="stack" style={{ gap: 26 }}>
            <p className="eyebrow">PTO League · Season 1 · The Founding Season</p>
            <h1 className="disp t-big">
              A rec league with <span className="it">pro‑sports energy.</span>
            </h1>
            <p className="lede measure">
              Sign up solo. Your own ranking. Every Sunday counts toward Finals Night.
              {leagueInPlay() ? " Season 1 is in play now." : ""}
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
                <span>Americano. Three divisions: Atlas, Riviera and Venus</span>
              </div>
            </div>
            <div className="cta-row">
              <a className="btn btn-lime" href="#season-2">
                Join the Season 2 waitlist
              </a>
              <a className="btn btn-cream" href="#how">
                How it works
              </a>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <PlayerCard />
          </div>
        </div>
      </section>

      <Standings />

      <section id="how" className="sec" style={{ padding: "100px 0" }}>
        <div className="wrap stack reveal" style={{ gap: 44 }}>
          <Head eyebrow="How it works">
            Sign up solo. <span className="it">Climb the table.</span>
          </Head>
          <div className="g4">
            <div className="step">
              <span className="disp num">01</span>
              <h3 className="t-step">Sign up on your own</h3>
              <p className="body" style={{ fontSize: 16 }}>
                Register individually. No partner needed. You enter the league as you.
              </p>
            </div>
            <div className="step">
              <span className="disp num">02</span>
              <h3 className="t-step">Play your Sundays</h3>
              <p className="body" style={{ fontSize: 16 }}>
                Americano rounds every Sunday. Partners and opponents rotate for variety across the season.
              </p>
            </div>
            <div className="step">
              <span className="disp num">03</span>
              <h3 className="t-step">Earn your points</h3>
              <p className="body" style={{ fontSize: 16 }}>
                A win is worth 3 points. Your results follow you, not a team.
              </p>
            </div>
            <div className="step">
              <span className="disp num">04</span>
              <h3 className="t-step">Make Finals Night</h3>
              <p className="body" style={{ fontSize: 16 }}>
                The top of each division plays for the title at the PTO Tournament on Finals Night. One champion per division.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="sec sec-alt" style={{ padding: "100px 0" }}>
        <div className="wrap stack reveal" style={{ gap: 40 }}>
          <Head eyebrow="What every player gets">
            More than a <span className="it">match slot.</span>
          </Head>
          <div className="g3">
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
              Hold your spot <span className="it">for Season 2.</span>
            </h2>
            <p className="body" style={{ maxWidth: 480 }}>
              Join the waitlist and you'll hear the Season 2 dates and entry before anyone else. Season 1 players get
              first call.
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
          <MailtoForm
            idPrefix="s2"
            title="Join the waitlist"
            fields={waitlistFields}
            subject={(v) => `Season 2 waitlist · ${v.first} ${v.last}`.trim()}
            submitLabel="Join the Season 2 waitlist"
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
              No. You need enough experience to comfortably play a match and understand basic rules and scoring.
            </Qa>
            <Qa q="What if I'm brand new to padel?">
              Start with a Thursday meet first. The league will be here when you're ready.
            </Qa>
            <Qa q="What if I miss a Sunday?">
              Tell us at least 48 hours ahead. An approved reserve player may fill your spot, and you get no points for
              matches you miss.
            </Qa>
            <Qa q="Can I sign up with a friend?">
              Yes, but not as a doubles team. You both compete independently.
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
