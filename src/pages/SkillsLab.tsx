// Skill Lab: small-group padel coaching. Rebuilt on Oct 15 2026 in the
// redesigned site's system (SiteLayout, cream and forest, Barlow) so it
// matches the other public pages, and given a sign-up form that lands in the
// "PTO Website: form entries" Sheet with an alert like every other form.
//
// Facts come only from src/content/skillsLab.ts. Anything still TODO_BENSON
// (day, time, venue, coach) hides itself; skills-lab-integrity.test.tsx
// fails the build if the sentinel ever renders. The first cohort's date
// (Aug 30) has passed, so the page sells the next cohort through the list
// rather than naming a start date.

import { photos } from "@/site/photos";
import { thursday } from "@/site/content";
import { Check, Head, Photo, Qa, Seal, Shot, usePagePreview } from "@/site/ui/bits";
import { SiteForm, type FormField } from "@/site/ui/forms";
import { isSet, skillsLab } from "@/content/skillsLab";

const money = (n: number) => `$${n}`;

const weeks = [
  { n: "01", title: "Build your foundation", text: "Racket control, the basic shots, serving and where to stand." },
  { n: "02", title: "Own the court", text: "Movement, positioning, playing the walls and working with your partner." },
  { n: "03", title: "Build your game", text: "Attacking, defending, volleys, lobs and putting points together." },
  { n: "04", title: "Put it into play", text: "Coached match play in real game situations." },
];

const levels = [
  { title: "Never played", text: "Good. We start from zero: racket control, the basic shots and where to stand." },
  { title: "Know the basics", text: "Still inconsistent? Skill Lab gives you the reps to put it together." },
  { title: "Play regularly", text: "Sharpen your technique, make better decisions and keep climbing.", lime: true },
];

const included = [
  "4 small-group coaching sessions, one a week",
  "6 players maximum, one dedicated coach",
  "Technical and tactical work, then coached match play",
  "Rackets and balls provided",
  "Snacks and drinks",
  "A Thursday meet on us when you finish",
];

const offers = [
  {
    eyebrow: "The full program",
    title: "Four-week cohort",
    price: skillsLab.cohortPrice,
    per: "for all four weeks",
    bullets: ["4 sessions, one a week", "6 players maximum", "A Thursday meet on us after"],
    dark: true,
    show: true,
  },
  {
    eyebrow: "Two weeks",
    title: "Two-session pack",
    price: skillsLab.twoSessionPackPrice,
    per: "for two sessions",
    bullets: ["Two sessions in back-to-back weeks", "Same small group, same coach"],
    show: skillsLab.showTwoSessionPack,
  },
  {
    eyebrow: "Try it first",
    title: "Single session",
    price: skillsLab.singleSessionPrice,
    per: "for one session",
    bullets: ["One session to see what Skill Lab is about", "No four-week commitment"],
    show: true,
  },
].filter((o) => o.show);

const signupFields: readonly FormField[] = [
  { name: "first", label: "First name", required: true, autoComplete: "given-name", half: true },
  { name: "last", label: "Last name", autoComplete: "family-name", half: true },
  { name: "email", label: "Email", type: "email", required: true, autoComplete: "email", placeholder: "you@email.com" },
  { name: "phone", label: "Phone (optional)", type: "tel", autoComplete: "tel", placeholder: "For a text when spots open" },
  {
    name: "level",
    label: "Where's your game?",
    type: "select",
    options: ["Never played", "Know the basics", "Play regularly"],
  },
  {
    name: "offer",
    label: "Interested in",
    type: "select",
    options: ["Four-week cohort", ...(skillsLab.showTwoSessionPack ? ["Two-session pack"] : []), "Single session", "Not sure yet"],
  },
  { name: "notes", label: "Anything the coach should know?", type: "textarea", placeholder: "What you want to work on, days that suit you" },
];

