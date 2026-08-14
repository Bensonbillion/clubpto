import { describe, expect, it } from "vitest";
import { planV4Publish, publishIdOfV3, publishIdOfV4, type PlanInput, type PublishPlan } from "./plan";
import type { AmericanoSession, AmericanoPlayer, AmericanoPool } from "@/types/americano";
import type { SessionV2 } from "@/court-manager/react/useSessionV2";
import { DEFAULT_FORMAT } from "@/lib/americano/format";
import { defaultVenueFor } from "@/lib/clubDate";

/* ── fixtures ────────────────────────────────────────────────────── */

const player = (id: string, name: string, status: AmericanoPlayer["status"] = "present"): AmericanoPlayer => ({
  playerId: id, displayName: name, tier: "B", status, joinedAtMatchIndex: null, catchUpUsed: false,
});

const donePool = (id: string, label: "Court 1" | "Court 2", ids: string[]): AmericanoPool => ({
  id, label, playerIds: ids, targetMatches: 4, playoffMode: "none",
  status: "complete", matches: [], matchFormat: DEFAULT_FORMAT,
  champion: { kind: "individual", playerIds: [ids[0]], title: "Court 1 Champions", at: 1 },
});

// Wednesday 12 August 2026, 7:04pm Toronto.
const STARTED = Date.parse("2026-08-12T23:04:00Z");

const night = (over: Partial<AmericanoSession> = {}): AmericanoSession => ({
  id: "night-2026-08-12",
  date: "2026-08-12",
  startedAtMs: STARTED,
  sessionName: "",
  players: [player("e1", "Benson"), player("e2", "Timi")],
  pools: [donePool("court-2", "Court 2", ["e1"]), donePool("court-1", "Court 1", ["e2"])],
  defaultMatchFormat: DEFAULT_FORMAT,
  isPractice: false,
  status: "active",
  ...over,
});

const input = (over: Partial<PlanInput> = {}): PlanInput => ({
  venue: "The District Padel",
  mapping: { e1: "p-benson", e2: "p-timi" },
  aliasRows: [],
  ...over,
});

/* ── the session id (C6) ─────────────────────────────────────────── */

describe("the published session id", () => {
  // `night-${date}` was the id, and session_id is a primary key: two nights
  // on one date merged into one row and their children collided.
  it("is stable across presses and distinct between two nights on one date", () => {
    const first = night();
    const second = night({ startedAtMs: STARTED + 3 * 60 * 60 * 1000 });

    expect(publishIdOfV4(first)).toBe(publishIdOfV4(first)); // press twice
    expect(publishIdOfV4(first)).not.toBe(publishIdOfV4(second));
    // Both were the same calendar night, which is exactly the collision.
    expect(first.date).toBe(second.date);
  });

  it("carries the Toronto date, not the UTC one", () => {
    // 8:30pm Wednesday in Toronto is already Thursday in UTC.
    const late = night({ startedAtMs: Date.parse("2026-08-13T00:30:00Z") });
    expect(publishIdOfV4(late)).toMatch(/^night-2026-08-12-/);
  });

  it("is null before the night has started, rather than minted from the clock", () => {
    // A clock-derived id would be different on every press, filing one night
    // as several.
    expect(publishIdOfV4(night({ startedAtMs: null }))).toBeNull();
    expect(publishIdOfV3({ sessionStartedAt: null } as SessionV2)).toBeNull();
  });

  it("v3 derives the same way, from its own start instant", () => {
    const s = { sessionStartedAt: STARTED } as SessionV2;
    expect(publishIdOfV3(s)).toBe(`night-2026-08-12-${STARTED}`);
  });
});

/* ── v4: the honest partial ──────────────────────────────────────── */

describe("publishing a v4 night", () => {
  it("publishes attendance and says plainly what it is not publishing", () => {
    const plan = planV4Publish(night(), input());
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    expect(plan.payload.attendance).toEqual([{ player_id: "p-benson" }, { player_id: "p-timi" }]);
    expect(plan.payload.session.attendance_count).toBe(2);
    expect(plan.payload.session.venue).toBe("The District Padel");
    expect(plan.payload.session.date).toBe("2026-08-12");

    // The line that must not be papered over.
    expect(plan.payload.pairs).toEqual([]);
    expect(plan.payload.results).toEqual([]);
    expect(plan.payload.champions).toEqual([]);
    expect(plan.payload.finalists).toEqual([]);
    expect(plan.notes.join(" ")).toContain("results are not published");
  });

  it("counts who was in the room, not who was expected", () => {
    const s = night({
      players: [player("e1", "Benson"), player("e2", "Timi", "not_arrived"), player("e3", "Shana", "left")],
      pools: [donePool("court-2", "Court 2", ["e1"]), donePool("court-1", "Court 1", ["e3"])],
    });
    const plan = planV4Publish(s, input({ mapping: { e1: "p-benson", e3: "p-shana" } }));
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    // Someone who left early was still here. Someone who never came was not.
    expect(plan.payload.attendance).toEqual([{ player_id: "p-benson" }, { player_id: "p-shana" }]);
    expect(plan.payload.session.attendance_count).toBe(2);
  });

  it("commits the alias confirmations in the same payload", () => {
    const plan = planV4Publish(
      night(),
      input({ aliasRows: [{ kind: "engine_player_id", value: "e2", playerId: "p-timi" }] })
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.payload.aliases).toEqual([
      { kind: "engine_player_id", value: "e2", player_id: "p-timi" },
    ]);
  });

  it("carries practice through, so a practice night publishes no records", () => {
    const plan = planV4Publish(night({ isPractice: true }), input());
    expect(plan.ok && plan.payload.session.practice_only).toBe(true);
  });
});

