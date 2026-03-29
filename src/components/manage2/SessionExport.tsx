/**
 * SessionExport for Open Mode — same export pattern but with "PTO OPEN" branding.
 * Single unified standings (no tier grouping).
 */
import { GameState, Match, PlayoffMatch } from "@/types/courtManager";
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
  const sessionName = (state.sessionConfig as { sessionName?: string }).sessionName || "Open Session";
  const dateStr = new Date().toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });

  lines.push(`🏆 PTO OPEN ${sessionName} — Session Results`);
  lines.push(divider);
  lines.push("");

  // Round-robin results
  const completed = state.matches.filter((m) => m.status === "completed");
  if (completed.length > 0) {
    lines.push("📋 ROUND-ROBIN RESULTS");
    lines.push("");
    completed.forEach((m) => {
      const winner = m.winner ? `${m.winner.player1.name} & ${m.winner.player2.name}` : "?";
      const loser = m.loser ? `${m.loser.player1.name} & ${m.loser.player2.name}` : "?";
      lines.push(`  Game ${m.gameNumber || "?"}`);
      lines.push(`  ✅ ${winner}  def.  ${loser}`);
      lines.push("");
    });
  }

  // Unified standings (no tier grouping)
  const pairMap = new Map<string, { name: string; wins: number; losses: number; tier: string }>();
  for (const m of completed) {
    if (!m.winner || !m.loser) continue;
    const wKey = [m.winner.player1.id, m.winner.player2.id].sort().join("|||");
    const lKey = [m.loser.player1.id, m.loser.player2.id].sort().join("|||");
    if (!pairMap.has(wKey)) {
      pairMap.set(wKey, { name: `${m.winner.player1.name} & ${m.winner.player2.name}`, wins: 0, losses: 0, tier: m.winner.skillLevel });
    }
    if (!pairMap.has(lKey)) {
      pairMap.set(lKey, { name: `${m.loser.player1.name} & ${m.loser.player2.name}`, wins: 0, losses: 0, tier: m.loser.skillLevel });
    }
    pairMap.get(wKey)!.wins++;
    pairMap.get(lKey)!.losses++;
  }

  const pairStats = Array.from(pairMap.values())
    .map((p) => {
      const total = p.wins + p.losses;
      const pct = total > 0 ? Math.round((p.wins / total) * 100) : 0;
      return { ...p, total, pct };
    })
    .filter((p) => p.total > 0)
    .sort((a, b) => {
      if (b.pct !== a.pct) return b.pct - a.pct;
      return b.wins - a.wins;
    });

  if (pairStats.length > 0) {
    lines.push("📊 STANDINGS");
    pairStats.forEach((p, i) => {
      lines.push(`  ${i + 1}. ${p.name} [${p.tier}] — ${p.wins}W ${p.losses}L (${p.pct}%)`);
    });
    lines.push("");
  }

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

    const lastRound = rounds[rounds.length - 1];
    const finalMatch = byRound[lastRound]?.[0];
    if (finalMatch?.winner) {
      lines.push(divider);
      lines.push(`👑 CHAMPIONS: ${finalMatch.winner.player1.name} & ${finalMatch.winner.player2.name}`);
      lines.push(divider);
    }
  }

  lines.push("");
  lines.push("📍 Club PTO Open — Padel Toronto");

  return lines.join("\n");
}

function buildWhatsAppSummary(state: GameState): string {
  const sessionName = (state.sessionConfig as { sessionName?: string }).sessionName || "Open Session";
  const dateStr = new Date().toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  const completedCount = state.matches.filter((m) => m.status === "completed").length;
  const playerCount = state.roster.filter((p) => p.checkedIn).length;

  // Find champion
  let champion = "";
  if (state.playoffMatches && state.playoffMatches.length > 0) {
    const allComplete = state.playoffMatches.every((m) => m.status === "completed");
    const byRound = state.playoffMatches.reduce((acc, m) => { if (!acc[m.round]) acc[m.round] = []; acc[m.round].push(m); return acc; }, {} as Record<number, PlayoffMatch[]>);
    const rounds = Object.keys(byRound).map(Number).sort((a, b) => b - a);
    const finalMatch = byRound[rounds[0]]?.[0];
    if (allComplete && finalMatch?.winner) {
      champion = `${finalMatch.winner.player1.name} & ${finalMatch.winner.player2.name}`;
    }
  }

  const lines = [
    `🏆 PTO OPEN ${sessionName} — ${dateStr}`,
  ];
  if (champion) {
    lines.push(`Champion: ${champion} 🥇`);
  }
  lines.push(`${playerCount} players. ${completedCount} games.`);
  lines.push("See you next week 🎾");

  return lines.join("\n");
}

const SessionExport = ({ state }: SessionExportProps) => {
  const [copied, setCopied] = useState(false);
  const [whatsAppCopied, setWhatsAppCopied] = useState(false);
  const summary = buildTextSummary(state);
  const whatsAppText = buildWhatsAppSummary(state);

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
        await navigator.share({ title: "PTO OPEN Session Results", text: summary });
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  };

  const handleWhatsAppCopy = async () => {
    try {
      await navigator.clipboard.writeText(whatsAppText);
      setWhatsAppCopied(true);
      toast({ title: "WhatsApp text copied!" });
      setTimeout(() => setWhatsAppCopied(false), 2000);
    } catch {
      toast({ title: "Error", description: "Could not copy.", variant: "destructive" });
    }
  };

  const completedCount = state.matches.filter((m) => m.status === "completed").length;
  if (completedCount === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <h3 className="font-display text-xl text-accent">Session Export</h3>
      <p className="text-sm text-muted-foreground">Share results to WhatsApp, iMessage, or copy to clipboard.</p>

      {/* WhatsApp quick share */}
      <div className="rounded-md border border-accent/20 bg-accent/5 p-4 space-y-2">
        <p className="text-xs uppercase tracking-widest text-accent">WhatsApp Quick Share</p>
        <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-mono">{whatsAppText}</pre>
        <Button onClick={handleWhatsAppCopy} size="sm" variant="outline" className="border-accent/40 text-accent hover:bg-accent/10">
          {whatsAppCopied ? <><Check className="w-3.5 h-3.5 mr-1.5" /> Copied</> : <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy WhatsApp Text</>}
        </Button>
      </div>

      {/* Full summary */}
      <pre className="rounded-md border border-border bg-muted/30 p-4 text-xs text-foreground/80 overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap font-mono">
        {summary}
      </pre>
      <div className="flex gap-3">
        <Button onClick={handleCopy} variant="outline" className="border-accent/40 text-accent hover:bg-accent/10">
          {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
          {copied ? "Copied" : "Copy Full"}
        </Button>
        <Button onClick={handleShare} className="bg-accent text-accent-foreground hover:bg-accent/80">
          <Share2 className="w-4 h-4 mr-1.5" /> Share
        </Button>
      </div>
    </div>
  );
};

export default SessionExport;
