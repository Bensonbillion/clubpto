// What day a night belongs to, and where it was played.
//
// THE BUG THIS EXISTS TO KILL (C6). Session dates were computed as
// `new Date().toISOString().slice(0, 10)` — UTC. A Wednesday night in
// Toronto runs until roughly 10pm, which is 02:00 UTC on Thursday, so every
// session that ran past 8pm EDT stamped TOMORROW. Nothing throws. The recap
// says Thursday, the streak counts a day that had no padel, and two nights
// eight days apart look like a broken week. It compounds every session and
// gets harder to unwind the longer it runs.
//
// The club is in Toronto and nowhere else, so the zone is a constant, not a
// setting. Toronto is UTC-5 in winter and UTC-4 in summer; hardcoding either
// is the same bug with a smaller window.

import { weeklyMeets } from "./constants";

export const CLUB_TIME_ZONE = "America/Toronto";

/**
 * The calendar date in Toronto at a given instant, as "YYYY-MM-DD".
 *
 * Intl does the DST arithmetic. formatToParts rather than format() because
 * the assembled string is then ours, not a locale's idea of ordering.
 */
export function clubDate(epochMs: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLUB_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(epochMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today in Toronto. The only place `Date.now()` should enter a session date. */
export const clubToday = (): string => clubDate(Date.now());

/**
 * Day of week for a calendar date, 0 = Sunday.
 *
 * Built on Date.UTC deliberately: `new Date("2026-08-12")` is parsed as UTC
 * midnight, which in Toronto is the evening of the 11th, so asking that Date
 * for its local weekday returns the day before. A calendar date has no
 * instant in it, and this treats it that way.
 */
export function weekdayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

const WEDNESDAY = 3;
const SUNDAY = 0;

/**
 * Where the club plays on a given date, or null when the date is neither of
 * the two weekly nights.
 *
 * Null is the point. clubhouse_sessions.venue is NOT NULL, and a night that
 * moves for a holiday, or a one-off on a Saturday, must not be recorded at
 * whichever venue the weekday happened to suggest — that is a permanently
 * wrong record written on the first exception. The default is a suggestion
 * the admin confirms, never a derivation the admin never sees.
 */
export function defaultVenueFor(isoDate: string): string | null {
  const day = weekdayOf(isoDate);
  const [wednesday, sunday] = weeklyMeets.nights;
  if (day === WEDNESDAY) return wednesday.venue;
  if (day === SUNDAY) return sunday.venue;
  return null;
}

/** Every venue the club plays at, for the override picker. */
export const knownVenues = (): string[] => weeklyMeets.nights.map((n) => n.venue);
