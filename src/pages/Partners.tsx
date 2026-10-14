// Partners: for brands. No logo wall and no partner names: PTO lists a
// brand only once a deal is signed and Benson says so. Audience lines are
// the approved ones only; no reach numbers on the public page.

import { photos } from "@/site/photos";
import { club, partnerAudience } from "@/site/content";
import { Head, Photo, Shot, usePageMeta } from "@/site/ui/bits";
import { MailtoForm, type MailtoField } from "@/site/ui/forms";

const kitFields: readonly MailtoField[] = [
  { name: "brand", label: "Brand", required: true, autoComplete: "organization", placeholder: "Brand name", half: true },
  { name: "name", label: "Your name", required: true, autoComplete: "name", placeholder: "First and last name", half: true },
  { name: "email", label: "Work email", type: "email", required: true, autoComplete: "email", placeholder: "you@brand.com" },
  {
    name: "interest",
    label: "What are you thinking?",
    type: "select",
    options: ["A Thursday night", "The league", "COURTSIDE", "Product seeding", "Not sure yet"],
  },
  { name: "notes", label: "Anything else", type: "textarea", placeholder: "What you're launching, timing, goals" },
];

const ways = [
  {
    eyebrow: "One night",
    title: "Session partner",
    text: "A Thursday named for you. Your product in people's hands, and recap content you can reuse.",
  },
  {
    eyebrow: "A season",
    title: "Season partner",
    text: "Your brand across a PTO League season, from the first Sunday to Finals Night.",
  },
  {
    eyebrow: "The big one",
    title: "Presenting partner",
    text: "Your name on COURTSIDE or the league: the stage, the backdrop and the prize table.",
    dark: true,
  },
  {
    eyebrow: "Product",
    title: "Seeding",
    text: "Product to our players and the creators in our community, with a recap.",
  },
];

const Partners = () => {
  usePageMeta(
    "Partners · Club PTO",
    "Partner with Club PTO, Toronto's padel social club. Thursday nights, the PTO League and COURTSIDE. Request the media kit.",
    "/partners",
  );

  const stats = [partnerAudience, "Every Thursday, every league Sunday, every COURTSIDE"];

  return (
    <>
      <section className="sec-hero">
        <div className="wrap g2" style={{ alignItems: "center" }}>
          <div className="stack" style={{ gap: 26 }}>
            <p className="eyebrow">For brands</p>
            <h1 className="disp t-hero">
              Get in <span className="it">the room.</span>
            </h1>
            <p className="lede measure">
              PTO is Toronto's padel social club: a weekly room of young professionals who show up, play and post.
              Brands join the night, not just the feed.
            </p>
            <div className="cta-row">
              <a className="btn btn-dark" href="#contact">
                Request the media kit
              </a>
              <a className="btn btn-line" href={`mailto:${club.email}`}>
                Email us
              </a>
            </div>
          </div>
          <div className="collage">
            <Shot
              photo={photos.thursdayCrew}
              priority
              sizes="(max-width: 900px) 52vw, 310px"
              at={{ left: "4%", top: 0, width: "52%", height: "72%", transform: "rotate(-3deg)" }}
            />
            <Shot
              photo={photos.courtsideFunSign}
              sizes="(max-width: 900px) 48vw, 290px"
              at={{ right: "2%", bottom: 0, width: "48%", height: "66%", transform: "rotate(3deg)" }}
            />
          </div>
        </div>
      </section>

      <section className="sec-dark" style={{ padding: "96px 0" }}>
        <div className="wrap g2 reveal" style={{ alignItems: "start" }}>
          <div className="stack" style={{ gap: 18 }}>
            <p className="eyebrow">The room</p>
            <h2 className="disp t-xxl">
              {club.playedCount} Torontonians <span className="it">have played with us.</span>
            </h2>
          </div>
          <div>
            {stats.map((s) => (
              <div key={s} className="stat">
                {s}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" style={{ padding: "96px 0" }}>
        <div className="wrap stack reveal" style={{ gap: 40 }}>
          <Head eyebrow="Ways to partner">
            From one night <span className="it">to a whole season.</span>
          </Head>
          <div className="g4">
            {ways.map((w) => (
              <article key={w.title} className={`card card-pad${w.dark ? " card-dark" : ""}`} style={{ padding: 28 }}>
                <p className={`eyebrow${w.dark ? "" : " eyebrow-leaf"}`}>{w.eyebrow}</p>
                <h3 className="disp t-door">{w.title}</h3>
                <p className="body" style={{ fontSize: 16 }}>
                  {w.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sec sec-alt" style={{ padding: "96px 0" }}>
        <div className="wrap stack reveal" style={{ gap: 36 }}>
          <div className="split">
            <Head eyebrow="Made on the night">
              Content people <span className="it">actually share.</span>
            </Head>
            <p className="body" style={{ maxWidth: 400, fontSize: 16 }}>
              Our players post from every event. Partner nights are photographed and filmed, and the files are yours to
              reuse.
            </p>
          </div>
          <div className="strip strip-45">
            <div>
              <Photo photo={photos.goldenHourPoint} sizes="(max-width: 900px) 33vw, 400px" />
            </div>
            <div>
              <Photo photo={photos.loungeAfter} sizes="(max-width: 900px) 33vw, 400px" />
            </div>
            <div>
              <Photo photo={photos.forehandLoad} sizes="(max-width: 900px) 33vw, 400px" />
            </div>
          </div>
        </div>
      </section>

      <section className="sec" style={{ padding: "96px 0" }}>
        <div className="wrap stack reveal" style={{ gap: 40 }}>
          <Head eyebrow="How it works">
            Three steps. <span className="it">That's it.</span>
          </Head>
          <div className="g3">
            <div className="step">
              <span className="disp num">01</span>
              <h3 className="t-step">Tell us what you're launching</h3>
              <p className="body" style={{ fontSize: 16 }}>
                A product, a season, a moment you want people talking about.
              </p>
            </div>
            <div className="step">
              <span className="disp num">02</span>
              <h3 className="t-step">We shape it together</h3>
              <p className="body" style={{ fontSize: 16 }}>
                A night, a season or an event, built around what fits your brand.
              </p>
            </div>
            <div className="step">
              <span className="disp num">03</span>
              <h3 className="t-step">We run it and report back</h3>
              <p className="body" style={{ fontSize: 16 }}>
                The recap, the content and the numbers, sent after the night.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="sec-dark" style={{ padding: "100px 0" }}>
        <div className="wrap g2" style={{ alignItems: "start" }}>
          <div className="stack" style={{ gap: 22 }}>
            <p className="eyebrow">Let's talk</p>
            <h2 className="disp t-xl">
              Get the <span className="it">media kit.</span>
            </h2>
            <p className="body" style={{ maxWidth: 440 }}>
              Tell us a little about your brand and we'll send the kit with dates, formats and recent numbers.
            </p>
            <p className="body">
              Or email <a href={`mailto:${club.email}`}>{club.email}</a>
            </p>
          </div>
          <MailtoForm
            idPrefix="kit"
            fields={kitFields}
            subject={(v) => `Media kit request · ${v.brand || v.name}`}
            submitLabel="Request the media kit"
          />
        </div>
      </section>
    </>
  );
};

export default Partners;
