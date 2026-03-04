import { createClient, type Client } from "@libsql/client/web";

let turso: Client | null = null;

try {
  const url = import.meta.env.VITE_TURSO_DATABASE_URL;
  const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN;
  if (url && authToken) {
    turso = createClient({ url, authToken });
  } else {
    console.warn("[Turso] Missing env vars:", { url: !!url, authToken: !!authToken });
  }
} catch (e) {
  console.error("[Turso] Failed to initialize:", e);
}

export { turso };

export async function query(sql: string, params?: any[]) {
  if (!turso) {
    throw new Error("Turso database not configured. Set VITE_TURSO_DATABASE_URL and VITE_TURSO_AUTH_TOKEN.");
  }
  return await turso.execute({ sql, args: params || [] });
}
