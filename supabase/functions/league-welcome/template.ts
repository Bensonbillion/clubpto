// The PTO League welcome email, as one pure module.
//
// No imports, no Deno globals, no I/O: this file is shared by the Edge
// Function next to it (which sends the result) and by the vitest suite in
// src/league/__tests__/welcomeTemplate.test.ts (which pins the copy). The
// body is the approved text with three tokens; renderWelcome substitutes
// them and changes nothing else, so a diff of WELCOME_TEMPLATE is a diff of
// what people receive.
//
// Tokens: {{first_name}}, {{division}}, {{deposit_email}}. A division the
// label map does not know drops the "for the ..." tail of the first line,
// so it reads "Thanks for putting your name down." rather than rendering a
// raw value.
//
// The HTML version is built from the rendered text, never from the template
// on its own, so the copy exists once. It wraps the same paragraphs in a
// light Club PTO shell (dark header band with the wordmark, the message on
// white, a small dark footer) so the mail reads as officially from the club
// while staying a personal note. The plain text goes out beside it as the
// multipart alternative. Every string that reaches the HTML is escaped
// first; the first name comes from a public form.

export const WELCOME_SUBJECT = "PTO League: one last thing and you're in";

// Where the wordmark lives once the site deploys: Vite serves public/ at
// the site root, so public/email/logo-wordmark-cream.png is this URL. Until
// that deploy lands, clubpto.com answers the path with index.html (a 200,
// so nothing logs an error) and the header shows the alt text instead. The
// Edge Function can point somewhere else with LEAGUE_EMAIL_LOGO_URL.
export const DEFAULT_LOGO_URL =
  "https://clubpto.com/email/logo-wordmark-cream.png";

// The email copy of the wordmark is not the site's transparent PNG. It is
// an opaque export, cream on #1A1A1A, 300 by 54 (twice the rendered size,
// for retina screens). Clients that invert the whole mail for dark mode
// (Gmail on iOS, Outlook for Windows) turn the band light but leave images
// alone, so a transparent cream wordmark would vanish there; the opaque
// one stays a small dark plate with cream text. On the band itself the two
// look the same. Both dimensions are written as attributes so every client
// renders it at one size.
const LOGO_WIDTH = 150;
const LOGO_HEIGHT = 27;

// Only an absolute http(s) URL is accepted for the wordmark. Anything else
// (blank, a bare path, another scheme) falls back to the default, so the
// src attribute never holds something a mail client would refuse or run.
const LOGO_URL_OK = /^https?:\/\//i;

export const DIVISION_LABELS: Record<string, string> = {
  mens: "Men's Division",
  womens: "Women's Division",
};

const DIVISION_PHRASE = "your name down for the {{division}}.";
const DIVISION_FALLBACK = "your name down.";

export const WELCOME_TEMPLATE = `Hey {{first_name}},

Thanks for putting your name down for the {{division}}. Pretty stoked this is actually happening, and that you want in.

Here's the rundown.

Sundays, 3 to 5 PM at The District Padel in Mississauga. Seven weeks, October 4 to November 15.

You sign up solo, no partner needed. Americano style, so you get a new partner every week and play with and against everyone in your division. Individual standings, updated weekly.

16 players per division. After week 7, the top 8 head to the PTO Tournament on November 22. Over $2,000 in prizes.

The season's $200. A $100 deposit locks your spot. We'll sort the rest later, no stress. Just send it by Interac e-transfer to {{deposit_email}} whenever you get a sec. Registration closes September 29, so get it in by then and you're good.

Want a look? We're @club_pto on Instagram: https://www.instagram.com/club_pto

Any questions, just hit reply. We're around.

See you on court,
Club PTO`;

export interface WelcomeInput {
  firstName: string;
  division: string;
  depositEmail: string;
  /** Absolute http(s) URL of the wordmark in the HTML header; DEFAULT_LOGO_URL if absent or not one. */
  logoUrl?: string;
}

export interface WelcomeMail {
  subject: string;
  text: string;
  html: string;
}

// One pass with a replacer function rather than String.replace with a
// string: a replacement that happens to contain "$&" or "$1" would
// otherwise be read as a pattern, and the first name comes from a public
// form. One pass also means a substituted value is never scanned again,
// so a first name of "{{deposit_email}}" renders exactly as typed.
const TOKEN = /\{\{(first_name|division|deposit_email)\}\}/g;

/** "samia" becomes "Samia"; the rest of the name is left as typed. */
export const presentableFirstName = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return "there";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

// The five characters that can change meaning in HTML text or inside a
// quoted attribute. Applied to everything before it goes into the markup,
// the constants included, so a name like <b>x</b> renders as typed.
export const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// The one link the copy carries, and the site. The e-transfer address
// stays plain text.
const INSTAGRAM_URL = "https://www.instagram.com/club_pto";
const SITE_URL = "https://clubpto.com";

