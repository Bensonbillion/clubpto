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
  name: "list_upcoming_sessions",
  title: "List upcoming sessions",
  description: "List active upcoming Club PTO padel sessions with date, time, price, and spots remaining.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max sessions to return (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await client(ctx)
      .from("sessions")
      .select("id, session_date, session_time, price_cents, spots_remaining, max_spots, is_active")
      .eq("is_active", true)
      .gte("session_date", today)
      .order("session_date", { ascending: true })
      .limit(limit ?? 10);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { sessions: data ?? [] },
    };
  },
});
