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
//
// A wrong or revoked key answers 502, not 400, so it never reads as the
// person's email being bad. Every refusal logs Mailchimp's status and title.

import { createHash } from "node:crypto";

/** The ClubPTO audience (Mailchimp list ID). */
export const LIST_ID = process.env.MAILCHIMP_LIST_ID || "62654c6967";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = new Set(["popup", "home", "events"]);

const BAD_KEY = "Mailchimp isn't connected right.";
const BAD_EMAIL = "That email address doesn't look right.";
const NOT_TAKEN = "Mailchimp didn't take that one.";

const clean = (v, max = 100) => String(v ?? "").trim().slice(0, max);

// 401 and 403 mean the key is wrong, revoked or for another data centre.
const keyRefused = (status) => status === 401 || status === 403;

// One line in Vercel's function logs saying why Mailchimp said no: the HTTP
// status and Mailchimp's title only. Never the key, the header or the email
// (Mailchimp's detail can quote the email, so it stays out too).
const logRefusal = (step, status, err) =>
  console.error(`Mailchimp refused the ${step}: ${status} ${err?.title ?? "(no title)"}`);

/**
 * Add or update one person. Returns { code, result }: the HTTP code for the
 * handler to answer with, and { ok, already } or { ok: false, error }.
 */
const addMember = async ({ email, firstName, source }, { apiKey, doFetch = fetch }) => {
  const dc = String(apiKey).split("-")[1];
  if (!dc) {
    console.error("Mailchimp key has no data centre (the part after the dash).");
    return { code: 502, result: { ok: false, error: "Mailchimp key has no data centre." } };
  }
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
  } else if (keyRefused(existing.status)) {
    // The key is wrong, so the PUT would be refused too. Stop here.
    logRefusal("lookup", existing.status, await existing.json().catch(() => ({})));
    return { code: 502, result: { ok: false, error: BAD_KEY } };
  }

  const res = await doFetch(base, {
    method: "PUT",
    headers,
    body: JSON.stringify({ email_address: email, status_if_new: "subscribed", merge_fields: { FNAME: firstName } }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    logRefusal("sign-up", res.status, err);
    if (keyRefused(res.status)) return { code: 502, result: { ok: false, error: BAD_KEY } };
    // Only Mailchimp's "looks fake or invalid" refusal is about the address.
    const fake =
      res.status === 400 && err?.title === "Invalid Resource" && /looks fake or invalid/i.test(String(err?.detail ?? ""));
    if (fake) return { code: 400, result: { ok: false, error: BAD_EMAIL } };
    return { code: res.status >= 500 ? 502 : 400, result: { ok: false, error: NOT_TAKEN } };
  }

  const tags = [{ name: "Website", status: "active" }];
  if (SOURCES.has(source)) tags.push({ name: `Website: ${source}`, status: "active" });
  await doFetch(`${base}/tags`, { method: "POST", headers, body: JSON.stringify({ tags }) }).catch(() => {});

  return { code: 200, result: { ok: true, already } };
};

/**
 * Add or update one person. Returns { ok, already } or { ok: false, error }.
 * `already` is true when they were subscribed before this sign-up.
 */
export const subscribe = async (person, options) => (await addMember(person, options)).result;

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
    const { code, result } = await addMember({ email, firstName, source: clean(body.source, 20) }, { apiKey });
    res.status(code).json(result);
  } catch {
    res.status(502).json({ ok: false, error: "Mailchimp didn't answer." });
  }
}
