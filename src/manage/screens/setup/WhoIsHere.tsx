// Frame 06 — Who is here. Step 2 of 4.
//
// The tick is the whole screen: only ticked people get put into matches, so
// the checkbox is the one thing with weight on each row and the lime fill is
// spent on the ticks, not on any second accent.
//
// The search field filters in place. When it matches nobody the list area is
// replaced by v2 frame 24, which is not a different screen — same header, same
// action bar, same running count. The query is interpolated into both the
// headline and the walk-in button, because the fastest fix for a name that is
// not on the list is to add it.

import { useRef } from "react";
import { Body, FooterBar, Num, PrimaryButton, Screen, SecondaryButton, T, TertiaryButton } from "../../ui/primitives";
import { H1, QuietLine, SETUP, StepCounter, Sub, TopBar } from "./shell";

/** Inline styles cannot reach ::placeholder, and the spec fixes its colour. */
const SEARCH_CSS = `.setup-roster-search::placeholder{color:rgba(244,237,224,.45);opacity:1}`;

export interface RosterRow {
  playerId: string;
  displayName: string;
  /** Ticked people are in tonight. Walk-ins arrive already ticked. */
  ticked: boolean;
  /**
   * A quiet second line under the name, set only when unticking will not
   * actually remove the person. Somebody who has played is pinned in the night
   * by their own results, and that is the one thing a row cannot say by
   * itself.
   */
  note?: string | null;
}

export interface WhoIsHereProps {
  /**
   * The whole roster for the selected night, sorted alphabetically by display
   * name, walk-ins included. The visible list is filtered from this; the
   * footer count is not, so it keeps counting people the search hides.
   */
  rows: RosterRow[];
  /**
   * Where these names came from, when it is worth saying. Null when the club
   * list loaded and there is nothing to explain.
   *
   * There is no error variant of this screen, and that is deliberate: the
   * roster falls back to the copy that ships with the app, so there is no
   * state where the list is missing. A screen offering to retry a load that
   * already succeeded would be a lie with a button on it.
   */
  rosterNote?: string | null;
  /** The live search text. Empty shows the placeholder. */
  query: string;
  onQueryChange: (query: string) => void;
  onToggle: (playerId: string) => void;
  /** The `+ Add a walk-in` row. Opens name entry. */
  onAddWalkIn: () => void;
  /** Frame 24's button: the typed query becomes the walk-in's name. */
  onAddWalkInNamed: (name: string) => void;
  onClearSearch: () => void;
  /** Back returns to frame 05 with the ticks intact. */
  onBack: () => void;
  onNext: () => void;
}

// FLAG: no loading variant is drawn for the roster fetch. Nothing is rendered
// for it here; the spec's suggested skeleton has no copy behind it.

const Checkbox = ({ on }: { on: boolean }) => (
  <span style={{
    width: 26, height: 26, borderRadius: 4, boxSizing: "border-box", flexShrink: 0,
    background: on ? T.lime : "transparent",
    border: on ? `2px solid ${T.ink}` : `2px solid ${SETUP.lineBox}`,
  }} />
);

