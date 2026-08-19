// Shared number formatting for the summary / empty / error / confirm frames.
//
// The wireframes are consistent about this and the spec states it outright:
//   - stat-tile values and match scores are zero-padded to two digits
//     (`01`, `05`, `00`, `09`)
//   - numerals inside a sentence are NOT padded
//     (`2 results are queued.`, `15 in tonight.`, `All 24 results`)
//   - score difference always carries its sign (`+18`, `-3`)

/** Zero-pad a value numeral to two digits. Never use on a numeral in a sentence. */
export const pad2 = (n: number): string => (n < 0 ? "-" : "") + String(Math.abs(n)).padStart(2, "0");

/** Score difference, always signed. `0` renders `+0`, which is what the table shows. */
export const signed = (n: number): string => (n < 0 ? `${n}` : `+${n}`);

/**
 * v2's language joins a pair with `and` everywhere (`Timi and Tumi`).
 * The WhatsApp payload is the one place that joins with `+`.
 */
export const joinPair = (a: string, b: string): string => `${a} and ${b}`;
