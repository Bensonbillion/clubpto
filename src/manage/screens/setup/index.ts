// Slice `setup` — Job 1, the wizard.
// Frames 05 Which night, 06 Who is here, 07 Courts, 08 How many matches each,
// 09 Ready, plus frame 06's error variant carried over from v1 frame 25b.
//
// One decision per screen, the running count in the footer, and a button that
// names the next screen. Back is non-destructive at every step, including out
// of frame 05 to Home.

export { WhichNight } from "./WhichNight";
export type { WhichNightProps, NightOption } from "./WhichNight";

export { WhoIsHere } from "./WhoIsHere";
export type { WhoIsHereProps, RosterRow } from "./WhoIsHere";

export { RosterFailed } from "./RosterFailed";
export type { RosterFailedProps } from "./RosterFailed";

export { Courts } from "./Courts";
export type { CourtsProps, SetupCourt, CourtChip } from "./Courts";

export { MatchesEach } from "./MatchesEach";
export type { MatchesEachProps } from "./MatchesEach";

export { Ready } from "./Ready";
export type { ReadyProps } from "./Ready";

// The shared wizard shell. Every frame above is built from these.
export { SETUP, TopBar, StepCounter, H1, Sub, QuietLine, pad2 } from "./shell";
