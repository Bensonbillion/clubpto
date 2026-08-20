// Slice `setup`, Job 1, the wizard.
// Frames 05 Which night, 06 Who is here, 07 Split the courts, 08 Matches each,
// 09 Ready. Frames 27a and 27b are states of 06 and 07 and live inside them.
//
// Frame 06 had an error variant, "Tonight's bookings did not load", and it is
// gone. The list now falls back to the one that ships with the app, so there is
// no state in which the names are missing. A screen offering to retry a load
// that already succeeded would be a lie with a button on it, and its other
// action, add everyone by name, is what Who is here already does.
//
// One decision per screen, the running count in the footer, and a button that
// names the next screen. Back is non-destructive at every step, including out
// of frame 05 to Home.

export { WhichNight } from "./WhichNight";
export type { WhichNightProps, NightOption } from "./WhichNight";

export { WhoIsHere } from "./WhoIsHere";
export type { WhoIsHereProps, RosterRow, TierPrompt } from "./WhoIsHere";

export { Courts } from "./Courts";
export type { CourtsProps, SetupCourt, CourtChip } from "./Courts";

export { MatchesEach } from "./MatchesEach";
export type { MatchesEachProps, MatchesEachCourt } from "./MatchesEach";

export { Ready } from "./Ready";
export type { ReadyProps } from "./Ready";

// The shared wizard chrome. Every frame above is built from these.
export { SetupHeader, Why, Chip } from "./shell";
