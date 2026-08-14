// Engine player id -> clubhouse roster member. Pure: no React, no Supabase,
// no tier (same law as the rest of src/clubhouse/publish).
//
// THE PROBLEM (C1 in docs/SCHEMA-MAP.md). clubhouse_roster ids are slugs
// (p-benson). Engine ids are minted (pl-<base36>-<n>, csv_<normalized>,
// plv4-<...>, plus a legacy 9-character random). Nothing joins them, so
// attendance — which is keyed on roster ids — cannot be written for anyone.
//
// THE RULE. Names may SUGGEST. Only an admin decides. The seeded roster holds
// both "Timi" (p-timi) and "Timi Olaoye" (p-timi-olaoye); a silent first-name
// match picks one of them and is unrecoverable by the time anyone notices,
// because the only symptom is that the wrong person's nights-out count grows.
// So this module never returns a mapping it invented. It returns questions.
//
// AND NOTHING FUZZIER THAN EQUALITY. The seed header of 002_roster_seed.sql
// records, as a data law, that Ade and Adee, Sam and Samuel, Temi and
// Temitope, Donell and Donnel and Donnell, Debbie and Deborah, Eman and
// Emmanuel, Tomi and Tumi were all present on the same night and are
// different people. Any prefix, edit-distance or "did you mean" matcher
// merges real members. Comparison here is normalized equality, and that is
// the whole of it.
//
// ONE HAZARD THIS CANNOT SOLVE. v3 mints manual ids as
// `pl-<base36 Date.now()>-<counter>` with the counter reset to 0 on every
// page load, so two tablets adding a player in the same millisecond can mint
// the same id for two different people. The primary key then makes the second
// confirmation a REASSIGNMENT rather than a new row: it shows up in
// AliasPlan.reassignments before the admin commits, and the database appends
// the previous mapping to clubhouse_player_alias_history. Visible, not
// prevented.

/** The only kind today. The database check constraint agrees (migration 006). */
export type AliasKind = "engine_player_id";

export interface AliasRow {
  kind: AliasKind;
  value: string;
  playerId: string;
}

/**
 * What the engine knows about a person at publish time. Deliberately NOT the
 * engine's Player type: that carries tier, isVip and isCoach, and none of
 * them may cross into the clubhouse (PIPE-1). Structurally incapable beats
 * carefully avoided.
 */
export interface EngineIdentity {
  id: string;
  /** First name as the engine holds it. May be empty for a stale reference. */
  name: string;
  lastName?: string;
  /**
   * True when this id survives ONLY in older references and is not a separate
   * person tonight.
   *
   * This is not hypothetical. mergeRoster's attach() replaces a csv_ id with
   * a stable one when "Import classic roster" matches a CSV-created player —
   * and both import callers rewrite session.players ONLY. The old id stays
   * behind in pairs[].playerIds, in the pair's own id string
   * (`pair-<a>-<b>`, src/court-manager/checkin.ts), in unpaired,
   * vipPartnerId, playoffs and champion. mergeRoster returns no old->new map,
   * so nothing fixes them up. A publish input built from pairs therefore
   * carries the OLD id while one built from players carries the NEW one, and
   * both have to land on the same member.
   *
   * Marking those stale keeps them out of the duplicate-person check, which
   * would otherwise refuse to commit a night that is perfectly correct.
   */
  staleReference?: boolean;
}

export interface RosterName {
  playerId: string;
  displayName: string;
}

export interface AliasCandidate {
  playerId: string;
  displayName: string;
  match: "full-name" | "first-name";
  /** Engine ids already pointing at this member. Two is normal after an id swap. */
  alreadyMappedFrom: number;
}

export type QuestionReason =
  | "one-full-name-match"
  | "one-first-name-match"
  | "several-first-name-matches"
  | "no-name-match";

export interface AliasQuestion {
  engineId: string;
  /**
   * What the admin reads. A name, never a tier. Empty when the id is a stale
   * reference with no Player left behind it — the UI shows the raw id and
   * says where it came from.
   */
  engineName: string;
  /** See EngineIdentity.staleReference. */
  stale: boolean;
  /** Ranked: full-name matches first, then first-name, then alphabetical. */
  candidates: AliasCandidate[];
  /**
   * A UI MAY pre-select this. A UI MAY NOT act on it. Null whenever more
   * than one roster member answers to the name, which is the case the whole
   * module exists for.
   */
  preselected: string | null;
  reason: QuestionReason;
}

export interface AliasResolution {
  /** Already known. No human needed. */
  resolved: { engineId: string; playerId: string; stale: boolean }[];
  /** Everyone else, in the order the engine listed them. */
  questions: AliasQuestion[];
  /** Ids that are leftovers rather than people. See EngineIdentity.staleReference. */
  staleIds: string[];
}

