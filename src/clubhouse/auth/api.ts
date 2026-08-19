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

/** Create an account. Name and phone ride the auth payload as user
    metadata, so the capture happens at signup time even if the member
    never finishes email confirmation — ensureProfile() materializes the
    row on first sign-in. When email confirmation is on (the project
    default), the session arrives only after the confirmation link is
    tapped — the caller shows the check-your-email state when
    `confirmationPending`. */
export async function signUpWithPassword(
  email: string,
  password: string,
  fullName: string,
  phone: string
): Promise<{ error?: string; confirmationPending?: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { full_name: fullName.trim(), phone: phone.trim() },
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

/**
 * The signed-in member's row in the outreach book. Insert-if-missing from
 * the session's metadata — never an overwrite, so later edits survive
 * every sign-in. Fire-and-forget from the door's resolve().
 */
export async function ensureProfile(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return;
  const meta = (user.user_metadata ?? {}) as { full_name?: string; phone?: string };
  await supabase.from("clubhouse_member_profile").upsert(
    {
      auth_user_id: user.id,
      full_name: meta.full_name ?? "",
      email: user.email ?? "",
      phone: meta.phone ?? "",
    },
    { onConflict: "auth_user_id", ignoreDuplicates: true }
  );
}

export interface MemberProfile {
  fullName: string;
  email: string;
  phone: string;
}

/** The signed-in member's own row in the book (owner-only RLS). */
export async function getMyProfile(): Promise<MemberProfile | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return null;
  const { data } = await supabase
    .from("clubhouse_member_profile")
    .select("full_name, email, phone")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return { fullName: data.full_name, email: data.email, phone: data.phone };
}

/** Fill the gaps in your own row — the in-room prompt's save. */
export async function updateMyProfile(fields: {
  fullName?: string;
  phone?: string;
}): Promise<{ error?: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return { error: "You're signed out. Refresh and try again." };
  const patch: Record<string, string> = { updated_at: new Date().toISOString() };
  if (fields.fullName !== undefined) patch.full_name = fields.fullName.trim();
  if (fields.phone !== undefined) patch.phone = fields.phone.trim();
  const { error } = await supabase
    .from("clubhouse_member_profile")
    .update(patch)
    .eq("auth_user_id", userId);
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

function friendly(message: string): string {
  if (/rate limit/i.test(message))
    return "Too many tries in a row. Give it a minute, then try again.";
  if (/at least 6 characters/i.test(message))
    return "Passwords need at least 6 characters.";
  return message;
}
