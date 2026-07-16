import { courtsideII, weeklyMeets } from "@/lib/constants";

const items = [
  `${courtsideII.name} · ${courtsideII.dateLabel}`,
  courtsideII.venue,
  "Tickets live",
  `Weekly meets · ${weeklyMeets.days}`,
  "A padel social club in Toronto",
];

const Half = ({ hidden }: { hidden?: boolean }) => (
  <span
    aria-hidden={hidden}
    style={{ display: "inline-flex", alignItems: "center" }}
  >
    {items.map((item) => (
      <span key={item} style={{ display: "inline-flex", alignItems: "center" }}>
        <span className="rly-ticker__item">{item}</span>
        <span className="rly-ticker__sep">✦</span>
      </span>
    ))}
  </span>
);

const Ticker = () => (
  <div className="rly-ticker">
    <div className="rly-ticker__track">
      <Half />
      <Half hidden />
    </div>
  </div>
);

export default Ticker;
