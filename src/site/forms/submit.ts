// Sends a site form to the "PTO Website: form entries" Google Sheet.
//
// The Sheet's Apps Script web app (scripts/site-forms-apps-script/Code.gs,
// owned by clubptobookings@gmail.com) adds one row per entry and emails
// clubptobookings@gmail.com straight away. The URL is not a secret: the
// script only appends rows and sends that one alert, and it drops anything
// with the hidden `website` field filled in or sent faster than a person
// could type it.

export const FORMS_URL: string =
  (import.meta.env.VITE_FORMS_URL as string | undefined) ||
  "https://script.google.com/macros/s/AKfycbyLszJXUpr6TmBYY3Y0hcFRiOWqdYf_d4HjcAJh87UMQviDmvVTg9iD7PcwEsFUeuk/exec";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FormId = "book-pto" | "partners" | "season-2" | "newsletter";

export interface Entry {
  form: FormId;
  email: string;
  name?: string;
  company?: string;
  /** Where a newsletter sign-up came from: "popup", "home", "events". */
  source?: string;
  /** Everything else on the form, as the visitor saw it. */
  fields?: { label: string; value: string }[];
}

export interface Payload extends Entry {
  page: string;
  elapsedMs: number;
  /** The hidden field. People never see it, so it is empty for people. */
  website: string;
}

export interface SendResult {
  ok: boolean;
  /** A newsletter sign-up for an email that is already on the list. */
  already?: boolean;
  /** Why it failed, in words for the visitor. */
  error?: string;
}

export const buildPayload = (
  entry: Entry,
  opts: { startedAt: number; now: number; page: string; honeypot: string },
): Payload => ({
  ...entry,
  email: entry.email.trim(),
  fields: (entry.fields ?? []).filter((f) => f.value.trim() !== ""),
  page: opts.page,
  elapsedMs: Math.max(0, opts.now - opts.startedAt),
  website: opts.honeypot,
});

/**
 * Posted as text/plain on purpose: it is a CORS-safelisted type, so the
 * browser sends it without a preflight, which an Apps Script web app cannot
 * answer. The body is still JSON.
 */
export const sendEntry = async (payload: Payload, doFetch: typeof fetch = fetch): Promise<SendResult> => {
  try {
    const res = await doFetch(FORMS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as { ok?: boolean; error?: string; already?: boolean };
    if (body && body.ok === true) return { ok: true, already: Boolean(body.already) };
    return { ok: false, error: (body && body.error) || "That didn't go through." };
  } catch {
    return { ok: false, error: "That didn't go through. Check your connection and try again." };
  }
};
