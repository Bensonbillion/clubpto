// @vitest-environment jsdom
//
// The door does not answer a question it has not been told the answer to.
//
// The belt to persistence.ts's braces (2026-09-16). load() now hands back a
// night already on this phone without waiting for the row, which covers the
// operator reloading over their own night. A phone with NOTHING local still
// waits, correctly, because it has nothing to show, and for as long as it
// waits this screen is what the operator is looking at.
//
// It used to spend `loading` on one thing only: hiding the "Copy last
// Wednesday" ghost. So while the answer was in the air it said "No night is
// running" and put Start tonight live underneath it. On The District's
// captive portal that is ten seconds of a screen inviting a tap that marks
// the night for a wipe on the wizard's first act.

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeNothingRunning } from "../screens/door-home/HomeNothingRunning";

const draw = (props: Partial<Parameters<typeof HomeNothingRunning>[0]> = {}) => {
  const onStartTonight = vi.fn();
  render(<HomeNothingRunning onStartTonight={onStartTonight} {...props} />);
  return { onStartTonight, start: () => screen.getByRole("button", { name: "Start tonight" }) };
};

describe("while the app is still looking for the night", () => {
  it("does not claim that nothing is running", () => {
    draw({ loading: true });
    expect(screen.queryByText(/No night is running/)).toBeNull();
    expect(screen.getByText("Checking whether a night is running.")).toBeTruthy();
  });

  it("does not offer to start one, and a tap does nothing", async () => {
    const user = userEvent.setup();
    const { onStartTonight, start } = draw({ loading: true });
    expect(start().hasAttribute("disabled")).toBe(true);
    await user.click(start());
    expect(onStartTonight).not.toHaveBeenCalled();
  });

  it("the club's name is on screen the whole time, so the wait is not a blank phone", () => {
    draw({ loading: true });
    expect(screen.getByText("Club PTO")).toBeTruthy();
  });
});

describe("once the answer is in", () => {
  it("says what it knows and offers the night", async () => {
    const user = userEvent.setup();
    const { onStartTonight, start } = draw({ loading: false });
    expect(screen.getByText(/No night is running/)).toBeTruthy();
    expect(start().hasAttribute("disabled")).toBe(false);
    await user.click(start());
    expect(onStartTonight).toHaveBeenCalledTimes(1);
  });

  it("the copy ghost still waits for the answer, as it always did", () => {
    render(<HomeNothingRunning loading onStartTonight={() => {}} lastSessionDayName="Wednesday" />);
    expect(screen.queryByRole("button", { name: /Copy last/ })).toBeNull();
  });
});
