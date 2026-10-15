/** @OnlyCurrentDoc */
/**
 * Club PTO website forms → this Google Sheet, plus an email alert.
 *
 * Bound to the Sheet "PTO Website: form entries". Deployed as a web app
 * (Execute as: me, Who has access: Anyone). The site POSTs JSON as
 * text/plain (a CORS-safelisted type, so no preflight, which a web app
 * cannot answer) from:
 *   - Book PTO inquiry      form: "book-pto"
 *   - Partners media kit    form: "partners"
 *   - Season 2 list         form: "season-2"
 *   - Skill Lab sign-up     form: "skill-lab"
 *   - Newsletter sign-up    form: "newsletter" (pop-up and inline boxes)
 *
 * Every entry is one row. Inquiries go on the Inquiries tab, sign-ups on
 * the Newsletter tab (a repeat email is not added twice). Each entry also
 * emails ALERT_TO, with Reply-To set to the person who filled it in.
 *
 * Source of truth for this file: scripts/site-forms-apps-script/Code.gs in
 * the clubpto repo. Paste changes into the Apps Script editor and deploy a
 * new version of the SAME deployment (Deploy > Manage deployments > edit),
 * so the URL the site uses never changes.
 */

const ALERT_TO = 'clubptobookings@gmail.com';
/** Set to false if newsletter alerts get noisy; sign-ups still land in the Sheet. */
const ALERT_ON_NEWSLETTER = true;

const FORMS = {
  'book-pto': { tab: 'inquiry', label: 'Book PTO inquiry' },
  partners: { tab: 'inquiry', label: 'Partner / media kit request' },
  'season-2': { tab: 'inquiry', label: 'Season 2 list' },
  'skill-lab': { tab: 'inquiry', label: 'Skill Lab sign-up' },
  newsletter: { tab: 'newsletter', label: 'Newsletter sign-up' },
};

const TABS = {
  inquiry: {
    name: 'Inquiries',
    headers: ['Received', 'Form', 'Name', 'Email', 'Company or brand', 'Details', 'Page'],
  },
  newsletter: {
    name: 'Newsletter',
    headers: ['Received', 'First name', 'Email', 'Signed up from', 'Page'],
  },
};

const MAX_FIELD = 2000;
const MAX_FIELDS = 20;
const PER_EMAIL_PER_HOUR = 5;
const ALL_PER_HOUR = 120;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function doGet() {
  return json({ ok: true, service: 'pto-site-forms' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json({ ok: false, error: 'That did not come through. Try again.' });
  }

  // Bots: a hidden field people never see, and a form filled in faster
  // than a person can. Answer ok so they learn nothing, store nothing.
  if (clean(body.website) || Number(body.elapsedMs) < 1500) return json({ ok: true });

  const form = FORMS[String(body.form || '')];
  if (!form) return json({ ok: false, error: 'Unknown form.' });

  const email = clean(body.email).toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: "That email address doesn't look right." });

  if (overLimit(email)) {
    return json({ ok: false, error: 'Lots of messages from you just now. Try again in an hour, or email ' + ALERT_TO + '.' });
  }

  const name = clean(body.name);
  const company = clean(body.company);
  const page = clean(body.page);
  const source = clean(body.source);
  const fields = (Array.isArray(body.fields) ? body.fields : [])
    .slice(0, MAX_FIELDS)
    .map((f) => ({ label: clean(f && f.label), value: clean(f && f.value) }))
    .filter((f) => f.label && f.value);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = tab(form.tab);
    if (form.tab === 'newsletter') {
      const already = sh
        .getRange(2, 3, Math.max(sh.getLastRow() - 1, 1), 1)
        .createTextFinder(email)
        .matchEntireCell(true)
        .findNext();
      if (already) return json({ ok: true, already: true });
      sh.appendRow([new Date(), safe(name), safe(email), safe(source), safe(page)]);
    } else {
      const details = fields.map((f) => f.label + ': ' + f.value).join('\n');
      sh.appendRow([new Date(), form.label, safe(name), safe(email), safe(company), safe(details), safe(page)]);
    }
  } finally {
    lock.releaseLock();
  }

  if (form.tab !== 'newsletter' || ALERT_ON_NEWSLETTER) {
    sendAlert(form, { name, email, company, page, source, fields });
  }
  return json({ ok: true });
}

function sendAlert(form, entry) {
  const who = entry.name || entry.email;
  const subject =
    form.tab === 'newsletter'
      ? 'New newsletter sign-up: ' + entry.email
      : 'New ' + form.label + ': ' + who + (entry.company ? ' (' + entry.company + ')' : '');
  const lines = [form.label, ''];
  if (entry.name) lines.push('Name: ' + entry.name);
  lines.push('Email: ' + entry.email);
  if (entry.company) lines.push('Company or brand: ' + entry.company);
  entry.fields.forEach((f) => lines.push(f.label + ': ' + f.value));
  lines.push('');
  if (entry.source) lines.push('Signed up from: ' + entry.source);
  if (entry.page) lines.push('Page: ' + entry.page);
  lines.push('All entries: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
  if (form.tab !== 'newsletter') lines.push('', 'Reply to this email to answer them directly.');
  MailApp.sendEmail({ to: ALERT_TO, replyTo: entry.email, subject: subject, body: lines.join('\n'), name: 'Club PTO website' });
}

/** The tab for a kind of entry, created with its header row the first time. */
function tab(kind) {
  const spec = TABS[kind];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(spec.name);
  if (!sh) {
    sh = ss.insertSheet(spec.name);
    sh.appendRow(spec.headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, spec.headers.length).setFontWeight('bold');
  }
  return sh;
}

/** Runs once from the editor: makes both tabs and asks Google for permission. */
function setup() {
  tab('inquiry');
  tab('newsletter');
  const first = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1');
  if (first && first.getLastRow() === 0 && SpreadsheetApp.getActiveSpreadsheet().getSheets().length > 2) {
    SpreadsheetApp.getActiveSpreadsheet().deleteSheet(first);
  }
  MailApp.getRemainingDailyQuota();
}

function overLimit(email) {
  const cache = CacheService.getScriptCache();
  const bump = (key, max) => {
    const n = Number(cache.get(key) || 0) + 1;
    cache.put(key, String(n), 3600);
    return n > max;
  };
  return bump('e:' + email, PER_EMAIL_PER_HOUR) || bump('all', ALL_PER_HOUR);
}

function clean(v) {
  return String(v === undefined || v === null ? '' : v).replace(/\s+$/g, '').replace(/^\s+/g, '').slice(0, MAX_FIELD);
}

/** A value that starts like a formula is stored as text, never run. */
function safe(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
