// The manager door's rate limit, asserted by name.
//
// This is the only thing standing between a 6-digit code on a public endpoint
// and a million guesses, so the interesting cases are the ones where a limiter
// is usually got wrong: a lockout that never expires because each new attempt
// refreshes it, and a limiter that counts an admin's successes against them.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLICY,
  isLockedOut,
  isPasscodeShape,
  lockoutRemaining,
  messageFor,
  timingSafeEqual,
  type AttemptRecord,
} from "../../../../supabase/functions/_shared/passcodeRules";

const T0 = 1_700_000_000_000;
const fails = (n: number, from = T0, stepMs = 1_000): AttemptRecord[] =>
  Array.from({ length: n }, (_, i) => ({ at: from + i * stepMs, ok: false }));

describe("the door locks, and then it reopens", () => {
  it("lets an admin fumble up to the limit", () => {
    const now = T0 + 5_000;
    expect(isLockedOut(fails(DEFAULT_POLICY.maxFailures - 1), now)).toBe(false);
  });

  it("locks on the failure that reaches the limit", () => {
    const now = T0 + 5_000;
    expect(isLockedOut(fails(DEFAULT_POLICY.maxFailures), now)).toBe(true);
  });

  it("REOPENS on its own — the lockout runs from the failure that tripped it", () => {
    // The bug this pins: timing the lockout from the NEWEST failure means every
    // further guess (or every retry by a panicking admin) renews the sentence,
    // and the door never opens again without a human.
    const attempts = fails(DEFAULT_POLICY.maxFailures);
    const tripped = attempts[DEFAULT_POLICY.maxFailures - 1].at;
    expect(isLockedOut(attempts, tripped + DEFAULT_POLICY.lockoutMs - 1)).toBe(true);
    expect(isLockedOut(attempts, tripped + DEFAULT_POLICY.lockoutMs + 1)).toBe(false);
  });

  it("expires on schedule, because nothing is recorded while locked", () => {
    // The endpoint returns the lockout BEFORE it records anything (see
    // manager-passcode/index.ts — the isLockedOut branch sits above record()),
    // so guessing during a lockout adds no rows and cannot renew the sentence.
    // Given that, the trail a locked-out attacker leaves is exactly the five
    // failures that tripped it, and the door reopens on its own.
    const attempts = fails(DEFAULT_POLICY.maxFailures);
    const tripped = attempts[DEFAULT_POLICY.maxFailures - 1].at;
    expect(isLockedOut(attempts, tripped + DEFAULT_POLICY.lockoutMs + 1)).toBe(false);
  });

  it("a fresh burst AFTER the lockout expires locks it again", () => {
    const first = fails(DEFAULT_POLICY.maxFailures);
    const trip1 = first[DEFAULT_POLICY.maxFailures - 1].at;
    const reopened = trip1 + DEFAULT_POLICY.lockoutMs + 1;
    expect(isLockedOut(first, reopened)).toBe(false);
    const second = [...first, ...fails(DEFAULT_POLICY.maxFailures, reopened, 500)];
    expect(isLockedOut(second, reopened + 5_000)).toBe(true);
  });

  it("counts only failures — a success never pushes an admin toward lockout", () => {
    const now = T0 + 5_000;
    const mixed: AttemptRecord[] = [
      ...fails(DEFAULT_POLICY.maxFailures - 1),
      ...Array.from({ length: 20 }, (_, i) => ({ at: T0 + 2_000 + i, ok: true })),
    ];
    expect(isLockedOut(mixed, now)).toBe(false);
  });

  it("failures spread wider than the window never combine into a lockout", () => {
    // Four fumbles over four separate weeks plus one today is not an attack.
    // The window is measured BETWEEN failures, so they never add up.
    const scattered: AttemptRecord[] = Array.from(
      { length: DEFAULT_POLICY.maxFailures },
      (_, i) => ({ at: T0 + i * (DEFAULT_POLICY.windowMs + 1_000), ok: false }),
    );
    const now = scattered[scattered.length - 1].at + 1_000;
    expect(isLockedOut(scattered, now)).toBe(false);
  });

  it("an active lockout is NOT ended by its own failures ageing out", () => {
    // The regression: filtering by `now - at < windowMs` made the count fall
    // below the threshold as the lockout ran down, reopening the door early.
    const attempts = fails(DEFAULT_POLICY.maxFailures);
    const tripped = attempts[DEFAULT_POLICY.maxFailures - 1].at;
    const nearlyOver = tripped + DEFAULT_POLICY.lockoutMs - 1_000;
    expect(nearlyOver - attempts[0].at).toBeGreaterThan(DEFAULT_POLICY.windowMs);
    expect(isLockedOut(attempts, nearlyOver)).toBe(true);
  });

  it("reports a remaining time that only ever counts down", () => {
    const attempts = fails(DEFAULT_POLICY.maxFailures);
    const tripped = attempts[DEFAULT_POLICY.maxFailures - 1].at;
    const early = lockoutRemaining(attempts, tripped + 1_000);
    const later = lockoutRemaining(attempts, tripped + 2_000);
    expect(early).toBeGreaterThan(later);
    expect(lockoutRemaining(attempts, tripped + DEFAULT_POLICY.lockoutMs + 1)).toBe(0);
  });
});

describe("the comparison does not leak the secret", () => {
  it("matches only an exact string", () => {
    expect(timingSafeEqual("123456", "123456")).toBe(true);
    expect(timingSafeEqual("123456", "123457")).toBe(false);
    expect(timingSafeEqual("123456", "12345")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });

  it("compares the full length regardless of where the first difference is", () => {
    // Not a timing measurement — that is unstable in CI. This pins the shape
    // that makes constant time possible: no early return on first mismatch.
    const src = timingSafeEqual.toString();
    expect(src).not.toMatch(/return\s+false/);
  });
});

describe("the pad only submits what the door accepts", () => {
  it("takes exactly N digits", () => {
    expect(isPasscodeShape("123456", 6)).toBe(true);
    expect(isPasscodeShape("12345", 6)).toBe(false);
    expect(isPasscodeShape("1234567", 6)).toBe(false);
    expect(isPasscodeShape("12345a", 6)).toBe(false);
    expect(isPasscodeShape("  123456  ", 6)).toBe(false);
    expect(isPasscodeShape(123456, 6)).toBe(false);
    expect(isPasscodeShape(null, 6)).toBe(false);
  });
});

describe("three failures, three different sentences", () => {
  it("never renders the same words for different causes", () => {
    const wrong = messageFor("wrong");
    const locked = messageFor("locked", 5 * 60_000);
    const unreachable = messageFor("unreachable");
    const misconfigured = messageFor("misconfigured");
    const all = [wrong, locked, unreachable, misconfigured];
    expect(new Set(all).size).toBe(all.length);
    for (const m of all) expect(m.length).toBeGreaterThan(0);
  });

  it("tells the admin when to come back, rounded up so it is never 'in 0 minutes'", () => {
    expect(messageFor("locked", 1)).toMatch(/1 minute\b/);
    expect(messageFor("locked", 5 * 60_000)).toMatch(/5 minutes/);
  });

  it("says nothing about how close the guess was", () => {
    expect(messageFor("wrong").toLowerCase()).not.toMatch(/digit|close|last|first|character/);
  });

  it("a success has nothing to say", () => {
    expect(messageFor("ok")).toBe("");
  });
});
