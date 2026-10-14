import { Link } from "react-router-dom";
import { photos } from "@/site/photos";
import {
  club,
  communityNights,
  emailCaptureReady,
  courtside,
  finalsUpcoming,
  isSet,
  leagueFacts,
  longDay,
} from "@/site/content";
import { Head, Photo, Shot, usePageMeta } from "@/site/ui/bits";
import { EmailCapture } from "@/site/ui/forms";

const Events = () => {
  usePageMeta(
    "Events · Club PTO",
    "The nights everyone posts about. COURTSIDE, our summer day party at The Pad, plus Finals Night and community nights. Padel at the centre, music and the hang all around it.",
    "/events",
  );

  const finals = finalsUpcoming();

  return (
    <>
      <section className="sec-hero">
        <div className="wrap g2" style={{ alignItems: "center" }}>
          <div className="stack" style={{ gap: 26 }}>
            <p className="eyebrow">Events</p>
            <h1 className="disp t-xl">
              The nights everyone <span className="it">posts about.</span>
            </h1>
            <p className="lede measure">
              COURTSIDE, Finals Night and the socials in between. Padel at the centre, with music, food and the hang
              all around it.
            </p>
            <div className="cta-row">
              <a className="btn btn-dark" href="#drops">
                Hear about the next one first
              </a>
              <Link className="btn btn-line" to="/book-pto">
                Throw your own
              </Link>
            </div>
          </div>
          <div className="collage">
            <Shot
              photo={photos.courtsideHitCrowd}
              priority
              sizes="(max-width: 900px) 62vw, 370px"
              at={{ left: "4%", top: "2%", width: "62%", height: "82%", transform: "rotate(-2deg)" }}
            />
            <Shot
              photo={photos.courtsideHost}
              sizes="(max-width: 900px) 44vw, 260px"
              at={{ right: 0, bottom: "2%", width: "44%", height: "54%", transform: "rotate(4deg)" }}
            />
          </div>
        </div>
      </section>

      {finals ? (
        <section className="sec sec-alt" style={{ padding: "96px 0" }}>
          <div className="wrap stack reveal" style={{ gap: 28 }}>
            <Head eyebrow="Coming up">On the calendar</Head>
            <article className="event-row">
              <div className="event-date card-lime">
                {isSet(leagueFacts.finalsDate) ? (
                  <>
                    <span className="eyebrow">{longDay(leagueFacts.finalsDate).split(",")[0]}</span>
                    <span className="disp" style={{ fontSize: 30 }}>
                      {longDay(leagueFacts.finalsDate).split(", ")[1]}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="eyebrow">Date</span>
                    <span className="disp" style={{ fontSize: 26 }}>
                      Soon
                    </span>
                  </>
                )}
              </div>
              <div className="stack" style={{ gap: 8 }}>
                <p className="eyebrow eyebrow-leaf">PTO League</p>
                <h3 className="disp t-card">Season 1 Finals Night</h3>
                <p className="body" style={{ fontSize: 16 }}>
                  {isSet(leagueFacts.finalsVenue) ? `${leagueFacts.finalsVenue} · ` : ""}The top of each division plays
                  for the title. Trophies, awards and the whole league in one room.
                </p>
              </div>
              <Link className="btn btn-dark" to="/league">
                See the league
              </Link>
            </article>
          </div>
        </section>
      ) : null}

      <section className="sec-dark" style={{ padding: "100px 0" }}>
        <div className="wrap stack" style={{ gap: 48 }}>
          <div className="split reveal" style={{ gap: 32 }}>
            <div className="stack" style={{ gap: 12 }}>
              <p className="eyebrow">Our summer day party</p>
              <h2 className="disp t-giant">COURTSIDE</h2>
              <p
                className="lime-it"
                style={{ margin: 0, fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontSize: 28 }}
              >
                by Club PTO
              </p>
            </div>
            <p className="body" style={{ maxWidth: 420 }}>
              Think day party, with padel at the centre. Open courts all afternoon, a tournament running through it,
              DJ sets and golden hour at The Pad.
            </p>
          </div>
          <div className="g2 reveal" style={{ gap: 24 }}>
            {[
              { s: courtside.seriesOne, photo: photos.courtsideSeriesOne },
              { s: courtside.seriesTwo, photo: photos.courtsideDj, focus: "50% 35%" },
            ].map(({ s, photo, focus }) => (
              <article key={s.label} style={{ background: "#173724", display: "flex", flexDirection: "column" }}>
                <div style={{ aspectRatio: "3 / 2", overflow: "hidden" }}>
                  <Photo photo={photo} focus={focus} sizes="(max-width: 900px) 100vw, 600px" />
                </div>
                <div className="stack" style={{ padding: 28, gap: 10 }}>
                  <p className="eyebrow">{s.label}</p>
                  <h3 className="disp" style={{ fontSize: 40 }}>
                    {s.title}
                  </h3>
                  <p className="body" style={{ fontSize: 16 }}>
                    {s.text}
                  </p>
                  <a href="https://www.instagram.com/club_pto/" style={{ fontWeight: 700, marginTop: 6 }}>
                    Watch the recap on Instagram
                  </a>
                </div>
              </article>
            ))}
          </div>
          <div className="g4 keep-cols">
            {[photos.courtsideGuests, photos.courtsideNet, photos.courtsideLunge, photos.goldenHourPoint].map((p) => (
              <div key={p.alt} style={{ aspectRatio: "3 / 4", overflow: "hidden" }}>
                <Photo photo={p} sizes="(max-width: 900px) 50vw, 300px" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" style={{ padding: "100px 0" }}>
        <div className="wrap stack reveal" style={{ gap: 36 }}>
          <Head eyebrow="From the community">
            More nights <span className="it">like these</span>
          </Head>
          <div className="g3">
            <article className="stack" style={{ gap: 14 }}>
              <div style={{ aspectRatio: "4 / 3", overflow: "hidden" }}>
                <Photo photo={photos.gamesNight} sizes="(max-width: 900px) 100vw, 400px" />
              </div>
              <p className="eyebrow eyebrow-leaf">
                Community night
              </p>
              <h3 className="disp" style={{ fontSize: 30 }}>
                Indoor Games Night
              </h3>
              <p className="body" style={{ fontSize: 16 }}>
                Padel on the courts, games in the lounge, music all night.
              </p>
            </article>
            <article className="stack" style={{ gap: 14 }}>
              <div style={{ aspectRatio: "4 / 3", overflow: "hidden" }}>
                <Photo photo={photos.oneYear} sizes="(max-width: 900px) 100vw, 400px" />
              </div>
              <p className="eyebrow eyebrow-leaf">{communityNights.anniversaryMonth}</p>
              <h3 className="disp" style={{ fontSize: 30 }}>
                One year of PTO
              </h3>
              <p className="body" style={{ fontSize: 16 }}>
                One year of new faces becoming familiar ones. We threw a party for the people who built this.
              </p>
            </article>
            <Link to="/book-pto" className="stack" style={{ gap: 14, textDecoration: "none", color: "#0E2418" }}>
              <div style={{ aspectRatio: "4 / 3", overflow: "hidden" }}>
                <Photo photo={photos.groupDinner} sizes="(max-width: 900px) 100vw, 400px" />
              </div>
              <p className="eyebrow eyebrow-leaf">Your date</p>
              <h3 className="disp" style={{ fontSize: 30 }}>
                Your event, run by PTO
              </h3>
              <p className="body" style={{ fontSize: 16 }}>
                Birthdays, team nights, client nights. You bring the people, we run the rest.{" "}
                <span style={{ fontWeight: 700, textDecoration: "underline" }}>Check a date</span>
              </p>
            </Link>
          </div>
        </div>
      </section>

      <section id="drops" className="sec-lime" style={{ padding: "72px 0" }}>
        <div className="wrap split" style={{ alignItems: "center", gap: 32 }}>
          <div className="stack" style={{ gap: 10 }}>
            <h2 className="disp t-m">
              Don't find out <span className="it">from someone's story.</span>
            </h2>
            <p className="body" style={{ color: "#0E2418" }}>
              {emailCaptureReady()
                ? "Event drops land in your inbox before they hit Instagram."
                : `Event drops land on ${club.instagramHandle} first.`}
            </p>
          </div>
          <EmailCapture buttonLabel="Get event drops" source="events-drops" />
        </div>
      </section>
    </>
  );
};

export default Events;
