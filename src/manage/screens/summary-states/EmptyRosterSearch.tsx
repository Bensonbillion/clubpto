// Frame 24a — Empty, roster search (v2 `1y`).
//
// The roster step with a query that matches nobody. Everything is left-aligned;
// v1 centred it and v2 does not.

import { Body, FooterBar, Num, PrimaryButton, Screen, SecondaryButton, T, TertiaryButton } from "../../ui/primitives";

export interface EmptyRosterSearchProps {
  /** The raw typed query, preserved verbatim including case. */
  query: string;
  /** Players marked present tonight. */
  confirmedCount: number;
  onQueryChange: (query: string) => void;
  /** Creates a tonight-only player from the raw query string. */
  onAddWalkIn: (name: string) => void;
  onClearSearch: () => void;
  onNext: () => void;
}

export const EmptyRosterSearch = ({
  query,
  confirmedCount,
  onQueryChange,
  onAddWalkIn,
  onClearSearch,
  onNext,
}: EmptyRosterSearchProps) => (
  <Screen>
    <div style={{
      padding: "18px 18px 12px", display: "flex", flexDirection: "column", gap: 12,
      borderBottom: `1px solid ${T.lineSoft}`,
    }}>
      <div style={{ font: "700 24px Inter, sans-serif" }}>Who is here?</div>
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        aria-label="Who is here?"
        style={{
          height: 48, border: `2px solid ${T.ink}`, borderRadius: T.radius,
          background: "transparent", color: T.ink, padding: "0 14px",
          font: "600 16px Inter, sans-serif", outline: "none",
          width: "100%", boxSizing: "border-box",
        }}
      />
    </div>

    <Body style={{
      padding: "28px 18px", display: "flex", flexDirection: "column", gap: 14,
      alignItems: "flex-start",
    }}>
      <div style={{ font: "700 20px/1.3 Inter, sans-serif" }}>
        {`Nobody in the roster matches "${query}".`}
      </div>
      <div style={{ font: "400 16px/1.45 Inter, sans-serif", color: T.ink68 }}>
        Walk-ins are normal. Add the name and they play tonight only.
      </div>
      {/* FLAG: a query that duplicates a name already in tonight's list is not
          drawn. This frame still offers the walk-in. */}
      <SecondaryButton onClick={() => onAddWalkIn(query)} style={{ width: "auto" }}>
        {`Add "${query}" as a walk-in`}
      </SecondaryButton>
      <TertiaryButton onClick={onClearSearch} style={{ width: "auto", textAlign: "left" }}>
        Clear the search
      </TertiaryButton>
    </Body>

    <FooterBar helper={<><Num size={22}>{confirmedCount}</Num> in tonight.</>}>
      <PrimaryButton onClick={onNext}>Next: courts</PrimaryButton>
    </FooterBar>
  </Screen>
);
