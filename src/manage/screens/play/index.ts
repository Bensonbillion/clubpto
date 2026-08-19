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

export { ScoreEntry } from "./ScoreEntry";
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

export { courtActivityLine, joinNames, padScore } from "./model";
export type {
  CourtActivity,
  CourtChip,
  CourtSummary,
  PairSide,
  ScheduleRow,
  ScheduleRowStatus,
  WaitingPlayer,
} from "./model";
