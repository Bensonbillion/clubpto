// Clubhouse reads (Wave 3): the ONLY data source for the room is the
// clubhouse_* tables (PIPE-1 — the site cannot leak what it cannot read).
// v1 reconstructs PublishBundles from the published tables and derives
// boards/records/rivalries in the browser with the pure derive functions;
// the PIPE-6 stored-totals acceleration arrives with the publish pipeline.

import { clubhouse as supabase } from "../supabaseClient";
import type { PublishBundle, PublishedChampion, PublishedPair } from "../publish/types";

export interface RosterEntry {
  playerId: string;
  displayName: string;
  /**
   * PROF-3. Optional because the fixtures and the preview page build these
   * by hand; absent reads as visible. Only ever true for the viewer's own
   * row — RLS returns nobody else's hidden rows (migration 005).
   */
  hidden?: boolean;
}

export interface MemberPrefs {
  showWinpct: boolean;
  showRank: boolean;
}

export const DEFAULT_PREFS: MemberPrefs = { showWinpct: true, showRank: false };

/**
 * Roster map for profiles and the mosaic (names only, AUTH-5 copy).
 *
 * Hidden players (PROF-3) are filtered by RLS, not here. This used to carry
 * .eq("hidden", false), which looked like the safe belt-and-braces move and
 * was in fact the bug: it also dropped the VIEWER'S OWN row, so a member who
 * hid themselves lost their name from their own seat. Migration 005 moved
 * the rule into the policy — `hidden = false OR it is yours` — so the only
 * hidden row that can arrive here is the reader's own, and the players
 * directory is the one surface that filters it back out.
 */
export async function fetchRoster(): Promise<RosterEntry[]> {
  const { data, error } = await supabase
    .from("clubhouse_roster")
    .select("player_id, display_name, hidden")
    .order("display_name");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    playerId: r.player_id,
    displayName: r.display_name,
    hidden: Boolean(r.hidden),
  }));
}

/**
 * Every published session, reconstructed into PublishBundles (oldest first).
 * One round of four reads; volumes are club-sized, not internet-sized.
 */
export async function fetchBundles(): Promise<PublishBundle[]> {
  const [sessions, pairs, results, champions, finalists] = await Promise.all([
    supabase.from("clubhouse_sessions").select("*").order("date"),
    supabase.from("clubhouse_pairs").select("*"),
    supabase.from("clubhouse_results").select("*"),
    supabase.from("clubhouse_champions").select("*"),
    supabase.from("clubhouse_finalists").select("*"),
  ]);

  // A failed read must not render as "no sessions yet" — a blank room and a
  // broken room look identical to a member, and only one deserves a refresh.
  for (const res of [sessions, pairs, results, champions, finalists]) {
    if (res.error) throw res.error;
  }

  const pairsBySession = new Map<string, PublishedPair[]>();
  for (const p of pairs.data ?? []) {
    const list = pairsBySession.get(p.session_id) ?? [];
    list.push({ pairId: p.pair_id, players: p.players });
    pairsBySession.set(p.session_id, list);
  }

  const group = <T extends { session_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) {
      const list = m.get(r.session_id) ?? [];
      list.push(r);
      m.set(r.session_id, list);
    }
    return m;
  };
  const resultsBy = group(results.data);
  const champsBy = group(champions.data);
  const finalsBy = group(finalists.data);

  const honor = (row: { title: string; points: number; pair: PublishedPair }): PublishedChampion => ({
    title: row.title,
    points: row.points,
    pair: row.pair,
  });

  return (sessions.data ?? []).map((s) => ({
    session: {
      sessionId: s.session_id,
      date: s.date,
      venue: s.venue,
      attendanceCount: s.attendance_count,
      recapNote: s.recap_note ?? undefined,
      shoutouts: (s.shoutouts as string[] | null) ?? undefined,
    },
    players: [], // visible players live inside pairs; the bundle-level list is not republished
    pairs: pairsBySession.get(s.session_id) ?? [],
    results: (resultsBy.get(s.session_id) ?? [])
      .map((r) => ({
        gameId: r.game_id,
        winnerPairId: r.winner_pair_id,
        loserPairId: r.loser_pair_id,
        completedAt: Number(r.completed_at),
      }))
      .sort((a, b) => a.completedAt - b.completedAt),
    champions: (champsBy.get(s.session_id) ?? []).map(honor),
    finalists: (finalsBy.get(s.session_id) ?? []).map(honor),
    practiceOnly: Boolean(s.practice_only),
  }));
}

/** My preference toggles (LB-3 / DASH-7); defaults when the row is absent. */
export async function fetchPrefs(playerId: string): Promise<MemberPrefs> {
  const { data } = await supabase
    .from("clubhouse_prefs")
    .select("show_winpct, show_rank")
    .eq("player_id", playerId)
    .maybeSingle();
  if (!data) return { ...DEFAULT_PREFS };
  return { showWinpct: data.show_winpct, showRank: data.show_rank };
}

/**
 * Everyone's Win% visibility, for honoring LB-3 on the boards.
 * Throws on failure so the caller can fail CLOSED (hide win rates) rather
 * than publish opt-outs it could not read.
 */
export async function fetchAllPrefs(): Promise<Map<string, MemberPrefs>> {
  const { data, error } = await supabase
    .from("clubhouse_prefs")
    .select("player_id, show_winpct, show_rank");
  if (error) throw error;
  return new Map(
    (data ?? []).map((r) => [r.player_id, { showWinpct: r.show_winpct, showRank: r.show_rank }])
  );
}

export async function saveMyPrefs(playerId: string, prefs: MemberPrefs): Promise<{ error?: string }> {
  const { error } = await supabase.from("clubhouse_prefs").upsert({
    player_id: playerId,
    show_winpct: prefs.showWinpct,
    show_rank: prefs.showRank,
    updated_at: new Date().toISOString(),
  });
  return error ? { error: error.message } : {};
}
