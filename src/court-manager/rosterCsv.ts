/**
 * CSV parsing for the private admin roster-import command.
 *
 * This module deliberately knows nothing about React, localStorage, or
 * Supabase. The raw CSV is never bundled into the player-facing app.
 */

import { normalizeKey } from "./util";

export interface CsvRosterPlayer {
  sourceKey: string;
  firstName: string;
  lastName: string | null;
  /** Player-facing display label: first name by owner's instruction. */
  preferredName: string;
  email: string | null;
  phone: string | null;
}

function clean(value: string | undefined): string | null {
  // Strip a leading apostrophe (spreadsheet text-marker, e.g. '+16476868656).
  const trimmed = (value ?? "").trim().replace(/^'/, "").replace(/\s+/g, " ");
  return trimmed || null;
}

/** Minimal RFC-4180 row reader: quoted commas and escaped quotes included. */
function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((field) => field.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((field) => field.trim())) rows.push(row);
  return rows;
}

/**
 * Locate a column by trying exact header names first, then a "contains" match \u2014
 * so real contact exports (Google "Phone 1 - Value", Apple "E-mail", etc.)
 * resolve without hand-mapping. Returns -1 when nothing matches.
 */
function columnIndex(headers: string[], exact: string[], contains: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const name of exact) {
    const i = lower.indexOf(name);
    if (i !== -1) return i;
  }
  for (const needle of contains) {
    const i = lower.findIndex((h) => h.includes(needle));
    if (i !== -1) return i;
  }
  return -1;
}

/** Split a single full-name cell into first + last for name-only exports. */
function splitFullName(full: string): { firstName: string; lastName: string | null } {
  const parts = full.trim().split(/\s+/);
  const firstName = parts.shift() ?? "";
  return { firstName, lastName: parts.length ? parts.join(" ") : null };
}

/**
 * Returns all valid contacts without conflating shared family emails. The
 * source key includes phone and email so that a repeat import is stable.
 * Tolerant of Google/Apple/generic contact exports and name-only lists.
 */
export function parseRosterCsv(text: string): CsvRosterPlayer[] {
  const [headers = [], ...rows] = readCsv(text.replace(/^\uFEFF/, ""));
  const firstIdx = columnIndex(headers, ["first name", "given name"], ["first", "given"]);
  const lastIdx = columnIndex(headers, ["last name", "family name", "surname"], ["last", "family", "surname"]);
  const nameIdx = columnIndex(headers, ["name", "full name", "display name"], ["name"]);
  const phoneIdx = columnIndex(headers, ["phone", "mobile", "phone number"], ["phone", "mobile", "tel"]);
  const emailIdx = columnIndex(headers, ["email", "e-mail", "email address"], ["email", "e-mail"]);
  const players: CsvRosterPlayer[] = [];

  for (const row of rows) {
    let firstName = clean(row[firstIdx]);
    let lastName = clean(row[lastIdx]);
    // Fall back to a single Name column when there's no First Name column.
    if (!firstName && nameIdx !== -1 && nameIdx !== firstIdx) {
      const whole = clean(row[nameIdx]);
      if (whole) {
        const split = splitFullName(whole);
        firstName = split.firstName;
        lastName = lastName ?? split.lastName;
      }
    }
    if (!firstName) continue;
    const phone = clean(row[phoneIdx]);
    const emailRaw = clean(row[emailIdx]);
    const email = emailRaw?.toLowerCase() ?? null;
    const sourceKey = `csv_${[firstName, lastName, phone, email].map(normalizeKey).join("_")}`;
    players.push({ sourceKey, firstName, lastName, preferredName: firstName, email, phone });
  }
  return players;
}
