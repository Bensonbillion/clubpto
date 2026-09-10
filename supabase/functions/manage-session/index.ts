// manage-session: the Court Manager's shared row, behind the door's passcode.
//
// One row per manager instance ("1" for /manage, "2" for /manage2). The
// phone that runs the night pushes each save here; a second phone on the
// same link pulls it and follows. The passcode is checked on every call,
// which is the same gate the app's door applies, and the write uses the
// service role, so the public key alone reaches nothing. game_state stays
// exactly as locked as it was.
//
// The row is a straight line of versions. Every accepted push stamps
// `version` inside the envelope (no table change: it lives in the jsonb),
// and a push from a phone that knows about versions names the one it was
// built on as `baseVersion`. It is accepted only if the row still holds
// that version; otherwise it is refused WITH the row, as a 200 carrying
// `stale: true`, because supabase-js hides the body of any non-2xx reply
// and the row is the whole point of the refusal: the phone merges against
// it and pushes again. The check-and-write is one conditional update on
// saved_at, which every accepted write moves strictly forward, so two
// pushes against the same version cannot both land.
//
// A phone still running the older bundle sends no baseVersion. Until a
// merge-aware phone has written the row it keeps the old rule, newest
// savedAt wins with a 409 for an older copy, and its writes are versioned
// too. From the first merge-aware write on (the row carries `cas: true`)
// an old bundle can only follow: its pushes are refused, because a
// wholesale copy from a phone that cannot merge would erase whatever the
// newer phones landed since it last pulled. Its own tick keeps adopting
// the row, and its every tap shows the red line, which is the reload cue.

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

interface Row {
  envelope: { savedAt?: number; version?: number; cas?: boolean; [k: string]: unknown };
  saved_at: number | string;
}

const versionOf = (row: Row | null): number | null =>
  row ? (Number(row.envelope?.version) || 0) : null;

const withVersion = (row: Row) => ({ ...row.envelope, version: versionOf(row) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const expected = Deno.env.get("MANAGE_PASSCODE");
  if (!expected) return json({ error: "not configured" }, 500);

  let body: {
    op?: string; instance?: string; passcode?: string;
    envelope?: { savedAt?: number; [k: string]: unknown };
    baseVersion?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }

  if (body.passcode !== expected) return json({ error: "wrong passcode" }, 401);
  if (!body.instance || !INSTANCES.has(body.instance)) return json({ error: "bad instance" }, 400);
  const instance = body.instance;

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const readRow = async (): Promise<Row | null> => {
    const { data, error } = await db
      .from("manage_sessions")
      .select("envelope, saved_at")
      .eq("instance", instance)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Row | null) ?? null;
  };

  let row: Row | null;
  try {
    row = await readRow();
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }

  if (body.op === "pull") {
    return json({
      envelope: row ? withVersion(row) : null,
      savedAt: row?.saved_at ?? null,
      version: versionOf(row),
    });
  }

  if (body.op === "push") {
    const incoming = body.envelope;
    if (!incoming || typeof incoming.savedAt !== "number") return json({ error: "bad envelope" }, 400);
    const knowsVersions = Object.prototype.hasOwnProperty.call(body, "baseVersion");

    const stale = (current: Row) => json({
      stale: true,
      error: "stale",
      envelope: withVersion(current),
      savedAt: current.saved_at,
      version: versionOf(current),
    });

    if (row && knowsVersions && body.baseVersion !== versionOf(row)) return stale(row);
    if (row && !knowsVersions && (row.envelope.cas === true || Number(row.saved_at) > incoming.savedAt)) {
      return json({ error: "stale", envelope: withVersion(row), savedAt: row.saved_at }, 409);
    }

    const version = (versionOf(row) ?? 0) + 1;
    const savedAt = row ? Math.max(incoming.savedAt, Number(row.saved_at) + 1) : incoming.savedAt;
    const cas = knowsVersions || row?.envelope.cas === true;
    // The stored copy's own savedAt moves with the column, so a phone that
    // still compares clocks sees a strictly rising number.
    const stored = { ...incoming, savedAt, version, cas };
    const record = { instance, envelope: stored, saved_at: savedAt, updated_at: new Date().toISOString() };

    if (row) {
      // Conditional on the saved_at read above: if another push landed in
      // between, zero rows match and this one is refused with the row as it
      // now stands.
      const { data, error } = await db
        .from("manage_sessions")
        .update(record)
        .eq("instance", instance)
        .eq("saved_at", Number(row.saved_at))
        .select("saved_at");
      if (error) return json({ error: error.message }, 500);
      if (!data || data.length === 0) {
        try {
          const now = await readRow();
          if (now) return knowsVersions ? stale(now) : json({ error: "stale", envelope: withVersion(now), savedAt: now.saved_at }, 409);
        } catch (e) {
          return json({ error: (e as Error).message }, 500);
        }
        return json({ error: "row vanished" }, 500);
      }
      return json({ savedAt, version });
    }

    const { error } = await db.from("manage_sessions").insert(record);
    if (error) {
      // Two phones bootstrapping the row at once: the second sees the
      // unique violation and is refused with what the first wrote.
      if (error.code === "23505") {
        try {
          const now = await readRow();
          if (now) return knowsVersions ? stale(now) : json({ error: "stale", envelope: withVersion(now), savedAt: now.saved_at }, 409);
        } catch (e) {
          return json({ error: (e as Error).message }, 500);
        }
      }
      return json({ error: error.message }, 500);
    }
    return json({ savedAt, version });
  }

  return json({ error: "bad op" }, 400);
});
