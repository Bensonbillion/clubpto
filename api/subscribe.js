// POST /api/subscribe: add a newsletter sign-up to the ClubPTO audience in
// Mailchimp (the newsletter tool PTO uses), with their first name and a
// "Website" tag, plus "Website: popup" / "Website: home" / "Website: events"
// for where they signed up.
//
// Server-side through Mailchimp's Marketing API, because the browser-only
// sign-up endpoint (post-json) is gone for this account. Needs the
// MAILCHIMP_API_KEY environment variable in the Vercel project (a key from
// Mailchimp > Profile > Extras > API keys; the part after the dash, us17, is
// the data centre). Until it is set this answers 503 and the site still
// records every sign-up in the "PTO Website: form entries" Sheet.
//
// Someone who once unsubscribed is not re-subscribed (status_if_new only
// applies to new contacts); their name is still updated.

import { createHash } from "node:crypto";

/** The ClubPTO audience (Mailchimp list ID). */
export const LIST_ID = process.env.MAILCHIMP_LIST_ID || "62654c6967";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = new Set(["popup", "home", "events"]);

const clean = (v, max = 100) => String(v ?? "").trim().slice(0, max);

/**
 * Add or update one person. Returns { ok, already } or { ok: false, error }.
 * `already` is true when they were subscribed before this sign-up.
 */
export const subscribe = async ({ email, firstName, source }, { apiKey, doFetch = fetch }) => {
  const dc = String(apiKey).split("-")[1];
  if (!dc) return { ok: false, error: "Mailchimp key has no data centre." };
  const hash = createHash("md5").update(email.toLowerCase()).digest("hex");
  const base = `https://${dc}.api.mailchimp.com/3.0/lists/${LIST_ID}/members/${hash}`;
  const headers = {
    Authorization: `Basic ${Buffer.from(`clubpto:${apiKey}`).toString("base64")}`,
    "Content-Type": "application/json",
  };

  let already = false;
  const existing = await doFetch(base, { headers });
  if (existing.ok) {
    const member = await existing.json();
    already = member.status === "subscribed";
  }

  const res = await doFetch(base, {
    method: "PUT",
    headers,
    body: JSON.stringify({ email_address: email, status_if_new: "subscribed", merge_fields: { FNAME: firstName } }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const fake = /fake|invalid|looks/i.test(`${err.title} ${err.detail}`);
    return { ok: false, error: fake ? "That email address doesn't look right." : "Mailchimp didn't take that one." };
  }

  const tags = [{ name: "Website", status: "active" }];
  if (SOURCES.has(source)) tags.push({ name: `Website: ${source}`, status: "active" });
  await doFetch(`${base}/tags`, { method: "POST", headers, body: JSON.stringify({ tags }) }).catch(() => {});

  return { ok: true, already };
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "POST only" });
    return;
  }
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};

  // Same bot checks as the Sheet: a hidden field people never fill, and a
  // form finished faster than a person can type. Answer ok, add nobody.
  if (clean(body.website) || Number(body.elapsedMs) < 1500) {
    res.status(200).json({ ok: true });
    return;
  }

  const email = clean(body.email, 200).toLowerCase();
  const firstName = clean(body.firstName, 60);
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ ok: false, error: "That email address doesn't look right." });
    return;
  }
  if (!firstName) {
    res.status(400).json({ ok: false, error: "Add your first name." });
    return;
  }

  const apiKey = process.env.MAILCHIMP_API_KEY;
  if (!apiKey) {
    res.status(503).json({ ok: false, error: "Mailchimp isn't connected yet." });
    return;
  }

  try {
    const result = await subscribe({ email, firstName, source: clean(body.source, 20) }, { apiKey });
    res.status(result.ok ? 200 : 400).json(result);
  } catch {
    res.status(502).json({ ok: false, error: "Mailchimp didn't answer." });
  }
}
