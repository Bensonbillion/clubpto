// playoffs slice — frames 19a and 19b readiness, 20 bracket, 21 playoff match,
// 22 champion.
//
// One court, start to finish. Readiness, seeding, the bracket and the champion
// are per court and never merge, and two of these frames say so in copy.
//
// The bracket is a vertical stage list. If a future change turns it into a
// horizontal tree, that is a different design, not a refactor of this one.

export { PlayoffReadiness } from "./PlayoffReadiness";
export type { PlayoffReadinessProps, SeedingBlocker } from "./PlayoffReadiness";

export { Bracket } from "./Bracket";
export type { BracketProps } from "./Bracket";

export { PlayoffMatch } from "./PlayoffMatch";
export type { PlayoffMatchProps } from "./PlayoffMatch";

export { Champion } from "./Champion";
export type { ChampionProps } from "./Champion";

// Shared pieces. The score band is one component at three sizes (48 / 96 / 104)
// and every playoff frame that shows numbers uses it.
export { ScoreBand } from "./ScoreBand";
export type { ScoreBandProps } from "./ScoreBand";

export { BracketRow } from "./BracketRow";
export type { BracketRowProps } from "./BracketRow";

export { PlayoffHeader } from "./PlayoffHeader";
export type { PlayoffHeaderProps } from "./PlayoffHeader";

export { padScore, winnerFromScores, joinNames, countWord, topHalfSeedPairs } from "./model";
export type {
  PlayoffTeam,
  SeedPair,
  BracketMatch,
  BracketMatchStatus,
  BracketStage,
} from "./model";
