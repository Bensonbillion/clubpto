// Every site form goes somewhere: what it sends, what it does when the
// Sheet answers, and when the newsletter pop-up may show.
import { describe, expect, it, vi } from "vitest";
import { buildPayload, FORMS_URL, sendEntry } from "@/site/forms/submit";
import { mayOffer, SNOOZE_DAYS } from "@/site/forms/popup";

const DAY = 24 * 60 * 60 * 1000;

const answer = (body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

describe("site form entries", () => {
  it("sends the entry with the page, the time taken and the hidden field", () => {
    const p = buildPayload(
      {
        form: "book-pto",
        email: "  sam@acme.co ",
        name: "Sam Lee",
        company: "Acme",
        fields: [
          { label: "Type of night", value: "Company night" },
          { label: "Preferred date", value: "" },
        ],
      },
      { startedAt: 1_000, now: 46_000, page: "/book-pto#inquire", honeypot: "" },
    );
    expect(p).toMatchObject({
      form: "book-pto",
      email: "sam@acme.co",
      name: "Sam Lee",
      company: "Acme",
      page: "/book-pto#inquire",
      elapsedMs: 45_000,
      website: "",
    });
    // Blank answers are left out rather than sent as empty lines.
    expect(p.fields).toEqual([{ label: "Type of night", value: "Company night" }]);
  });

  it("posts as text/plain JSON to the Sheet's web app", async () => {
    const doFetch = answer({ ok: true });
    const p = buildPayload({ form: "newsletter", email: "a@b.co", source: "popup" }, { startedAt: 0, now: 5000, page: "/", honeypot: "" });
    await expect(sendEntry(p, doFetch)).resolves.toEqual({ ok: true, already: false });
    const [url, init] = (doFetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(FORMS_URL);
    expect(FORMS_URL).toMatch(/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toMatch(/^text\/plain/);
    expect(JSON.parse(init.body)).toMatchObject({ form: "newsletter", email: "a@b.co", source: "popup" });
  });

  it("says when an email is already on the list", async () => {
    const p = buildPayload({ form: "newsletter", email: "a@b.co" }, { startedAt: 0, now: 5000, page: "/", honeypot: "" });
    await expect(sendEntry(p, answer({ ok: true, already: true }))).resolves.toEqual({ ok: true, already: true });
  });

  it("passes the Sheet's own reason through when it says no", async () => {
    const p = buildPayload({ form: "partners", email: "a@b.co" }, { startedAt: 0, now: 5000, page: "/", honeypot: "" });
    await expect(sendEntry(p, answer({ ok: false, error: "Unknown form." }))).resolves.toEqual({
      ok: false,
      error: "Unknown form.",
    });
  });

  it("fails softly when the network is down, so the form can offer email instead", async () => {
    const p = buildPayload({ form: "season-2", email: "a@b.co" }, { startedAt: 0, now: 5000, page: "/", honeypot: "" });
    const down = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const r = await sendEntry(p, down);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/didn't go through/);
  });
});

describe("newsletter pop-up", () => {
  const now = Date.UTC(2026, 9, 15, 16);
  const fresh = { subscribed: false, dismissedAt: null, shownThisVisit: false };

  it("offers itself to someone who hasn't signed up or said no", () => {
    expect(mayOffer(fresh, now)).toBe(true);
  });

  it("never shows to someone already on the list", () => {
    expect(mayOffer({ ...fresh, subscribed: true }, now)).toBe(false);
  });

  it("shows once per visit at most", () => {
    expect(mayOffer({ ...fresh, shownThisVisit: true }, now)).toBe(false);
  });

  it("stays away for three weeks after Not now, then may ask again", () => {
    expect(SNOOZE_DAYS).toBe(21);
    expect(mayOffer({ ...fresh, dismissedAt: now - 20 * DAY }, now)).toBe(false);
    expect(mayOffer({ ...fresh, dismissedAt: now - 22 * DAY }, now)).toBe(true);
  });
});
