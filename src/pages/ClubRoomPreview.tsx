// DEV-ONLY visual harness for the Wave 3 room (same pattern as /manage/test).
// Renders the clubhouse sections from fixtures — no auth, no Supabase.
// Guarded: renders nothing outside `npm run dev`.

import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import type { PublishBundle } from "@/clubhouse/publish/types";
import { TITLES } from "@/clubhouse/publish/types";
import { buildClubhouseView } from "@/clubhouse/ui/viewmodel";
import { Boards, Dashboard, Mosaic, Players, Recaps, WallRecords } from "@/clubhouse/ui/sections";
import type { MemberPrefs, RosterEntry } from "@/clubhouse/data/reads";
import "@/clubhouse/ui/clubhouse.css";

const roster: RosterEntry[] = [
  ["fx-ada", "Ada"], ["fx-ben", "Ben"], ["fx-cy", "Cy"], ["fx-dee", "Dee"],
  ["fx-eve", "Eve"], ["fx-fola", "Fola"], ["fx-gus", "Gus"], ["fx-hana", "Hana"],
].map(([playerId, displayName]) => ({ playerId, displayName }));

const pair = (id: string, a: number, b: number) => ({
  pairId: id,
  players: [
    { id: roster[a].playerId, displayName: roster[a].displayName },
    { id: roster[b].playerId, displayName: roster[b].displayName },
  ] as [any, any],
});

function fixtureSession(n: number, date: string): PublishBundle {
  const p1 = pair(`s${n}p1`, 0, 1);
  const p2 = pair(`s${n}p2`, 2, 3);
  const p3 = pair(`s${n}p3`, 4, 5);
  const p4 = pair(`s${n}p4`, 6, 7);
  return {
    session: {
      sessionId: `fx-s${n}`,
      date,
      venue: "District Padel Club",
      attendanceCount: 8,
      recapNote:
        n % 2 === 0
          ? "Big night. The last court stayed loud until close and the final needed every point."
          : undefined,
      shoutouts: n === 3 ? ["Hana brought three first-timers. Host of the night."] : undefined,
    },
    players: [],
    pairs: [p1, p2, p3, p4],
    results: [
      { gameId: `s${n}g1`, winnerPairId: p1.pairId, loserPairId: p2.pairId, completedAt: 1 },
      { gameId: `s${n}g2`, winnerPairId: p3.pairId, loserPairId: p4.pairId, completedAt: 2 },
      { gameId: `s${n}g3`, winnerPairId: p1.pairId, loserPairId: p3.pairId, completedAt: 3 },
      { gameId: `s${n}g4`, winnerPairId: p2.pairId, loserPairId: p4.pairId, completedAt: 4 },
    ],
    champions: [
      { title: TITLES.CHAMPION_OF_THE_WEEK, points: 100, pair: p1 },
      ...(n % 2 === 0 ? [{ title: TITLES.COURT_1_CHAMPIONS, points: 40, pair: p2 }] : []),
    ],
    finalists: [{ title: TITLES.CHAMPION_OF_THE_WEEK, points: 50, pair: p3 }],
    practiceOnly: false,
  };
}

// Twelve weekly nights: enough to cross The 10 Club so milestone badges,
// streaks and records all render in the harness.
const FIXTURES: PublishBundle[] = Array.from({ length: 12 }, (_, i) => {
  const day = new Date(Date.UTC(2026, 4, 20 + i * 7)); // Wednesdays from May 20
  return fixtureSession(i + 1, day.toISOString().slice(0, 10));
});

export default function ClubRoomPreview() {
  const [empty, setEmpty] = useState(false);
  const [prefs, setPrefs] = useState<MemberPrefs>({ showWinpct: true, showRank: true });
  const view = useMemo(
    () =>
      buildClubhouseView(
        empty ? [] : FIXTURES,
        roster,
        new Map([["fx-ada", prefs]]),
        "fx-ada"
      ),
    [empty, prefs]
  );

  if (!import.meta.env.DEV) return <Navigate to="/club" replace />;

  return (
    <div className="clb-shell" style={{ minHeight: "100vh" }}>
      <div className="clb-section" style={{ paddingBottom: 0 }}>
        <label className="clb-toggle">
          <input type="checkbox" checked={empty} onChange={(e) => setEmpty(e.target.checked)} />
          Preview the empty room (before the first session)
        </label>
      </div>
      <Dashboard me={view.me!} prefs={prefs} onPrefs={setPrefs} saving={false} />
      <Recaps recaps={view.recaps} />
      <WallRecords view={view} />
      <Boards view={view} />
      <Players view={view} />
      <Mosaic view={view} myPlayerId="fx-ada" />
    </div>
  );
}
