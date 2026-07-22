import { useEffect } from "react";
import PageWrapper from "@/components/layout/PageWrapper";
import { weeklyMeets } from "@/lib/constants";

// Booking runs through Acuity. /book stays alive as a branded hand-off
// so old links and the Play nav item land somewhere that works.
const Book = () => {
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.replace(weeklyMeets.bookingUrl);
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <PageWrapper>
      <div
        className="rly-page"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div>
          <p className="rly-kicker" style={{ justifyContent: "center" }}>
            <span className="rly-dot" /> Booking
          </p>
          <h1
            className="rly-display"
            style={{ fontSize: "clamp(2.6rem, 8vw, 5rem)", marginTop: "0.8rem" }}
          >
            Off to the
            <br />
            <span className="rly-script">calendar.</span>
          </h1>
          <p
            className="rly-mono"
            style={{ fontSize: 15, color: "var(--chalk-dim)", marginTop: "1.6rem" }}
          >
            Sending you to our booking page
          </p>
          <div className="rly-cta-row" style={{ justifyContent: "center" }}>
            <a className="rly-pill" href={weeklyMeets.bookingUrl}>
              Continue to booking ↗
            </a>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
};

export default Book;
