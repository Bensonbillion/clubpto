// Frame 37, Team endings. Readiness in the shape of frame 21, two doors
// instead of one.
//
// Every pair has met its target and the order resolves itself. The table
// can be crowned as it stands, or seeded into a straight pairs knockout,
// first against last, with the same byes and play-ins the knockout door
// gives any count. The champion screen is the same one either way.

import type { ReactNode } from "react";
import { Body, Card, Eyebrow, FooterBar, Screen, T } from "../../ui/primitives";
import { Heading, PlayoffHeader } from "../playoffs/PlayoffHeader";

export interface TeamEndingsProps {
  header?: ReactNode;
  pairCount: number;
  /** engine/knockout.ts knockoutShape for this many pairs, lower-cased into the sentence. */
  bracketShape: string | null;
  onCrown: () => void;
  onSeedBracket: () => void;
}

const Door = ({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: "block", width: "100%", padding: 0, border: "none",
      background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer",
    }}
  >
    <Card style={{ gap: 0 }}>
      <p style={{ fontFamily: T.fontHead, fontSize: 18, margin: "0 0 6px" }}>{title}</p>
      <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0 }}>{detail}</p>
    </Card>
  </button>
);

export const TeamEndings = ({ header, pairCount, bracketShape, onCrown, onSeedBracket }: TeamEndingsProps) => (
  <Screen>
    {header}
    <PlayoffHeader
      left={<Heading>The table is settled. How do the teams end?</Heading>}
      right={<Eyebrow>Targets met</Eyebrow>}
    />
    <p style={{
      font: `400 15px/1.5 ${T.fontBody}`, color: T.mut,
      padding: "0 22px", margin: "8px 0 0", textWrap: "pretty",
    }}>
      Every pair has met its target and the order resolves itself.
    </p>

    <Body style={{ padding: "18px 22px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
      <Door
        title="Crown the table"
        detail="The top pair are the champions as they stand."
        onClick={onCrown}
      />
      <Door
        title="Seed the bracket"
        detail="A straight pairs knockout from the table, first against last."
        onClick={onSeedBracket}
      />
      {bracketShape != null && (
        <p style={{ font: `400 14px/1.5 ${T.fontBody}`, color: T.mut, margin: "4px 2px 0" }}>
          With {pairCount} pairs: {bracketShape.charAt(0).toLowerCase() + bracketShape.slice(1)}
        </p>
      )}
    </Body>

    <FooterBar helper="Pick how the teams end.">{null}</FooterBar>
  </Screen>
);

export default TeamEndings;
