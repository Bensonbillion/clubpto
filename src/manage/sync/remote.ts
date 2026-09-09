// The shared row: how a night reaches a second phone.
//
// The manager is local-first and stays that way: every save lands in this
// phone's storage before anything else happens. What this file adds is the
// mirror. The night is pushed to one row per manager instance behind the
// manage-session Edge Function, and pulled from it, so a second phone that
// opens the same link sees the night as it stands, and follows it.
//
// Why a function and not a table policy: game_state was closed to anon
// writes for a reason that has not changed, which is that everyone with the
// app's public key could clobber a live night. The function checks the
// door's passcode on every call and writes with the service role, so the
// row is reachable by exactly the people the door already lets in, and by
// nobody holding only the key.

import type { Envelope, RemoteSync } from "@/court-manager/persistence";
import { clubhouse } from "@/clubhouse/supabaseClient";
import type { Session } from "../types";

export const MANAGE_SESSION_FUNCTION = "manage-session";

interface Reply {
  envelope?: Envelope<Session> | null;
  savedAt?: number | null;
  error?: string;
}

/** What the function is asked, and with what. */
export interface ManageRemoteConfig {
  instance: string;
  passcode: string;
  /**
   * The transport, injected so the adapter tests headlessly. Defaults to
   * the club's Supabase client invoking the function.
   */
  invoke?: (body: Record<string, unknown>) => Promise<{ data: Reply | null; error: { message: string } | null }>;
}

const defaultInvoke: NonNullable<ManageRemoteConfig["invoke"]> = (body) =>
  clubhouse.functions.invoke<Reply>(MANAGE_SESSION_FUNCTION, { body });

export function createManageRemote(config: ManageRemoteConfig): RemoteSync<Session> {
  const invoke = config.invoke ?? defaultInvoke;
  const call = async (body: Record<string, unknown>): Promise<Reply> => {
    const { data, error } = await invoke({ instance: config.instance, passcode: config.passcode, ...body });
    if (error) throw new Error(error.message);
    if (!data) throw new Error("empty reply");
    if (data.error) throw new Error(data.error);
    return data;
  };
  return {
    async push(envelope) {
      // The function keeps whichever copy is newer, so a stale device pushing
      // an old night cannot roll the row back. A refusal is an error here,
      // which keeps the local status honest ("pending") until the next pull
      // hands this device the newer copy.
      await call({ op: "push", envelope });
    },
    async pull() {
      const reply = await call({ op: "pull" });
      return reply.envelope ?? null;
    },
  };
}
