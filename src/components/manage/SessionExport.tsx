import { GameState, Match, PlayoffMatch, SkillTier } from "@/types/courtManager";
import { Button } from "@/components/ui/button";
import { Copy, Share2, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface SessionExportProps {
  state: GameState;
}

function buildTextSummary(state: GameState): string {
  const lines: string[] = [];
  const divider = "━━━━━━━━━━━━━━━━━━━━";

  lines.push("🏆 CLUB PTO — Session Results");
  lines.push(divider);
  lines.push("");

  // Round-robin results
  const completed = state.matches.filter((m) => m.status === "completed");
  if (completed.length > 0) {
    lines.push("📋 ROUND-ROBIN RESULTS");
    lines.push("");
    completed.forEach((m) => {
      const label = m.matchupLabel || "";
      const winner = m.winner ? `${m.winner.player1.name} & ${m.winner.player2.name}` : "?";
      const loser = m.loser ? `${m.loser.player1.name} & ${m.loser.player2.name}` : "?";
      lines.push(`  Game ${m.gameNumber || "?"} ${label ? `(${label})` : ""}`);
      lines.push(`  ✅ ${winner}  def.  ${loser}`);
      lines.push("");
    });
  }

  // Standings by tier — pair-based (matches the leaderboard)
  const buildPairStandings = (tier: SkillTier, label: string) => {
    const tierPairs = state.pairs.filter((p) => p.skillLevel === tier);
    if (tierPairs.length === 0) return;

    const pairStats = tierPairs.map((p) => {
      const total = p.wins + p.losses;
      const pct = total > 0 ? Math.round((p.wins / total) * 100) : 0;
      return { name: `${p.player1.name} & ${p.player2.name}`, wins: p.wins, losses: p.losses, pct, total };
    }).filter((p) => p.total > 0)
      .sort((a, b) => {
        if (b.pct !== a.pct) return b.pct - a.pct;
        return b.wins - a.wins;
      });

    if (pairStats.length === 0) return;
    lines.push(`📊 STANDINGS — ${label}`);
    pairStats.forEach((p, i) => {
      lines.push(`  ${i + 1}. ${p.name} — ${p.wins}W ${p.losses}L (${p.pct}%)`);
    });
    lines.push("");
  };

  buildPairStandings("A", "Tier A (Advanced)");
  buildPairStandings("B", "Tier B (Intermediate)");
  buildPairStandings("C", "Tier C (Beginner)");

  // Playoff bracket
  if (state.playoffMatches && state.playoffMatches.length > 0) {
    lines.push(divider);
    lines.push("🏆 PLAYOFF BRACKET");
    lines.push("");

    const byRound = state.playoffMatches.reduce((acc, m) => {
      if (!acc[m.round]) acc[m.round] = [];
      acc[m.round].push(m);
      return acc;
    }, {} as Record<number, PlayoffMatch[]>);

    const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
    rounds.forEach((r) => {
      const roundLabel = r === rounds[rounds.length - 1] ? "FINAL" : r === 1 ? "SEMI-FINALS" : `ROUND ${r}`;
      lines.push(`  ${roundLabel}`);
      byRound[r].forEach((m) => {
        const t1 = m.pair1 ? `${m.pair1.player1.name} & ${m.pair1.player2.name}` : "TBD";
        const t2 = m.pair2 ? `${m.pair2.player1.name} & ${m.pair2.player2.name}` : "TBD";
        if (m.winner) {
          const winLabel = `${m.winner.player1.name} & ${m.winner.player2.name}`;
          lines.push(`    ${t1} vs ${t2} → 🏆 ${winLabel}`);
        } else {
          lines.push(`    ${t1} vs ${t2} — ${m.status}`);
        }
      });
      lines.push("");
    });

    // Champion
    const lastRound = rounds[rounds.length - 1];
    const finalMatch = byRound[lastRound]?.[0];
    if (finalMatch?.winner) {
      lines.push(divider);
      lines.push(`👑 CHAMPIONS: ${finalMatch.winner.player1.name} & ${finalMatch.winner.player2.name}`);
      lines.push(divider);
    }
  }

  lines.push("");
  lines.push("📍 Club PTO Padel");

  return lines.join("\n");
}

const SessionExport = ({ state }: SessionExportProps) => {
  const [copied, setCopied] = useState(false);
  const summary = buildTextSummary(state);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      toast({ title: "Copied!", description: "Session summary copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Error", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Club PTO Session Results", text: summary });
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  };

  const completedCount = state.matches.filter((m) => m.status === "completed").length;
  if (completedCount === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <h3 className="font-display text-xl text-accent">Session Export</h3>
      <p className="text-sm text-muted-foreground">Share results to WhatsApp, iMessage, or copy to clipboard.</p>
      <pre className="rounded-md border border-border bg-muted/30 p-4 text-xs text-foreground/80 overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap font-mono">
        {summary}
      </pre>
      <div className="flex gap-3">
        <Button onClick={handleCopy} variant="outline" className="border-accent/40 text-accent hover:bg-accent/10">
          {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button onClick={handleShare} className="bg-accent text-accent-foreground hover:bg-accent/80">
          <Share2 className="w-4 h-4 mr-1.5" /> Share
        </Button>
      </div>
    </div>
  );
};

export default SessionExport;
