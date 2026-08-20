// Slice `door-home`, frames 00 Index, 01 Passcode, 02 Passcode failed,
// 03 Home nothing running, 04 Home night in progress.
//
// Frame 00's component is `FrameIndex`, in FrameIndex.tsx: an `Index.tsx`
// beside this barrel collides with `index.ts` on a case-insensitive filesystem.

export { FrameIndex, FRAME_INDEX } from "./FrameIndex";
export type { FrameIndexProps, FrameLink } from "./FrameIndex";

export { Passcode, PASSCODE_LENGTH } from "./Passcode";
export type { PasscodeProps } from "./Passcode";

export { PasscodeFailed } from "./PasscodeFailed";
export type { PasscodeFailedProps } from "./PasscodeFailed";

export { HomeNothingRunning } from "./HomeNothingRunning";
export type { HomeNothingRunningProps } from "./HomeNothingRunning";

export { HomeNightInProgress } from "./HomeNightInProgress";
export type { HomeNightInProgressProps, CourtActivity } from "./HomeNightInProgress";
