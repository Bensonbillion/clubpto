// summary-states slice — frame 23 Session summary, the two empties (24/25),
// the two errors, and the confirmation sheets.
//
// Two frames that were drawn here are gone. EmptyRosterSearch duplicated the
// no-matches branch Who is here already renders inline, without a top bar, so
// routing to it would have stranded the operator mid-wizard with no way back.
// ErrorBookingsNotLoaded described a roster failure that cannot happen now
// that the list ships with the app.
//
// The confirms live here rather than beside the screens they interrupt because
// every one of them is the same sheet with different words, and the frames
// weight them identically: the SAFE action is the filled button, the
// destructive one is outline-only. Keeping them together is what stops that
// inversion drifting apart one sheet at a time.

export { SessionSummary, buildWhatsAppPayload } from "./SessionSummary";
export { EmptyCourtUnassigned } from "./EmptyCourtUnassigned";
export { ErrorScoreNotSaved } from "./ErrorScoreNotSaved";
export { ConfirmVoidResult } from "./ConfirmVoidResult";
export { ConfirmDeletePlayoff } from "./ConfirmDeletePlayoff";
export { pad2, signed, joinPair } from "./format";
