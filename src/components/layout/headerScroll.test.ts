import { describe, expect, it } from "vitest";
import { HIDE_AFTER, SCROLLED_AT, nextHeaderState } from "./headerScroll";

describe("header scroll rule", () => {
  it("stays transparent over the top of the hero", () => {
    expect(nextHeaderState(0, 0)).toEqual({ scrolled: false, hidden: false });
    expect(nextHeaderState(SCROLLED_AT, 0).scrolled).toBe(false);
    expect(nextHeaderState(SCROLLED_AT + 1, 0).scrolled).toBe(true);
  });

  it("hides only when scrolling down past the threshold", () => {
    // Deep enough, but moving up: stays visible.
    expect(nextHeaderState(500, 600).hidden).toBe(false);
    // Deep enough and moving down: hides.
    expect(nextHeaderState(600, 500).hidden).toBe(true);
    // Moving down but still near the top: stays visible.
    expect(nextHeaderState(HIDE_AFTER, HIDE_AFTER - 50).hidden).toBe(false);
    expect(nextHeaderState(HIDE_AFTER + 1, HIDE_AFTER).hidden).toBe(true);
  });

  it("reveals on any upward movement, however deep the page", () => {
    for (const y of [200, 2_000, 20_000]) {
      expect(nextHeaderState(y - 1, y).hidden).toBe(false);
    }
  });

  it("is stable when the position does not change", () => {
    // Equal positions are not "scrolling down", so a resting page at depth
    // keeps the bar visible rather than flickering it away.
    expect(nextHeaderState(800, 800).hidden).toBe(false);
  });

  it("returns the same answer for the same inputs (safe to call per frame)", () => {
    expect(nextHeaderState(700, 300)).toEqual(nextHeaderState(700, 300));
  });
});