/* ── refusals, named ─────────────────────────────────────────────── */

describe("what a Publish refuses, and what it says", () => {
  const refusalsOf = (plan: PublishPlan): string[] =>
    "refusals" in plan ? plan.refusals : [];

  it("refuses a night that never started", () => {
    const plan = planV4Publish(night({ startedAtMs: null }), input());
    expect(plan.ok).toBe(false);
    expect(refusalsOf(plan).join(" ")).toContain("has not been started");
  });

  it("names the court that is still playing", () => {
    const s = night({
      pools: [
        donePool("court-2", "Court 2", ["e1"]),
        { ...donePool("court-1", "Court 1", ["e2"]), status: "round_robin", champion: undefined },
      ],
    });
    const plan = planV4Publish(s, input());
    expect(plan.ok).toBe(false);
    expect(refusalsOf(plan).join(" ")).toContain("Court 1 has not finished");
  });

  it("treats a pool that says complete without a champion as unfinished", () => {
    const s = night({
      pools: [donePool("court-2", "Court 2", ["e1"]), { ...donePool("court-1", "Court 1", ["e2"]), champion: undefined }],
    });
    expect(planV4Publish(s, input()).ok).toBe(false);
  });

  it("refuses an empty venue and says what the defaults are", () => {
    const plan = planV4Publish(night(), input({ venue: "   " }));
    expect(plan.ok).toBe(false);
    const said = refusalsOf(plan).join(" ");
    expect(said).toContain("needs a venue");
    expect(said).toContain("The District Padel");
  });

  // The refusal an admin can actually act on: names, not engine ids.
  it("names the unmatched people rather than their engine ids", () => {
    const plan = planV4Publish(night(), input({ mapping: { e1: "p-benson" } }));
    expect(plan.ok).toBe(false);
    const said = refusalsOf(plan).join(" ");
    expect(said).toContain("Timi");
    expect(said).not.toContain("e2");
  });

  it("collects every refusal at once, so the admin sees the whole list", () => {
    const plan = planV4Publish(night({ startedAtMs: null }), input({ venue: "", mapping: {} }));
    expect(plan.ok).toBe(false);
    expect(refusalsOf(plan).length).toBeGreaterThanOrEqual(3);
  });

  it("never returns a payload when it refuses", () => {
    const plan = planV4Publish(night(), input({ venue: "" }));
    expect("payload" in plan).toBe(false);
  });
});

/* ── idempotency, at the payload level ───────────────────────────── */

describe("pressing Publish again", () => {
  it("builds a byte-identical payload the second and third time", () => {
    const s = night();
    const a = planV4Publish(s, input());
    const b = planV4Publish(s, input());
    const c = planV4Publish(s, input());
    expect(a.ok && b.ok && c.ok).toBe(true);
    if (!a.ok || !b.ok || !c.ok) return;
    expect(JSON.stringify(b.payload)).toBe(JSON.stringify(a.payload));
    expect(JSON.stringify(c.payload)).toBe(JSON.stringify(a.payload));
  });

  // Nothing in the payload may come from the clock. If it did, the second
  // press would be a different night as far as the database is concerned.
  it("contains no value derived from the current time", () => {
    const plan = planV4Publish(night(), input());
    if (!plan.ok) throw new Error("expected a plan");
    const json = JSON.stringify(plan.payload);
    expect(json).not.toContain(String(Date.now()).slice(0, 8));
    expect(plan.payload.session.session_id).toBe(`night-2026-08-12-${STARTED}`);
  });
});

// The venue is a suggestion the admin confirms, never a derivation they never
// see. clubhouse_sessions.venue is NOT NULL, so a night that moves for a
// holiday would otherwise be recorded permanently at whichever venue the
// weekday happened to imply.
describe("the venue on the confirm screen", () => {
  it("defaults from the weekday", () => {
    expect(defaultVenueFor("2026-08-12")).toBe("The District Padel"); // Wednesday
    expect(defaultVenueFor("2026-08-16")).toBe("North Padel"); // Sunday
  });

  it("publishes what the admin confirmed, not what the weekday implied", () => {
    // A Wednesday night that moved. The default would have said District.
    const plan = planV4Publish(night(), input({ venue: "North Padel" }));
    expect(plan.ok && plan.payload.session.venue).toBe("North Padel");
    expect(defaultVenueFor("2026-08-12")).not.toBe("North Padel");
  });

  it("takes a venue that is neither of the two, for a one-off", () => {
    const plan = planV4Publish(night(), input({ venue: "  Rally Padel Etobicoke  " }));
    expect(plan.ok && plan.payload.session.venue).toBe("Rally Padel Etobicoke");
  });

  it("suggests nothing on a day the club does not normally play", () => {
    // A Saturday. The confirm has to ask rather than guess.
    expect(defaultVenueFor("2026-08-15")).toBeNull();
  });
});
