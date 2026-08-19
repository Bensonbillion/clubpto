// Slice `play` — Job 2, Score the games.
// Frames 10 Court view, 11 Score entry, 12 Court switcher.

export { CourtView } from "./CourtView";
export type { CourtViewProps } from "./CourtView";

export { ScoreEntry } from "./ScoreEntry";
export type { ScoreEntryProps } from "./ScoreEntry";

export { CourtSwitcher } from "./CourtSwitcher";
export type { CourtSwitcherProps } from "./CourtSwitcher";

// Shared pieces. Frames 25 and 26 in the States group consume CourtStrip.
export { CourtStrip } from "./CourtStrip";
export type { CourtStripProps } from "./CourtStrip";

export { MatchCard } from "./MatchCard";
export type { MatchCardProps } from "./MatchCard";

export { RoundHeader } from "./RoundHeader";
export type { RoundHeaderProps } from "./RoundHeader";

export { WaitingBlock } from "./WaitingBlock";
export type { WaitingBlockProps } from "./WaitingBlock";

export { padScore } from "./model";
export type { CourtStatus, CourtSummary, PairSide, WaitingPlayer } from "./model";
