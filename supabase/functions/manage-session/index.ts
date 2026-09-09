// manage-session: the Court Manager's shared row, behind the door's passcode.
//
// One row per manager instance ("1" for /manage, "2" for /manage2). The
// phone that runs the night pushes each save here; a second phone on the
// same link pulls it and follows. The passcode is checked on every call,
// which is the same gate the app's door applies, and the write uses the
// service role, so the public key alone reaches nothing. game_state stays
// exactly as locked as it was.
//
// Newest wins. A push carrying a savedAt older than the row is refused with
// the row's own copy, so a phone that was away cannot roll the night back.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const INSTANCES = new Set(["1", "2"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const expected = Deno.env.get("MANAGE_PASSCODE");
  if (!expected) return json({ error: "not configured" }, 500);

  let body: { op?: string; instance?: string; passcode?: string; envelope?: { savedAt?: number } };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }

  if (body.passcode !== expected) return json({ error: "wrong passcode" }, 401);
  if (!body.instance || !INSTANCES.has(body.instance)) return json({ error: "bad instance" }, 400);

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: row, error: readError } = await db
    .from("manage_sessions")
    .select("envelope, saved_at")
    .eq("instance", body.instance)
    .maybeSingle();
  if (readError) return json({ error: readError.message }, 500);

  if (body.op === "pull") {
    return json({ envelope: row?.envelope ?? null, savedAt: row?.saved_at ?? null });
  }

  if (body.op === "push") {
    const incoming = body.envelope;
    if (!incoming || typeof incoming.savedAt !== "number") return json({ error: "bad envelope" }, 400);
    if (row && Number(row.saved_at) > incoming.savedAt) {
      return json({ error: "stale", envelope: row.envelope, savedAt: row.saved_at }, 409);
    }
    const { error: writeError } = await db
      .from("manage_sessions")
      .upsert({
        instance: body.instance,
        envelope: incoming,
        saved_at: incoming.savedAt,
        updated_at: new Date().toISOString(),
      });
    if (writeError) return json({ error: writeError.message }, 500);
    return json({ savedAt: incoming.savedAt });
  }

  return json({ error: "bad op" }, 400);
});
