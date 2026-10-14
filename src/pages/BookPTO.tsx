// Book PTO: company nights and private parties. Every package is
// "Quote on request" by choice (Benson, Oct 2026): no prices on the page.

import { photos } from "@/site/photos";
import { club, venue } from "@/site/content";
import { Check, Head, Plus, Qa, Shot, usePageMeta } from "@/site/ui/bits";
import { MailtoForm, type MailtoField } from "@/site/ui/forms";

const inquiryFields: readonly MailtoField[] = [
  { name: "name", label: "Your name", required: true, autoComplete: "name", placeholder: "First and last name", half: true },
  { name: "email", label: "Email", type: "email", required: true, autoComplete: "email", placeholder: "you@company.com", half: true },
  { name: "company", label: "Company or group", autoComplete: "organization", placeholder: "Who's coming" },
  {
    name: "type",
    label: "Type of night",
    type: "select",
    options: ["Company night", "Private party", "Something else"],
    half: true,
  },
  {
    name: "size",
    label: "Group size",
    type: "select",
    options: ["Up to 12", "13 to 16", "17 to 24", "25 or more"],
    half: true,
  },
  { name: "date", label: "Preferred date", type: "date" },
  { name: "notes", label: "Anything we should know?", type: "textarea", placeholder: "Occasion, timing, food, anything else" },
];

const packages = [
  {
    eyebrow: "For teams",
    title: "Company night",
    bullets: ["Up to 12 guests", "2 courts · 2 hours", "Team socials, holiday parties, client nights"],
    dark: true,
  },
  {
    eyebrow: "Bigger teams",
    title: "Big group",
    bullets: ["17 to 24 guests", "3 courts · 2 hours", "Offsites, department nights, bigger teams"],
  },
  {
    eyebrow: "Friends and family",
    title: "Private party",
    bullets: ["12 to 16 guests", "2 courts · 2 hours", "Birthdays, friend groups, bachelor and bachelorette nights"],
  },
];

const included = [
  "Courts for two hours",
  "Balls and a PTO host running the night",
  "A warm-up clinic for first-timers",
  "The Americano format and a live scoreboard",
  "A final and a team photo",
];

const addOns = [
  "Food and drinks, arranged with the venue",
  "A photographer: edited photos your team keeps",
  "Prizes or branded balls for the winners",
];

