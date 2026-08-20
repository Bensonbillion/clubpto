// Slice `people`, who is here, and what happens when that changes mid-night.
// Frames 14 Players tab, 15 Late arrival, 16 Correct or void,
// 16b Move courts mid-night, 16c Someone leaves early.
//
// The confirmation that stands between "Void this result" and the deletion is
// frame 28a, which lives in the summary-states slice with the other confirm
// sheets. This slice opens it and does not own it.

export { PlayersTab } from "./PlayersTab";
export type { PlayersTabProps, PlayersTabPlayer, PlayerStatus } from "./PlayersTab";

export { LateArrival } from "./LateArrival";
export type { LateArrivalProps, LateArrivalCourt, LateArrivalTier } from "./LateArrival";

export { CorrectOrVoid } from "./CorrectOrVoid";
export type { CorrectOrVoidProps, CorrectOrVoidMatch } from "./CorrectOrVoid";

export { MoveCourts } from "./MoveCourts";
export type { MoveCourtsProps, MoveCourtsCourt } from "./MoveCourts";

export { LeavesEarly } from "./LeavesEarly";
export type { LeavesEarlyProps } from "./LeavesEarly";

// No v3 frame. See the note at the top of Extend.tsx.
export { Extend } from "./Extend";
export type { ExtendProps } from "./Extend";

export { countWord, pairName } from "./model";
