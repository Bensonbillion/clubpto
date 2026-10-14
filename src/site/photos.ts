// Every photo the public site shows, with its alt text, in one place.
//
// Imported with ?picture, so each one ships as AVIF + WebP + JPEG at three
// widths (see vite.config.ts). Full color always: no grayscale or filters.
// Benson picked every photo here, so swap a file rather than adding faces.

import doublesPoint from "@/assets/site/doubles-point.jpg?picture";
import overheadSwing from "@/assets/site/overhead-swing.jpg?picture";
import thursdayCrew from "@/assets/site/thursday-crew.jpg?picture";
import forehandLoad from "@/assets/site/forehand-load.jpg?picture";
import leagueReady from "@/assets/site/league-ready.jpg?picture";
import courtsideDj from "@/assets/site/courtside-dj.jpg?picture";
import groupOnCourt from "@/assets/site/group-on-court.jpg?picture";
import goldenHourPoint from "@/assets/site/golden-hour-point.jpg?picture";
import betweenGames from "@/assets/site/between-games.jpg?picture";
import courtsideTradingShots from "@/assets/site/courtside-trading-shots.jpg?picture";
import courtsideFunSign from "@/assets/site/courtside-fun-sign.jpg?picture";
import courtsideLunge from "@/assets/site/courtside-lunge.jpg?picture";
import courtsideCrowd from "@/assets/site/courtside-crowd.jpg?picture";
import groupDinner from "@/assets/site/group-dinner.jpg?picture";
import baselineReady from "@/assets/site/baseline-ready.jpg?picture";
import thursdayPoster from "@/assets/site/thursday-poster.jpg?picture";
import districtOverhead from "@/assets/site/district-overhead.jpg?picture";
import chasingBall from "@/assets/site/chasing-ball.jpg?picture";
import districtSprint from "@/assets/site/district-sprint.jpg?picture";
import leaguePair from "@/assets/site/league-pair.jpg?picture";
import courtsideHitCrowd from "@/assets/site/courtside-hit-crowd.jpg?picture";
import courtsideHost from "@/assets/site/courtside-host.jpg?picture";
import courtsideSeriesOne from "@/assets/site/courtside-series-one.jpg?picture";
import courtsideGuests from "@/assets/site/courtside-guests.jpg?picture";
import courtsideNet from "@/assets/site/courtside-net.jpg?picture";
import gamesNight from "@/assets/site/games-night.jpg?picture";
import oneYear from "@/assets/site/one-year.jpg?picture";
import loungeAfter from "@/assets/site/lounge-after.jpg?picture";
import type { PictureSource } from "@/components/ui/Picture";

export interface SitePhoto {
  img: PictureSource;
  alt: string;
  /** CSS object-position, when the subject is not centred. */
  focus?: string;
}

const p = (img: PictureSource, alt: string, focus?: string): SitePhoto => ({ img, alt, focus });

export const photos = {
  doublesPoint: p(doublesPoint, "A doubles point at District Padel"),
  overheadSwing: p(overheadSwing, "A player hitting an overhead at District Padel"),
  thursdayCrew: p(thursdayCrew, "Four PTO regulars at a Thursday meet"),
  forehandLoad: p(forehandLoad, "A player loading up for a forehand at District Padel"),
  leagueReady: p(leagueReady, "A PTO League player set at the net during a Sunday match", "50% 38%"),
  courtsideDj: p(courtsideDj, "A DJ set at COURTSIDE Series II"),
  groupOnCourt: p(groupOnCourt, "A PTO group photo on court"),
  goldenHourPoint: p(goldenHourPoint, "Two players mid-point at golden hour at COURTSIDE"),
  betweenGames: p(betweenGames, "Players crowding around between games"),
  courtsideTradingShots: p(courtsideTradingShots, "Two players trading shots at COURTSIDE"),
  courtsideFunSign: p(courtsideFunSign, "A player returning a ball under the Club PTO sign at COURTSIDE"),
  courtsideLunge: p(courtsideLunge, "A player lunging for a low ball at COURTSIDE"),
  courtsideCrowd: p(courtsideCrowd, "A crowd watching a match at COURTSIDE at The Pad"),
  groupDinner: p(groupDinner, "A PTO group laughing around a long table"),
  baselineReady: p(baselineReady, "A player set at the baseline during a Thursday meet at District Padel"),
  thursdayPoster: p(thursdayPoster, "The poster announcing Thursday meets at District Padel and Pickleball"),
  districtOverhead: p(districtOverhead, "A player hitting an overhead during a Thursday meet at District Padel"),
  chasingBall: p(chasingBall, "A player chasing down a ball at District Padel"),
  districtSprint: p(districtSprint, "A player sprinting to the ball at District Padel"),
  leaguePair: p(leaguePair, "Two league players posing with a racket"),
  courtsideHitCrowd: p(courtsideHitCrowd, "A player hitting while the crowd watches at COURTSIDE"),
  courtsideHost: p(courtsideHost, "The host on the mic at COURTSIDE"),
  courtsideSeriesOne: p(courtsideSeriesOne, "A doubles match at golden hour during COURTSIDE Series I"),
  courtsideGuests: p(courtsideGuests, "Two guests at COURTSIDE"),
  courtsideNet: p(courtsideNet, "Players at the net at COURTSIDE"),
  gamesNight: p(gamesNight, "Foosball at the Indoor Games Night"),
  oneYear: p(oneYear, "Friends celebrating at the PTO one-year anniversary", "50% 62%"),
  loungeAfter: p(loungeAfter, "Regulars in the lounge after play"),
} as const;

export type PhotoKey = keyof typeof photos;
