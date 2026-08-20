// Frame 27a, Empty, roster search.
//
// The frame is a crop of frame 06, "Who is here": the search field with "Sope"
// typed into it, and where the roster list was, this. It is built as the
// REGION, not as a screen, and the reason is written into an earlier version
// of this slice: a full-screen empty state was tried, and routing to it left
// the operator mid-wizard with no top bar and no way back. The list is what
// goes away when nothing matches. The header, the field and the footer stay.
//
// So "Who is here" renders its own field and drops this in where the rows
// were. The query is passed in because the sentence and the button both say
// it back.

import { SecondaryButton, T } from "../../ui/primitives";

export interface EmptyRosterSearchProps {
  /** Exactly what the operator typed. Named twice in the drawn copy. */
  query: string;
  /**
   * Adds the typed name as a walk-in: tonight only, never onto the permanent
   * roster. The caller keeps the field's text, so the name is handed back
   * rather than read out of the input again.
   */
  onAddWalkIn: (name: string) => void;
}

export const EmptyRosterSearch = ({ query, onAddWalkIn }: EmptyRosterSearchProps) => (
  <div style={{
    flex: 1, display: "flex", flexDirection: "column",
    justifyContent: "center", alignItems: "center", gap: 16, padding: 26,
  }}>
    <p style={{
      font: `400 15px/1.55 ${T.fontBody}`, color: T.mut, margin: 0,
      textAlign: "center", textWrap: "pretty",
    }}>{`No one called ${query} on tonight's booking list.`}</p>

    {/* The empty state invites the action, so the button is the way out of the
        dead end rather than a note explaining it. It hugs its label instead of
        filling the width: it answers the sentence above it, and a full-width
        button here would outrank the footer's real next step. */}
    <SecondaryButton
      onClick={() => onAddWalkIn(query)}
      style={{ width: "auto", padding: "8px 24px" }}
    >{`Add ${query} as a walk-in`}</SecondaryButton>
  </div>
);
