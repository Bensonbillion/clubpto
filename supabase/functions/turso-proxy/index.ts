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
    const url = Deno.env.get("VITE_TURSO_DATABASE_URL");
    const authToken = Deno.env.get("VITE_TURSO_AUTH_TOKEN");

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

    // Basic allowlist: DML + DDL for schema management
    const command = sql.trim().split(/\s+/)[0].toUpperCase();
    if (!["SELECT", "INSERT", "UPDATE", "DELETE", "WITH", "CREATE", "ALTER", "DROP"].includes(command)) {
      return new Response(
        JSON.stringify({ error: `Disallowed SQL command: ${command}` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await turso.execute({ sql, args: params || [] });

    return new Response(
      JSON.stringify({ columns: result.columns, rows: result.rows, rowsAffected: result.rowsAffected }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[turso-proxy] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
