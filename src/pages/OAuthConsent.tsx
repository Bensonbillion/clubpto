import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type AuthDetails = {
  client?: { name?: string; client_name?: string; redirect_uri?: string };
  redirect_url?: string;
  redirect_to?: string;
  scopes?: string[];
  scope?: string;
};

// Beta `auth.oauth` namespace — typed locally
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
};

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      setEmail(sess.session.user.email ?? null);
      try {
        const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) return setError(error.message);
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load authorization");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId, oauth]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const { data, error } = approve
        ? await oauth.approveAuthorization(authorizationId)
        : await oauth.denyAuthorization(authorizationId);
      if (error) {
        setBusy(false);
        return setError(error.message);
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        return setError("No redirect returned by the authorization server.");
      }
      window.location.href = target;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Authorization failed");
    }
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#1A1A1A] text-[#F5F0EB] px-6">
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-serif">Could not load this authorization</h1>
          <p className="text-[#A8A29E] text-sm">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#1A1A1A] text-[#F5F0EB]">
        <p className="text-[#A8A29E]">Loading…</p>
      </main>
    );
  }

  const clientName = details.client?.name ?? details.client?.client_name ?? "an app";
  const scopes = details.scopes ?? (details.scope ? details.scope.split(" ") : []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#1A1A1A] text-[#F5F0EB] px-6 py-12">
      <div className="w-full max-w-md space-y-6 border border-white/10 p-8">
        <div>
          <h1 className="text-2xl font-serif tracking-wide">Connect {clientName} to Club PTO</h1>
          <p className="text-sm text-[#A8A29E] mt-2">
            This lets {clientName} use Club PTO as you {email ? `(${email})` : ""}.
          </p>
        </div>
        <div className="text-sm space-y-2">
          <p className="text-[#F5F0EB]">This connection will be able to:</p>
          <ul className="list-disc list-inside text-[#A8A29E] space-y-1">
            <li>Read upcoming sessions</li>
            <li>Read the player roster</li>
            <li>Read the leaderboard</li>
          </ul>
          {scopes.length > 0 && (
            <p className="text-xs text-[#A8A29E] pt-2">Requested scopes: {scopes.join(", ")}</p>
          )}
          <p className="text-xs text-[#A8A29E] pt-2">
            This does not bypass Club PTO's permissions or backend policies.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => decide(true)}
            disabled={busy}
            className="flex-1 bg-[#C9A84C] text-[#1A1A1A] hover:bg-[#b89740]"
          >
            Approve
          </Button>
          <Button
            onClick={() => decide(false)}
            disabled={busy}
            variant="outline"
            className="flex-1 border-white/20 text-[#F5F0EB] hover:bg-white/5"
          >
            Cancel
          </Button>
        </div>
      </div>
    </main>
  );
}
