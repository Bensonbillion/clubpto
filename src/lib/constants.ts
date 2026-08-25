// Design system color tokens
export const colors = {
  dark: {
    DEFAULT: '#1A1A1A',
    surface: '#2D2D2D',
    elevated: '#3A3A3A',
  },
  cream: '#F5F0EB',
  gold: '#C9A84C',
  muted: '#A8A29E',
} as const;

// Navigation items (membership parked for now)
export const navItems = [
  { label: "About", href: "/about" },
  { label: "Play", href: "/book" },
  { label: "Skill Lab", href: "/skills-lab" },
  { label: "Community", href: "/community" },
  { label: "Partners", href: "/partners" },
  { label: "FAQ", href: "/faq" },
  { label: "Members", href: "/club" },
] as const;

// Social links
export const socialLinks = {
  instagram: "https://www.instagram.com/club_pto",
} as const;

// Club info
export const clubInfo = {
  name: "Club PTO",
  tagline: "Where the game meets the city",
  address: "Toronto, ON",
  email: "clubptobookings@gmail.com",
} as const;

// Courtside II, the next event. One source of truth for every surface.
export const courtsideII = {
  name: "Courtside Social II",
  subtitle: "The Clubhouse Experience",
  dateLabel: "Sat · Jul 18",
  date: "2026-07-18",
  venue: "The Pad · 309 Cherry St",
  ticketsUrl:
    "https://www.eventbrite.ca/e/courtside-social-ii-the-clubhouse-experience-by-clubpto-tickets-1992069417252?aff=ptosite",
} as const;

// Weekly meets. Booking runs through Acuity; the site never owns checkout.
//
// THE TWO NIGHTS ARE THE SAME THING. Both entries carry exactly the same
// fields, and no public copy may rank one night above the other or imply a
// difference in how hard or how serious it is. If a descriptor is added to
// one night it must be added to both, or it does not belong on either.
// Anyone should be able to take whichever day their week allows and know
// they got the same night.
// (Guarded by src/site/__tests__/nights-are-equal.test.ts.)
export const weeklyMeets = {
  bookingUrl: "https://clubptobookings.as.me/",
  price: "CA$20",
  nights: [
    { day: "Wednesdays", venue: "The District Padel", area: "Mississauga" },
    { day: "Sundays", venue: "North Padel", area: "North York" },
  ],
  /** Short form for tickers and footers. */
  days: "Wednesday + Sunday",
} as const;

// Skills Lab facts live in src/content/skillsLab.ts, not here — that file
// carries the TODO sentinels and the build-time check that unconfirmed
// values never render.

// True until the end of event day (America/Toronto). Every surface that
// sells tickets must check this so the site never promotes a past event.
export const isCourtsideUpcoming = () =>
  new Date(`${courtsideII.date}T23:59:59-04:00`).getTime() > Date.now();
