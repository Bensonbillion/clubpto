// The PTO League welcome email, pinned.
//
// The template lives next to the Edge Function that sends it
// (supabase/functions/league-welcome/template.ts) and is a pure module, so
// it can be imported here without Deno. These tests hold the copy to the
// approved text, the substitutions to their rules, the HTML version to its
// shell, the wordmark file to its export, and the whole thing to the house
// voice: no dashes, no banned words, no leftover tokens.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOGO_URL,
  DIVISION_LABELS,
  WELCOME_SUBJECT,
  WELCOME_TEMPLATE,
  renderWelcome,
} from "../../../supabase/functions/league-welcome/template";

const deposit = "pay@example.com";

const render = (firstName: string, division: string) =>
  renderWelcome({ firstName, division, depositEmail: deposit });

const wordCount = (s: string) => s.trim().split(/\s+/).length;

const BANNED = ["exclusive", "elite", "luxury", "vip", "premier", "premium"];

const SUBJECT = "PTO League: one last thing and you're in";

// Written as escapes so the test file itself carries no dash characters.
const DASHES = /[\u2013\u2014]/;

const EXPECTED_MENS = `Hey Benson,

Thanks for putting your name down for the Men's Division. Pretty stoked this is actually happening, and that you want in.

Here's the rundown.

Sundays, 3 to 5 PM at The District Padel in Mississauga. Seven weeks, October 4 to November 15.

You sign up solo, no partner needed. Americano style, so you get a new partner every week and play with and against everyone in your division. Individual standings, updated weekly.

16 players per division. After week 7, the top 8 head to the PTO Tournament on November 22. Over $2,000 in prizes.

The season's $200. A $100 deposit locks your spot. We'll sort the rest later, no stress. Just send it by Interac e-transfer to pay@example.com whenever you get a sec. Registration closes September 29, so get it in by then and you're good.

Want a look? We're @club_pto on Instagram: https://www.instagram.com/club_pto

Any questions, just hit reply. We're around.

See you on court,
Club PTO`;