// The paragraph of the template that carries the link. It holds no token,
// so it reaches bodyHtml exactly as written above, and it is the only
// paragraph that is ever given an anchor: the same URL typed into the
// first-name field renders as text. Nothing that arrived from the form
// becomes a link.
const LINK_PARAGRAPH =
  WELCOME_TEMPLATE.split("\n\n").find((p) => p.includes(INSTAGRAM_URL)) ?? "";

// Hidden at the top of the body so inbox snippets show it after the
// subject. Not the subject again (the inbox would print it twice) and not
// the greeting: the one line of logistics. The test suite checks these
// facts against the copy so the two cannot drift apart.
const PREHEADER =
  "Sundays 3 to 5 PM at The District Padel, October 4 to November 15.";

// Padding after the preheader, so Gmail does not pull body text into the
// snippet. Eighty pairs covers a wide desktop inbox.
const PREHEADER_PAD = "&nbsp;&zwnj;".repeat(80);

// System fonts only: no web fonts in email. Single quotes because the
// whole stack sits inside a double-quoted style attribute.
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

// One <p> per blank-line paragraph of the text, single newlines as <br>,
// the last paragraph without a bottom margin. The escape runs before the
// link is added, so the anchor is the only markup inside the body. The
// paragraphs are whatever the text holds: a first name with a line break
// in it (the form's input cannot produce one, a direct POST can) becomes a
// <br> or an extra <p> in the greeting, which is layout only and the price
// of deriving the HTML from the text.
const bodyHtml = (text: string): string => {
  const paragraphs = text.split("\n\n");
  const link = escapeHtml(INSTAGRAM_URL);
  const anchor = `<a href="${link}" style="color:#1A1A1A;text-decoration:underline;">${link}</a>`;
  return paragraphs
    .map((paragraph, i) => {
      const margin =
        i === paragraphs.length - 1 ? "margin:0;" : "margin:0 0 16px 0;";
      const escaped = escapeHtml(paragraph);
      const linked =
        paragraph === LINK_PARAGRAPH
          ? escaped.split(link).join(anchor)
          : escaped;
      return `<p style="${margin}">${linked.split("\n").join("<br>")}</p>`;
    })
    .join("\n");
};

// The shell: table layout with every style inline, a light colour scheme
// declared so dark-mode clients that honour it leave the cream and the
// dark bands alone, and nothing loaded from anywhere but the wordmark. The
// card is the hybrid pattern: a fluid table capped at 560px for every
// modern client, inside a fixed 560px ghost table that only Outlook for
// Windows sees, since its Word engine ignores max-width. The preheader div
// is hidden every way the clients need (display, size, mso-hide) and
// padded so Gmail does not run body text on after it. The alt text is
// styled cream so a client that blocks images still shows the name on the
// dark band.
const shellHtml = (subject: string, text: string, logoUrl: string): string =>
  `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F0EB;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F5F0EB;opacity:0;">${escapeHtml(PREHEADER)}${PREHEADER_PAD}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#F5F0EB;">
<tr>
<td align="center" style="padding:32px 16px;">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
<tr>
<td style="background-color:#1A1A1A;padding:20px 28px;">
<img src="${escapeHtml(logoUrl)}" alt="Club PTO" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" style="display:block;border:0;outline:none;color:#F5F0EB;font-family:${FONT};font-size:18px;font-weight:600;">
</td>
</tr>
<tr>
<td style="background-color:#FFFFFF;padding:28px;color:#1A1A1A;font-family:${FONT};font-size:16px;line-height:1.55;">
${bodyHtml(text)}
</td>
</tr>
<tr>
<td style="background-color:#1A1A1A;padding:18px 28px;color:#A8A29E;font-family:${FONT};font-size:13px;line-height:1.5;">
<span style="color:#F5F0EB;">Club PTO</span><br>
A padel community in Toronto<br>
<a href="${escapeHtml(INSTAGRAM_URL)}" style="color:#C9A84C;text-decoration:none;">@club_pto</a> &middot; <a href="${escapeHtml(SITE_URL)}" style="color:#C9A84C;text-decoration:none;">clubpto.com</a>
</td>
</tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td>
</tr>
</table>
</body>
</html>`;

export const renderWelcome = ({
  firstName,
  division,
  depositEmail,
  logoUrl,
}: WelcomeInput): WelcomeMail => {
  const label = DIVISION_LABELS[division];
  // The phrase and its replacement are both constants, so plain
  // split/join is safe here and leaves the template untouched otherwise.
  const base = label
    ? WELCOME_TEMPLATE
    : WELCOME_TEMPLATE.split(DIVISION_PHRASE).join(DIVISION_FALLBACK);
  const values: Record<string, string> = {
    first_name: presentableFirstName(firstName),
    division: label ?? "",
    deposit_email: depositEmail.trim(),
  };
  const text = base.replace(TOKEN, (_match, key: string) => values[key] ?? "");
  const wanted = (logoUrl ?? "").trim();
  const logo = LOGO_URL_OK.test(wanted) ? wanted : DEFAULT_LOGO_URL;
  const html = shellHtml(WELCOME_SUBJECT, text, logo);
  return { subject: WELCOME_SUBJECT, text, html };
};
