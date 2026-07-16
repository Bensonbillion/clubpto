import { Link } from "react-router-dom";
import { navItems, socialLinks, clubInfo, courtsideII, weeklyMeets } from "@/lib/constants";

const Footer = () => {
  return (
    <footer className="rly-footer">
      <div className="rly-footer__inner">
        {/* Brand */}
        <div>
          <p className="rly-brand" style={{ fontSize: "1.6rem" }}>
            CLUB PTO<em>*</em>
          </p>
          <p
            className="rly-mono"
            style={{ fontSize: 11, color: "var(--chalk-dim)", marginTop: "0.8rem" }}
          >
            {clubInfo.tagline}
          </p>
        </div>

        {/* Navigate */}
        <div>
          <h4 className="rly-footer__heading">Navigate</h4>
          <nav>
            <Link to="/" className="rly-footer__link">
              Home
            </Link>
            {navItems.map((item) => (
              <Link key={item.href} to={item.href} className="rly-footer__link">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Connect */}
        <div>
          <h4 className="rly-footer__heading">Connect</h4>
          <a
            href={socialLinks.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="rly-footer__link"
          >
            @club_pto
          </a>
          <a href={`mailto:${clubInfo.email}`} className="rly-footer__link" style={{ textTransform: "none" }}>
            {clubInfo.email}
          </a>
          <span className="rly-footer__fact">{clubInfo.address}</span>
        </div>

        {/* On court */}
        <div>
          <h4 className="rly-footer__heading">On court</h4>
          <span className="rly-footer__fact">Weekly meets · {weeklyMeets.days}</span>
          <a
            href={courtsideII.ticketsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rly-footer__link"
          >
            {courtsideII.name} · {courtsideII.dateLabel} ↗
          </a>
        </div>
      </div>

      <div className="rly-footer__bottom">
        <div className="rly-footer__bottom-inner">
          <span>&copy; {new Date().getFullYear()} Club PTO · Toronto</span>
          <span>More than a game</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
