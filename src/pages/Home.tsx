import { Link } from "react-router-dom";
import { photos } from "@/site/photos";
import { bookPto, club, thursday } from "@/site/content";
import { Head, Photo, Seal, Shot, usePageMeta } from "@/site/ui/bits";
import { EmailCapture } from "@/site/ui/forms";
import { LeagueOnHome, Ticker, UpNext } from "@/site/ui/LeagueLive";

/**
 * Keep in step with HERO_SIZES in vite.config.ts (the build preloads it).
 * Full width on phones (the photo hero), the collage's big print on desktop.
 */
const HERO_SIZES = "(max-width: 900px) 100vw, 310px";

const Hero = () => (
  <section className="sec-hero home-hero">
    <div className="wrap g2" style={{ alignItems: "center" }}>
      <div className="stack hero-copy" style={{ gap: 28 }}>
        {/* On phones the eyebrow and headline sit on a full-bleed action
            photo, so the first screen is padel, not paragraphs. On wide
            screens the photo hides and the taped collage takes over. */}
        <div className="hero-head">
          <div className="hero-head-media">
            <Photo photo={photos.doublesPoint} priority sizes={HERO_SIZES} focus="50% 40%" />
          </div>
          <p className="eyebrow">Padel Social Club · Toronto</p>
          <h1 className="disp t-hero">
            Play.
            <br />
            Connect.
            <br />
            <span className="it">Compete.</span>
          </h1>
        </div>
        <p className="lede measure">
          Club PTO is Toronto's padel social club. A weekly meet, a league with real stakes, and the events
          everyone posts about. Every level welcome.
        </p>
        <div className="cta-row">
          <a className="btn btn-dark" href={thursday.bookingUrl}>
            Book a Thursday pass
          </a>
          <Link className="btn btn-line" to="/book-pto">
            Book PTO for your team
          </Link>
        </div>
        <p className="small" style={{ margin: 0, color: "var(--text)" }}>
          <strong>{club.playedCount} Torontonians</strong> have played with us since {club.since}.
        </p>
      </div>
      <div className="collage hide-sm">
        <Shot
          photo={photos.doublesPoint}
          sizes={HERO_SIZES}
          at={{ left: "2%", top: "5%", width: "56%", height: "76%", transform: "rotate(-3deg)" }}
        />
        <Shot
          photo={photos.overheadSwing}
          sizes="(max-width: 900px) 40vw, 230px"
          at={{ right: "1%", top: 0, width: "40%", height: "46%", transform: "rotate(4deg)" }}
        />
        <Shot
          photo={photos.thursdayCrew}
          sizes="(max-width: 900px) 42vw, 240px"
          at={{ right: "5%", bottom: "1%", width: "42%", height: "45%", transform: "rotate(-2deg)" }}
        />
        <Seal at={{ left: "44%", bottom: "5%", width: 132, height: 132, transform: "rotate(-10deg)" }}>
          Every
          <br />
          {thursday.day}
          <br />
          {thursday.startTime}
        </Seal>
      </div>
    </div>
  </section>
);

const doors = [
  {
    to: "/play",
    photo: photos.forehandLoad,
    n: "01 · Play",
    title: "Thursday meets",
    text: "Three courts by level, rotating partners, $20 a night. Come solo.",
    cta: "Book a pass →",
  },
  {
    to: "/league",
    photo: photos.leagueReady,
    n: "02 · League",
    title: "The league",
    text: "Your own ranking, new partners every match, a Finals Night to play for.",
    cta: "See the league →",
  },
  {
    to: "/events",
    photo: photos.courtsideDj,
    n: "03 · Events",
    title: "COURTSIDE and socials",
    text: "Tournaments, music and the nights people talk about for weeks.",
    cta: "See what's on →",
  },
  {
    to: "/book-pto",
    photo: photos.groupOnCourt,
    n: "04 · Book PTO",
    title: "Company nights",
    text: "We run the night. You bring your team, your friends or your clients.",
    cta: "Check a date →",
  },
];

const Doors = () => (
  <section className="sec sec-alt" style={{ padding: "96px 0" }}>
    <div className="wrap stack reveal" style={{ gap: 40 }}>
      <Head eyebrow="Find your way in">Four ways into PTO</Head>
      <div className="g4 doors">
        {doors.map((d) => (
          <Link key={d.to} to={d.to} className="door">
            <div className="frame">
              <Photo photo={d.photo} sizes="(max-width: 900px) 45vw, 290px" />
            </div>
            <p className="eyebrow eyebrow-leaf">{d.n}</p>
            <h3 className="disp t-door">
              {d.title}
            </h3>
            <p className="body" style={{ fontSize: 16 }}>
              {d.text}
            </p>
            <span style={{ fontWeight: 700 }}>{d.cta}</span>
          </Link>
        ))}
      </div>
    </div>
  </section>
);

