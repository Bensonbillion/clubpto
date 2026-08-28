// Frame 32, Knockout ready. The draw, as it will run.
//
// The first round listed whole before anything starts: byes named as byes,
// play-ins with their empty slats, and one sentence of shape on top. The
// plate is offered here, before the night, because "everyone knocked out in
// round one plays their own small bracket" is a promise worth making while
// the room can still hear it.

import { Body, Card, Eyebrow, FooterBar, Num, PrimaryButton, Screen, T, Tag } from "../../ui/primitives";
import { Chip, SetupHeader } from "../setup/shell";

export interface ReadyTieRow {
  /** "Kayode + Chizea" over "Ayo + Tumi": composed by the caller. */
  a: string;
  b: string;
  seedA: number;
  seedB: number;
}

export interface KnockoutReadyProps {
  pairCount: number;
  /** engine/knockout.ts knockoutShape: the sentence over the list. */
  shape: string;
  /** The label over the first round's rows: "Play-ins", "Quarterfinals". */
  firstRoundLabel: string;
  /** Sides seeded straight through, named with their seeds. */
  byes: { name: string; seed: number }[];
  ties: ReadyTieRow[];
  /** What follows the listed round: "Semifinals and the final, drawn as play-in winners land." */
  thenLine: string | null;
  /** The rotating trio's sentence, when the draw holds one. */
  trioLine?: string | null;
  plate: boolean;
  onPlate: (on: boolean) => void;
  onBack?: () => void;
  onStart: () => void;
}

export const KnockoutReady = ({
  pairCount, shape, firstRoundLabel, byes, ties, thenLine, trioLine,
  plate, onPlate, onBack, onStart,
}: KnockoutReadyProps) => (
  <Screen>
    <SetupHeader title="The draw, as it will run." step="Setup · Sunday · Playoff" onBack={onBack} />
    <p style={{
      font: `400 15px/1.5 ${T.fontBody}`, color: T.mut,
      padding: "0 22px", margin: "8px 0 0", textWrap: "pretty",
    }}>
      <Num size={15}>{pairCount}</Num> pairs. {shape}
    </p>

    <Body style={{ padding: "16px 22px 8px", overscrollBehavior: "contain" }}>
      <Eyebrow style={{ color: T.mut, margin: "0 0 10px" }}>{firstRoundLabel}</Eyebrow>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {byes.map((s) => (
          <div key={s.seed} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            border: `1.5px solid ${T.line}`, borderRadius: T.radiusPanel, padding: "11px 14px",
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ font: `600 15px ${T.fontBody}` }}>{s.name}</span>
              <Tag size="sm" tone="quiet">{s.seed}</Tag>
            </span>
            <Tag size="sm">Bye</Tag>
          </div>
        ))}
        {ties.map((tie) => (
          <div key={tie.seedA} style={{
            border: `1.5px solid ${T.line}`, borderRadius: T.radiusPanel, padding: "11px 14px",
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            {[{ n: tie.a, s: tie.seedA }, { n: tie.b, s: tie.seedB }].map((side) => (
              <div key={side.s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ font: `600 15px ${T.fontBody}` }}>{side.n}</span>
                  <Tag size="sm" tone="quiet">{side.s}</Tag>
                </span>
                <Num size={18} style={{ color: T.dim }}>00</Num>
              </div>
            ))}
          </div>
        ))}
      </div>

      {thenLine != null && (
        <>
          <Eyebrow style={{ color: T.mut, margin: "16px 0 6px" }}>Then</Eyebrow>
          <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0 }}>
            {thenLine}
          </p>
        </>
      )}
      {trioLine != null && trioLine !== "" && (
        <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: "10px 0 0" }}>
          {trioLine}
        </p>
      )}

      <Card style={{ gap: 10, marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span>
            <span style={{ display: "block", font: `600 15px ${T.fontBody}` }}>
              Plate for first-round losers
            </span>
            <span style={{ display: "block", font: `400 13.5px/1.5 ${T.fontBody}`, color: T.mut, marginTop: 2 }}>
              Everyone knocked out in round one plays their own small bracket.
            </span>
          </span>
          <Chip radio on={plate} onClick={() => onPlate(!plate)}
            style={{ minHeight: 36, padding: "4px 14px", fontSize: 13 }}>
            {plate ? "On" : "Off"}
          </Chip>
        </div>
      </Card>
    </Body>

    <FooterBar helper="Byes and the trio absorb whatever the pairing leaves.">
      <PrimaryButton onClick={onStart}>Start the knockout</PrimaryButton>
    </FooterBar>
  </Screen>
);

export default KnockoutReady;
