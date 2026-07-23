import { createClient } from "https://esm.sh/@libsql/client@0.17.0/web";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("TURSO_DATABASE_URL");
    const authToken = Deno.env.get("TURSO_AUTH_TOKEN");

    if (!url || !authToken) {
      return new Response(
        JSON.stringify({ error: "Turso not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const turso = createClient({ url, authToken });

    const { sql, params } = await req.json();

    if (!sql || typeof sql !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'sql' field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: this endpoint is unauthenticated (verify_jwt = false), so the
    // command allowlist is the only guard. DDL is DENIED — no CREATE/ALTER/DROP
    // — so a caller can never drop or restructure the database. Runtime only
    // needs DML; schema changes must go through the Turso CLI, never this proxy.
    // (Full fix still required: put this behind auth — see SECURITY-REMEDIATION.md.)
    const command = sql.trim().split(/\s+/)[0].toUpperCase();
    const ALLOWED = ["SELECT", "INSERT", "UPDATE", "DELETE", "WITH"];
    if (!ALLOWED.includes(command)) {
      return new Response(
        JSON.stringify({ error: `Disallowed SQL command: ${command}` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Block stacked statements (e.g. "SELECT 1; DROP TABLE x") — one statement only.
    const withoutTrailing = sql.trim().replace(/;\s*$/, "");
    if (withoutTrailing.includes(";")) {
      return new Response(
        JSON.stringify({ error: "Multiple SQL statements are not allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await turso.execute({ sql, args: params || [] });

    return new Response(
      JSON.stringify({ columns: result.columns, rows: result.rows, rowsAffected: result.rowsAffected }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[turso-proxy] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
