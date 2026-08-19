// Pure decision logic for the manager passcode door.
//
// Deliberately dependency-free and Deno-free: the Edge Function imports it at
// runtime and vitest imports the same file, so the rate limit that protects a
// live night is tested rather than assumed. Nothing here reads a secret or
// touches IO — the caller supplies counts and the clock.

/** Outcomes the door can produce. Each maps to its OWN phone message. */
export type PasscodeOutcome =
  | "ok"
  | "wrong"
  | "locked"
  | "misconfigured"
  | "unreachable";

export interface RateLimitPolicy {
  /** Failures allowed inside the window before the door locks. */
  maxFailures: number;
  /** Rolling window, milliseconds. */
  windowMs: number;
  /** How long the lockout lasts once tripped, milliseconds. */
  lockoutMs: number;
}

/**
 * A six-digit code on an open endpoint is a million guesses. At 5 tries per
 * 15 minutes a full sweep takes ~5 years, and a real admin fat-fingering the
 * pad twice is never locked out for long. Tuned for a phone in a dark room,
 * not for a threat model that assumes the attacker is patient AND lucky.
 */
export const DEFAULT_POLICY: RateLimitPolicy = {
  maxFailures: 5,
  windowMs: 15 * 60_000,
  lockoutMs: 15 * 60_000,
};

export interface AttemptRecord {
  /** Epoch ms. */
  at: number;
  ok: boolean;
}

/**
 * When did the limiter last trip — i.e. when did maxFailures land inside one
 * window? Null if it never has.
 *
 * The window is measured BETWEEN FAILURES, never against `now`. Filtering by
 * `now - at < windowMs` first looks equivalent and is not: as the lockout runs
 * down, the oldest failures age out of the window, the count falls under the
 * threshold, and the door quietly reopens EARLY — the one failure mode a rate
 * limiter must not have. Caught by
 * __tests__/passcodeRules.test.ts "REOPENS on its own".
 *
 * Only FAILURES count: a successful sign-in must never push an admin toward
 * their own lockout, and the owner opening the pad twice is not an attack.
 */
function lastTripAt(
  attempts: readonly AttemptRecord[],
  policy: RateLimitPolicy,
): number | null {
  const failures = attempts.filter((a) => !a.ok).sort((a, b) => a.at - b.at);
  let trip: number | null = null;
  for (let i = policy.maxFailures - 1; i < failures.length; i++) {
    const span = failures[i].at - failures[i - (policy.maxFailures - 1)].at;
    if (span <= policy.windowMs) trip = failures[i].at;
  }
  return trip;
}

/** Should this caller be allowed to try at all? */
export function isLockedOut(
  attempts: readonly AttemptRecord[],
  now: number,
  policy: RateLimitPolicy = DEFAULT_POLICY,
): boolean {
  const trip = lastTripAt(attempts, policy);
  return trip !== null && now - trip < policy.lockoutMs;
}

/** Remaining lockout in ms, or 0 if the caller may try. */
export function lockoutRemaining(
  attempts: readonly AttemptRecord[],
  now: number,
  policy: RateLimitPolicy = DEFAULT_POLICY,
): number {
  const trip = lastTripAt(attempts, policy);
  if (trip === null) return 0;
  return Math.max(0, policy.lockoutMs - (now - trip));
}

/**
 * Constant-time string compare.
 *
 * A plain === leaks the shared secret one character at a time to anyone who
 * can measure the response. The endpoint is public, so this is not paranoia.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  // Compare a fixed number of characters so length alone does not branch.
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Digits only, and the length the owner configured. */
export function isPasscodeShape(code: unknown, length: number): code is string {
  return typeof code === "string" && new RegExp(`^\\d{${length}}$`).test(code);
}

/**
 * What the phone says. Three failures that look identical on screen are three
 * failures the admin cannot act on differently, so each gets its own words —
 * and none of them hint at whether the code was close.
 */
export function messageFor(outcome: PasscodeOutcome, retryInMs = 0): string {
  switch (outcome) {
    case "ok":
      return "";
    case "wrong":
      return "Wrong passcode — try again";
    case "locked": {
      const mins = Math.max(1, Math.ceil(retryInMs / 60_000));
      return `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
    }
    case "misconfigured":
      // Says "not set up" rather than naming the missing secret: the message
      // renders on a public screen.
      return "The door is not set up yet. Use email recovery below.";
    case "unreachable":
      return "Can't reach the door — check signal, then retry.";
  }
}
