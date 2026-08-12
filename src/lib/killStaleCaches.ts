// The stale-cache kill-switch.
//
// The public site shipped with a precaching service worker for months. A
// precache that owns index.html can pin an entire retired design on a
// returning visitor's device indefinitely — which is exactly what happened:
// people kept seeing the pre-RALLY "Play. Connect." site long after it left
// the codebase.
//
// Removing the worker from the build stops NEW clients acquiring one, but it
// does nothing for the devices already holding it: their worker keeps serving
// its cached index.html and never asks the network. The only cure is code
// that runs the moment such a client finally loads one fresh document —
// unregister every worker, drop every cache — after which the ghost cannot
// come back.
//
// Deliberately: fire-and-forget, never awaited, never throwing, no UI. If it
// fails the app is unaffected; it simply tries again next load. Idempotent, so
// it is harmless on the overwhelming majority of loads where there is nothing
// to clean up.

export function killStaleCaches(): void {
  try {
    if (typeof navigator !== "undefined" && navigator.serviceWorker?.getRegistrations) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {});
    }
    if (typeof caches !== "undefined" && caches.keys) {
      void caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => {});
    }
  } catch {
    // Feature-detection is above; this is the belt to that pair of braces.
    // A cache purge must never be the reason the site fails to start.
  }
}
