// A newsletter sign-up, from the pop-up or the inline boxes on Home and
// Events. It goes two places at once:
// - Mailchimp, the ClubPTO audience (api/subscribe.js), so they get the
//   emails, tagged "Website";
// - the "PTO Website: form entries" Sheet's Newsletter tab, which keeps a
//   record and emails clubptobookings@gmail.com.
// Either one landing counts as signed up, so a Mailchimp hiccup never loses
// the person: they are still in the Sheet.

import { buildPayload, sendEntry, type SendResult } from "@/site/forms/submit";

export type NewsletterSource = "popup" | "home" | "events";

export interface NewsletterSignup {
  firstName: string;
  email: string;
  source: NewsletterSource;
  startedAt: number;
  honeypot: string;
}

const toMailchimp = async (
  body: { email: string; firstName: string; source: string; website: string; elapsedMs: number },
  doFetch: typeof fetch,
): Promise<SendResult> => {
  try {
    const res = await doFetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const b = (await res.json()) as SendResult;
    return { ok: b.ok === true, already: Boolean(b.already), error: b.error };
  } catch {
    return { ok: false, error: "That didn't go through." };
  }
};

export const joinNewsletter = async (s: NewsletterSignup, doFetch: typeof fetch = fetch): Promise<SendResult> => {
  const payload = buildPayload(
    { form: "newsletter", email: s.email, name: s.firstName.trim(), source: s.source },
    {
      startedAt: s.startedAt,
      now: Date.now(),
      page: typeof window === "undefined" ? "" : window.location.pathname,
      honeypot: s.honeypot,
    },
  );
  const [sheet, mailchimp] = await Promise.all([
    sendEntry(payload, doFetch),
    toMailchimp(
      {
        email: payload.email,
        firstName: payload.name ?? "",
        source: s.source,
        website: payload.website,
        elapsedMs: payload.elapsedMs,
      },
      doFetch,
    ),
  ]);
  if (sheet.ok || mailchimp.ok) {
    return { ok: true, already: Boolean(mailchimp.already || sheet.already) };
  }
  return { ok: false, error: sheet.error ?? mailchimp.error ?? "That didn't go through." };
};
