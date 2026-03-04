import { createClient } from "@libsql/client/web";

export const turso = createClient({
  url: import.meta.env.VITE_TURSO_DATABASE_URL,
  authToken: import.meta.env.VITE_TURSO_AUTH_TOKEN,
});

// Helper function for queries
export async function query(sql: string, params?: any[]) {
  return await turso.execute({ sql, args: params || [] });
}
