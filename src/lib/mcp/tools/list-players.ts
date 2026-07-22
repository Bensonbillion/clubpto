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
  name: "list_players",
  title: "List players",
  description: "List players in the Club PTO roster with name, tier, VIP flag, and cumulative stats.",
  inputSchema: {
    tier: z.enum(["A", "B", "C"]).optional().describe("Filter by tier."),
    limit: z.number().int().min(1).max(200).optional().describe("Max players (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tier, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = client(ctx)
      .from("players")
      .select("id, name, tier, is_vip, total_points, total_wins")
      .order("total_points", { ascending: false })
      .limit(limit ?? 50);
    if (tier) q = q.eq("tier", tier);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { players: data ?? [] },
    };
  },
});
