import { weeklyMeets } from "@/lib/constants";

const items = [
  `Weekly sessions · ${weeklyMeets.days}`,
  "CA$20 · no membership",
  "Summer Series · wrapped",
  "A padel social club in Toronto",
  "Est. 2025",
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
