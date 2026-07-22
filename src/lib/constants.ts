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
  { label: "Community", href: "/community" },
  { label: "Partners", href: "/partners" },
  { label: "FAQ", href: "/faq" },
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
export const weeklyMeets = {
  days: "Wednesday + Sunday",
  city: "Toronto",
  bookingUrl: "https://clubptobookings.as.me/",
} as const;

// True until the end of event day (America/Toronto). Every surface that
// sells tickets must check this so the site never promotes a past event.
export const isCourtsideUpcoming = () =>
  new Date(`${courtsideII.date}T23:59:59-04:00`).getTime() > Date.now();