/**
 * Lowercase, fold accents, strip everything that is not a letter or digit.
 *
 * The NFD pass matters: without it an accented letter is not in [a-z0-9] and
 * gets deleted outright, so "José" would normalize to "jos" and stop matching
 * "Jose" — the engine and the roster hold names typed by different people on
 * different days. Folding can only ever produce MORE candidates, never fewer,
 * and more candidates means the question gets harder to auto-answer, not
 * easier: two matches is ambiguous and pre-selects nothing. Every roster name
 * is ASCII today; this is for the first one that is not.
 */
const norm = (value: string | null | undefined): string =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const firstWord = (value: string): string => value.trim().split(/\s+/)[0] ?? "";

/**
 * A full-name key with the token boundary KEPT: "ade|e", not "adee".
 *
 * The obvious version concatenates the two names and compares the letters run
 * together, and it is wrong in the worst possible way. norm() also strips the
 * space out of the roster side, so engine {name: "Ade", lastName: "E."} —
 * which is exactly what a CSV row "Ade E." produces through rosterCsv's
 * splitFullName — collapses to "adee" and matches the roster member Adee. A
 * DIFFERENT PERSON, offered under this module's strongest label. Same shape
 * for Ife + "Oma", Sam + "Uel", Temi + "Tope", every near-miss pair the seed
 * header lists as a data law. The separator is what makes it equality of
 * names rather than equality of letters. src/court-manager/rosterMerge.ts
 * already does it this way.
 */
const fullKey = (first: string, last: string): string => `${norm(first)}|${norm(last)}`;

/** The roster stores one string; split it the same way to compare like with like. */
const rosterFullKey = (displayName: string): string => {
  const parts = displayName.trim().split(/\s+/);
  return fullKey(parts[0] ?? "", parts.slice(1).join(" "));
};

/**
 * Split the session's engine players into the ones we already know and the
 * ones an admin has to look at. EVERY engine id lands in exactly one bucket:
 * a player who cannot be matched becomes a question with no candidates, never
 * a silent omission. Someone who turned up has to be accounted for even when
 * the answer is "they are not on the roster".
 */
export function resolveAliases(input: {
  engine: EngineIdentity[];
  roster: RosterName[];
  aliases: AliasRow[];
}): AliasResolution {
  const { engine, roster, aliases } = input;

  const known = new Map<string, string>();
  for (const a of aliases) if (a.kind === "engine_player_id") known.set(a.value, a.playerId);

  const mappedCount = new Map<string, number>();
  for (const a of aliases) mappedCount.set(a.playerId, (mappedCount.get(a.playerId) ?? 0) + 1);

  const resolved: AliasResolution["resolved"] = [];
  const questions: AliasQuestion[] = [];
  const staleIds: string[] = [];

  for (const p of engine) {
    const stale = p.staleReference === true;
    if (stale) staleIds.push(p.id);

    const hit = known.get(p.id);
    if (hit) {
      resolved.push({ engineId: p.id, playerId: hit, stale });
      continue;
    }

    // Truthiness is not the test. A surname field holding "-" or "." or a
    // stray space is truthy, and rosterCsv's clean() only trims and collapses
    // whitespace, so "-" reaches here intact. Under a truthiness guard that
    // one character turns a bare "Timi" into a confident full-name match on
    // one of the two Timis — the single outcome this module exists to
    // prevent, arriving with the strongest label the type offers.
    const wantLast = norm(p.lastName);
    const hasLastName = wantLast !== "";
    const wantFull = fullKey(p.name, p.lastName ?? "");
    const wantFirst = norm(p.name);

    const full: AliasCandidate[] = [];
    const first: AliasCandidate[] = [];
    for (const r of roster) {
      const candidate = (match: "full-name" | "first-name"): AliasCandidate => ({
        playerId: r.playerId,
        displayName: r.displayName,
        match,
        alreadyMappedFrom: mappedCount.get(r.playerId) ?? 0,
      });
      // A full-name match only means anything when the engine HAS a last
      // name; without one, wantFull is "timi|" and every single-word roster
      // row would look like a full-name match.
      if (hasLastName && rosterFullKey(r.displayName) === wantFull) full.push(candidate("full-name"));
      else if (wantFirst && norm(firstWord(r.displayName)) === wantFirst) first.push(candidate("first-name"));
    }

    const byName = (a: AliasCandidate, b: AliasCandidate) => a.displayName.localeCompare(b.displayName);
    full.sort(byName);
    first.sort(byName);
    const candidates = [...full, ...first];

    // Exactly one match, at the strongest signal available, may be
    // pre-selected. Everything else is the admin's call from a blank slate.
    let preselected: string | null = null;
    let reason: QuestionReason;
    if (full.length === 1) {
      preselected = full[0].playerId;
      reason = "one-full-name-match";
    } else if (full.length === 0 && first.length === 1) {
      preselected = first[0].playerId;
      reason = "one-first-name-match";
    } else if (candidates.length === 0) {
      reason = "no-name-match";
    } else {
      reason = "several-first-name-matches";
    }

    questions.push({
      engineId: p.id,
      engineName: [p.name, p.lastName].filter(Boolean).join(" "),
      stale,
      candidates,
      preselected,
      reason,
    });
  }

  return { resolved, questions, staleIds };
}

