// Slice `play`, Job 2, the middle two hours.
// Frames 10 Court view, 11 Balance rule, 12 Score entry, 12b Schedule,
// 13 Both courts one device.
//
// The ellipsis chip in the header opens the night menu (frame 25b), which
// lives in the summary-states slice. This slice raises `onOpenNightMenu` and
// does not own it.

export { CourtView } from "./CourtView";
export type { CourtViewProps } from "./CourtView";

export { BalanceRule } from "./BalanceRule";
export type { BalanceRuleProps } from "./BalanceRule";

export { ScoreEntry, startValue } from "./ScoreEntry";
export type { ScoreEntryProps } from "./ScoreEntry";

export { Schedule } from "./Schedule";
export type { ScheduleProps } from "./Schedule";

export { CourtSwitcher } from "./CourtSwitcher";
export type { CourtSwitcherProps } from "./CourtSwitcher";

// Shared pieces.
export { CourtHeader } from "./CourtHeader";
export type { CourtHeaderProps } from "./CourtHeader";

export { MatchCard } from "./MatchCard";
export type { MatchCardProps } from "./MatchCard";

export { MatchNav } from "./MatchNav";
export type { MatchNavProps } from "./MatchNav";

export { ScoreSlat } from "./ScoreSlat";
export type { ScoreSlatProps } from "./ScoreSlat";

export { WaitingBlock } from "./WaitingBlock";
export type { WaitingBlockProps } from "./WaitingBlock";

export { courtActivityLine, joinNames, leastPlayedWords, mixingWords, padScore } from "./model";
export type {
  CourtActivity,
  CourtChip,
  CourtSummary,
  PairSide,
  ScheduleRow,
  ScheduleRowStatus,
  WaitingPlayer,
} from "./model";

// Frame 12's Save rule, which moved out of ScoreEntry.tsx on 2026-09-15 so a
// test could reach it. It is exported the same way as the copy builders above
// rather than hidden behind the component, because the thing that went wrong
// was a rule nobody could run.
export {
  BIG_SCORE,
  NOTHING_HELD,
  askedAbout,
  bigScoreHeld,
  heldLevel,
  levelLineHeld,
  saveIntent,
} from "./model";
export type { HeldLines, SaveIntent } from "./model";
