// The shared row: how a night reaches a second phone.
//
// The manager is local-first and stays that way: every save lands in this
// phone's storage before anything else happens. What this file adds is the
// mirror. The night is pushed to one row per manager instance behind the
// manage-session Edge Function, and pulled from it, so a second phone that
// opens the same link sees the night as it stands, and follows it.
//
// A push is a compare-and-set: it names the row version this phone last
// agreed with, and the function refuses it with the row when the row has
// moved past that. The refusal comes back as a 200 with `stale: true`,
// because supabase-js hides the body of any non-2xx reply, and the row IS
// the point of the refusal: the store merges against it.
//
// Why a function and not a table policy: game_state was closed to anon
// writes for a reason that has not changed, which is that everyone with the
// app's public key could clobber a live night. The function checks the
// door's passcode on every call and writes with the service role, so the
// row is reachable by exactly the people the door already lets in, and by
// nobody holding only the key.

import type { Envelope, PushReply, RemoteSync } from "@/court-manager/persistence";
import { clubhouse } from "@/clubhouse/supabaseClient";
import type { Session } from "../types";

export const MANAGE_SESSION_FUNCTION = "manage-session";

interface Reply {
  envelope?: Envelope<Session> | null;
  savedAt?: number | null;
  version?: number | null;
  /** The push was refused: the row moved past baseVersion. envelope is the row. */
  stale?: boolean;
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

/**
 * supabase-js gives a function call no deadline of its own, and a captive
 * portal at the venue can hold a request open for minutes. Past this the
 * call counts as offline: the local copy stands and the next tick tries
 * again.
 */
export const REMOTE_TIMEOUT_MS = 10_000;

const defaultInvoke: NonNullable<ManageRemoteConfig["invoke"]> = (body) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), REMOTE_TIMEOUT_MS);
  });
  return Promise.race([
    clubhouse.functions.invoke<Reply>(MANAGE_SESSION_FUNCTION, { body }),
    deadline,
  ]).finally(() => clearTimeout(timer));
};

export function createManageRemote(config: ManageRemoteConfig): RemoteSync<Session> {
  const invoke = config.invoke ?? defaultInvoke;
  const call = async (body: Record<string, unknown>): Promise<Reply> => {
    const { data, error } = await invoke({ instance: config.instance, passcode: config.passcode, ...body });
    if (error) throw new Error(error.message);
    if (!data) throw new Error("empty reply");
    // A refusal carries the row and is not an error: read it before the
    // generic error field, which the function also sets on a refusal.
    if (data.stale) return data;
    if (data.error) throw new Error(data.error);
    return data;
  };
  return {
    async push(envelope, baseVersion): Promise<PushReply<Session>> {
      // The version inside the envelope is the server's to stamp; what
      // travels is the copy and the version it was built on.
      const { version: _mine, ...copy } = envelope;
      void _mine;
      const reply = await call({ op: "push", envelope: copy, baseVersion });
      if (reply.stale) return { accepted: false, row: reply.envelope ?? null };
      return {
        accepted: true,
        version: reply.version ?? null,
        savedAt: reply.savedAt ?? envelope.savedAt,
      };
    },
    async pull() {
      const reply = await call({ op: "pull" });
      return reply.envelope ?? null;
    },
  };
}
