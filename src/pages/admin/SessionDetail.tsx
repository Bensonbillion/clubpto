import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { query } from "@/lib/turso";
import { Lock, Trophy, Calendar, Users, Clock, ArrowLeft } from "lucide-react";
import type { PlayoffMatch, Match, GameHistory, SkillTier } from "@/types/courtManager";

const PASSCODE = "9999";

type StandingsEntry = {
  player1Name: string;
  player2Name: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winPct: number;
  skillLevel: SkillTier;
};

const SessionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleDigit = (d: string) => {
    const next = code + d;
    setCodeError(false);
    if (next.length === 4) {
      if (next === PASSCODE) setUnlocked(true);
      else { setCodeError(true); setCode(""); }
    } else setCode(next);
  };

  useEffect(() => {
    if (!unlocked || !id) return;
    (async () => {
      try {
        const result = await query(
          `SELECT * FROM session_archives WHERE id = ?`,
          [id]
        );
        if (result.rows?.length > 0) {
          setSession(result.rows[0]);
        } else {
          setError("Session not found");
        }
      } catch (err: any) {
        setError("Failed to load session: " + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [unlocked, id]);

  // Passcode screen
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center">
        <Lock className="w-10 h-10 text-[#C9A84C] mb-4" />
        <h2 className="font-serif text-2xl text-[#C9A84C] mb-2">Session Details</h2>
        <p className="text-[#A8A29E] text-sm mb-6">Enter admin passcode</p>
        <div className="flex gap-3 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${i < code.length ? "bg-[#C9A84C] border-[#C9A84C]" : "border-[#A8A29E]/40"} ${codeError ? "border-red-500 bg-red-500/30" : ""}`} />
          ))}
        </div>
        {codeError && <p className="text-red-400 text-sm mb-3">Incorrect</p>}
        <div className="grid grid-cols-3 gap-3 max-w-[240px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", ""].map((d, i) =>
            d === "" ? <div key={i} /> : (
              <button key={d} onClick={() => handleDigit(d)} className="w-16 h-16 rounded-lg border border-[#2D2D2D] bg-[#2D2D2D] text-[#F5F0EB] text-xl hover:border-[#C9A84C]/40 transition-all active:scale-95">{d}</button>
            ),
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
        <p className="text-[#A8A29E] animate-pulse">Loading session...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error || "Session not found"}</p>
        <Link to="/admin/history" className="text-[#C9A84C] text-sm hover:underline">
          &larr; Back to Session History
        </Link>
      </div>
    );
  }

  // Parse JSON columns
  const roster = JSON.parse(session.roster || "[]");
  const matches: Match[] = JSON.parse(session.matches || "[]");
  const standings: Record<string, StandingsEntry[]> = JSON.parse(session.standings || "{}");
  const playoffBracket: PlayoffMatch[] = JSON.parse(session.playoff_bracket || "[]");
  const gameHistory: GameHistory[] = JSON.parse(session.game_history || "[]");

  const playerCount = roster.filter((p: any) => p.checkedIn).length || roster.length;
  const completedMatches = matches.filter(m => m.status === "completed").length;

  // Find champion
  let championNames: string | null = null;
  if (playoffBracket.length > 0) {
    const maxRound = Math.max(...playoffBracket.map(m => m.round));
    const finals = playoffBracket.filter(m => m.round === maxRound && m.status === "completed" && m.winner);
    if (finals.length > 0) {
      const w = finals[0].winner!;
      championNames = `${w.player1.name} & ${w.player2.name}`;
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + "T12:00:00");
      return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const roundLabel = (round: number, totalRounds: number) => {
    const fromEnd = totalRounds - round;
    if (fromEnd === 0) return "Final";
    if (fromEnd === 1) return "Semifinals";
    if (fromEnd === 2) return "Quarterfinals";
    return `Round ${round}`;
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-[#F5F0EB]">
      <header className="border-b border-[#2D2D2D] px-4 md:px-6 py-4">
        <Link to="/admin/history" className="flex items-center gap-1 text-xs text-[#A8A29E] hover:text-[#C9A84C] transition-colors mb-2">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Session History
        </Link>
        <h1 className="font-serif text-2xl text-[#C9A84C]">{formatDate(session.session_date)}</h1>
        {session.session_label && (
          <p className="text-sm text-[#A8A29E] mt-0.5">{session.session_label}</p>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <StatBox icon={<Users className="w-4 h-4" />} label="Players" value={playerCount} />
          <StatBox icon={<Calendar className="w-4 h-4" />} label="Matches" value={completedMatches} />
          <StatBox label="Courts" value={session.court_count} />
          <StatBox icon={<Clock className="w-4 h-4" />} label="Duration" value={`${session.duration_minutes}m`} />
        </div>

        {/* Champion banner */}
        {championNames && (
          <div className="border-2 border-[#C9A84C] p-5 text-center space-y-2">
            <Trophy className="w-8 h-8 text-[#C9A84C] mx-auto" />
            <p className="text-xs text-[#A8A29E] uppercase tracking-wider">Session Champions</p>
            <p className="font-serif text-xl text-[#C9A84C]">{championNames}</p>
          </div>
        )}

        {/* Standings by tier */}
        {(["A", "B", "C"] as const).map(tier => {
          const tierStandings = standings[tier];
          if (!tierStandings || tierStandings.length === 0) return null;
          return (
            <div key={tier} className="border border-[#2D2D2D] p-4 space-y-3">
              <h2 className="font-serif text-sm text-[#C9A84C]">Tier {tier} Standings</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#A8A29E] text-xs uppercase tracking-wider border-b border-[#2D2D2D]">
                    <th className="text-left py-2 font-normal">#</th>
                    <th className="text-left py-2 font-normal">Pair</th>
                    <th className="text-center py-2 font-normal">W</th>
                    <th className="text-center py-2 font-normal">L</th>
                    <th className="text-right py-2 font-normal">Win%</th>
                  </tr>
                </thead>
                <tbody>
                  {tierStandings.map((s: StandingsEntry, i: number) => (
                    <tr key={i} className="border-b border-[#2D2D2D]/50">
                      <td className="py-2 text-[#A8A29E]">{i + 1}</td>
                      <td className="py-2">{s.player1Name} & {s.player2Name}</td>
                      <td className="py-2 text-center text-green-400">{s.wins}</td>
                      <td className="py-2 text-center text-red-400">{s.losses}</td>
                      <td className="py-2 text-right text-[#C9A84C]">{(s.winPct * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        {/* Playoff Bracket */}
        {playoffBracket.length > 0 && (
          <div className="border border-[#2D2D2D] p-4 space-y-3">
            <h2 className="font-serif text-sm text-[#C9A84C]">Playoff Bracket</h2>
            {(() => {
              const maxRound = Math.max(...playoffBracket.map(m => m.round));
              const rounds = Array.from(new Set(playoffBracket.map(m => m.round))).sort((a, b) => a - b);
              return rounds.map(round => (
                <div key={round} className="space-y-2">
                  <p className="text-xs text-[#A8A29E] uppercase tracking-wider">{roundLabel(round, maxRound)}</p>
                  {playoffBracket.filter(m => m.round === round).map(m => (
                    <div key={m.id} className={`p-3 border ${m.status === "completed" ? "border-[#2D2D2D]" : "border-[#2D2D2D]/50"} text-sm`}>
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          {m.pair1 ? (
                            <p className={m.winner && m.winner.player1.id === m.pair1.player1.id ? "text-[#C9A84C] font-medium" : "text-[#A8A29E]"}>
                              {m.seed1 > 0 && <span className="text-xs text-[#A8A29E]/60 mr-1">#{m.seed1}</span>}
                              {m.pair1.player1.name} & {m.pair1.player2.name}
                              {m.winner && m.winner.player1.id === m.pair1.player1.id && " ✓"}
                            </p>
                          ) : (
                            <p className="text-[#A8A29E]/40 italic text-xs">TBD</p>
                          )}
                          {m.pair2 ? (
                            <p className={m.winner && m.winner.player1.id === m.pair2.player1.id ? "text-[#C9A84C] font-medium" : "text-[#A8A29E]"}>
                              {m.seed2 > 0 && <span className="text-xs text-[#A8A29E]/60 mr-1">#{m.seed2}</span>}
                              {m.pair2.player1.name} & {m.pair2.player2.name}
                              {m.winner && m.winner.player1.id === m.pair2.player1.id && " ✓"}
                            </p>
                          ) : (
                            <p className="text-[#A8A29E]/40 italic text-xs">TBD</p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 ${m.status === "completed" ? "text-green-400" : "text-[#A8A29E]/40"}`}>
                          {m.status === "completed" ? "Done" : m.status === "playing" ? "Live" : "Pending"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ));
            })()}
          </div>
        )}

        {/* Game Log */}
        {gameHistory.length > 0 && (
          <div className="border border-[#2D2D2D] p-4 space-y-3">
            <h2 className="font-serif text-sm text-[#C9A84C]">Game Log</h2>
            <div className="space-y-1.5 text-sm">
              {gameHistory.map((g, i) => (
                <div key={g.id || i} className="flex items-center gap-2 py-1.5 border-b border-[#2D2D2D]/30 last:border-0">
                  <span className="text-[#A8A29E]/60 text-xs font-mono w-6 shrink-0">#{i + 1}</span>
                  <span className="text-xs text-[#A8A29E] w-10 shrink-0">Ct {g.court}</span>
                  <span className="text-[#F5F0EB]">{g.winnerNames}</span>
                  <span className="text-[#A8A29E]/60 text-xs">def.</span>
                  <span className="text-[#A8A29E]">{g.loserNames}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4">
          <Link to="/admin/history" className="flex items-center gap-1 text-xs text-[#A8A29E] hover:text-[#C9A84C] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Session History
          </Link>
        </div>
      </main>
    </div>
  );
};

const StatBox = ({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | number }) => (
  <div className="p-3 bg-[#2D2D2D]/50 border border-[#2D2D2D]">
    <div className="flex items-center justify-center gap-1.5 text-xl font-mono font-bold text-[#F5F0EB]">
      {icon && <span className="text-[#C9A84C]">{icon}</span>}
      {value}
    </div>
    <div className="text-[10px] text-[#A8A29E] uppercase tracking-wider mt-1">{label}</div>
  </div>
);

export default SessionDetail;
