import { useQuery } from "@tanstack/react-query";
import { query } from "@/lib/turso";

export interface Session {
  id: string;
  session_date: string;
  session_time: string;
  max_spots: number;
  spots_remaining: number;
  price_cents: number;
  is_active: boolean;
}

export const useSessions = () => {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      const result = await query(
        'SELECT * FROM sessions WHERE session_date >= ? AND is_active = 1 ORDER BY session_date ASC LIMIT 4',
        [today]
      );

      return result.rows as unknown as Session[];
    },
  });
};
