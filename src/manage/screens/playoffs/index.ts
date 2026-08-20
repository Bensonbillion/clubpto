// playoffs slice: frames 19 to 24.
//
// One court, start to finish: how it ends, whether it may seed, the bracket,
// the match, and both celebrations. Every surface is per court and none of them
// merge, which is why there are two champion screens and no crossover final.
//
// The bracket is a vertical stage list. If a future change turns it into a
// horizontal tree, that is a different design, not a refactor of this one.

export { HowThisCourtEnds } from "./HowThisCourtEnds";
export type { HowThisCourtEndsProps } from "./HowThisCourtEnds";

export { PlayoffReadiness } from "./PlayoffReadiness";
export type { PlayoffReadinessProps, SeedingBlocker } from "./PlayoffReadiness";

export { Bracket } from "./Bracket";
export type { BracketProps } from "./Bracket";

export { PlayoffMatch } from "./PlayoffMatch";
export type { PlayoffMatchProps } from "./PlayoffMatch";

export { Champion } from "./Champion";
export type { ChampionProps } from "./Champion";

export { IndividualChampion } from "./IndividualChampion";
export type { IndividualChampionProps, RunnerUpLine } from "./IndividualChampion";

// Shared pieces.
export { ScoreBand } from "./ScoreBand";
export type { ScoreBandProps } from "./ScoreBand";

export { BracketRow } from "./BracketRow";
export type { BracketRowProps } from "./BracketRow";

export { PlayoffHeader, Heading, CourtLabel, CourtChip } from "./PlayoffHeader";
export type { PlayoffHeaderProps } from "./PlayoffHeader";

export { DeepBar } from "./DeepBar";

export {
  scoreText,
  winnerFromScores,
  joinNames,
  joinPair,
  countWord,
  ordinalWord,
  seedPairLabel,
} from "./model";
export type {
  PlayoffTeam,
  SeedPair,
  BracketWaiting,
  BracketSide,
  BracketMatch,
  BracketMatchStatus,
  BracketStage,
} from "./model";
