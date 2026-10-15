// Newsletter sign-ups reach Mailchimp and the Sheet, first name included;
// every page shares with its own preview; visits are tracked on the public
// site only.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { joinNewsletter } from "@/site/forms/newsletter";
import { PAGE_META, metaFileFor, SITE, type PagePath } from "@/site/pageMeta";
import { keepVisit } from "@/site/analytics";
// Plain JS outside src: the Vercel function and the build step.
import handler, { subscribe, LIST_ID } from "../../../api/subscribe.js";
import { pageHtml } from "../../../scripts/page-html.mjs";

const ROOT = join(__dirname, "..", "..", "..");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllEnvs());

describe("newsletter sign-up", () => {
  const signup = { firstName: "Amara", email: "amara@mail.com", source: "popup" as const, startedAt: Date.now() - 9000, honeypot: "" };

  it("sends the first name to Mailchimp and to the Sheet", async () => {
    const seen: { url: string; body: Record<string, unknown> }[] = [];
    const doFetch = vi.fn(async (url: string, init?: RequestInit) => {
      seen.push({ url, body: JSON.parse(String(init?.body)) });
      return json({ ok: true });
    }) as unknown as typeof fetch;
    await expect(joinNewsletter(signup, doFetch)).resolves.toEqual({ ok: true, already: false });
    const mc = seen.find((s) => s.url === "/api/subscribe");
    const sheet = seen.find((s) => s.url.startsWith("https://script.google.com/"));
    expect(mc?.body).toMatchObject({ email: "amara@mail.com", firstName: "Amara", source: "popup" });
    expect(sheet?.body).toMatchObject({ form: "newsletter", email: "amara@mail.com", name: "Amara", source: "popup" });
  });

  it("counts as signed up if either one takes it, and says so when they were already on", async () => {
    const mcDown = vi.fn(async (url: string) =>
      url === "/api/subscribe" ? json({ ok: false, error: "Mailchimp isn't connected yet." }, 503) : json({ ok: true }),
    ) as unknown as typeof fetch;
    await expect(joinNewsletter(signup, mcDown)).resolves.toMatchObject({ ok: true });
    const already = vi.fn(async (url: string) =>
      url === "/api/subscribe" ? json({ ok: true, already: true }) : json({ ok: true }),
    ) as unknown as typeof fetch;
    await expect(joinNewsletter(signup, already)).resolves.toEqual({ ok: true, already: true });
  });

  it("fails only when both are down", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    await expect(joinNewsletter(signup, down)).resolves.toMatchObject({ ok: false });
  });
});