describe("welcome email template", () => {
  it("renders the approved copy byte for byte", () => {
    expect(render("Benson", "mens").text).toBe(EXPECTED_MENS);
  });

  it("uses the exact subject", () => {
    expect(render("Benson", "mens").subject).toBe(SUBJECT);
    expect(WELCOME_SUBJECT).toBe(SUBJECT);
  });

  it("capitalises a lower-case first name and trims it", () => {
    expect(render("samia", "womens").text).toMatch(/^Hey Samia,/);
    expect(render("  samia  ", "womens").text).toMatch(/^Hey Samia,/);
  });

  it("leaves the rest of the name as typed", () => {
    expect(render("jean-Luc", "mens").text).toMatch(/^Hey Jean-Luc,/);
  });

  it("falls back to a greeting when the name is blank", () => {
    expect(render("   ", "mens").text).toMatch(/^Hey there,/);
  });

  it("labels both divisions", () => {
    expect(render("A", "mens").text).toContain(
      "your name down for the Men's Division.",
    );
    expect(render("A", "womens").text).toContain(
      "your name down for the Women's Division.",
    );
    expect(DIVISION_LABELS).toEqual({
      mens: "Men's Division",
      womens: "Women's Division",
    });
  });

  it("drops the division phrase for an unknown division", () => {
    const { text } = render("A", "mixed");
    expect(text).toContain("Thanks for putting your name down. Pretty stoked");
    expect(text).not.toContain("for the ");
    expect(text).not.toContain("mixed");
  });

  it("substitutes the deposit email", () => {
    const { text } = renderWelcome({
      firstName: "A",
      division: "mens",
      depositEmail: "  money@club.example ",
    });
    expect(text).toContain(
      "Just send it by Interac e-transfer to money@club.example whenever you get a sec.",
    );
  });

  it("never scans a substituted value for tokens or patterns", () => {
    expect(render("{{deposit_email}}", "mens").text).toMatch(
      /^Hey \{\{deposit_email\}\},/,
    );
    expect(render("{{division}}", "womens").text).toMatch(/^Hey \{\{division\}\},/);
    expect(render("$& $1 $$", "mens").text).toMatch(/^Hey \$& \$1 \$\$,/);
  });

  it("leaves no tokens behind", () => {
    for (const division of ["mens", "womens", "other"]) {
      const { subject, text } = render("samia", division);
      expect(subject).not.toContain("{{");
      expect(subject).not.toContain("}}");
      expect(text).not.toContain("{{");
      expect(text).not.toContain("}}");
    }
  });

  it("uses no em or en dashes", () => {
    for (const division of ["mens", "womens", "other"]) {
      const { subject, text } = render("samia", division);
      expect(subject).not.toMatch(DASHES);
      expect(text).not.toMatch(DASHES);
    }
    expect(WELCOME_TEMPLATE).not.toMatch(DASHES);
  });

  it("avoids the banned words", () => {
    const { subject, text } = render("samia", "mens");
    const haystack = `${subject}\n${text}`.toLowerCase();
    for (const word of BANNED) {
      expect(haystack).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
  });

  it("stays under 170 words", () => {
    for (const division of ["mens", "womens", "other"]) {
      expect(wordCount(render("Benson", division).text)).toBeLessThan(170);
    }
  });

  it("carries the facts that matter", () => {
    const { text } = render("Benson", "mens");
    for (const fact of ["$200", "$100", "September 29", "@club_pto", deposit]) {
      expect(text).toContain(fact);
    }
  });

  it("signs off as Club PTO, with no personal name", () => {
    const lines = render("Benson", "mens").text.split("\n");
    expect(lines[0]).toBe("Hey Benson,");
    expect(lines[lines.length - 1]).toBe("Club PTO");
    expect(lines[lines.length - 2]).toBe("See you on court,");
    expect(render("Benson", "mens").text).not.toMatch(/\bBenson\b(?!,)/);
  });
});

// The HTML version. The copy is pinned above; these hold the shell to its
// shape and make sure nothing that reaches the markup can break out of it.
const logoTag = (src: string) =>
  `<img src="${src}" alt="Club PTO" width="150" height="27"`;

const PREHEADER =
  "Sundays 3 to 5 PM at The District Padel, October 4 to November 15.";

// What a reader sees of the html: <br> back to newlines, tags dropped, the
// five escapes undone. Used to check the copy survived the wrapping intact.
const visibleText = (html: string) =>
  html
    .replace(/<br>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const renderWithLogo = (logoUrl: string) =>
  renderWelcome({
    firstName: "Benson",
    division: "mens",
    depositEmail: deposit,
    logoUrl,
  });

describe("welcome email html", () => {
  it("leaves the text alternative and subject exactly as before", () => {
    const mail = renderWithLogo("https://cdn.example/wordmark.png");
    expect(mail.text).toBe(EXPECTED_MENS);
    expect(mail.subject).toBe(SUBJECT);
    expect(render("Benson", "mens").text).toBe(EXPECTED_MENS);
  });

  it("carries the wordmark at a fixed size, from the default url", () => {
    expect(DEFAULT_LOGO_URL).toBe(
      "https://clubpto.com/email/logo-wordmark-cream.png",
    );
    const { html } = render("Benson", "mens");
    expect(html).toContain(logoTag(DEFAULT_LOGO_URL));
    expect(html).toContain('style="display:block;border:0;outline:none;');
  });

  it("uses a custom logo url when one is passed, escaped", () => {
    const custom = renderWithLogo(
      "https://cdn.example/wordmark.png?v=2&w=150",
    ).html;
    expect(custom).toContain(
      logoTag("https://cdn.example/wordmark.png?v=2&amp;w=150"),
    );
    expect(custom).not.toContain(DEFAULT_LOGO_URL);
    // Blank falls back rather than shipping an empty src.
    expect(renderWithLogo("  ").html).toContain(logoTag(DEFAULT_LOGO_URL));
  });

  it("falls back to the default logo for anything but an http(s) url", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "//cdn.example/wordmark.png",
      "/email/logo-wordmark-cream.png",
      "ftp://cdn.example/wordmark.png",
    ]) {
      const { html } = renderWithLogo(bad);
      expect(html).toContain(logoTag(DEFAULT_LOGO_URL));
      expect(html).not.toMatch(/javascript:/i);
      expect(html).not.toContain("data:");
    }
    expect(renderWithLogo("HTTP://cdn.example/wordmark.png").html).toContain(
      logoTag("HTTP://cdn.example/wordmark.png"),
    );
  });

  it("ships the wordmark the site will serve: an opaque 300 by 54 png", () => {
    const file = readFileSync(
      fileURLToPath(
        new URL(
          "../../../public/email/logo-wordmark-cream.png",
          import.meta.url,
        ),
      ),
    );
    // PNG signature, then the IHDR chunk: width, height, bit depth, colour
    // type. Twice the <img> attributes, for retina screens.
    expect([...file.subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(file.subarray(12, 16).toString("latin1")).toBe("IHDR");
    expect(file.readUInt32BE(16)).toBe(2 * 150);
    expect(file.readUInt32BE(20)).toBe(2 * 27);
    expect(file[24]).toBe(8);
    // Colour type 2 is truecolour with no alpha channel, and no tRNS chunk
    // means no transparency at all: the dark plate is baked in, so a client
    // that inverts the whole mail for dark mode still shows cream on dark.
    expect(file[25]).toBe(2);
    expect(file.includes("tRNS")).toBe(false);
  });

  it("renders every paragraph of the text, in order, one <p> each", () => {
    for (const division of ["mens", "womens", "other"]) {
      const { text, html } = render("Benson", division);
      const paragraphs = text.split("\n\n");
      const seen = visibleText(html);
      let at = 0;
      for (const paragraph of paragraphs) {
        const next = seen.indexOf(paragraph, at);
        expect(next).toBeGreaterThanOrEqual(at);
        at = next + paragraph.length;
      }
      expect(html.match(/<p style="margin:0 0 16px 0;">/g)).toHaveLength(
        paragraphs.length - 1,
      );
      expect(html.match(/<p style="margin:0;">/g)).toHaveLength(1);
    }
    expect(render("Benson", "mens").html).toContain(
      '<p style="margin:0;">See you on court,<br>Club PTO</p>',
    );
  });

  it("links the Instagram url in the body and nothing else", () => {
    const { html } = render("Benson", "mens");
    expect(html).toContain(
      '<a href="https://www.instagram.com/club_pto" style="color:#1A1A1A;text-decoration:underline;">https://www.instagram.com/club_pto</a>',
    );
    expect(html).not.toContain("mailto:");
    expect(html).toContain(`e-transfer to ${deposit} whenever`);
    // Body anchor plus the two in the footer.
    expect(html.match(/<a /g)).toHaveLength(3);
  });

  it("never links a url that arrived in the name", () => {
    const { html } = render("x https://www.instagram.com/club_pto", "mens");
    expect(html).toContain("Hey X https://www.instagram.com/club_pto,");
    expect(html).not.toContain("Hey X <a");
    expect(html.match(/<a /g)).toHaveLength(3);
  });

  it("escapes the first name", () => {
    const bold = render("<b>x</b>", "mens").html;
    expect(bold).toContain("Hey &lt;b&gt;x&lt;/b&gt;,");
    expect(bold).not.toContain("<b>");
    const broken = render('"><script>alert(1)</script>', "mens").html;
    expect(broken).toContain(
      "Hey &quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;,",
    );
    expect(broken).not.toMatch(/<script/i);
    expect(render("Tom & Jerry", "mens").html).toContain(
      "Hey Tom &amp; Jerry,",
    );
  });

  it("escapes the copy's own apostrophes", () => {
    const { html } = render("Benson", "mens");
    expect(html).toContain("Here&#39;s the rundown.");
    expect(html).toContain(
      "<title>PTO League: one last thing and you&#39;re in</title>",
    );
  });

  it("leaves no tokens, dashes, scripts or styles behind", () => {
    for (const division of ["mens", "womens", "other"]) {
      const { html } = render("samia", division);
      expect(html).not.toContain("{{");
      expect(html).not.toContain("}}");
      expect(html).not.toMatch(DASHES);
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/<style/i);
      expect(html).not.toMatch(/<link/i);
      expect(html).not.toMatch(/javascript:/i);
    }
  });

  it("avoids the banned words in the html too", () => {
    const haystack = visibleText(render("samia", "mens").html).toLowerCase();
    for (const word of BANNED) {
      expect(haystack).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
  });

  it("stays under 12 KB", () => {
    for (const division of ["mens", "womens", "other"]) {
      const bytes = new TextEncoder().encode(render("Benson", division).html);
      expect(bytes.length).toBeLessThan(12000);
    }
  });

  it("has the footer with both links", () => {
    const { html } = render("Benson", "mens");
    expect(html).toContain(
      '<a href="https://www.instagram.com/club_pto" style="color:#C9A84C;text-decoration:none;">@club_pto</a>',
    );
    expect(html).toContain(
      '<a href="https://clubpto.com" style="color:#C9A84C;text-decoration:none;">clubpto.com</a>',
    );
    expect(html).toContain('<span style="color:#F5F0EB;">Club PTO</span>');
    expect(html).toContain("A padel community in Toronto");
  });

  it("carries a preheader that is not the subject again, hidden every way", () => {
    const { text, html } = render("Benson", "mens");
    expect(html).toContain(
      `<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F5F0EB;opacity:0;">${PREHEADER}&nbsp;&zwnj;`,
    );
    expect(html.match(/&nbsp;&zwnj;/g)).toHaveLength(80);
    expect(html).not.toContain("One last thing and you&#39;re in.");
    // The preheader is a constant of its own; every fact in it must still
    // be in the copy, so a change to one shows up here.
    for (const fact of [
      "Sundays",
      "3 to 5 PM",
      "The District Padel",
      "October 4 to November 15",
    ]) {
      expect(text).toContain(fact);
    }
  });

  it("is a light, table-based document with an Outlook ghost table", () => {
    const { html } = render("Benson", "mens");
    expect(html.startsWith('<!DOCTYPE html>\n<html lang="en">')).toBe(true);
    expect(html).toContain('<meta name="color-scheme" content="light">');
    expect(html).toContain(
      '<meta name="supported-color-schemes" content="light">',
    );
    expect(html).toContain('<meta name="viewport"');
    // Fluid and capped for everyone else, fixed at 560 for Outlook's Word
    // engine, which ignores max-width.
    expect(html).toContain(
      '<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->\n<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">',
    );
    expect(html).toContain(
      "</table>\n<!--[if mso]></td></tr></table><![endif]-->\n</td>",
    );
    expect(html).toContain("background-color:#1A1A1A;padding:20px 28px;");
    expect(html).toContain(
      "background-color:#FFFFFF;padding:28px;color:#1A1A1A;",
    );
    expect(html).toContain(
      "background-color:#1A1A1A;padding:18px 28px;color:#A8A29E;",
    );
  });
});
