import { Link } from "react-router-dom";
import { photos } from "@/site/photos";
import { longDay, thursday, todayInToronto, venue } from "@/site/content";
import { Head, Photo, Qa, Seal, Shot, usePagePreview } from "@/site/ui/bits";

const Play = () => {
  usePagePreview("/play");
  const starting = todayInToronto() < thursday.firstDate ? ` from ${longDay(thursday.firstDate).replace(/^\w+, /, "")}` : "";

  return (
    <>
      <section className="sec-hero">
        <div className="wrap g2" style={{ alignItems: "center" }}>
          <div className="stack" style={{ gap: 26 }}>
            <p className="eyebrow">Thursday meets</p>
            <h1 className="disp t-xl">
              Thursday plans? <span className="it">Sorted.</span>
            </h1>
            <p className="lede measure">
              Padel every Thursday night. Three courts split by level, a new partner every round, and the hang after.
              Bring a friend or come solo.
            </p>
            <div className="facts">
              <div className="fact">
                <span>When</span>
                <span>
                  Every Thursday{starting} · {thursday.startTime} to {thursday.endTime}
                </span>
              </div>
              <div className="fact">
                <span>Where</span>
                <span>
                  {venue.name}, {venue.address}
                </span>
              </div>
              <div className="fact">
                <span>Price</span>
                <span>
                  {thursday.price} ({thursday.priceNote}) · no membership
                </span>
              </div>
            </div>
            <div className="cta-row">
              <a className="btn btn-dark" href={thursday.bookingUrl}>
                Grab a Thursday pass
              </a>
              <a className="btn btn-line" href="#how">
                How a night works
              </a>
            </div>
          </div>
          <div className="collage collage-tall">
            <Shot
              photo={photos.baselineReady}
              priority
              sizes="(max-width: 900px) 56vw, 330px"
              at={{ right: 0, bottom: "3%", width: "56%", height: "66%", transform: "rotate(3deg)", zIndex: 2 }}
            />
            <Shot
              photo={photos.thursdayPoster}
              sizes="(max-width: 900px) 58vw, 340px"
              at={{ left: 0, top: 0, width: "58%", height: "70%", transform: "rotate(-3deg)" }}
            />
            <Seal at={{ left: 0, bottom: "4%", width: 140, height: 140, transform: "rotate(-9deg)" }}>
              3 courts
              <br />
              every
              <br />
              level
            </Seal>
          </div>
        </div>
      </section>

      <section id="how" className="sec sec-alt" style={{ padding: "96px 0" }}>
        <div className="wrap stack reveal" style={{ gap: 44 }}>
          <Head eyebrow="How a night works">
            Two hours. <span className="it">Everyone plays.</span>
          </Head>
          <div className="g4">
            <div className="step">
              <span className="disp num">01</span>
              <h3 className="t-step">Check in</h3>
              <p className="body" style={{ fontSize: 16 }}>
                Say hi at the desk. First time? Tell us and we'll put you on the right court. Zero pressure.
              </p>
            </div>
            <div className="step">
              <span className="disp num">02</span>
              <h3 className="t-step">A new partner every round</h3>
              <p className="body" style={{ fontSize: 16 }}>
                It's called Americano. By the end of the night you've played with your whole court.
              </p>
            </div>
            <div className="step">
              <span className="disp num">03</span>
              <h3 className="t-step">Courts by level</h3>
              <p className="body" style={{ fontSize: 16 }}>
                Three courts split by level, so every game is close and nobody's carrying anyone.
              </p>
            </div>
            <div className="step">
              <span className="disp num">04</span>
              <h3 className="t-step">The hang</h3>
              <p className="body" style={{ fontSize: 16 }}>
                Stay after. The lounge is where new faces become familiar ones.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: "0 0 104px" }}>
        <div className="wrap strip reveal">
          <div>
            <Photo photo={photos.districtOverhead} sizes="(max-width: 900px) 33vw, 400px" />
          </div>
          <div>
            <Photo photo={photos.chasingBall} sizes="(max-width: 900px) 33vw, 400px" />
          </div>
          <div>
            <Photo photo={photos.districtSprint} sizes="(max-width: 900px) 33vw, 400px" />
          </div>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap g2 reveal" style={{ alignItems: "start" }}>
          <Head eyebrow="Questions">Good to know</Head>
          <div>
            <Qa q="Do I need a partner?" open>
              No. Come solo, that's kind of the point. Partners rotate every round, so you'll play with everyone on
              your court.
            </Qa>
            <Qa q="I've never played. Can I come?">
              Yes. Every level is welcome, true beginners included. Tell us at check-in and we'll put you on the right
              court.
            </Qa>
            <Qa q="What should I bring?">
              Something you can move in. Rackets and balls are provided. Court shoes are ideal, but clean sneakers
              work fine.
            </Qa>
            <Qa q="What if I can't make it?">
              Plans change. Give us 24 hours so your spot can go to someone else.
            </Qa>
            <Qa q="Is there something more competitive?">
              Oh, there is. The PTO League runs on Sundays, with your own ranking on a real table.{" "}
              <Link to="/league" style={{ fontWeight: 700 }}>
                See the league
              </Link>
            </Qa>
          </div>
        </div>
      </section>

      <section className="sec-dark" style={{ padding: "88px 0" }}>
        <div className="wrap split" style={{ alignItems: "center", gap: 32 }}>
          <div className="stack" style={{ gap: 12 }}>
            <h2 className="disp t-l">
              See you <span className="it">Thursday.</span>
            </h2>
            <p className="body">
              {thursday.startTime} at {venue.short}. {thursday.price} including HST.
            </p>
          </div>
          <div className="cta-row">
            <a className="btn btn-lime" href={thursday.bookingUrl}>
              Grab a Thursday pass
            </a>
            <Link className="btn btn-cream" to="/league">
              See the league
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default Play;