export const WhoIsHere = ({
  rows, rosterNote, query, onQueryChange, onToggle, onAddWalkIn, onAddWalkInNamed, onClearSearch, onBack, onNext,
}: WhoIsHereProps) => {
  const searchRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();
  const visible = needle === ""
    ? rows
    : rows.filter((r) => r.displayName.toLowerCase().includes(needle));

  // The count is of everyone ticked, never of the filtered view: frame 24
  // still reads its running total while the list shows nothing.
  const inTonight = rows.filter((r) => r.ticked).length;
  const noMatches = trimmed !== "" && visible.length === 0;

  return (
    <Screen>
      <style>{SEARCH_CSS}</style>
      <TopBar onBack={onBack} right={<StepCounter step={2} />} />

      <div style={{ padding: "18px 18px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
        <H1>Who is here?</H1>
        <Sub>Only the people you tick get put into matches.</Sub>
        {rosterNote && <QuietLine>{rosterNote}</QuietLine>}
        <input
          ref={searchRef}
          className="setup-roster-search"
          value={query}
          placeholder="Search the roster"
          onChange={(e) => onQueryChange(e.target.value)}
          style={{
            height: 48, width: "100%", boxSizing: "border-box", borderRadius: T.radius,
            padding: "0 14px", background: "transparent", color: T.ink, outline: "none",
            // Typed text fills the field; empty falls back to the quiet outline.
            border: trimmed === "" ? `1px solid ${T.line}` : `2px solid ${T.ink}`,
            font: trimmed === "" ? "400 16px Inter, sans-serif" : "600 16px Inter, sans-serif",
          }}
        />
      </div>

      {noMatches ? (
        <Body style={{
          padding: "28px 18px", display: "flex", flexDirection: "column",
          gap: 14, alignItems: "flex-start",
        }}>
          <p style={{ font: "700 20px/1.3 Inter, sans-serif", margin: 0 }}>
            Nobody in the roster matches "{trimmed}".
          </p>
          <p style={{ font: "400 16px/1.45 Inter, sans-serif", color: T.ink68, margin: 0 }}>
            Walk-ins are normal. Add the name and they play tonight only.
          </p>
          <SecondaryButton
            onClick={() => onAddWalkInNamed(trimmed)}
            style={{ width: "auto", minHeight: 56, font: "700 17px Inter, sans-serif" }}
          >
            Add "{trimmed}" as a walk-in
          </SecondaryButton>
          <TertiaryButton onClick={onClearSearch} style={{ width: "auto", minHeight: 0 }}>
            Clear the search
          </TertiaryButton>
        </Body>
      ) : (
        // `overscrollBehavior` keeps a flick at the end of 66 rows inside the
        // list instead of dragging the page and unpinning the footer on iOS.
        <Body style={{ overscrollBehavior: "contain" }}>
          {visible.map((row) => (
            <button
              key={row.playerId}
              type="button"
              role="checkbox"
              aria-checked={row.ticked}
              onClick={() => onToggle(row.playerId)}
              style={{
                width: "100%", boxSizing: "border-box", cursor: "pointer", textAlign: "left",
                border: "none", borderTop: `1px solid ${SETUP.lineRow}`, background: "transparent",
                color: T.ink, padding: "12px 18px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              }}
            >
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ font: "600 16px Inter, sans-serif" }}>{row.displayName}</span>
                {row.note && (
                  <span style={{ font: "400 13px/1.35 Inter, sans-serif", color: T.ink55 }}>
                    {row.note}
                  </span>
                )}
              </span>
              <Checkbox on={row.ticked} />
            </button>
          ))}

          {/*
            With a 66 name roster this row sits about 3300px down, and it used
            to do nothing at all when the search box was empty: a silent no-op
            at the end of a long scroll. When there is nothing typed it now
            sends the operator back to the field, which is where the name has
            to go anyway.
          */}
          <button
            type="button"
            onClick={() => {
              if (trimmed === "") { searchRef.current?.focus(); return; }
              onAddWalkIn();
            }}
            style={{
              width: "100%", boxSizing: "border-box", cursor: "pointer", textAlign: "left",
              border: "none", borderTop: `1px solid ${SETUP.lineRow}`, background: "transparent",
              color: T.ink, padding: "14px 18px",
              display: "flex", alignItems: "center", gap: 8,
              font: "600 16px Inter, sans-serif",
            }}
          >
            {/* The plus rides the numeral face, as drawn. */}
            <Num size={24}>+</Num>Add a walk-in
          </button>
        </Body>
      )}

      <FooterBar helper={<><Num size={22}>{inTonight}</Num>{" "}in tonight.</>}>
        <PrimaryButton onClick={onNext}>Next: courts</PrimaryButton>
      </FooterBar>
    </Screen>
  );
};

export default WhoIsHere;
