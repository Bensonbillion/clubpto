import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, roster } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const rosterSummary = roster
      .map((p: { name: string; skillLevel: string }) => `- ${p.name} (${p.skillLevel})`)
      .join("\n");

    const systemPrompt = `You are a padel game night assistant helping an admin configure sessions.
The admin will describe how they want games structured this week (e.g. "pair boys and girls together", "keep all men separate from women", "create mixed pairs").

Your job is to return a JSON object with:
1. "fixedPairs": an array of { player1Name, player2Name } objects — specific players who MUST be paired together as teammates.
2. "skillOverrides": an array of { playerName, newSkill } where newSkill is "good" or "beginner" — use this to reassign players to different groups if needed.
3. "explanation": a short plain-English summary (1-3 sentences) of what you're doing and why.

Important rules:
- Only use names that appear in the provided roster.
- You can infer gender from names when asked for mixed pairings (use your best judgment, but err on the side of caution).
- If the admin's prompt can't be satisfied (e.g. not enough players of each type), explain why in the explanation and return empty arrays.
- Do NOT invent players or fabricate names.
- Return ONLY valid JSON, no markdown, no code blocks.

Current roster:
${rosterSummary}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits required. Please add credits in your workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";

    let parsed: { fixedPairs?: unknown[]; skillOverrides?: unknown[]; explanation?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to extract JSON from the response if it has extra text
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /* ignore */ }
      }
    }

    return new Response(
      JSON.stringify({
        fixedPairs: parsed.fixedPairs || [],
        skillOverrides: parsed.skillOverrides || [],
        explanation: parsed.explanation || "Done! Your game setup has been configured.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-setup-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
