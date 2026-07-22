import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listUpcomingSessions from "./tools/list-upcoming-sessions";
import listPlayers from "./tools/list-players";
import getLeaderboard from "./tools/get-leaderboard";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "club-pto-mcp",
  title: "Club PTO",
  version: "0.1.0",
  instructions:
    "Tools for Club PTO — a Toronto padel league. Use list_upcoming_sessions for booking info, list_players for the roster, and get_leaderboard for top players.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listUpcomingSessions, listPlayers, getLeaderboard],
});
