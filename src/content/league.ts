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
  venueName: "North Padel",
  venueArea: "Toronto",

  // Divisions + roster.
  mensRoster: 16,
  womensRoster: 16,
  totalRoster: 32,
  matchesPerWeek: 2,
  totalMatches: 14,
  regularSeasonWeeks: 7,

  // Pricing (CAD).
  fullPrice: 200,
  depositPrice: 100,

  // Registration URL. TODO_BENSON until the Acuity link (or equivalent) is
  // pinned. Until then, every CTA falls through to #pricing.
  registrationUrl: TODO,
} as const;

/** True when the operational fact has been filled in. */
export const leagueIsSet = (value: string): boolean => value !== TODO;

/**
 * The general CTA target. Falls back to #pricing until the real link lands
 * so no visible button is ever a dead end.
 */
export const leagueCtaHref = (): string =>
  leagueIsSet(league.registrationUrl) ? league.registrationUrl : "#pricing";
