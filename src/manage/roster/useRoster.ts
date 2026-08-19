// The roster, as React state.
//
// Thin on purpose. All of the judgement lives in source.ts and merge.ts,
// which are testable without a renderer. What is left here is the lifecycle:
// load once, survive a double mount, never write to a component that is gone.

import { useCallback, useEffect, useRef, useState } from "react";
import { BUNDLED_ROSTER, type RosterName } from "./names";
import { loadRoster, type RosterLoad, type RosterOrigin } from "./source";

export interface RosterState {
  names: RosterName[];
  origin: RosterOrigin;
  error: string | null;
  loading: boolean;
  /**
   * Try the club list again. A tap while a load is still in flight is dropped
   * rather than queued: the network this button gets mashed on is exactly the
   * one where every extra request makes the next answer land later.
   */
  retry: () => void;
}

type Loaded = Omit<RosterState, "retry">;

const initial = (): Loaded => ({
  // Seeded with the bundle, not with []. There is no first frame where the
  // picker is empty, so no screen needs a "no players yet" state that would
  // only ever be a lie, and a manager who opens the wizard offline can start
  // tapping names immediately.
  names: [...BUNDLED_ROSTER],
  origin: "bundled",
  error: null,
  loading: true,
});

export function useRoster(): RosterState {
  const [state, setState] = useState<Loaded>(initial);
  const inFlight = useRef(false);

  // Bumping this re-runs the effect. A counter rather than a boolean, so a
  // second retry while the first is still resolving still counts as a new
  // attempt instead of being swallowed.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // `live` is scoped to this run of the effect, which is what makes the hook
    // safe under StrictMode. React mounts, unmounts, and remounts in
    // development, so two loads are in flight at once; the first one's cleanup
    // has already flipped its own `live` to false, so only the second can
    // write. Without this the two results race and the slower one wins, which
    // in the worst case means a stale "could not read the club list" landing
    // on top of a successful read. The same flag is what keeps the hook from
    // setting state after a real unmount.
    let live = true;
    inFlight.current = true;
    setState((prev) => ({ ...prev, loading: true }));

    loadRoster()
      // loadRoster is documented never to reject, and the catch is a net
      // rather than a plan: if that contract ever breaks, the picker should
      // fall back to the bundle instead of spinning forever.
      .catch((): RosterLoad => ({ names: [...BUNDLED_ROSTER], origin: "bundled", error: null }))
      .then((result) => {
        inFlight.current = false;
        if (!live) return;
        setState({ names: result.names, origin: result.origin, error: result.error, loading: false });
      });

    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    if (inFlight.current) return;
    setAttempt((n) => n + 1);
  }, []);

  // `loading` is for a spinner next to the refresh control, never a gate in
  // front of the list. The names are already correct enough to run a night on
  // before the request is sent, so hiding them while it resolves would trade a
  // working screen for a blank one.
  return { ...state, retry };
}
