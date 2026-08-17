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
  twoSessionPackPrice: 110, // only used if the flag flips
  singleSessionPrice: 60,
  registrationUrl: TODO, // where all CTAs resolve
} as const;

/** True when Benson has filled the value in. */
export const isSet = (value: string): boolean => value !== TODO;

/**
 * Every CTA on the page resolves here. Until the registration URL lands,
 * CTAs anchor to the pricing section so the page stays shippable for review.
 */
export const ctaHref = (): string =>
  isSet(skillsLab.registrationUrl) ? skillsLab.registrationUrl : "#pricing";
