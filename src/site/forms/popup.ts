// When the newsletter pop-up may show. Kept apart from the component so the
// rules are testable and live in one place.
//
// - Never to someone who has signed up (pop-up or inline box) on this device.
// - Once per visit at most.
// - After "Not now" or closing it, not again for SNOOZE_DAYS.
// - It opens after OPEN_AFTER_MS on the site or once they have scrolled
//   OPEN_AT_SCROLL of a page, whichever comes first, and never while they
//   are typing in another form.
//
// Browser storage can be missing or blocked (private windows), so every
// read and write is wrapped. A blocked store means the pop-up can show once
// per visit, which is fine.

export const KEYS = {
  subscribed: "pto-news-subscribed",
  dismissedAt: "pto-news-dismissed-at",
  shownThisVisit: "pto-news-shown",
} as const;

export const SNOOZE_DAYS = 21;
export const OPEN_AFTER_MS = 12_000;
export const OPEN_AT_SCROLL = 0.45;

const DAY = 24 * 60 * 60 * 1000;

export interface PopupMemory {
  subscribed: boolean;
  dismissedAt: number | null;
  shownThisVisit: boolean;
}

export const mayOffer = (m: PopupMemory, now: number): boolean =>
  !m.subscribed && !m.shownThisVisit && (m.dismissedAt === null || now - m.dismissedAt > SNOOZE_DAYS * DAY);

const read = (store: "local" | "session", key: string): string | null => {
  try {
    return (store === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
};

const write = (store: "local" | "session", key: string, value: string) => {
  try {
    (store === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    // Storage blocked: nothing to remember, nothing breaks.
  }
};

export const readMemory = (): PopupMemory => {
  const at = Number(read("local", KEYS.dismissedAt));
  return {
    subscribed: read("local", KEYS.subscribed) === "1",
    dismissedAt: Number.isFinite(at) && at > 0 ? at : null,
    shownThisVisit: read("session", KEYS.shownThisVisit) === "1",
  };
};

export const markShown = () => write("session", KEYS.shownThisVisit, "1");
export const markDismissed = (now = Date.now()) => write("local", KEYS.dismissedAt, String(now));
export const markSubscribed = () => write("local", KEYS.subscribed, "1");