const BookPTO = () => {
  usePageMeta(
    "Book PTO · Company nights and private parties · Club PTO",
    "Two hours of padel, run start to finish by Club PTO. Company nights, team socials and private parties in Mississauga. First-timers welcome.",
    "/book-pto",
  );

  return (
    <>
      <section className="sec-hero">
        <div className="wrap g2" style={{ alignItems: "center" }}>
          <div className="stack" style={{ gap: 26 }}>
            <p className="eyebrow">Company nights · Private parties</p>
            <h1 className="disp t-xl">
              Book PTO <span className="it">for your team.</span>
            </h1>
            <p className="lede measure">
              Two hours of padel, run start to finish by us. Your people just show up, first-timers included.
            </p>
            <div className="cta-row">
              <a className="btn btn-dark" href="#inquire">
                Check a date
              </a>
              <a className="btn btn-line" href="#packages">
                See packages
              </a>
            </div>
          </div>
          <div className="collage">
            <Shot
              photo={photos.doublesPoint}
              priority
              focus="50% 58%"
              sizes="(max-width: 900px) 70vw, 410px"
              at={{ left: 0, top: "8%", width: "70%", height: "58%", transform: "rotate(-2deg)" }}
            />
            <Shot
              photo={photos.groupOnCourt}
              sizes="(max-width: 900px) 44vw, 260px"
              at={{ right: 0, bottom: 0, width: "44%", height: "62%", transform: "rotate(3deg)" }}
            />
          </div>
        </div>
      </section>

      <section id="packages" className="sec sec-alt" style={{ padding: "96px 0" }}>
        <div className="wrap stack reveal" style={{ gap: 40 }}>
          <Head eyebrow="Packages">Pick your night</Head>
          <div className="g3">
            {packages.map((p) => (
              <article key={p.title} className={`card card-pad${p.dark ? " card-dark" : ""}`} style={{ gap: 18 }}>
                <p className={`eyebrow${p.dark ? "" : " eyebrow-leaf"}`}>{p.eyebrow}</p>
                <h3 className="disp" style={{ fontSize: 38 }}>
                  {p.title}
                </h3>
                <p className="disp" style={{ fontSize: 30, margin: 0 }}>
                  Quote on request
                </p>
                <ul className="bullets">
                  {p.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <a className={`btn ${p.dark ? "btn-lime" : "btn-dark"}`} href="#inquire" style={{ marginTop: "auto" }}>
                  Check a date
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" style={{ padding: "96px 0" }}>
        <div className="wrap stack reveal" style={{ gap: 40 }}>
          <Head eyebrow="How the night runs">
            Two hours, <span className="it">start to finish.</span>
          </Head>
          <div className="tl">
            <div style={{ background: "#D9E270" }}>
              <span className="eyebrow">0:00 · 20 min</span>
              <h3 style={{ fontSize: 20 }}>Welcome and warm-up clinic</h3>
              <p className="body" style={{ fontSize: 15, color: "#0E2418" }}>
                Rules, the walls, a few rallies.
              </p>
            </div>
            <div style={{ background: "#0E2418", color: "#F5EFE3" }}>
              <span className="eyebrow" style={{ color: "#D9E270" }}>
                0:20 · 80 min
              </span>
              <h3 style={{ fontSize: 24 }}>Americano with a live scoreboard</h3>
              <p className="body" style={{ fontSize: 15, color: "#E7E0D1" }}>
                Partners rotate every round, so everyone plays with everyone. Scores update live on our own software.
              </p>
            </div>
            <div style={{ background: "#FFFDF8" }}>
              <span className="eyebrow">1:40 · 20 min</span>
              <h3 style={{ fontSize: 20 }}>The final and team photo</h3>
              <p className="body" style={{ fontSize: 15 }}>
                Top scorers play it out.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: "0 0 96px" }}>
        <div className="wrap g2 reveal" style={{ alignItems: "start" }}>
          <div className="stack" style={{ gap: 16 }}>
            <h2 className="disp" style={{ fontSize: 40 }}>
              Included
            </h2>
            <div>
              {included.map((t) => (
                <div key={t} className="li">
                  <Check />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="stack" style={{ gap: 16 }}>
            <h2 className="disp" style={{ fontSize: 40 }}>
              Add-ons
            </h2>
            <div>
              {addOns.map((t) => (
                <div key={t} className="li">
                  <Plus />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="sec-alt" style={{ padding: "80px 0" }}>
        <div className="wrap g3 reveal">
          <div className="stack" style={{ gap: 10 }}>
            <span className="disp" style={{ fontSize: 56 }}>
              {club.playedCount}
            </span>
            <p className="body" style={{ fontSize: 16 }}>
              Torontonians have played with PTO since {club.since}.
            </p>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <span className="disp" style={{ fontSize: 40 }}>
              Built for first-timers
            </span>
            <p className="body" style={{ fontSize: 16 }}>
              The warm-up gets a brand new group playing in twenty minutes.
            </p>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <span className="disp" style={{ fontSize: 40 }}>
              We run the whole night
            </span>
            <p className="body" style={{ fontSize: 16 }}>
              The format, the scores, the final. You just bring people.
            </p>
          </div>
        </div>
      </section>

      <section id="inquire" className="sec-dark" style={{ padding: "100px 0" }}>
        <div className="wrap g2" style={{ alignItems: "start" }}>
          <div className="stack" style={{ gap: 22 }}>
            <p className="eyebrow">Check a date</p>
            <h2 className="disp t-xl">
              Tell us about <span className="it">your night.</span>
            </h2>
            <p className="body" style={{ maxWidth: 440 }}>
              We'll reply with open dates and a quote. Holiday dates go first, so ask early.
            </p>
            <p className="body">
              Or email <a href={`mailto:${club.email}`}>{club.email}</a>
            </p>
          </div>
          <MailtoForm
            idPrefix="book"
            fields={inquiryFields}
            subject={(v) => `${v.type || "Event"} inquiry · ${v.company || v.name}`}
            submitLabel="Check availability"
          />
        </div>
      </section>

      <section className="sec" style={{ padding: "100px 0" }}>
        <div className="wrap g2 reveal" style={{ alignItems: "start" }}>
          <Head eyebrow="Questions">Before you book</Head>
          <div>
            <Qa q="Most of us have never played. Is that okay?" open>
              Yes. Most groups haven't. The warm-up covers the basics and the rotation mixes everyone up.
            </Qa>
            <Qa q="Where is it?">
              {venue.name}, {venue.address}.
            </Qa>
            <Qa q="Can we sort food and drinks?">
              Yes. Tell us what you have in mind and we'll arrange it with the venue.
            </Qa>
          </div>
        </div>
      </section>
    </>
  );
};

export default BookPTO;
