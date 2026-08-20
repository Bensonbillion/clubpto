// Shared number and name formatting for the summary, empty, error and confirm
// frames.
//
// The wireframes are consistent about the numerals:
//   - a score is zero-padded to two digits, which is why frame 28a reads
//     "Ayo & Kayode 16, Benson & Ade 09" rather than "9"
//   - numerals inside a sentence are NOT padded, so frame 25's paste reads
//     "16 players", "12 pts", "1 Hamid 9"
//   - score difference always carries its sign, "+14" and "-2"

/** Zero-pad a score to two digits. Never use on a numeral inside a sentence. */
export const pad2 = (n: number): string => (n < 0 ? "-" : "") + String(Math.abs(n)).padStart(2, "0");

/** Score difference, always signed. `0` renders `+0`, which is what the table shows. */
export const signed = (n: number): string => (n < 0 ? `${n}` : `+${n}`);

/**
 * Join the two names of a pair for a sentence the operator reads on screen.
 *
 * The ampersand is frame 28a's own: "Ayo & Kayode 16, Benson & Ade 09 is
 * removed from the Court 1 standings." An earlier pass changed this to the
 * word "and" to match the rest of the manager's language, which was a
 * paraphrase of drawn copy, so it is back to the ampersand.
 *
 * Frame 25's WhatsApp paste joins champions with " + " instead. That is a
 * different join for a different job, it is built in SessionSummary where the
 * paste is assembled, and the two must not be collapsed into one helper.
 */
export const joinPair = (a: string, b: string): string => `${a} & ${b}`;
