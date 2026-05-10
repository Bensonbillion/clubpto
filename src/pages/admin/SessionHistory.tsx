import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { query } from "@/lib/turso";
import { Lock, Calendar, Users, Trophy, ChevronRight } from "lucide-react";
import type { PlayoffMatch, Player } from "@/types/courtManager";

const PASSCODE = "9999";

const SessionHistory = () => {
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const handleDigit = (d: string) => {
    const next = code + d;
    setCodeError(false);
    if (next.length === 4) {
      if (next === PASSCODE) setUnlocked(true);
      else { setCodeError(true); setCode(""); }
    } else setCode(next);
  };

  useEffect(() => {
    if (!unlocked) return;
    (async () => {
      try {
        const result = await query(
          `SELECT id, session_date, session_label, roster, court_count, playoff_bracket, archived_at
           FROM session_archives ORDER BY session_date DESC`
        );
        setSessions(result.rows || []);
      } catch (err) {
        console.error("Failed to load session history:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [unlocked]);

  // Passcode screen
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center">
        <Lock className="w-10 h-10 text-[#C9A84C] mb-4" />
        <h2 className="font-serif text-2xl text-[#C9A84C] mb-2">Session History</h2>
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
        <p className="text-[#A8A29E] animate-pulse">Loading session history...</p>
      </div>
    );
  }

  const getChampionNames = (playoffBracketJson: string): string | null => {
    try {
      const bracket: PlayoffMatch[] = JSON.parse(playoffBracketJson || "[]");
      if (bracket.length === 0) return null;
      const maxRound = Math.max(...bracket.map(m => m.round));
      const finals = bracket.filter(m => m.round === maxRound && m.status === "completed" && m.winner);
      if (finals.length === 0) return null;
      const winner = finals[0].winner!;
      return `${winner.player1.name} & ${winner.player2.name}`;
    } catch {
      return null;
    }
  };

  const getPlayerCount = (rosterJson: string): number => {
    try {
      const roster: Player[] = JSON.parse(rosterJson || "[]");
      return roster.filter(p => p.checkedIn).length || roster.length;
    } catch {
      return 0;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + "T12:00:00");
      return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-[#F5F0EB]">
      <header className="border-b border-[#2D2D2D] px-4 md:px-6 py-4">
        <h1 className="font-serif text-2xl text-[#C9A84C]">Session History</h1>
        <p className="text-xs text-[#A8A29E] mt-1">Past session results and standings</p>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-4">
        {sessions.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 text-[#A8A29E]/40 mx-auto mb-4" />
            <p className="text-[#A8A29E]">No archived sessions yet</p>
            <p className="text-[#A8A29E]/60 text-sm mt-1">Sessions are saved automatically when you reset</p>
          </div>
        ) : (
          sessions.map((s) => {
            const champion = getChampionNames(s.playoff_bracket);
            const playerCount = getPlayerCount(s.roster);
            return (
              <Link
                key={s.id}
                to={`/admin/history/${s.id}`}
                className="block border border-[#2D2D2D] p-4 hover:border-[#C9A84C]/40 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <p className="font-serif text-lg text-[#F5F0EB] group-hover:text-[#C9A84C] transition-colors">
                      {formatDate(s.session_date)}
                    </p>
                    {s.session_label && (
                      <p className="text-xs text-[#A8A29E]">{s.session_label}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-[#A8A29E]">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {playerCount} players
                      </span>
                      <span className="px-1.5 py-0.5 bg-[#2D2D2D] text-[#A8A29E] text-[10px] uppercase tracking-wider">
                        {s.court_count}-court
                      </span>
                    </div>
                    {champion && (
                      <p className="flex items-center gap-1.5 text-xs text-[#C9A84C]">
                        <Trophy className="w-3.5 h-3.5" />
                        {champion}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#A8A29E]/40 group-hover:text-[#C9A84C] transition-colors mt-1" />
                </div>
              </Link>
            );
          })
        )}

        <div className="pt-4">
          <Link to="/manage" className="text-xs text-[#A8A29E] hover:text-[#C9A84C] transition-colors">
            &larr; Back to Court Manager
          </Link>
        </div>
      </main>
    </div>
  );
};

export default SessionHistory;
