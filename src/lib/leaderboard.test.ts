import { describe, it, expect } from "vitest";
import { getWeekStartDate, aggregateAndRank } from "./leaderboard";

// ─── getWeekStartDate ──────────────────────────────────────

describe("getWeekStartDate", () => {
  it("returns Monday for a Wednesday", () => {
    // 2026-03-04 is a Wednesday
    const result = getWeekStartDate(new Date("2026-03-04T12:00:00"));
    expect(result).toBe("2026-03-02");
  });

  it("returns Monday for a Monday", () => {
    const result = getWeekStartDate(new Date("2026-03-02T08:00:00"));
    expect(result).toBe("2026-03-02");
  });

  it("returns previous Monday for a Sunday", () => {
    // 2026-03-08 is a Sunday
    const result = getWeekStartDate(new Date("2026-03-08T23:59:59"));
    expect(result).toBe("2026-03-02");
  });

  it("returns Monday for a Saturday", () => {
    // 2026-03-07 is a Saturday
    const result = getWeekStartDate(new Date("2026-03-07T10:00:00"));
    expect(result).toBe("2026-03-02");
  });

  it("returns Monday for a Friday", () => {
    // 2026-03-06 is a Friday
    const result = getWeekStartDate(new Date("2026-03-06T15:00:00"));
    expect(result).toBe("2026-03-02");
  });

  it("returns correct format YYYY-MM-DD", () => {
    const result = getWeekStartDate(new Date("2026-01-01T00:00:00"));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("handles year boundary (Jan 1 2026 is Thursday → Mon Dec 29 2025)", () => {
    const result = getWeekStartDate(new Date("2026-01-01T00:00:00"));
    expect(result).toBe("2025-12-29");
  });
});

// ─── aggregateAndRank ──────────────────────────────────────

describe("aggregateAndRank", () => {
  it("returns empty array for empty input", () => {
    expect(aggregateAndRank([])).toEqual([]);
  });

  it("aggregates multiple entries for same player", () => {
    const rawData = [
      { player_id: "p1", points: 3, players: { first_name: "Alice", preferred_name: null } },
      { player_id: "p1", points: 5, players: { first_name: "Alice", preferred_name: null } },
      { player_id: "p1", points: 3, players: { first_name: "Alice", preferred_name: null } },
    ];
    const result = aggregateAndRank(rawData);
    expect(result).toHaveLength(1);
    expect(result[0].points).toBe(11);
    expect(result[0].wins).toBe(3);
    expect(result[0].rank).toBe(1);
  });

  it("ranks by total points descending", () => {
    const rawData = [
      { player_id: "p1", points: 3, players: { first_name: "Alice", preferred_name: null } },
      { player_id: "p2", points: 10, players: { first_name: "Bob", preferred_name: null } },
      { player_id: "p3", points: 5, players: { first_name: "Charlie", preferred_name: null } },
    ];
    const result = aggregateAndRank(rawData);
    expect(result[0].playerName).toBe("Bob");
    expect(result[0].rank).toBe(1);
    expect(result[1].playerName).toBe("Charlie");
    expect(result[1].rank).toBe(2);
    expect(result[2].playerName).toBe("Alice");
    expect(result[2].rank).toBe(3);
  });

  it("uses preferred_name when available", () => {
    const rawData = [
      { player_id: "p1", points: 3, players: { first_name: "Robert", preferred_name: "Bobby" } },
    ];
    const result = aggregateAndRank(rawData);
    expect(result[0].playerName).toBe("Bobby");
  });

  it("falls back to first_name when preferred_name is null", () => {
    const rawData = [
      { player_id: "p1", points: 3, players: { first_name: "Robert", preferred_name: null } },
    ];
    const result = aggregateAndRank(rawData);
    expect(result[0].playerName).toBe("Robert");
  });

  it("handles multiple players with aggregation", () => {
    const rawData = [
      { player_id: "p1", points: 3, players: { first_name: "Alice", preferred_name: null } },
      { player_id: "p2", points: 3, players: { first_name: "Bob", preferred_name: null } },
      { player_id: "p1", points: 5, players: { first_name: "Alice", preferred_name: null } },
      { player_id: "p2", points: 10, players: { first_name: "Bob", preferred_name: null } },
    ];
    const result = aggregateAndRank(rawData);
    expect(result[0].playerId).toBe("p2");
    expect(result[0].points).toBe(13);
    expect(result[0].wins).toBe(2);
    expect(result[1].playerId).toBe("p1");
    expect(result[1].points).toBe(8);
    expect(result[1].wins).toBe(2);
  });
});
