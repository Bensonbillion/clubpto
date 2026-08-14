// The room behind the door (Wave 3). Loads published data ONCE, builds the
// pure view-model, renders the sections. Reads only clubhouse_* tables.

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PREFS,
  fetchAllPrefs,
  fetchBundles,
  fetchRoster,
  saveMyPrefs,
  type MemberPrefs,
  type RosterEntry,
} from "../data/reads";
import type { PublishBundle } from "../publish/types";
import { buildClubhouseView } from "./viewmodel";
import { Boards, Dashboard, Empty, Mosaic, Players, Recaps, WallRecords } from "./sections";
import "./clubhouse.css";

const NAV = [
  ["#you", "You"],
  ["#recaps", "Recaps"],
  ["#wall", "The wall"],
  ["#boards", "Boards"],
  ["#players", "Players"],
  ["#mosaic", "Mosaic"],
] as const;

export default function ClubhouseHome({
  playerId,
  displayName,
}: {
  playerId: string;
  displayName: string;
}) {
  const [bundles, setBundles] = useState<PublishBundle[] | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [allPrefs, setAllPrefs] = useState<Map<string, MemberPrefs>>(new Map());
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [prefsKnown, setPrefsKnown] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    // Bundles and roster are load-bearing: if either fails, say so.
    // Preferences may legitimately be unreadable (migration 003 not applied
    // yet); that degrades to "win rates hidden for everyone", never to
    // "publish everyone" (LB-3 fails closed).
    Promise.all([
      fetchBundles(),
      fetchRoster(),
      fetchAllPrefs().catch(() => {
        setPrefsKnown(false);
        return new Map<string, MemberPrefs>();
      }),
    ])
      .then(([b, r, p]) => {
        setBundles(b);
        setRoster(r);
        setAllPrefs(p);
      })
      .catch(() => setFailed(true));
  }, []);

  const view = useMemo(
    () => (bundles ? buildClubhouseView(bundles, roster, allPrefs, playerId, prefsKnown) : null),
    [bundles, roster, allPrefs, playerId, prefsKnown]
  );

  const myPrefs = allPrefs.get(playerId) ?? { ...DEFAULT_PREFS };

  const onPrefs = async (p: MemberPrefs) => {
    setSaving(true);
    setNotice(null);
    const previous = allPrefs;
    const next = new Map(allPrefs);
    next.set(playerId, p);
    setAllPrefs(next); // optimistic
    const res = await saveMyPrefs(playerId, p);
    if (res.error) {
      // A privacy switch that silently fails to save is worse than one that
      // refuses: put the toggle back and say so.
      setAllPrefs(previous);
      setNotice("That didn't save. Check your connection and try again.");
    }
    setSaving(false);
  };

  if (failed) {
    return (
      <div className="clb-section">
        <Empty>The room didn't load. Refresh, or message the club.</Empty>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="clb-section">
        <p className="rly-mono clb-dim" style={{ fontSize: 15 }}>Opening the room</p>
      </div>
    );
  }

  const me = view.me ?? {
    // Claimed players always resolve; this is a safe fallback shape.
    playerId,
    name: displayName,
    sessions: 0, games: 0, wins: 0, losses: 0, championships: 0, ptoPoints: 0,
    bestWinStreak: 0, milestones: [], winPctDisplay: null, rivalries: [],
    weekStreak: { current: 0, best: 0 },
    nextClub: { name: "The 10 Club", toGo: 10 },
    rank: null,
  };

  return (
    <div className="clb-shell">
      <nav className="clb-nav" aria-label="Clubhouse sections">
        {NAV.map(([href, label]) => (
          <a key={href} href={href}>{label}</a>
        ))}
      </nav>
      <Dashboard me={me} prefs={myPrefs} onPrefs={onPrefs} saving={saving} notice={notice} />
      <Recaps recaps={view.recaps} />
      <WallRecords view={view} />
      <Boards view={view} />
      <Players view={view} />
      <Mosaic view={view} myPlayerId={playerId} />
      <footer className="clb-section" style={{ paddingTop: "2rem" }}>
        <div className="rly-cta-row" style={{ marginBottom: "1.2rem" }}>
          <a
            className="rly-pill"
            href="https://clubptobookings.as.me/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Book a session ↗
          </a>
        </div>
        <p className="clb-dim" style={{ fontSize: 14.5 }}>
          Everything here builds session by session. Wednesdays and Sundays,
          all year.
        </p>
      </footer>
    </div>
  );
}
