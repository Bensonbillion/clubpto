// Clubhouse auth: email + password via Supabase (Benson, 2026-08-17 —
// the code-per-login flow is gone).
//
// Members who joined in the passwordless era have auth users with no
// password on file. Their one-time bridge is requestPasswordSetup(): a
// recovery email whose link lands back on /club with a PASSWORD_RECOVERY
// event, where setNewPassword() stores their first password. After that,
// plain sign-in forever.

import { clubhouse as supabase } from "@/clubhouse/supabaseClient";

export interface ClubIdentity {
  email: string;
  playerId?: string;
  displayName?: string;
  revoked?: boolean;
}

/** Create an account. When email confirmation is on (the project default),
    the session arrives only after the confirmation link is tapped — the
    caller shows the check-your-email state when `confirmationPending`. */
export async function signUpWithPassword(
  email: string,
  password: string
): Promise<{ error?: string; confirmationPending?: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}club`,
    },
  });
  if (error) {
    if (/already registered/i.test(error.message)) {
      return {
        error:
          "That email already has an account. Sign in instead, or use Set a password if you never made one.",
      };
    }
    return { error: friendly(error.message) };
  }
  return { confirmationPending: !data.session };
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) {
    if (/invalid login credentials/i.test(error.message)) {
      return {
        error:
          "Wrong email or password. If you used to sign in with a code, tap Set a password below and you'll never need a code again.",
      };
    }
    if (/email not confirmed/i.test(error.message)) {
      return {
        error:
          "Your email isn't confirmed yet. Find our confirmation email and tap the link, then sign in.",
      };
    }
    return { error: friendly(error.message) };
  }
  return {};
}

/** One recovery email; its link lands on /club as PASSWORD_RECOVERY, where
    setNewPassword() finishes the job. Serves both forgot-password and the
    first-password bridge for passwordless-era members. */
export async function requestPasswordSetup(email: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}club` }
  );
  if (error) return { error: friendly(error.message) };
  return {};
}

/** Store the new password for the recovery-authenticated session. */
export async function setNewPassword(password: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.updateUser({ password });
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
  if (/at least 6 characters/i.test(message))
    return "Passwords need at least 6 characters.";
  return message;
}
