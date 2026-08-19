// Frame 14 — Late arrival.
//
// Full screen, not a sheet. The consequence paragraph is body text on purpose:
// it is the thing that stops a bad tap, so it is not fine print.

import type { CSSProperties } from "react";
import { Num, Screen, Body, FooterBar, PrimaryButton, T } from "../../ui/primitives";

export interface LateArrivalCourt {
  courtNumber: number;
  /** "Court 1", "Court 2" ... */
  label: string;
  /** Players currently attached to that court. */
  playingCount: number;
}

export interface LateArrivalProps {
  /** The typed or picked name. Data, not fixed copy. */
  name: string;
  onNameChange: (name: string) => void;
  /** True when the typed name matches somebody on tonight's roster. */
  foundInRoster: boolean;
  courts: LateArrivalCourt[];
  /**
   * Preselect the court with the fewest players; break ties by lowest court
   * number. Null before the counts resolve.
   */
  selectedCourtNumber: number | null;
  onSelectCourt: (courtNumber: number) => void;
  onCancel: () => void;
  onAdd: () => void;
}

const LABEL: CSSProperties = {
  font: "700 14px Inter, sans-serif", letterSpacing: ".06em", textTransform: "uppercase",
  color: T.ink45, margin: 0,
};

export const LateArrival = ({
  name, onNameChange, foundInRoster, courts, selectedCourtNumber, onSelectCourt, onCancel, onAdd,
}: LateArrivalProps) => {
  const selected = courts.find((c) => c.courtNumber === selectedCourtNumber) ?? null;
  const typed = name.trim().length > 0;
  const ready = typed && selected != null;

  return (
    <Screen>
      <div style={{
        padding: "14px 18px", borderBottom: `1px solid ${T.lineSoft}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button type="button" onClick={onCancel} style={{
          border: "none", background: "transparent", color: T.ink,
          font: "600 16px Inter, sans-serif", cursor: "pointer", padding: 0,
        }}>Cancel</button>
        <div style={{ font: "700 17px Inter, sans-serif" }}>Add a player</div>
      </div>

      <Body style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={LABEL}>Name</p>
          <input
            value={name}
            autoFocus
            onChange={(e) => onNameChange(e.target.value)}
            style={{
              height: 52, width: "100%", boxSizing: "border-box",
              border: `2px solid ${T.ink}`, borderRadius: T.radius, padding: "0 14px",
              background: "transparent", color: T.ink, outline: "none",
              font: "600 18px Inter, sans-serif",
            }}
          />
          {typed && (foundInRoster ? (
            <p style={{ font: "400 14px Inter, sans-serif", color: T.ink55, margin: 0 }}>
              Found in the roster. Marked here for tonight.
            </p>
          ) : (
            /*
              FLAG: frame 14 draws no "not in the roster" helper. These two
              lines are borrowed verbatim from v2 frame 24 (Empty, roster
              search) as the spec directs, and need sign-off. Frame 24's
              confirm label, Add "{name}" as a walk-in, is NOT adopted: it
              drops the court, which frame 14's own button law requires. That
              conflict needs resolving in copy, not here.
            */
            <>
              <p style={{ font: "400 14px Inter, sans-serif", color: T.ink55, margin: 0 }}>
                Nobody in the roster matches "{name}".
              </p>
              <p style={{ font: "400 14px Inter, sans-serif", color: T.ink55, margin: 0 }}>
                Walk-ins are normal. Add the name and they play tonight only.
              </p>
            </>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={LABEL}>Court</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {courts.map((court) => {
              const on = court.courtNumber === selectedCourtNumber;
              return (
                <button key={court.courtNumber} type="button" onClick={() => onSelectCourt(court.courtNumber)}
                  style={{
                    flex: "1 1 120px", textAlign: "left", cursor: "pointer",
                    border: on ? `2px solid ${T.ink}` : `1px solid ${T.line}`,
                    background: on ? T.lime : "transparent",
                    color: on ? T.limeInk : T.ink,
                    borderRadius: T.radius, padding: 14,
                    display: "flex", flexDirection: "column", gap: 2,
                  }}>
                  <span style={{ font: "700 17px Inter, sans-serif" }}>{court.label}</span>
                  <span style={{
                    font: "400 14px Inter, sans-serif", color: on ? T.limeInk : T.ink55,
                  }}>
                    <Num size={19}>{court.playingCount}</Num>{" "}playing
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {ready && (
          <p style={{
            borderTop: `1px solid ${T.lineSoft}`, paddingTop: 16, margin: 0,
            font: "400 16px/1.45 Inter, sans-serif", textWrap: "pretty",
          }}>
            {/*
              FLAG: the wireframe reads "He gets one back-to-back to catch up".
              The spec directs the name-safe rewrite "They get one back-to-back
              to catch up" and leaves the rest untouched, which leaves "and
              starts" disagreeing with "They get". One word ("start") fixes it,
              but that is a copy change and needs sign-off, so the directed
              string ships as written.
            */}
            {name} joins the {selected.label} queue and is in the next match. They get one
            back-to-back to catch up, and starts on <Num size={20}>0</Num> games played.
          </p>
        )}
      </Body>

      <FooterBar helper="Nothing already played changes.">
        {/*
          FLAG: the inert state's label is not drawn. Rather than render the
          template with holes ("Add  to "), it falls back to this frame's own
          title copy. Needs sign-off.
        */}
        <PrimaryButton disabled={!ready} onClick={onAdd}>
          {ready ? `Add ${name} to ${selected.label}` : "Add a player"}
        </PrimaryButton>
      </FooterBar>
    </Screen>
  );
};

export default LateArrival;