// ---------------------------------------------------------------------------
// Staging. Confirmations live here — in memory — until Publish writes them
// all at once. Nothing in this file talks to the database on purpose: an
// admin confirming 24 names at 11pm and closing the laptop halfway must
// leave the database exactly as they found it.
// ---------------------------------------------------------------------------

/** playerId, or null for "not one of ours — skip them tonight". */
export type AliasDecisions = Record<string, string | null>;

export type PlanProblem =
  | { kind: "unanswered"; engineId: string }
  | { kind: "unknown-roster-member"; engineId: string; playerId: string }
  | { kind: "duplicate-person"; playerId: string; engineIds: string[] };

export interface AliasReassignment {
  engineId: string;
  from: string;
  to: string;
}

export interface AliasPlan {
  /** The one upsert. Empty when nothing was confirmed. */
  rows: AliasRow[];
  /** engineId -> rosterId for the whole session, resolved and confirmed alike. */
  mapping: Record<string, string>;
  /** Explicitly set aside. Not written, and they will be asked about again. */
  skipped: string[];
  /** Mappings this plan CHANGES. The UI has to say so out loud. */
  reassignments: AliasReassignment[];
  /** Non-empty means do not commit, and do not publish. */
  problems: PlanProblem[];
}

/**
 * Turn a resolution plus an admin's answers into the single write.
 *
 * A decision may name an engine id that already resolved — that is how a
 * wrong mapping gets corrected. It shows up in `reassignments` so the UI can
 * put it in front of the admin before they commit, and the database appends
 * the old mapping to clubhouse_player_alias_history when it lands.
 */
export function planAliases(input: {
  resolution: AliasResolution;
  decisions: AliasDecisions;
  roster: RosterName[];
  aliases: AliasRow[];
}): AliasPlan {
  const { resolution, decisions, roster, aliases } = input;

  const rosterIds = new Set(roster.map((r) => r.playerId));
  const existing = new Map<string, string>();
  for (const a of aliases) if (a.kind === "engine_player_id") existing.set(a.value, a.playerId);

  const rows: AliasRow[] = [];
  const mapping: Record<string, string> = {};
  const skipped: string[] = [];
  const reassignments: AliasReassignment[] = [];
  const problems: PlanProblem[] = [];

  for (const r of resolution.resolved) mapping[r.engineId] = r.playerId;

  for (const [engineId, playerId] of Object.entries(decisions)) {
    if (playerId === null) {
      skipped.push(engineId);
      delete mapping[engineId];
      continue;
    }
    if (!rosterIds.has(playerId)) {
      problems.push({ kind: "unknown-roster-member", engineId, playerId });
      continue;
    }
    const was = existing.get(engineId);
    if (was === playerId) {
      mapping[engineId] = playerId; // already stored exactly like this
      continue;
    }
    if (was) reassignments.push({ engineId, from: was, to: playerId });
    rows.push({ kind: "engine_player_id", value: engineId, playerId });
    mapping[engineId] = playerId;
  }

  // Every question must be answered — mapped or explicitly skipped. This is
  // what stops a name quietly falling out of the night.
  for (const q of resolution.questions) {
    if (!(q.engineId in decisions)) problems.push({ kind: "unanswered", engineId: q.engineId });
  }

  // Two PEOPLE in one session cannot be the same member. Attendance is keyed
  // (session_id, player_id), so the second one would collide — but the real
  // damage is that one of them was a mis-tap and nobody would ever see it.
  //
  // Stale references are excluded, and that exclusion is load-bearing: after
  // an id swap the same person legitimately appears twice in one night, once
  // as the new id in players and once as the old id still sitting in pairs.
  // Counting those as two people would refuse to commit a correct night.
  const stale = new Set(resolution.staleIds);
  const byPlayer = new Map<string, string[]>();
  for (const [engineId, playerId] of Object.entries(mapping)) {
    if (stale.has(engineId)) continue;
    const list = byPlayer.get(playerId) ?? [];
    list.push(engineId);
    byPlayer.set(playerId, list);
  }
  for (const [playerId, engineIds] of byPlayer) {
    if (engineIds.length > 1) problems.push({ kind: "duplicate-person", playerId, engineIds: [...engineIds].sort() });
  }

  return { rows, mapping, skipped, reassignments, problems };
}

/** A plan is committable only when nothing is outstanding and nothing collides. */
export function isCommittable(plan: AliasPlan): boolean {
  return plan.problems.length === 0;
}
