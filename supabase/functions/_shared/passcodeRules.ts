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
 * Should this caller be allowed to try at all?
 *
 * Counts only FAILURES inside the window: a successful sign-in must not push
 * an admin toward their own lockout, and the owner opening the pad twice on a
 * Wednesday is not an attack.
 */
export function isLockedOut(
  attempts: readonly AttemptRecord[],
  now: number,
  policy: RateLimitPolicy = DEFAULT_POLICY,
): boolean {
  const failures = attempts
    .filter((a) => !a.ok && now - a.at < policy.windowMs)
    .sort((a, b) => a.at - b.at);
  if (failures.length < policy.maxFailures) return false;
  // The lockout runs from the failure that tripped it, not from the newest —
  // otherwise every further attempt refreshes the sentence and the door never
  // reopens on its own.
  const tripped = failures[policy.maxFailures - 1];
  return now - tripped.at < policy.lockoutMs;
}

/** Remaining lockout in ms, or 0 if the caller may try. */
export function lockoutRemaining(
  attempts: readonly AttemptRecord[],
  now: number,
  policy: RateLimitPolicy = DEFAULT_POLICY,
): number {
  if (!isLockedOut(attempts, now, policy)) return 0;
  const failures = attempts
    .filter((a) => !a.ok && now - a.at < policy.windowMs)
    .sort((a, b) => a.at - b.at);
  const tripped = failures[policy.maxFailures - 1];
  return Math.max(0, policy.lockoutMs - (now - tripped.at));
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
