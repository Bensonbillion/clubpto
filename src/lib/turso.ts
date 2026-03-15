const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "ikfbtktofcfkpqxwlfku";
const FUNCTION_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/turso-proxy`;

const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmJ0a3RvZmNma3BxeHdsZmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDcwNzksImV4cCI6MjA4MzkyMzA3OX0.95w2QWdpJeMz1ob7KgtU7SmJVl88Uf2_xioTkphw3-Y";

export async function query(sql: string, params?: any[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({ sql, params: params || [] }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Turso proxy error: ${res.status}`);
  }

  return await res.json();
}

// Legacy export for compatibility — no longer used
export const turso = null;
