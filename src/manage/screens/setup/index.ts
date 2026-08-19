// Slice `setup` — Job 1, the wizard.
// Frames 05 Which night, 06 Who is here, 07 Courts, 08 How many matches each,
// 09 Ready.
//
// Frame 06 had an error variant, "Tonight's bookings did not load", and it is
// gone. The roster now falls back to the list that ships with the app, so
// there is no state in which the names are missing. A screen offering to retry
// a load that already succeeded would be a lie with a button on it, and its
// other action, add everyone by name, is what Who is here already does.
//
// One decision per screen, the running count in the footer, and a button that
// names the next screen. Back is non-destructive at every step, including out
// of frame 05 to Home.

export { WhichNight } from "./WhichNight";
export type { WhichNightProps, NightOption } from "./WhichNight";

export { WhoIsHere } from "./WhoIsHere";
export type { WhoIsHereProps, RosterRow } from "./WhoIsHere";

export { Courts } from "./Courts";
export type { CourtsProps, SetupCourt, CourtChip } from "./Courts";

export { MatchesEach } from "./MatchesEach";
export type { MatchesEachProps } from "./MatchesEach";

export { Ready } from "./Ready";
export type { ReadyProps } from "./Ready";

// The shared wizard shell. Every frame above is built from these.
export { SETUP, TopBar, StepCounter, H1, Sub, QuietLine, pad2 } from "./shell";
