// Clubhouse view-model (Wave 3): ONE pure function from published data to
// everything the room renders. All privacy law lives here, testably:
// top-10 only (LB-1), Win% qualifier + opt-out (LB-3), private rank (DASH-7),
// positive streaks (DASH-3), milestones for everyone (MILE-1), no tier
// anywhere (structurally absent from inputs, PIPE-1).

import type { PublishBundle } from "../publish/types";
import {
  detectRivalries,
  MILESTONE_TIERS,
  milestoneClubName,
  milestoneStatus,
  playerTotals,
  topN,
  weeklyStreaks,
  winPct,
  winPctEligible,
  WINPCT_MIN_GAMES,
  type PlayerTotals,
  type Rivalry,
} from "../derive/stats";
import { notableLines, type NotableLine } from "../derive/notables";
import type { MemberPrefs, RosterEntry } from "../data/reads";

export interface BoardRow {
  playerId: string;
  name: string;
  value: number;
  /** Pre-formatted display value (e.g. "67%" for Win%). */
  display: string;
}

export interface HonorView {
  title: string;
  points: number;
  names: string[]; // display names only; hidden halves already say "Club member"
  finalist: boolean;
}

export interface RecapView {
  sessionId: string;
  date: string;
  venue: string;
  attendanceCount: number;
  recapNote?: string;
  shoutouts?: string[];
  honors: HonorView[];
  notables: NotableLine[];
  gamesPlayed: number;
  practiceOnly: boolean;
}

export interface RecordEntry {
  label: string;
  holder: string;
  value: number;
}

export interface ProfileView {
  playerId: string;
  name: string;
  sessions: number;
  games: number;
  wins: number;
  losses: number;
  championships: number;
  ptoPoints: number;
  bestWinStreak: number;
  milestones: number[]; // earned club tiers
  /** Null when the player opted out (LB-3) or hasn't met the qualifier. */
  winPctDisplay: string | null;
  rivalries: { vsName: string; meetings: number; wins: number; losses: number }[];
}

export interface MyView extends ProfileView {
  weekStreak: { current: number; best: number };
  nextClub: { name: string; toGo: number } | null;
  /** Private rank by PTO Points; only rendered when showRank is on (DASH-7). */
  rank: number | null;
}

export interface MosaicCell {
  playerId?: string;
  name?: string;
  filled: boolean;
}

export interface ClubhouseView {
  publishedSessions: number;
  me: MyView | null;
  recaps: RecapView[]; // newest first
  boards: {
    points: BoardRow[];
    attendance: BoardRow[];
    games: BoardRow[];
    winpct: BoardRow[];
  };
  records: RecordEntry[];
  /** "threshold", never "tier": the leak guard bans that key site-wide (PIPE-1). */
  milestoneClubs: { threshold: number; name: string; members: string[] }[];
  profiles: ProfileView[]; // every roster player (PROF-1), claimed or not
  mosaic: MosaicCell[][];
}

// The pixel P (MOS-1): 1 = cell of the letterform, filled by attendees in
// first-attended order. Everyone gets a square, so the letterform is
// subdivided until it has at least as many cells as there are attendees
// (MOS-2 depends on the viewer always finding their own pixel).
const P_BITMAP = [
  "11111",
  "10001",
  "10001",
  "11111",
  "10000",
  "10000",
  "10000",
];

/** Each "1" becomes a scale x scale block, so cell count grows with the club. */
function scaleBitmap(bitmap: string[], scale: number): string[] {
  if (scale <= 1) return bitmap;
  return bitmap.flatMap((row) => {
    const wide = row
      .split("")
      .map((bit) => bit.repeat(scale))
      .join("");
    return Array.from({ length: scale }, () => wide);
  });
}

