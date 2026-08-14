// The header's scroll decision, extracted so it can be tested without a DOM.
//
// The wiring around it matters as much as the rule: the scroll event fires
// far more often than the screen paints, so Header reads position inside one
// requestAnimationFrame and only calls setState when one of these booleans
// actually flips. Re-rendering a fixed, full-width header on every scroll
// event is what made the site stutter on phones.

export interface HeaderScrollState {
  /** Past the point where the bar takes on a background. */
  scrolled: boolean;
  /** Slid out of view (scrolling down, well past the top). */
  hidden: boolean;
}

/** Below this, the bar stays transparent over the hero. */
export const SCROLLED_AT = 40;
/** Above this, scrolling down is allowed to hide the bar. */
export const HIDE_AFTER = 120;

/**
 * Pure: given where the page is now and where it was on the previous frame,
 * what should the header be doing?
 */
export function nextHeaderState(currentY: number, lastY: number): HeaderScrollState {
  return {
    scrolled: currentY > SCROLLED_AT,
    // Scrolling UP always reveals, at any depth — the bar must never trap
    // someone who wants the nav back.
    hidden: currentY > HIDE_AFTER && currentY > lastY,
  };
}
