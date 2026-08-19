// Whether tonight may be cleared yet.
//
// Reset is the natural end-of-night tap and it sits next to Publish. It also
// nulls the start instant that the published session id is derived from, so
// pressing it first does not merely lose the data — it loses the ability to
// file the night at all. The archive (C7) protects the DATA; nothing
// protected the SEQUENCE.
//
// This is a block with a door, not a disabled button. A hard block on the
// wrong night is its own trap: a draft nobody wants, a night the engine
// thinks is unpublished because the publish failed on a dead connection, a
// test session at 4pm. The admin can always get through — they just cannot
// get through without reading what it costs.
//
// Pure. The screens ask it; it decides nothing about how the answer renders.

export interface ResetDecision {
  /** True when Reset can just run, with no extra step. */
  allowed: boolean;
  /** Why it is held, in the admin's language. Null when allowed. */
  reason: string | null;
  /** The override control's label. Null when allowed. */
  overrideLabel: string | null;
  /** What the override destroys, said out loud before it happens. */
  consequence: string | null;
}

const FREE: ResetDecision = { allowed: true, reason: null, overrideLabel: null, consequence: null };

export interface ResetGuardInput {
  /** publishIdOfV3/V4 — null when the night never started. */
  publishId: string | null;
  /** The id this session records as published. Null until a Publish lands. */
  publishedId: string | null;
  /** Is there a night here at all: anyone checked in, any game played. */
  hasContent: boolean;
  /** People who were in the room, for the consequence line. */
  peopleCount: number;
}

export function resetDecision(input: ResetGuardInput): ResetDecision {
  const { publishId, publishedId, hasContent, peopleCount } = input;

  // Nothing to lose. An empty setup screen is not a night.
  if (!hasContent) return FREE;

  // Already published under this exact id: the record is filed, and clearing
  // the tablet no longer destroys anything the club needs.
  if (publishId && publishedId === publishId) return FREE;

  // A night with people in it that was never started cannot be published at
  // all — there is no start instant to file it under. Say that, rather than
  // pretending publishing is the way out.
  if (!publishId) {
    return {
      allowed: false,
      reason:
        "This night was never started, so it cannot be published. Resetting discards it.",
      overrideLabel: "Discard this night",
      consequence: peopleLine(peopleCount, "were checked in and"),
    };
  }

  return {
    allowed: false,
    reason: "This night has not been published yet. Resetting discards it.",
    overrideLabel: "Reset without publishing",
    consequence: peopleLine(peopleCount, "were here tonight and"),
  };
}

const peopleLine = (n: number, middle: string): string =>
  n > 0
    ? `${n} ${n === 1 ? "person" : "people"} ${middle} will not appear in the clubhouse. The night is archived and can be recovered by the club, but nobody's count will include it until someone does.`
    : "The night is archived and can be recovered by the club, but nothing about it reaches the clubhouse.";