const SkillsLab = () => {
  usePagePreview("/skills-lab");
  const when = [skillsLab.sessionDay, skillsLab.sessionTime].filter(isSet).join(" · ");
  const where = [skillsLab.venueName, skillsLab.venueArea].filter(isSet).join(", ");

  return (
    <>
      <section className="sec-hero">
        <div className="wrap g2" style={{ alignItems: "center" }}>
          <div className="stack" style={{ gap: 26 }}>
            <p className="eyebrow">Skill Lab · Small-group coaching</p>
            <h1 className="disp t-xl">
              Four weeks to a <span className="it">better game.</span>
            </h1>
            <p className="lede measure">
              Four weeks of small-group padel coaching. Six players, one coach, and a plan that meets you where you
              are, whether you've never held a racket or you keep hitting the same ceiling.
            </p>
            <div className="facts">
              <div className="fact">
                <span>Format</span>
                <span>4 weeks · one session a week</span>
              </div>
              <div className="fact">
                <span>Group</span>
                <span>6 players, 1 coach</span>
              </div>
              {when ? (
                <div className="fact">
                  <span>When</span>
                  <span>{when}</span>
                </div>
              ) : null}
              {where ? (
                <div className="fact">
                  <span>Where</span>
                  <span>{where}</span>
                </div>
              ) : null}
              {isSet(skillsLab.coachName) ? (
                <div className="fact">
                  <span>Coach</span>
                  <span>{skillsLab.coachName}</span>
                </div>
              ) : null}
              <div className="fact">
                <span>Price</span>
                <span>{money(skillsLab.cohortPrice)} for the four weeks</span>
              </div>
            </div>
            <div className="cta-row">
              <a className="btn btn-dark" href="#join">
                Get on the list
              </a>
              <a className="btn btn-line" href="#pricing">
                See pricing
              </a>
            </div>
          </div>
          <div className="collage collage-tall">
            <Shot
              photo={photos.forehandLoad}
              priority
              sizes="(max-width: 900px) 56vw, 330px"
              at={{ right: 0, top: 0, width: "56%", height: "64%", transform: "rotate(3deg)", zIndex: 2 }}
            />
            <Shot
              photo={photos.overheadSwing}
              sizes="(max-width: 900px) 58vw, 340px"
              at={{ left: 0, bottom: "2%", width: "58%", height: "66%", transform: "rotate(-3deg)" }}
            />
            <Seal at={{ right: "4%", bottom: "4%", width: 140, height: 140, transform: "rotate(8deg)", zIndex: 3 }}>
              6 players
              <br />
              1 coach
            </Seal>
          </div>
        </div>
      </section>

      <section className="sec sec-alt" style={{ padding: "96px 0" }}>
        <div className="wrap g2 reveal" style={{ alignItems: "start" }}>
          <Head eyebrow="Who it's for">
            New, rusty or stuck? <span className="it">It's built for all three.</span>
          </Head>
          <div className="stack" style={{ gap: 16 }}>
            <p className="body">Maybe you've been meaning to try padel and haven't booked.</p>
            <p className="body">Maybe you've played a few times and still don't really know what you're doing.</p>
            <p className="body">Or you play most weeks now and you've stopped getting better.</p>
            <p className="body">
              Same four weeks, same six players, same coach. Where you start doesn't change the program. It changes what
              the coach works on with you.
            </p>
          </div>
        </div>
      </section>

      <section className="sec" style={{ padding: "96px 0" }}>
        <div className="wrap stack reveal" style={{ gap: 44 }}>
          <Head eyebrow="The four weeks">
            Four weeks. <span className="it">Four jobs.</span>
          </Head>
          <div className="g4">
            {weeks.map((w) => (
              <div key={w.n} className="step">
                <span className="disp num">{w.n}</span>
                <h3 className="t-step">{w.title}</h3>
                <p className="body" style={{ fontSize: 16 }}>
                  {w.text}
                </p>
              </div>
            ))}
          </div>
          <p className="body measure">
            One session a week, each building on the last, so you finish with a game rather than a list of drills.
          </p>
        </div>
      </section>

      <section style={{ padding: "0 0 96px" }}>
        <div className="wrap strip reveal">
          <div>
            <Photo photo={photos.baselineReady} sizes="(max-width: 900px) 33vw, 400px" />
          </div>
          <div>
            <Photo photo={photos.doublesPoint} sizes="(max-width: 900px) 33vw, 400px" />
          </div>
          <div>
            <Photo photo={photos.districtSprint} sizes="(max-width: 900px) 33vw, 400px" />
          </div>
        </div>
      </section>

      <section className="sec sec-alt" style={{ padding: "96px 0" }}>
        <div className="wrap stack reveal" style={{ gap: 40 }}>
          <Head eyebrow="Why six">
            Six players. One coach. <span className="it">No waiting around.</span>
          </Head>
          <p className="body measure">
            A twenty-person clinic gives you a queue and a handful of touches an hour. Six means the coach sees every rep
            you take, and you take a lot of them. Players are placed by level, so you train with people moving at your
            speed.
          </p>
          <div className="g3 rail-m" role="region" aria-label="Levels" tabIndex={0}>
            {levels.map((l) => (
              <div key={l.title} className="perk" style={l.lime ? { background: "#D9E270" } : undefined}>
                <h3>{l.title}</h3>
                <p className="body" style={{ fontSize: 16, color: l.lime ? "#0E2418" : undefined }}>
                  {l.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" style={{ padding: "96px 0" }}>
        <div className="wrap g2 reveal" style={{ alignItems: "start" }}>
          <div className="stack" style={{ gap: 16 }}>
            <Head eyebrow="What's included">
              Bring shoes. <span className="it">We bring the rest.</span>
            </Head>
            <p className="body measure">
              Finish the four weeks and your first Thursday meet is on us. Come back the week after and keep playing.
            </p>
          </div>
          <div>
            {included.map((t) => (
              <div key={t} className="li">
                <Check />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="sec sec-alt" style={{ padding: "96px 0" }}>
        <div className="wrap stack reveal" style={{ gap: 40 }}>
          <Head eyebrow="Pricing">Choose how you train</Head>
          <div className="g3">
            {offers.map((o) => (
              <article key={o.title} className={`card card-pad${o.dark ? " card-dark" : ""}`} style={{ gap: 18 }}>
                <p className={`eyebrow${o.dark ? "" : " eyebrow-leaf"}`}>{o.eyebrow}</p>
                <h3 className="disp" style={{ fontSize: 34 }}>
                  {o.title}
                </h3>
                <p style={{ margin: 0 }}>
                  <span className="disp" style={{ fontSize: 49 }}>
                    {money(o.price)}
                  </span>
                  <span style={{ fontSize: 15 }}> {o.per}</span>
                </p>
                <ul className="bullets">
                  {o.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <a className={`btn ${o.dark ? "btn-lime" : "btn-dark"}`} href="#join" style={{ marginTop: "auto" }}>
                  Get on the list
                </a>
              </article>
            ))}
          </div>
          {isSet(skillsLab.registrationUrl) ? (
            <p className="body">
              Know your dates already?{" "}
              <a href={skillsLab.registrationUrl} style={{ fontWeight: 700 }}>
                See open sessions
              </a>
            </p>
          ) : null}
        </div>
      </section>

      <section className="sec" style={{ padding: "96px 0" }}>
        <div className="wrap g2 reveal" style={{ alignItems: "start" }}>
          <Head eyebrow="Questions">Before you sign up</Head>
          <div>
            <Qa q="Do I need to have played before?" open>
              No. Players are placed by level and complete beginners are welcome. Regulars are too. The coach just works
              on different things with you.
            </Qa>
            <Qa q="How big is the group?">Six players. Never more.</Qa>
            <Qa q="How often do we play?">Once a week, for four weeks.</Qa>
            <Qa q="What if I miss a session?">One make-up session in the following cohort, arranged with us directly.</Qa>
            <Qa q="Do I need a racket?">No. Rackets and balls are provided. Just bring court shoes and water.</Qa>
            <Qa q="What happens after the four weeks?">
              Your first Thursday meet is on us.{" "}
              <a href={thursday.bookingUrl} style={{ fontWeight: 700 }}>
                Grab a pass
              </a>
            </Qa>
          </div>
        </div>
      </section>

      <section id="join" className="sec-dark" style={{ padding: "100px 0" }}>
        <div className="wrap g2" style={{ alignItems: "start" }}>
          <div className="stack" style={{ gap: 22 }}>
            <p className="eyebrow">The next cohort</p>
            <h2 className="disp t-xl">
              Stop waiting to be <span className="it">good enough.</span>
            </h2>
            <p className="body" style={{ maxWidth: 460 }}>
              You get better by playing. Get on the list and you hear the next cohort's dates first. Six places per
              cohort.
            </p>
          </div>
          <SiteForm
            form="skill-lab"
            idPrefix="skl"
            title="Get on the list"
            fields={signupFields}
            nameFrom={["first", "last"]}
            subject={(v) => `Skill Lab sign-up · ${v.first} ${v.last}`.trim()}
            submitLabel="Save my spot on the list"
            done={{
              title: "You're on the list.",
              body: "You'll hear the next cohort's dates first. Six places, so watch your inbox.",
            }}
          />
        </div>
      </section>
    </>
  );
};

export default SkillsLab;