const FirstNight = () => (
  <section className="sec">
    <div className="wrap g2 reveal" style={{ alignItems: "start" }}>
      <div className="stack" style={{ gap: 20 }}>
        <p className="eyebrow">New here?</p>
        <h2 className="disp t-l">
          Your first night, <span className="it">sorted.</span>
        </h2>
        <p className="lede" style={{ maxWidth: 460 }}>
          No partner needed. No membership. Never played? Most of us hadn't either.
        </p>
      </div>
      <ol className="steps-list">
        <li>
          <span className="disp">1</span>
          <div className="stack" style={{ gap: 6 }}>
            <h3 className="t-step">Grab a pass</h3>
            <p className="body" style={{ fontSize: 16 }}>
              Book on our booking page. {thursday.priceNote}, no membership.
            </p>
          </div>
        </li>
        <li>
          <span className="disp">2</span>
          <div className="stack" style={{ gap: 6 }}>
            <h3 className="t-step">Show up solo or with friends</h3>
            <p className="body" style={{ fontSize: 16 }}>
              We put you on a court that matches your level and rotate partners all night.
            </p>
          </div>
        </li>
        <li>
          <span className="disp">3</span>
          <div className="stack" style={{ gap: 6 }}>
            <h3 className="t-step">Stay for the hang</h3>
            <p className="body" style={{ fontSize: 16 }}>
              Half of PTO happens between games. That's the part people come back for.
            </p>
          </div>
        </li>
      </ol>
    </div>
  </section>
);

const Wall = () => (
  <section style={{ padding: "0 0 104px" }}>
    <div className="wrap stack reveal" style={{ gap: 28 }}>
      <div className="split">
        <h2 className="disp t-m">
          Real nights. <span className="it">Real people.</span>
        </h2>
        <a className="link-strong" href={club.instagramUrl}>
          {club.instagramHandle} on Instagram
        </a>
      </div>
      <div className="wall">
        <div className="tall">
          <Photo photo={photos.goldenHourPoint} sizes="(max-width: 900px) 50vw, 300px" />
        </div>
        <div>
          <Photo photo={photos.betweenGames} sizes="(max-width: 900px) 50vw, 300px" />
        </div>
        <div>
          <Photo photo={photos.courtsideTradingShots} sizes="(max-width: 900px) 50vw, 300px" />
        </div>
        <div className="tall">
          <Photo photo={photos.courtsideFunSign} sizes="(max-width: 900px) 50vw, 300px" />
        </div>
        <div>
          <Photo photo={photos.regularsLaugh} sizes="(max-width: 900px) 50vw, 300px" />
        </div>
        <div>
          <Photo photo={photos.courtsideLunge} sizes="(max-width: 900px) 50vw, 300px" />
        </div>
      </div>
    </div>
  </section>
);

const Courtside = () => (
  <section className="sec-dark">
    <div className="wrap g2" style={{ gap: 0, alignItems: "stretch" }}>
      <div className="stack reveal cs-copy" style={{ gap: 22, justifyContent: "center" }}>
        <p className="eyebrow">The summer series</p>
        <h2 className="disp t-xxl">
          COURTSIDE
        </h2>
        <p className="lime-it" style={{ margin: 0, fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontSize: 26 }}>
          by Club PTO
        </p>
        <p className="body" style={{ maxWidth: 460 }}>
          A summer series where the experience goes beyond sports. Tournament padel, DJ sets and golden hour at
          The Pad. Series I and II ran in 2026; the next one drops on {club.instagramHandle} first.
        </p>
        <div>
          <Link className="btn btn-lime" to="/events">
            See the recaps
          </Link>
        </div>
      </div>
      <div style={{ minHeight: 560, overflow: "hidden" }}>
        <Photo photo={photos.courtsideCrowd} sizes="(max-width: 900px) 100vw, 620px" />
      </div>
    </div>
  </section>
);

const BookBand = () => (
  <section className="sec">
    <div className="wrap g2 reveal" style={{ alignItems: "center" }}>
      <div style={{ aspectRatio: "4 / 3", overflow: "hidden" }}>
        <Photo photo={photos.groupDinner} sizes="(max-width: 900px) 100vw, 590px" />
      </div>
      <div className="stack" style={{ gap: 22 }}>
        <p className="eyebrow">Company nights · Private parties</p>
        <h2 className="disp t-l">
          Bring your people. <span className="it">We'll run the night.</span>
        </h2>
        <p className="body">
          Two hours of padel with a host, a warm-up for first-timers and a live scoreboard. Company nights from{" "}
          {bookPto.companyFrom} for {bookPto.companyGuests}. Private parties from {bookPto.privateFrom}.
        </p>
        <div className="cta-row">
          <Link className="btn btn-dark" to="/book-pto#inquire">
            Check a date
          </Link>
          <Link className="btn btn-line" to="/book-pto#packages">
            What's included
          </Link>
        </div>
      </div>
    </div>
  </section>
);

const Drops = () => (
  <section className="sec-lime" style={{ padding: "72px 0" }}>
    <div className="wrap split" style={{ alignItems: "center", gap: 32 }}>
      <div className="stack" style={{ gap: 10 }}>
        <h2 className="disp t-m">
          Never miss a night.
        </h2>
        <p className="body" style={{ color: "var(--ink)" }}>
          New passes, league news and the next COURTSIDE, first.
        </p>
      </div>
      <EmailCapture buttonLabel="Keep me posted" source="home-drops" />
    </div>
  </section>
);

const Home = () => {
  usePageMeta(
    "Club PTO · Toronto's padel social club",
    "Thursday meets at District Padel, the PTO League on Sundays, and COURTSIDE. Every level welcome. Book a pass or book PTO for your team.",
    "/",
  );
  return (
    <>
      <Hero />
      <Ticker />
      <UpNext />
      <LeagueOnHome />
      <Doors />
      <FirstNight />
      <Wall />
      <Courtside />
      <BookBand />
      <Drops />
    </>
  );
};

export default Home;
