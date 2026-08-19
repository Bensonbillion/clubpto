// Who this new member might already be.
//
// This is a new write path into the table whose collisions have already bitten
// twice: "Ade" + "E." matched Adee under a full-name key that ran the letters
// together, and "martin's" looked like a person called Martin because a phone
// autocorrected "Martins". Both were caught late. A screen that lets an admin
// type a name and press save is the third chance to make the same mistake.
//
// SURFACE, DO NOT BLOCK. p-timi and p-timi-olaoye are two real people in this
// roster, and Ade / Adee played on the same night. A guard that refused a
// near-match would refuse a real member; one that stayed silent would create a
// second row for somebody who already exists. So: show what it found, make
// the admin look at it, and let them proceed.

/** Same normalization as the alias resolver: accents folded, then stripped. */
const norm = (value: string | null | undefined): string =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

export type NearMatchKind =
  /** Same name, normalized. Almost certainly the same person. */
  | "same-name"
  /** One name contains the other: Ade / Adee, Sam / Samuel, Timi / Timi Olaoye. */
  | "prefix"
  /** Same first word, different rest. */
  | "same-first-name";

export interface NearMatch {
  playerId: string;
  displayName: string;
  kind: NearMatchKind;
}

export interface RosterEntryLike {
  playerId: string;
  displayName: string;
}

const firstWord = (v: string) => v.trim().split(/\s+/)[0] ?? "";

/**
 * Everyone already on the roster who could plausibly be this person.
 *
 * Ranked strongest first, because the admin reads the top of the list. An
 * empty result means nothing on the roster resembles the typed name, which is
 * the ordinary case for a genuinely new member.
 */
export function nearMatches(typed: string, roster: RosterEntryLike[]): NearMatch[] {
  const key = norm(typed);
  if (!key) return [];
  const firstKey = norm(firstWord(typed));

  const out: NearMatch[] = [];
  for (const r of roster) {
    const rk = norm(r.displayName);
    if (!rk) continue;

    if (rk === key) {
      out.push({ ...r, kind: "same-name" });
    } else if (rk.startsWith(key) || key.startsWith(rk)) {
      // The Ade / Adee shape, and also Timi / Timi Olaoye once spaces are
      // stripped. Both are worth a second look and neither is a duplicate.
      out.push({ ...r, kind: "prefix" });
    } else if (firstKey && norm(firstWord(r.displayName)) === firstKey) {
      out.push({ ...r, kind: "same-first-name" });
    }
  }

  const rank: Record<NearMatchKind, number> = { "same-name": 0, prefix: 1, "same-first-name": 2 };
  return out.sort(
    (a, b) => rank[a.kind] - rank[b.kind] || a.displayName.localeCompare(b.displayName)
  );
}

/** What the screen says above the list, in the admin's language. */
export function nearMatchNotice(typed: string, found: NearMatch[]): string | null {
  if (found.length === 0) return null;
  const exact = found.filter((f) => f.kind === "same-name");
  if (exact.length > 0) {
    return `${exact.map((e) => e.displayName).join(" and ")} ${exact.length === 1 ? "is" : "are"} already on the roster. Adding "${typed.trim()}" makes a second person with that name.`;
  }
  return `${found.length} ${found.length === 1 ? "member looks" : "members look"} similar. Check this is somebody new before adding them.`;
}
