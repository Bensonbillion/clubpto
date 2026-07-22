import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function client(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_leaderboard",
  title: "Get leaderboard",
  description: "Get the top Club PTO players ranked by total points across all sessions.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Top N (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await client(ctx)
      .from("players")
      .select("name, tier, total_points, total_wins")
      .order("total_points", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const ranked = (data ?? []).map((p, i) => ({ rank: i + 1, ...p }));
    return {
      content: [{ type: "text", text: JSON.stringify(ranked, null, 2) }],
      structuredContent: { leaderboard: ranked },
    };
  },
});
