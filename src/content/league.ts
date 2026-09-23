// PTO League — the page's operational facts, in one typed file.
//
// Mirrors the skillsLab.ts pattern: TODO_BENSON is a sentinel, not a
// placeholder to render. Any element that depends on one of these values
// hides itself entirely until the value is set. See leagueIsSet() below.

export const TODO = "TODO_BENSON";

export const league = {
  // Season 1 — the Founding Season.
  seasonNumber: 1,
  startDate: "2026-10-04",
  endDate: "2026-11-15",
  tournamentDate: "2026-11-22",
  depositDeadline: "2026-09-27",

  // Day, time, venue — the operational rhythm.
  sessionDay: "Sundays",
  sessionTime: "3:00 – 5:00 PM",
  venueName: "The District Padel",
  venueArea: "Mississauga",

  // Divisions + roster.
  mensRoster: 16,
  womensRoster: 16,
  totalRoster: 32,
  matchesPerWeek: 2,
  totalMatches: 14,
  regularSeasonWeeks: 7,

  // Pricing (CAD).
  fullPrice: 225,
  depositPrice: 100,

  // Registration URL. TODO_BENSON until the Acuity link (or equivalent) is
  // pinned. Until then, every CTA falls through to the /league/join funnel.
  registrationUrl: TODO,

  // Lead capture has no URL here: /league/join writes straight to the
  // clubhouse league_registrations table (src/league/submitRegistration.ts).

  // Deposit checkout. Stripe payment link, Square, whatever. TODO until
  // picked; when TODO the deposit step shows a "pay by e-transfer" fallback.
  depositUrl: TODO,

  // Registration closes at end of day Toronto time on this date; the
  // countdown bar reads from here. ISO with an explicit -04:00 (EDT in
  // September) keeps the timer consistent for every viewer regardless of
  // their machine timezone.
  registrationCloseAt: "2026-09-29T23:59:59-04:00",

  // Roster fill. Update this one number as registrations come in; every
  // surface that shows spots (hero, pricing badge, final CTA) picks it up.
  spotsClaimed: 16,

  // Where the CTAs route. Kept on the content file so a hosted funnel
  // (external landing, e-commerce) can drop in without a code change.
  joinPath: "/league/join",
} as const;

/** Remaining spots — derived so we never store two truths for the same fact. */
export const leagueSpotsRemaining = (): number =>
  Math.max(0, league.totalRoster - league.spotsClaimed);

/** True when the operational fact has been filled in. */
export const leagueIsSet = (value: string): boolean => value !== TODO;

/**
 * The general CTA target. Prefers a pinned external registrationUrl
 * (e.g., Acuity) when set; otherwise routes visitors into the local
 * /league/join funnel so nothing is a dead end.
 */
export const leagueCtaHref = (): string =>
  leagueIsSet(league.registrationUrl) ? league.registrationUrl : league.joinPath;
