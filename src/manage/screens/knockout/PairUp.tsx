// Frame 30, Pair up. The organiser makes the draw by hand.
//
// Tap one name, tap a second, the pair moves up into the draw. Tap a pair to
// break it. The draw's order IS the seeding, and "Shuffle the draw" reorders
// pairs without touching who plays with whom. Tier chips are visible here,
// the last setup surface that shows them: the organiser's own pairing is the
// balance, so the letters are information, never law.

import type { PlayerTier } from "../../types";
import { Body, Eyebrow, FooterBar, PrimaryButton, Screen, T, Tag } from "../../ui/primitives";
import { Chip, SetupHeader, Why } from "../setup/shell";

export interface PairUpName {
  id: string;
  name: string;
  tier?: PlayerTier | null;
}

export interface PairUpPair {
  seed: number;
  members: PairUpName[];
}

export interface PairUpProps {
  pairs: PairUpPair[];
  unpaired: PairUpName[];
  /** The first tap of a pair, waiting for its second. */
  heldId: string | null;
  onTapName: (id: string) => void;
  onTapPair: (seed: number) => void;
  onShuffle: () => void;
  onBack?: () => void;
  /** Absent while more than one name is unpaired: the draw is not whole. */
  onNext?: () => void;
  /**
   * The footer's state sentence: "Timi is held. Tap a second name to pair.",
   * or the trio line when one name is left over. Composed by the caller,
   * which knows the names.
   */
  helper: string;
}

const TierNote = ({ tier }: { tier?: PlayerTier | null }) =>
  tier != null
    ? <Tag size="sm">{tier}</Tag>
    : <span style={{ font: `400 12px ${T.fontBody}`, color: T.dim }}>Not assessed</span>;

export const PairUp = ({
  pairs, unpaired, heldId, onTapName, onTapPair, onShuffle, onBack, onNext, helper,
}: PairUpProps) => (
  <Screen>
    <SetupHeader title="Who plays together?" step="Setup · Sunday · Playoff" onBack={onBack} />
    <Why>
      Tap one name, tap a second, the pair moves up into the draw. Tap a pair
      to break it.
    </Why>

    <Body style={{ padding: "16px 22px 8px", overscrollBehavior: "contain" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Eyebrow style={{ color: T.mut }}>The draw, in order</Eyebrow>
        {pairs.length > 1 && (
          <button type="button" onClick={onShuffle} style={{
            border: "none", background: "transparent", cursor: "pointer",
            font: `600 13.5px ${T.fontBody}`, color: T.acc, padding: 4,
          }}>Shuffle the draw</button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "10px 0 0" }}>
        {pairs.map((p) => (
          <button
            key={p.seed}
            type="button"
            onClick={() => onTapPair(p.seed)}
            style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%",
              boxSizing: "border-box", padding: "11px 14px", cursor: "pointer",
              border: `1.5px solid ${T.line}`, borderRadius: T.radiusPanel,
              background: "transparent", color: "inherit", textAlign: "left",
            }}
          >
            <span style={{
              fontFamily: T.fontHead, fontSize: 16, minWidth: 18,
              fontVariantNumeric: "tabular-nums", color: T.soft,
            }}>{p.seed}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {p.members.map((m, i) => (
                <span key={m.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {i > 0 && <span style={{ color: T.soft }}>+</span>}
                  <span style={{ font: `600 15px ${T.fontBody}` }}>{m.name}</span>
                  <TierNote tier={m.tier} />
                </span>
              ))}
            </span>
          </button>
        ))}
        {pairs.length === 0 && (
          <p style={{ font: `400 14px ${T.fontBody}`, color: T.dim, margin: "2px 2px 0" }}>
            No pairs yet. The first two taps make one.
          </p>
        )}
      </div>

      <Eyebrow style={{ color: T.mut, margin: "18px 0 10px" }}>
        Unpaired · {unpaired.length}
      </Eyebrow>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {unpaired.map((m) => (
          <Chip
            key={m.id}
            on={m.id === heldId}
            onClick={() => onTapName(m.id)}
            style={{ minHeight: 38, padding: "4px 14px", fontSize: 14, gap: 7 }}
          >
            {m.name}
            {m.tier != null && <Tag size="sm">{m.tier}</Tag>}
          </Chip>
        ))}
        {unpaired.length === 0 && (
          <p style={{ font: `400 14px ${T.fontBody}`, color: T.dim, margin: 0 }}>
            Everyone is in the draw.
          </p>
        )}
      </div>
    </Body>

    <FooterBar helper={helper}>
      <PrimaryButton disabled={onNext == null} onClick={onNext}>Next: courts</PrimaryButton>
    </FooterBar>
  </Screen>
);

export default PairUp;
