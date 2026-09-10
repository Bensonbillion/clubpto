// Two phones, one night: the merge.
//
// The shared row is a straight line of versions, and every phone remembers
// the last version it agreed with (its base). When a phone's push is
// refused because the row moved, or its poll finds the row moved while it
// holds unpushed taps, it does not adopt the row and lose its own work, and
// it does not push over the row and lose the other phone's. It merges:
// merge(base, local, row) keeps what each side changed since the base.
//
// No clocks. Two phones' clocks are not comparable, so nothing here orders
// a completedAt, a startedAt or a savedAt. Every true conflict, where both
// phones changed the same thing differently, goes to the row, which is the
// copy that reached the server first, and the losing phone is the one doing
// the merge, so it is the one that can be told. The rules, each in one
// sentence:
//
//   1. If a phone restarted the night, that phone's whole night stands.
//   2. A field one phone changed keeps the change; both changed, the row's.
//   3. A game's result is one value: a recorded score beats anything done
//      to an unplayed game, otherwise the row's result stands.
//   4. The same game dealt on both phones is one game: the row's copy, or
//      whichever copy was scored.
//   5. One live game per court and per player; the row's copies stay.
//   6. A walk-in typed on both phones is one person.
//
// Only unplayed games are ever dropped. A recorded score is never deleted
// by a merge; at worst it loses to the row's score for the same game, and
// the note says so.

import type { Court, Match, Player, Session } from "../types";

export type MergeNote =
  /** The row restarted the night; this phone's unpushed taps went with it. */
  | { kind: "nightReplaced" }
  /** Both phones recorded this game differently; the row's result stands. */
  | { kind: "resultKept"; courtNumber: number; kept: Match; dropped: Match }
  /** A live game this phone dealt was set aside for the row's. */
  | { kind: "gameDropped"; courtNumber: number; matchId: string }
  /** One person, typed on both phones, folded into one player. */
  | { kind: "walkInFolded"; name: string }
  /** Both phones set this field differently; the row's value stands. */
  | { kind: "fieldKept"; entity: "player" | "court" | "night"; id: string; field: string }
  /** A live game fielded someone the other phone had marked as left; it was dealt again. */
  | { kind: "leaverDealtAround"; courtNumber: number; playerId: string };

export interface MergeResult {
  state: Session;
  notes: MergeNote[];
}

/* ── equality, without caring about key order ───────────────────── */

