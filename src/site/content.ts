// The public site's facts, in one typed file.
//
// Same rule as src/content/league.ts and src/content/skillsLab.ts: TODO_BENSON
// is a sentinel, not a placeholder to render. Every element that depends on
// an unconfirmed fact hides itself until the value is filled in here, and
// src/site/__tests__/site-pages-integrity.test.tsx fails the build if the
// sentinel (or a "[bracketed placeholder]") ever reaches rendered HTML.
//
// Facts only. If a line below is not something Benson has confirmed or the
// booking page shows, it stays TODO.

import { league } from "@/content/league";
import { weeklyMeets, clubInfo, socialLinks } from "@/lib/constants";

export const TODO = "TODO_BENSON";

/** True once a fact has been confirmed and filled in. */
export const isSet = (value: string): boolean =>
  value !== TODO && value.trim().length > 0;

export const club = {
  name: clubInfo.name,
  email: clubInfo.email,
  instagramUrl: socialLinks.instagram,
  instagramHandle: "@club_pto",
  /** Public attendance number. 600+, never 1,000+. */
  playedCount: "600+",
  since: "October 2025",
  triplet: "Play. Connect. Compete.",
} as const;

export const venue = {
  /** The weekly meet's venue, read from the facts table. */
  name: weeklyMeets.nights[0].venue,
  short: "District Padel",
  address: "1550 Caterpillar Rd, Mississauga",
} as const;

// Thursday meets. Start time and price are what the Acuity booking page
// shows ("Thursday Padel @ District Padel Club", CA$22.60, 7:45 PM).
export const thursday = {
  day: "Thursday",
  firstDate: "2026-10-15",
  startTime: "7:45 PM",
  endTime: "10 PM",
  courts: 3,
  price: "$22.60",
  priceNote: "$20 plus HST",
  bookingUrl: weeklyMeets.bookingUrl,
} as const;

export const leagueFacts = {
  ...league,
  /** league.sessionTime in house style. */
  timeShort: "3 to 5 PM",
  /**
   * The season as actually scheduled in the league Sheet (Sessions tab):
   * seven Sundays, Oct 11 to Nov 22. league.ts still carries the original
   * Oct 4 plan, so the site keeps its own copy.
   */
  seasonStart: "2026-10-11",
  seasonEnd: "2026-11-22",
  /** Where Finals Night is held. Unconfirmed. */
  finalsVenue: TODO,
  /**
   * Finals Night as YYYY-MM-DD. league.tournamentDate says 2026-11-22, but
   * Season 1 started a week later than planned, so the date waits for
   * Benson before the site prints it.
   */
  finalsDate: TODO,
} as const;

/** If Finals Night has no confirmed date, stop promoting it after this. */
const FINALS_FALLBACK_UNTIL = "2026-12-06";

// Season 2 has no dates or price yet (Benson, Oct 14). These two lines are
// deliberately general so the section reads complete without promising.
export const season2 = {
  name: TODO,
  start: "After Season 1's Finals Night",
  entry: "Shared with the waitlist first",
  depositNote: TODO,
} as const;

export const courtside = {
  seriesOne: {
    label: "Series I · Sat, May 16, 2026 · The Pad, Toronto",
    title: "The first one",
    text: "Tournament padel, three DJ sets and the first golden hour. Sold out in advance.",
  },
  seriesTwo: {
    label: "Series II · Sat, July 18, 2026 · The Pad, Toronto",
    title: "The Clubhouse Experience",
    text: "A padel tournament with prizes, open courts, Afro House DJ sets and the Courtside Clubhouse lounge.",
  },
} as const;

/**
 * Book PTO. Benson, Oct 14: show the two starting prices, quote the big
 * group. All prices are "from", before HST.
 */
export const bookPto = {
  companyFrom: "$1,800",
  companyGuests: "up to 12 guests",
  privateFrom: "$700",
} as const;

/** The approved audience line for the Partners page. */
export const partnerAudience = "Majority women and BIPOC, 20 to 35";

/** Community nights on the Events page. */
export const communityNights = {
  anniversaryMonth: "October 2026",
} as const;

const TORONTO = "America/Toronto";

/** Parts of "now" as seen in Toronto, whatever the visitor's clock says. */
const torontoParts = (now: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TORONTO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    weekday: get("weekday"),
  };
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const addDays = (ymd: string, days: number): string => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * The next Thursday meet as YYYY-MM-DD in Toronto. Tonight counts until the
 * night ends at 10 PM. Never earlier than the first Thursday.
 */
export const nextThursday = (now: Date = new Date()): string => {
  const { ymd, hour, weekday } = torontoParts(now);
  const today = WEEKDAYS.indexOf(weekday);
  let ahead = (4 - today + 7) % 7;
  if (ahead === 0 && hour >= 22) ahead = 7;
  const next = addDays(ymd, ahead);
  return next < thursday.firstDate ? thursday.firstDate : next;
};

/** "Thu · Oct 15" from YYYY-MM-DD. */
export const shortDay = (ymd: string): string => {
  const d = new Date(`${ymd}T12:00:00Z`);
  const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${day} · ${md}`;
};

/** "Sun, Nov 22" from YYYY-MM-DD. */
export const longDay = (ymd: string): string => {
  const d = new Date(`${ymd}T12:00:00Z`);
  const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${day}, ${md}`;
};

/** Toronto's today as YYYY-MM-DD. */
export const todayInToronto = (now: Date = new Date()): string => torontoParts(now).ymd;

/** True while Season 1 is still being played. */
export const leagueInPlay = (now: Date = new Date()): boolean => {
  const today = todayInToronto(now);
  return today >= leagueFacts.seasonStart && today <= leagueFacts.seasonEnd;
};

/** True until Finals Night has passed. */
export const finalsUpcoming = (now: Date = new Date()): boolean =>
  todayInToronto(now) <=
  (isSet(leagueFacts.finalsDate) ? leagueFacts.finalsDate : FINALS_FALLBACK_UNTIL);
