// @vitest-environment jsdom
//
// Frame 24, the runners-up line under the individual champion.
//
// The standings engine can now say "level" about two rows nothing separated
// (#60). This screen is the one place where saying so beats silence: second
// and third on the same points, the same difference and the same match are
// read once, at the end of the night, by a room that wants to know. Until now
// the line printed two identical numbers and let the reader assume the order
// meant something.
//
// The owner chose the words on 2026-09-19: "nothing between them". It is the
// only new copy, and it is new copy for a frame that draws no clause for it,
// so it is pinned here as a sentence and not left to a render.

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IndividualChampion } from "../screens/playoffs/IndividualChampion";
import type { StandingsRow } from "../engine/standings";

const draw = (secondFromThird: StandingsRow["separatedBy"], third = true) =>
  render(
    <IndividualChampion
      courtNumber={1}
      championName="Ade"
      points={9}
      matchesPlayed={4}
      wonEveryMatch={false}
      second={{ displayName: "Dele", points: 3 }}
      third={third ? { displayName: "Emeka", points: 3 } : null}
      secondFromThird={secondFromThird}
      onCopyForWhatsApp={vi.fn()}
      onBackToStandings={vi.fn()}
    />,
  );

describe("the runners-up line", () => {
  it("says nothing separated second and third when nothing did", () => {
    draw("level");
    expect(screen.getByText("Dele second on 3, Emeka third on 3, nothing between them.")).toBeInTheDocument();
  });

  it("still credits score difference when that decided it", () => {
    draw("diff");
    expect(screen.getByText("Dele second on 3, Emeka third on 3 by score difference.")).toBeInTheDocument();
  });

  it("still stays quiet on an order break, which the frame draws no clause for", () => {
    draw("reachedFirst");
    expect(screen.getByText("Dele second on 3, Emeka third on 3.")).toBeInTheDocument();
  });

  it("still stops at second when there is no third", () => {
    draw("level", false);
    expect(screen.getByText("Dele second on 3.")).toBeInTheDocument();
  });
});
