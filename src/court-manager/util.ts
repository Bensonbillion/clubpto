// Court Manager v3 — shared pure utilities. Single home for helpers that were
// otherwise copy-pasted across modules (seeded RNG, key normalization).

/** Seeded RNG (mulberry32). Math.random is banned in pure scheduling code. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lowercased, punctuation-stripped identity key for name/contact matching. */
export function normalizeKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