const canon = (v: unknown): string => {
  if (v === undefined) return "undefined";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort()
    .map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(",")}}`;
};
const eq = (a: unknown, b: unknown): boolean => canon(a) === canon(b);

/* ── one field, three ways ──────────────────────────────────────── */

/**
 * The value a field takes. Only one side changed: that side. Both changed
 * differently: the row. With no base to compare against, the row's value
 * stands, because a phone without lineage cannot prove it changed anything
 * and the row is the night everyone else is looking at; what such a phone
 * keeps is its additions, and any score it recorded (rule 3).
 */
const pick = <V>(base: V | undefined, local: V, remote: V, hasBase: boolean):
  { value: V; conflict: boolean } => {
  if (eq(local, remote)) return { value: local, conflict: false };
  if (!hasBase) return { value: remote, conflict: false };
  if (eq(local, base)) return { value: remote, conflict: false };
  if (eq(remote, base)) return { value: local, conflict: false };
  return { value: remote, conflict: true };
};

/* ── the night's identity ───────────────────────────────────────── */

/**
 * Rule 1. Whole-night operations (start over, back to setup, a new night,
 * reset everything, a knockout or teams night started over a running one)
 * are not edits to merge; the night they produce stands whole. Read off
 * the fields those operations move. Ending the night and starting it from
 * setup are deliberately NOT here: both keep every game, so the other
 * phone's taps must survive them.
 */
const changedGeneration = (base: Session, s: Session): boolean =>
  s.id !== base.id
  || (base.startedAt != null && s.startedAt !== base.startedAt)
  || (base.status === "running" && s.status === "setup")
  || (base.matches.some((m) => m.status === "played") && s.matches.length === 0);

/* ── games ──────────────────────────────────────────────────────── */

const recorded = (m: Match): boolean =>
  m.status === "played" && ((m.scoreA != null && m.scoreB != null) || m.walkover != null);

/** The result, without its clock: two phones recording 7-5 recorded 7-5. */
const resultOf = (m: Match) =>
  ({ scoreA: m.scoreA, scoreB: m.scoreB, status: m.status, walkover: m.walkover ?? null });

const sidesKey = (m: Match): string =>
  [[...m.teamA].sort().join("+"), [...m.teamB].sort().join("+")].sort().join(" v ");

/**
 * Rule 4's idea of "the same game": a round-robin slot on a court, a teams
 * tie between two pairs, a bracket tie at a stage. Courts are left out of
 * the last two because two phones can deal the same tie to different free
 * courts.
 */
const gameKey = (m: Match): string =>
  m.stage !== null ? `${m.stage}|${sidesKey(m)}`
    : m.id.startsWith("tm-") ? `tm|${sidesKey(m)}`
      : `slot|${m.courtNumber}|${m.matchIndex}`;

/** Merge one game present on both sides. */
const mergeMatch = (
  base: Match | undefined, local: Match, remote: Match, hasBase: boolean,
  notes: MergeNote[],
): Match => {
  const rl = resultOf(local), rr = resultOf(remote);
  const rb = base ? resultOf(base) : undefined;
  // Rule 3. The result is one value. Where a recorded score beat an unplayed
  // game, the score brings its four: that side played it as it stood on
  // that phone, a seat swap on the other phone notwithstanding. Everywhere
  // else the seats merge field by field like anything else.
  let winner: Match;
  let lineup: Match | null = null;
  if (eq(rl, rr)) winner = remote;
  else if (hasBase && eq(rl, rb)) winner = remote;
  else if (hasBase && eq(rr, rb)) winner = local;
  else if (!(base && recorded(base)) && recorded(local) !== recorded(remote)) {
    winner = recorded(local) ? local : remote;
  } else {
    winner = remote;
    lineup = remote;
    if (recorded(local) || recorded(remote)) {
      notes.push({ kind: "resultKept", courtNumber: remote.courtNumber, kept: remote, dropped: local });
    }
  }
  const other = winner === remote ? local : remote;
  if (recorded(winner) && !recorded(other)) lineup = winner;
  const rest = <F extends "courtNumber" | "matchIndex" | "startedAt" | "teamA" | "teamB">(field: F): Match[F] =>
    pick(base?.[field], local[field], remote[field], hasBase).value;
  return {
    ...winner,
    courtNumber: rest("courtNumber"),
    matchIndex: rest("matchIndex"),
    startedAt: rest("startedAt"),
    teamA: [...(lineup ? lineup.teamA : rest("teamA"))] as [string, string],
    teamB: [...(lineup ? lineup.teamB : rest("teamB"))] as [string, string],
    stage: winner.stage,
  };
};

/* ── entities present on one side only ──────────────────────────── */

/**
 * Something only one side holds. Never in the base: it was added there,
 * keep it. In the base: the other side deleted it, and the deletion stands
 * unless this side changed it since (a recorded score always counts as a
 * change worth keeping). Without a base nothing is ever deleted.
 */
const survivesAlone = <E>(
  base: E | undefined, mine: E, hasBase: boolean, allowDeletes: boolean,
  changed: (b: E, m: E) => boolean,
): boolean => !hasBase || !allowDeletes || base === undefined || changed(base, mine);

/* ── the merge ──────────────────────────────────────────────────── */

const PLAYER_FIELDS = ["name", "walkIn", "courtNumber", "away", "joinedAtMatchIndex", "tier"] as const;
const COURT_FIELDS = ["targetMatches", "playoffSeeded", "champion", "ending"] as const;
const NIGHT_FIELDS = [
  "dayLabel", "date", "status", "startedAt", "endedAt", "format", "knockoutPairs", "plate",
  "teamsTarget", "teamsEnding",
] as const;

const byId = <E, K extends string | number>(list: readonly E[], key: (e: E) => K) =>
  new Map(list.map((e) => [key(e), e] as const));

/** Remote's order first, then what only local holds, in local's order. */
const ordered = <E, K extends string | number>(
  remote: readonly E[], local: readonly E[], key: (e: E) => K, keep: Map<K, E>,
): E[] => {
  const out: E[] = [];
  const seen = new Set<K>();
  for (const e of [...remote, ...local]) {
    const k = key(e);
    if (seen.has(k)) continue;
    seen.add(k);
    const kept = keep.get(k);
    if (kept) out.push(kept);
  }
  return out;
};

export function mergeSessions(base: Session | null, local: Session, remote: Session): MergeResult {
  const notes: MergeNote[] = [];
  if (eq(local, remote)) return { state: remote, notes };
  if (base && eq(remote, base)) return { state: local, notes };
  if (base && eq(local, base)) return { state: remote, notes };

  // Rule 1.
  if (base) {
    const lg = changedGeneration(base, local);
    const rg = changedGeneration(base, remote);
    if (lg && !rg) return { state: local, notes };
    if (rg) {
      if (!eq(local, base)) notes.push({ kind: "nightReplaced" });
      return { state: remote, notes };
    }
  } else if (local.id !== remote.id
    || (local.startedAt != null && remote.startedAt != null && local.startedAt !== remote.startedAt)) {
    notes.push({ kind: "nightReplaced" });
    return { state: remote, notes };
  }

  const hasBase = base != null;
  const allowDeletes = hasBase;
  const b = base ?? remote;

  /* players */
  const bp = byId(b.players, (p) => p.id), lp = byId(local.players, (p) => p.id), rp = byId(remote.players, (p) => p.id);
  const players = new Map<string, Player>();
  for (const id of new Set([...lp.keys(), ...rp.keys()])) {
    const L = lp.get(id), R = rp.get(id), B = bp.get(id);
    if (L && R) {
      const merged: Player = { ...R };
      for (const f of PLAYER_FIELDS) {
        const { value, conflict } = pick(B?.[f], L[f], R[f], hasBase);
        if (value === undefined) delete (merged as unknown as Record<string, unknown>)[f];
        else (merged as unknown as Record<string, unknown>)[f] = value;
        if (conflict && (f === "name" || f === "courtNumber" || f === "tier")) {
          notes.push({ kind: "fieldKept", entity: "player", id, field: f });
        }
      }
      players.set(id, merged);
    } else if (L) {
      if (survivesAlone(B, L, hasBase, allowDeletes, (x, y) => !eq(x, y))) players.set(id, L);
    } else if (R) {
      if (survivesAlone(B, R, hasBase, allowDeletes, (x, y) => !eq(x, y))) players.set(id, R);
    }
  }

  /* courts */
  const bc = byId(b.courts, (c) => c.number), lc = byId(local.courts, (c) => c.number), rc = byId(remote.courts, (c) => c.number);
  const courts = new Map<number, Court>();
  for (const n of new Set([...lc.keys(), ...rc.keys()])) {
    const L = lc.get(n), R = rc.get(n), B = bc.get(n);
    if (L && R) {
      const merged: Court = { ...R };
      for (const f of COURT_FIELDS) {
        const { value, conflict } = pick(B?.[f], L[f], R[f], hasBase);
        if (value === undefined) delete (merged as unknown as Record<string, unknown>)[f];
        else (merged as unknown as Record<string, unknown>)[f] = value;
        if (conflict && f === "targetMatches") notes.push({ kind: "fieldKept", entity: "court", id: String(n), field: f });
      }
      courts.set(n, merged);
    } else if (L) {
      if (survivesAlone(B, L, hasBase, allowDeletes, (x, y) => !eq(x, y))) courts.set(n, L);
    } else if (R) {
      if (survivesAlone(B, R, hasBase, allowDeletes, (x, y) => !eq(x, y))) courts.set(n, R);
    }
  }

  /* games */
  const bm = byId(b.matches, (m) => m.id), lm = byId(local.matches, (m) => m.id), rm = byId(remote.matches, (m) => m.id);
  const matches = new Map<string, Match>();
  for (const id of new Set([...lm.keys(), ...rm.keys()])) {
    const L = lm.get(id), R = rm.get(id), B = bm.get(id);
    if (L && R) {
      matches.set(id, eq(L, R) ? R : mergeMatch(B, L, R, hasBase, notes));
    } else if (L) {
      if (survivesAlone(B, L, hasBase, allowDeletes, (x, y) => recorded(y) || !eq(x, y))) matches.set(id, L);
    } else if (R) {
      if (survivesAlone(B, R, hasBase, allowDeletes, (x, y) => recorded(y) || !eq(x, y))) matches.set(id, R);
    }
  }

  /* the night's own fields */
  const night: Session = { ...remote, id: remote.id };
  for (const f of NIGHT_FIELDS) {
    const { value, conflict } = pick(b[f], local[f], remote[f], hasBase);
    if (value === undefined) delete (night as unknown as Record<string, unknown>)[f];
    else (night as unknown as Record<string, unknown>)[f] = value;
    if (conflict && (f === "dayLabel" || f === "knockoutPairs" || f === "teamsTarget")) {
      notes.push({ kind: "fieldKept", entity: "night", id: remote.id, field: f });
    }
  }

  let state: Session = {
    ...night,
    players: ordered(remote.players, local.players, (p) => p.id, players),
    courts: ordered(remote.courts, local.courts, (c) => c.number, courts)
      .sort((x, y) => x.number - y.number),
    matches: ordered(remote.matches, local.matches, (m) => m.id, matches),
  };

  state = foldWalkIns(state, base, local, remote, notes);
  state = repair(state, base, remote, notes);
  state = restoreReferences(state, local, remote);
  return { state, notes };
}

/* ── rule 6: one person typed twice ─────────────────────────────── */

const nameKey = (name: string) => name.trim().toLowerCase();

const remapIds = (s: Session, from: string, to: string): Session => {
  const swap = (id: string) => (id === from ? to : id);
  return {
    ...s,
    matches: s.matches.map((m) => ({
      ...m,
      teamA: m.teamA.map(swap) as [string, string],
      teamB: m.teamB.map(swap) as [string, string],
    })),
    knockoutPairs: s.knockoutPairs?.map((p) => ({ ...p, playerIds: p.playerIds.map(swap) })),
    courts: s.courts.map((c) => ({ ...c, champion: c.champion ? c.champion.map(swap) : c.champion })),
  };
};

function foldWalkIns(
  state: Session, base: Session | null, local: Session, remote: Session, notes: MergeNote[],
): Session {
  const baseIds = new Set((base ?? remote).players.map((p) => p.id));
  const remoteIds = new Set(remote.players.map((p) => p.id));
  const localIds = new Set(local.players.map((p) => p.id));
  const newLocal = state.players.filter((p) => p.walkIn && !baseIds.has(p.id) && !remoteIds.has(p.id));
  const newRemote = state.players.filter((p) => p.walkIn && !baseIds.has(p.id) && !localIds.has(p.id) && remoteIds.has(p.id));
  let out = state;
  for (const mine of newLocal) {
    const twin = newRemote.find((p) => nameKey(p.name) === nameKey(mine.name));
    if (!twin) continue;
    out = remapIds(out, mine.id, twin.id);
    out = {
      ...out,
      players: out.players
        .filter((p) => p.id !== mine.id)
        .map((p) => p.id !== twin.id ? p : {
          ...p,
          courtNumber: p.courtNumber ?? mine.courtNumber,
          tier: p.tier ?? mine.tier,
        }),
    };
    notes.push({ kind: "walkInFolded", name: twin.name });
  }
  return out;
}

/* ── rules 4 and 5: one game, one court, one player ─────────────── */

/**
 * Which copy stays when two must become one: the row's, then the lower
 * slot, then the id. No clocks.
 */
const rank = (m: Match, inRemote: Set<string>): [number, number, string] =>
  [inRemote.has(m.id) ? 0 : 1, m.matchIndex, m.id];
const before = (a: [number, number, string], b: [number, number, string]): boolean =>
  a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2];

function repair(state: Session, base: Session | null, remote: Session, notes: MergeNote[]): Session {
  const inRemote = new Set(remote.matches.map((m) => m.id));
  const inBase = new Set((base ?? remote).matches.map((m) => m.id));
  const dropped = new Set<string>();
  const drop = (m: Match) => {
    if (dropped.has(m.id)) return;
    dropped.add(m.id);
    if (!inRemote.has(m.id) && !recorded(m)) notes.push({ kind: "gameDropped", courtNumber: m.courtNumber, matchId: m.id });
  };
  const live = () => state.matches.filter((m) => !dropped.has(m.id) && m.status === "onCourt");

  // Somebody marked as left on one phone while the other phone dealt them
  // a game: the game comes down, as it would have on the phone that marked
  // them, and the court deals again without them. Group games only; a
  // bracket tie with a leaver is a walkover, which is the operator's call.
  // Before rule 4, so a copy of the same slot dealt without the leaver is
  // the one that stays.
  const away = new Set(state.players.filter((p) => p.away).map((p) => p.id));
  for (const m of live()) {
    if (m.stage !== null || recorded(m)) continue;
    const leaver = [...m.teamA, ...m.teamB].find((id) => away.has(id));
    if (leaver === undefined) continue;
    dropped.add(m.id);
    notes.push({ kind: "leaverDealtAround", courtNumber: m.courtNumber, playerId: leaver });
  }

  // Rule 4. The same game minted on both phones, which is only ever two
  // games neither phone's base held. A later rematch of the same two pairs
  // is not this: its first meeting is in the base.
  const fresh = state.matches.filter((m) => !dropped.has(m.id) && !inBase.has(m.id) && m.status !== "voided");
  const groups = new Map<string, Match[]>();
  for (const m of fresh) {
    const k = gameKey(m);
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const scored = group.filter(recorded);
    if (scored.length === 0) {
      const keep = group.reduce((a, m) => before(rank(m, inRemote), rank(a, inRemote)) ? m : a);
      for (const m of group) if (m !== keep) drop(m);
    } else if (scored.length === 1) {
      for (const m of group) if (m !== scored[0]) drop(m);
    } else {
      // Both phones scored their own copy. The same four twice is one game
      // entered twice: the row's stands and the note carries both. Different
      // fours are different games that happened; both stay.
      const keep = scored.reduce((a, m) => before(rank(m, inRemote), rank(a, inRemote)) ? m : a);
      for (const m of group) {
        if (m === keep) continue;
        if (!recorded(m)) { drop(m); continue; }
        if (sidesKey(m) === sidesKey(keep)) {
          dropped.add(m.id);
          notes.push({ kind: "resultKept", courtNumber: keep.courtNumber, kept: keep, dropped: m });
        }
      }
    }
  }

  // Rule 4, the other way round: a live game standing on a slot, or a
  // bracket tie, whose result is already recorded is the same game dealt
  // again by a phone that had not seen the score. Not for a teams tie,
  // whose two pairs can legitimately meet again.
  for (const m of live()) {
    const k = gameKey(m);
    if (k.startsWith("tm|")) continue;
    if (state.matches.some((x) => x !== m && !dropped.has(x.id) && x.status !== "voided" && recorded(x) && gameKey(x) === k)) drop(m);
  }

  // Rule 5. One live game per court.
  const perCourt = new Map<number, Match[]>();
  for (const m of live()) perCourt.set(m.courtNumber, [...(perCourt.get(m.courtNumber) ?? []), m]);
  for (const group of perCourt.values()) {
    if (group.length < 2) continue;
    const keep = group.reduce((a, m) => before(rank(m, inRemote), rank(a, inRemote)) ? m : a);
    for (const m of group) if (m !== keep) drop(m);
  }

  // Rule 5. One live game per player.
  const perPlayer = new Map<string, Match[]>();
  for (const m of live()) {
    for (const id of [...m.teamA, ...m.teamB]) perPlayer.set(id, [...(perPlayer.get(id) ?? []), m]);
  }
  for (const group of perPlayer.values()) {
    if (group.length < 2) continue;
    const keep = group.reduce((a, m) => before(rank(m, inRemote), rank(a, inRemote)) ? m : a);
    for (const m of group) if (m !== keep) drop(m);
  }

  return dropped.size === 0 ? state : { ...state, matches: state.matches.filter((m) => !dropped.has(m.id)) };
}

/** Anyone a surviving game, pair or crown names is a person the night has. */
function restoreReferences(state: Session, local: Session, remote: Session): Session {
  const have = new Set(state.players.map((p) => p.id));
  const needed = new Set<string>();
  for (const m of state.matches) for (const id of [...m.teamA, ...m.teamB]) needed.add(id);
  for (const p of state.knockoutPairs ?? []) for (const id of p.playerIds) needed.add(id);
  for (const c of state.courts) for (const id of c.champion ?? []) needed.add(id);
  const missing = [...needed].filter((id) => !have.has(id));
  if (missing.length === 0) return state;
  const find = (id: string): Player | undefined =>
    remote.players.find((p) => p.id === id) ?? local.players.find((p) => p.id === id);
  const restored = missing.map(find).filter((p): p is Player => p != null);
  return restored.length === 0 ? state : { ...state, players: [...state.players, ...restored] };
}

/** Exported for the tests and the hook: what counts as a recorded result. */
export const isRecorded = recorded;
