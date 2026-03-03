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

// Navigation items
export const navItems = [
  { label: "About", href: "/about" },
  { label: "Membership", href: "/membership" },
  { label: "Play", href: "/book" },
  { label: "Events", href: "/events" },
  { label: "Community", href: "/community" },
  { label: "FAQ", href: "/faq" },
] as const;

// Social links
export const socialLinks = {
  instagram: "https://instagram.com/clubpto",
} as const;

// Club info
export const clubInfo = {
  name: "Club PTO",
  tagline: "Where the game meets the city",
  address: "Toronto, ON",
  email: "hello@clubpto.com",
} as const;
