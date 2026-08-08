// Clubhouse auth (AUTH-1..6): passwordless email via Supabase.
// One email sends BOTH a magic link and a 6-digit code; either works.
// No passwords exist anywhere, ever.

import { supabase } from "@/integrations/supabase/client";

export interface ClubIdentity {
  email: string;
  playerId?: string;
  displayName?: string;
  revoked?: boolean;
}

/** Send the login email (magic link + OTP code in one message). */
export async function requestLoginCode(email: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}club`,
    },
  });
  if (error) return { error: friendly(error.message) };
  return {};
}

/** Verify the 6-digit code as the equal alternative to the link (AUTH-1). */
export async function verifyLoginCode(
  email: string,
  code: string
): Promise<{ error?: string }> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: "email",
  });
  if (error) return { error: friendly(error.message) };
  return {};
}

export async function getSessionEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.email ?? null;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** The signed-in user's player link, if claimed (AUTH-4/5). */
export async function getMyIdentity(): Promise<ClubIdentity | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user?.email) return null;

  const { data: link } = await supabase
    .from("clubhouse_links")
    .select("player_id, revoked")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!link) return { email: user.email };
  let displayName: string | undefined;
  const { data: roster } = await supabase
    .from("clubhouse_roster")
    .select("display_name")
    .eq("player_id", link.player_id)
    .maybeSingle();
  displayName = roster?.display_name ?? undefined;

  return {
    email: user.email,
    playerId: link.player_id,
    displayName,
    revoked: link.revoked,
  };
}

export interface ClaimablePlayer {
  playerId: string;
  displayName: string;
}

/** Names available in the find-your-name picker (AUTH-5). */
export async function listClaimable(): Promise<ClaimablePlayer[]> {
  const { data } = await supabase
    .from("clubhouse_roster")
    .select("player_id, display_name")
    .eq("claimable", true)
    .order("display_name");
  return (data ?? []).map((r) => ({ playerId: r.player_id, displayName: r.display_name }));
}

/**
 * Claim a roster name. One link per auth user (PK) and per player (unique):
 * a second claim of a claimed player errors and surfaces to the club (AUTH-6).
 * Claiming stamps publication consent (PRIV-1) — the UI shows the consent
 * checkbox before enabling the claim button.
 */
export async function claimPlayer(playerId: string): Promise<{ error?: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return { error: "You're signed out. Refresh and try again." };

  const { error } = await supabase.from("clubhouse_links").insert({
    auth_user_id: userId,
    player_id: playerId,
    consent_publication_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "That name is already claimed. If it's yours, message the club and we'll sort it out.",
      };
    }
    return { error: friendly(error.message) };
  }
  return {};
}

function friendly(message: string): string {
  if (/rate limit/i.test(message))
    return "Too many tries in a row. Give it a minute, then try again.";
  if (/expired|invalid/i.test(message))
    return "That code didn't match or has expired. Request a fresh one.";
  return message;
}
