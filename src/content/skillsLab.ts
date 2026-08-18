// Skills Lab — the page's operational facts, in one typed file.
//
// TODO_BENSON is a sentinel, not a placeholder to render: any element that
// depends on one of these values hides itself entirely, and the integrity
// test (skills-lab-integrity.test.tsx, run as part of `npm run build`) fails
// the build if the sentinel ever reaches rendered HTML. Fill a value in and
// the element appears — no code change needed.

export const TODO = "TODO_BENSON";

export const skillsLab = {
  // Public on the poster ("LIVE 30.08.2026") and the approved wireframe's
  // ribbon — the one operational fact that's already published.
  cohortStartDate: "2026-08-30",
  sessionDay: TODO, // e.g. "Wednesday" or "Sunday"
  sessionTime: TODO, // e.g. "10:00–11:30 AM"
  venueName: TODO, // e.g. "North Padel"
  venueArea: TODO, // e.g. "North York"
  coachName: TODO,
  cohortPrice: 199, // CAD
  // Benson (2026-08-17): the two-session pack renders.
  showTwoSessionPack: true,
  twoSessionPackPrice: 99,
  singleSessionPrice: 60,
  /** The Skills Lab category page on Acuity — all three offers. */
  registrationUrl:
    "https://app.acuityscheduling.com/schedule/f86e2580/?categories[]=Skills%20Lab",
  /** Direct booking links per offer (Benson, 2026-08-17). */
  cohortUrl:
    "https://app.acuityscheduling.com/schedule/f86e2580/appointment/97226735/calendar/12767324/datetime/2026-08-31T17%3A00%3A00-04%3A00?categories%5B%5D=Skills+Lab",
  singleSessionUrl:
    "https://app.acuityscheduling.com/schedule/f86e2580/appointment/97226649/calendar/12767324/datetime/2026-08-30T05%3A00%3A00-04%3A00?categories%5B%5D=Skills+Lab",
  twoSessionPackUrl:
    "https://app.acuityscheduling.com/schedule/f86e2580/appointment/97226697/calendar/12767324/datetime/2026-08-30T05%3A00%3A00-04%3A00?categories%5B%5D=Skills+Lab",
} as const;

/** True when Benson has filled the value in. */
export const isSet = (value: string): boolean => value !== TODO;

/**
 * The general CTA target: the Acuity category page with all three offers.
 * Offer-specific buttons link their own booking URLs directly; anything
 * neutral resolves here. The #pricing fallback stays as the safety net
 * should the URL ever be reset to TODO.
 */
export const ctaHref = (): string =>
  isSet(skillsLab.registrationUrl) ? skillsLab.registrationUrl : "#pricing";
