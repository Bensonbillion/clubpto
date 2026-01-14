import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
      
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .gte("session_date", today)
        .eq("is_active", true)
        .order("session_date", { ascending: true })
        .limit(4);

      if (error) throw error;
      return data as Session[];
    },
  });
};