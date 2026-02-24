import { Match } from "@/types/courtManager";
import { AlertTriangle } from "lucide-react";

interface CourtConflictAlertProps {
  court1Match: Match | null;
  court2Match: Match | null;
  upNextMatches: Match[];
}

function getPlayerIds(match: Match): string[] {
  return [
    match.pair1.player1.id,
    match.pair1.player2.id,
    match.pair2.player1.id,
    match.pair2.player2.id,
  ];
}

function getPlayerNames(match: Match): Map<string, string> {
  const map = new Map<string, string>();
  [match.pair1.player1, match.pair1.player2, match.pair2.player1, match.pair2.player2].forEach(
    (p) => map.set(p.id, p.name)
  );
  return map;
}

const CourtConflictAlert = ({ court1Match, court2Match, upNextMatches }: CourtConflictAlertProps) => {
  const conflicts: string[] = [];

  // Check if same player is on both courts simultaneously
  if (court1Match && court2Match) {
    const c1Ids = getPlayerIds(court1Match);
    const c2Ids = new Set(getPlayerIds(court2Match));
    const names = new Map([...getPlayerNames(court1Match), ...getPlayerNames(court2Match)]);
    c1Ids.forEach((id) => {
      if (c2Ids.has(id)) {
        conflicts.push(`${names.get(id) || "Unknown"} is assigned to BOTH courts simultaneously!`);
      }
    });
  }

  // Check if an up-next player is still playing
  const playingIds = new Set<string>();
  const playingNames = new Map<string, string>();
  [court1Match, court2Match].forEach((m) => {
    if (!m) return;
    getPlayerIds(m).forEach((id) => playingIds.add(id));
    getPlayerNames(m).forEach((name, id) => playingNames.set(id, name));
  });

  upNextMatches.forEach((m) => {
    getPlayerIds(m).forEach((id) => {
      if (playingIds.has(id)) {
        conflicts.push(`${playingNames.get(id) || "Unknown"} is still playing but is scheduled Up Next — may cause a delay.`);
      }
    });
  });

  if (conflicts.length === 0) return null;

  return (
    <div className="rounded-lg border-2 border-destructive/50 bg-destructive/10 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-destructive" />
        <h4 className="font-display text-base text-destructive">Court Conflict</h4>
      </div>
      {conflicts.map((c, i) => (
        <p key={i} className="text-sm text-destructive/80 pl-7">⚠ {c}</p>
      ))}
    </div>
  );
};

export default CourtConflictAlert;