export function buildClubhouseView(
  bundles: PublishBundle[],
  roster: RosterEntry[],
  allPrefs: Map<string, MemberPrefs>,
  myPlayerId: string | null,
  /** False when preferences could not be read: LB-3 then fails closed. */
  prefsKnown = true
): ClubhouseView {
  const ordered = [...bundles].sort((a, b) => a.session.date.localeCompare(b.session.date));
  const totals = playerTotals(ordered);
  const rivalries = detectRivalries(ordered);

  // Published names WIN over the roster copy (PRIV-3): privacy processing
  // happens at publish time, so a pseudonym lives in the bundle while the
  // roster still holds the legal name. Roster only names players who have
  // never been published. Newest publish wins (ordered is oldest-first).
  const nameOf = new Map<string, string>();
  for (const b of ordered) {
    for (const p of b.pairs)
      for (const ref of p.players) if (ref.id) nameOf.set(ref.id, ref.displayName);
    for (const honor of [...b.champions, ...b.finalists])
      for (const ref of honor.pair.players) if (ref.id) nameOf.set(ref.id, ref.displayName);
  }
  for (const r of roster) if (!nameOf.has(r.playerId)) nameOf.set(r.playerId, r.displayName);
  const name = (id: string) => nameOf.get(id) ?? "Club member";

  // LB-3 fails CLOSED: when preferences are unknown (read failed, table
  // missing), win rates stay hidden. An opt-out that leaks on error is not
  // an opt-out.
  const prefsOf = (id: string): MemberPrefs =>
    allPrefs.get(id) ?? { showWinpct: prefsKnown, showRank: false };

  // ---- attendance dates per player (streaks + mosaic order) ----
  // datesOf counts every night you turned up (your own page, milestones).
  // rankedDatesOf excludes practice, for the public streak record (PIPE-3).
  const datesOf = new Map<string, string[]>();
  const rankedDatesOf = new Map<string, string[]>();
  const firstSeen: string[] = []; // player ids in first-attended order
  for (const b of ordered) {
    const seen = new Set<string>();
    for (const p of b.pairs)
      for (const ref of p.players)
        if (ref.id && !seen.has(ref.id)) {
          seen.add(ref.id);
          if (!datesOf.has(ref.id)) {
            datesOf.set(ref.id, []);
            firstSeen.push(ref.id);
          }
          datesOf.get(ref.id)!.push(b.session.date);
          if (!b.practiceOnly) {
            if (!rankedDatesOf.has(ref.id)) rankedDatesOf.set(ref.id, []);
            rankedDatesOf.get(ref.id)!.push(b.session.date);
          }
        }
  }

  // ---- recaps, newest first, with notable lines computed per session ----
  const recaps: RecapView[] = ordered
    .map((b, i) => ({
      sessionId: b.session.sessionId,
      date: b.session.date,
      venue: b.session.venue,
      attendanceCount: b.session.attendanceCount,
      recapNote: b.session.recapNote,
      shoutouts: b.session.shoutouts,
      honors: [
        ...b.champions.map((c) => ({
          title: c.title,
          points: c.points,
          names: c.pair.players.map((r) => (r.id ? name(r.id) : r.displayName)),
          finalist: false,
        })),
        ...b.finalists.map((c) => ({
          title: c.title,
          points: c.points,
          names: c.pair.players.map((r) => (r.id ? name(r.id) : r.displayName)),
          finalist: true,
        })),
      ],
      notables: notableLines(b, ordered.slice(0, i)),
      gamesPlayed: b.results.length,
      practiceOnly: b.practiceOnly,
    }))
    .reverse();

  // ---- boards: accumulative featured (LB-2), Win% qualified + opted-in ----
  const list = [...totals.values()];
  const row = (t: PlayerTotals, value: number, display?: string): BoardRow => ({
    playerId: t.playerId,
    name: name(t.playerId),
    value,
    display: display ?? String(value),
  });
  // Practice nights never feed a board or a record (PIPE-3). They still
  // count as attendance on your own page and toward milestone clubs, which
  // are persistence, not competition.
  const rankedSessions = new Map<string, number>();
  for (const b of ordered) {
    if (b.practiceOnly) continue;
    const seen = new Set<string>();
    for (const p of b.pairs)
      for (const ref of p.players)
        if (ref.id && !seen.has(ref.id)) {
          seen.add(ref.id);
          rankedSessions.set(ref.id, (rankedSessions.get(ref.id) ?? 0) + 1);
        }
  }
  const ranked = (t: PlayerTotals) => rankedSessions.get(t.playerId) ?? 0;

  const boards = {
    points: topN(list, (t) => t.ptoPoints).filter((t) => t.ptoPoints > 0).map((t) => row(t, t.ptoPoints)),
    attendance: topN(list, ranked).filter((t) => ranked(t) > 0).map((t) => row(t, ranked(t))),
    games: topN(list, (t) => t.games).filter((t) => t.games > 0).map((t) => row(t, t.games)),
    winpct: topN(
      winPctEligible(list).filter((t) => prefsOf(t.playerId).showWinpct),
      winPct
    ).map((t) => row(t, winPct(t), `${Math.round(winPct(t) * 100)}%`)),
  };

  // ---- records book (CHW-2) ----
  const record = (label: string, metric: (t: PlayerTotals) => number): RecordEntry | null => {
    if (list.length === 0) return null;
    const best = list.reduce((a, b) => (metric(b) > metric(a) ? b : a));
    const value = metric(best);
    if (value === 0) return null;
    return { label, holder: name(best.playerId), value };
  };
  const streakRecord = (): RecordEntry | null => {
    let holder: string | null = null;
    let value = 0;
    for (const [id, dates] of rankedDatesOf) {
      const s = weeklyStreaks(dates);
      if (s.best > value) {
        value = s.best;
        holder = id;
      }
    }
    return holder && value > 1 ? { label: "Longest weekly attendance streak", holder: name(holder), value } : null;
  };
  const records = [
    record("Longest win streak", (t) => t.longestWinStreak),
    record("Most championships", (t) => t.championships),
    record("Most sessions attended", ranked),
    record("Most games played", (t) => t.games),
    streakRecord(),
  ].filter((r): r is RecordEntry => r !== null);

  // ---- milestone clubs (MILE-1): membership by persistence, never skill ----
  const milestoneClubs = MILESTONE_TIERS.map((threshold) => ({
    threshold,
    name: milestoneClubName(threshold),
    // Alphabetical on purpose: club membership is not a ranking, and a
    // list sorted by sessions would be a full attendance table (LB-1).
    members: list
      .filter((t) => t.sessions >= threshold)
      .map((t) => name(t.playerId))
      .sort((a, b) => a.localeCompare(b)),
  }));

  // ---- profiles for every roster player (PROF-1) ----
  const profileOf = (playerId: string): ProfileView => {
    const t = totals.get(playerId);
    const p = prefsOf(playerId);
    const mine = rivalries
      .filter((r: Rivalry) => r.playerA === playerId || r.playerB === playerId)
      .map((r) => {
        const other = r.playerA === playerId ? r.playerB : r.playerA;
        const wins = r.playerA === playerId ? r.winsA : r.winsB;
        return { vsName: name(other), meetings: r.meetings, wins, losses: r.meetings - wins };
      })
      .sort((a, b) => b.meetings - a.meetings);
    const games = t?.games ?? 0;
    const wins = t?.wins ?? 0;
    return {
      playerId,
      name: name(playerId),
      sessions: t?.sessions ?? 0,
      games,
      wins,
      losses: t?.losses ?? 0,
      championships: t?.championships ?? 0,
      ptoPoints: t?.ptoPoints ?? 0,
      bestWinStreak: t?.longestWinStreak ?? 0,
      milestones: milestoneStatus(t?.sessions ?? 0).earned,
      winPctDisplay:
        p.showWinpct && games >= WINPCT_MIN_GAMES ? `${Math.round((wins / games) * 100)}%` : null,
      rivalries: mine,
    };
  };
  // PROF-3: a hidden player is gone from the directory — including from
  // their own copy of it, so hiding looks like it worked. Their name still
  // reaches nameOf above, which is what keeps their own seat from greeting
  // them as "Club member".
  const profiles = roster.filter((r) => !r.hidden).map((r) => profileOf(r.playerId));

  // ---- me (dashboard) ----
  let me: MyView | null = null;
  if (myPlayerId) {
    const base = profileOf(myPlayerId);
    const ms = milestoneStatus(base.sessions);
    const byPoints = [...list].sort((a, b) => b.ptoPoints - a.ptoPoints);
    const idx = byPoints.findIndex((t) => t.playerId === myPlayerId);
    me = {
      ...base,
      weekStreak: weeklyStreaks(datesOf.get(myPlayerId) ?? []),
      nextClub: ms.next ? { name: milestoneClubName(ms.next), toGo: ms.toNext! } : null,
      rank: prefsOf(myPlayerId).showRank && idx >= 0 ? idx + 1 : null,
    };
  }

  // ---- mosaic (MOS-1/2): attendees fill the pixel P in first-attended order ----
  const baseCells = P_BITMAP.join("").split("1").length - 1;
  const scale = Math.max(1, Math.ceil(Math.sqrt(firstSeen.length / baseCells)));
  const bitmap = scaleBitmap(P_BITMAP, scale);
  const mosaic: MosaicCell[][] = bitmap.map((rowBits) =>
    rowBits
      .split("")
      .map((bit) => ({ filled: false, ...(bit === "1" ? {} : { off: true }) } as MosaicCell & { off?: boolean }))
  );
  const cells: MosaicCell[] = [];
  bitmap.forEach((rowBits, r) =>
    rowBits.split("").forEach((bit, c) => {
      if (bit === "1") cells.push(mosaic[r][c]);
    })
  );
  firstSeen.forEach((id, i) => {
    const cell = cells[i];
    if (!cell) return; // impossible by construction; never silently overwrite
    cell.playerId = id;
    cell.name = name(id);
    cell.filled = true;
  });

  return {
    publishedSessions: ordered.filter((b) => !b.practiceOnly).length,
    me,
    recaps,
    boards,
    records,
    milestoneClubs,
    profiles,
    mosaic,
  };
}
