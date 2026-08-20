// summary-states slice, frame 25 Session summary, the two empties, the score
// error, and the three confirmation sheets.
//
// Frame 25 changed what the summary IS. It used to be a dashboard that also
// knew how to build a WhatsApp message; it is now the message itself, shown in
// monospace, with the buttons under it. Everything the old screen rendered
// twice, once as a table and once as text, it now renders once.
//
// The two empties are REGIONS, not screens. Both frames are crops of a setup
// screen that keeps running around them: 27a is what replaces the roster list
// when a search matches nobody, 27b is what replaces a court's names when
// nobody is on it. An earlier pass built the first of these as a full screen
// and it stranded the operator mid-wizard with no way back, which is the
// reason they are shaped this way.
//
// The three confirms live here rather than beside the screens they interrupt
// because they are one sheet with three sets of words, and frame 26 gives them
// one job: name exactly what will be lost. Keeping them together is what stops
// that promise being kept on two sheets out of three. Their shared heading and
// paragraph are in confirm-sheet.tsx, which is internal to the slice.

export { SessionSummary, buildWhatsAppPayload } from "./SessionSummary";
export type {
  SessionSummaryProps, SummaryChampion, SummaryCourtStandings, SummaryStandingRow,
} from "./SessionSummary";

export { EmptyRosterSearch } from "./EmptyRosterSearch";
export type { EmptyRosterSearchProps } from "./EmptyRosterSearch";

export { EmptyCourtUnassigned } from "./EmptyCourtUnassigned";
export type { EmptyCourtUnassignedProps } from "./EmptyCourtUnassigned";

export { ErrorScoreNotSaved } from "./ErrorScoreNotSaved";
export type { ErrorScoreNotSavedProps } from "./ErrorScoreNotSaved";

export { ConfirmVoidResult } from "./ConfirmVoidResult";
export type { ConfirmVoidResultProps } from "./ConfirmVoidResult";

export { ConfirmDeletePlayoff } from "./ConfirmDeletePlayoff";
export type { ConfirmDeletePlayoffProps } from "./ConfirmDeletePlayoff";

export { ConfirmEndNight } from "./ConfirmEndNight";
export type { ConfirmEndNightProps } from "./ConfirmEndNight";

export { pad2, signed, joinPair } from "./format";