describe("api/subscribe (Mailchimp)", () => {
  const key = "abc123-us17";

  it("adds a new person to the ClubPTO audience with first name and Website tags", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const doFetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (!init?.method) return json({ status: 404 }, 404);
      return json({});
    }) as unknown as typeof fetch;
    await expect(subscribe({ email: "amara@mail.com", firstName: "Amara", source: "home" }, { apiKey: key, doFetch })).resolves.toEqual({
      ok: true,
      already: false,
    });
    expect(LIST_ID).toBe("62654c6967");
    const put = calls.find((c) => c.init?.method === "PUT");
    expect(put?.url).toMatch(/^https:\/\/us17\.api\.mailchimp\.com\/3\.0\/lists\/62654c6967\/members\/[a-f0-9]{32}$/);
    expect(JSON.parse(String(put?.init?.body))).toEqual({
      email_address: "amara@mail.com",
      status_if_new: "subscribed",
      merge_fields: { FNAME: "Amara" },
    });
    const tags = calls.find((c) => c.url.endsWith("/tags"));
    expect(JSON.parse(String(tags?.init?.body)).tags.map((t: { name: string }) => t.name)).toEqual(["Website", "Website: home"]);
  });

  it("knows when someone was already subscribed", async () => {
    const doFetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method ? json({}) : json({ status: "subscribed" }),
    ) as unknown as typeof fetch;
    await expect(subscribe({ email: "a@b.co", firstName: "A", source: "popup" }, { apiKey: key, doFetch })).resolves.toEqual({
      ok: true,
      already: true,
    });
  });

  it("turns Mailchimp's fake-email refusal into plain words", async () => {
    const doFetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? json({ title: "Invalid Resource", detail: "looks fake or invalid" }, 400) : json({}, 404),
    ) as unknown as typeof fetch;
    await expect(subscribe({ email: "a@b.co", firstName: "A", source: "popup" }, { apiKey: key, doFetch })).resolves.toEqual({
      ok: false,
      error: "That email address doesn't look right.",
    });
  });

  // Mailchimp's answer to a wrong, revoked or mistyped key. Its title has the
  // word "Invalid" in it, which must not read as the person's email being bad.
  const badKey = () => json({ title: "API Key Invalid", status: 401, detail: "Your API key may be invalid, or you've attempted to access the wrong datacenter." }, 401);

  it("does not blame the person's email when the Mailchimp key is wrong", async () => {
    const doFetch = vi.fn(async () => badKey()) as unknown as typeof fetch;
    const result = await subscribe({ email: "amara@mail.com", firstName: "Amara", source: "popup" }, { apiKey: key, doFetch });
    expect(result.ok).toBe(false);
    expect(result.error).not.toBe("That email address doesn't look right.");
    expect(result.error).toBe("Mailchimp isn't connected right.");
  });

  it("answers a wrong key as a server problem, not a bad sign-up", async () => {
    vi.stubEnv("MAILCHIMP_API_KEY", key);
    vi.stubGlobal("fetch", vi.fn(async () => badKey()));
    try {
      const res = await run({ email: "amara@mail.com", firstName: "Amara", source: "popup", elapsedMs: 5000 });
      expect(res.code).toBe(502);
      expect(res.body).toMatchObject({ ok: false, error: "Mailchimp isn't connected right." });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  const run = async (body: unknown, method = "POST") => {
    const res = { code: 0, body: undefined as unknown, setHeader: vi.fn(), status(c: number) { this.code = c; return this; }, json(b: unknown) { this.body = b; } };
    await handler({ method, body }, res);
    return res;
  };

  it("asks for a first name, and drops bot-speed posts without calling Mailchimp", async () => {
    vi.stubEnv("MAILCHIMP_API_KEY", key);
    expect((await run({ email: "a@b.co", firstName: "", elapsedMs: 5000 })).code).toBe(400);
    const bot = await run({ email: "a@b.co", firstName: "A", elapsedMs: 200 });
    expect(bot).toMatchObject({ code: 200, body: { ok: true } });
  });

  it("says plainly when the Mailchimp key isn't set yet", async () => {
    vi.stubEnv("MAILCHIMP_API_KEY", "");
    expect(await run({ email: "a@b.co", firstName: "A", elapsedMs: 5000 })).toMatchObject({ code: 503 });
  });
});

describe("shared-link previews", () => {
  const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as {
    rewrites: { source: string; destination: string }[];
  };

  it("gives every public page its own share image, and the file exists", () => {
    for (const [path, meta] of Object.entries(PAGE_META)) {
      expect(existsSync(join(ROOT, "public", meta.image)), `${path} ${meta.image}`).toBe(true);
    }
    expect(new Set(Object.values(PAGE_META).map((m) => m.image)).size).toBe(Object.keys(PAGE_META).length);
  });

  it("serves each page's own HTML before the app fallback", () => {
    const fallback = vercel.rewrites.findIndex((r) => r.destination === "/index.html");
    for (const path of Object.keys(PAGE_META) as PagePath[]) {
      if (path === "/") continue;
      const i = vercel.rewrites.findIndex((r) => r.source === path);
      expect(i, path).toBeGreaterThanOrEqual(0);
      expect(i, path).toBeLessThan(fallback);
      expect(vercel.rewrites[i].destination).toBe(`/${metaFileFor(path)}`);
    }
  });

  it("writes the page's title, description, URL and image into the HTML", () => {
    const template = readFileSync(join(ROOT, "index.html"), "utf8");
    const html = pageHtml(template, SITE, "/book-pto", PAGE_META["/book-pto"]);
    expect(html).toContain("<title>Book PTO · Company nights and private parties · Club PTO</title>");
    expect(html).toContain('property="og:url" content="https://clubpto.com/book-pto"');
    expect(html).toContain('property="og:image" content="https://clubpto.com/og/book-pto.jpg"');
    expect(html).toContain('rel="canonical" href="https://clubpto.com/book-pto"');
    expect(html).toContain("Skip the escape room.");
  });
});

describe("visit tracking", () => {
  const visit = (path: string) => ({ type: "pageview" as const, url: `https://clubpto.com${path}` });

  it("counts the public pages", () => {
    for (const p of ["/", "/play", "/league", "/skills-lab", "/book-pto?x=1"]) expect(keepVisit(visit(p))).not.toBeNull();
  });

  it("leaves out the operators' tools", () => {
    for (const p of ["/manage", "/manage2", "/admin/reset", "/league/admin"]) expect(keepVisit(visit(p))).toBeNull();
  });
});
