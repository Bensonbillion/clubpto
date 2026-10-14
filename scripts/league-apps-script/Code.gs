/**
 * PTO League — Apps Script Web App backing the courtside admin console.
 *
 * The Sheet is the single source of truth. This file is the only thing that
 * writes to it, so every rule about which columns are formulas lives here.
 *
 * DEPLOYING (there is no CLI on this project, so this is by hand):
 *   1. Open the Sheet, Extensions > Apps Script.
 *   2. Paste this file over Code.gs.
 *   3. Project Settings > Script Properties, add:
 *        ADMIN_PASSCODE = <the shared passcode>
 *      Writes are refused without it. Do not put the passcode in this file;
 *      anyone who can open the Sheet can read the source.
 *   4. Deploy > New deployment > Web app.
 *        Execute as: Me
 *        Who has access: Anyone
 *      Copy the /exec URL into the site's VITE_LEAGUE_API_URL.
 *   5. Re-deploy (Manage deployments > edit > new version) after any edit.
 *      Saving alone does not update the live URL.
 *
 * CLIENT NOTE: post as text/plain. A Web App on "Anyone" will not accept a
 * custom Content-Type from a browser without a CORS preflight it cannot
 * answer, so application/json fails. The body is still JSON, Apps Script
 * just hands it over as a string in e.postData.contents.
 */

const SHEETS = {
  PLAYERS: 'Players',
  SESSIONS: 'Sessions',
  ATTENDANCE: 'Attendance',
  MATCHES: 'Matches',
  STANDINGS: 'Standings',
  CONFIG: 'Config',
};

/** Every data tab puts headers on row 4 and data from row 5. */
const HEADER_ROW = 4;
const FIRST_DATA_ROW = 5;
/** Attendance carries its session IDs one row above the headers. */
const ATTENDANCE_SESSION_ROW = 3;
const ATTENDANCE_FIRST_SESSION_COL = 4; // D
const ATTENDANCE_SESSION_COUNT = 7; // D..J, S01..S07

/** Matches columns. A (#), L (Won) and M (Check) are formulas: never write. */
const MATCH_COL = {
  SESSION: 2, // B
  DIVISION: 3, // C
  ROUND: 4, // D
  COURT: 5, // E
  A1: 6, // F
  A2: 7, // G
  SCORE_A: 8, // H
  SCORE_B: 9, // I
  B1: 10, // J
  B2: 11, // K
  WON: 12, // L, formula
};
const MATCH_WRITE_FIRST_COL = MATCH_COL.SESSION; // B
const MATCH_WRITE_WIDTH = MATCH_COL.B2 - MATCH_COL.SESSION + 1; // B..K

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

const json = (payload) =>
  ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );

const okResult = (data) => ({ ok: true, data });
const errResult = (error) => ({ ok: false, error: String(error) });

/**
 * Explicit rather than getActiveSpreadsheet(), which returns null for a
 * standalone deployment and fails somewhere less obvious. If this is ever
 * pointed at a copy of the Sheet, change it here.
 */
const SPREADSHEET_ID = '1LuFQiJQCePxJ2BhMHkFpL0r8Nsr2BvoKmRYYZJdYCNY';

const book = () => SpreadsheetApp.openById(SPREADSHEET_ID);

const sheetOf = (name) => {
  const sh = book().getSheetByName(name);
  if (!sh) throw new Error('Missing tab: ' + name);
  return sh;
};

/** Last row holding data, judged by one column rather than the whole grid. */
const lastRowOf = (sh, column) => {
  const max = sh.getLastRow();
  if (max < FIRST_DATA_ROW) return FIRST_DATA_ROW - 1;
  const values = sh
    .getRange(FIRST_DATA_ROW, column, max - FIRST_DATA_ROW + 1, 1)
    .getValues();
  let last = FIRST_DATA_ROW - 1;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() !== '') last = FIRST_DATA_ROW + i;
  }
  return last;
};

const isoDate = (value) => {
  if (!value) return '';
  if (Object.prototype.toString.call(value) !== '[object Date]') {
    return String(value);
  }
  return Utilities.formatDate(value, book().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Players, without Email or Phone.
 *
 * doGet is unauthenticated by design, so anything returned here is readable
 * by anyone holding the URL. None of the admin screens show contact details,
 * so they stay in the Sheet rather than being published to the open web.
 */
const readPlayers = () => {
  const sh = sheetOf(SHEETS.PLAYERS);
  const last = lastRowOf(sh, 1);
  if (last < FIRST_DATA_ROW) return [];
  return sh
    .getRange(FIRST_DATA_ROW, 1, last - FIRST_DATA_ROW + 1, 4)
    .getValues()
    .filter((r) => String(r[0]).trim() !== '')
    .map((r) => ({
      id: String(r[0]).trim(),
      name: String(r[1]).trim(),
      // Division lives in its own column. It is NOT derivable from the ID:
      // M07 is in M2 and M08 is in M1.
      division: String(r[2]).trim(),
      status: String(r[3]).trim(),
    }));
};

const readSessions = () => {
  const sh = sheetOf(SHEETS.SESSIONS);
  const last = lastRowOf(sh, 1);
  if (last < FIRST_DATA_ROW) return [];
  return sh
    .getRange(FIRST_DATA_ROW, 1, last - FIRST_DATA_ROW + 1, 6)
    .getValues()
    .filter((r) => String(r[0]).trim() !== '')
    .map((r) => ({
      id: String(r[0]).trim(),
      week: Number(r[1]) || null,
      date: isoDate(r[2]),
      status: String(r[3]).trim(),
      courts: Number(r[4]) || 0,
      notes: String(r[5] || '').trim(),
    }));
};

const readConfig = () => {
  const sh = sheetOf(SHEETS.CONFIG);
  const values = sh.getRange('B6:B10').getValues();
  return {
    pointsPerWin: Number(values[0][0]) || 0,
    pointsPerLoss: Number(values[1][0]) || 0,
    standingsModel: String(values[2][0] || 'MATCH').trim(),
    fairnessBasis: String(values[3][0] || 'TOTAL').trim(),
    bestNSessions: Number(values[4][0]) || 0,
  };
};

/** Column index on Attendance for a session ID, or 0 if it is not there. */
const attendanceColumnFor = (sessionId) => {
  const sh = sheetOf(SHEETS.ATTENDANCE);
  const ids = sh
    .getRange(
      ATTENDANCE_SESSION_ROW,
      ATTENDANCE_FIRST_SESSION_COL,
      1,
      ATTENDANCE_SESSION_COUNT,
    )
    .getValues()[0];
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i]).trim() === sessionId) {
      return ATTENDANCE_FIRST_SESSION_COL + i;
    }
  }
  return 0;
};

/** { playerId: "In" | "Out" } for one session. */
const readAttendance = (sessionId) => {
  if (!sessionId) return {};
  const col = attendanceColumnFor(sessionId);
  if (!col) throw new Error('Unknown session on Attendance: ' + sessionId);
  const sh = sheetOf(SHEETS.ATTENDANCE);
  const last = lastRowOf(sh, 1);
  if (last < FIRST_DATA_ROW) return {};
  const height = last - FIRST_DATA_ROW + 1;
  const ids = sh.getRange(FIRST_DATA_ROW, 1, height, 1).getValues();
  const marks = sh.getRange(FIRST_DATA_ROW, col, height, 1).getValues();
  const out = {};
  for (let i = 0; i < height; i++) {
    const id = String(ids[i][0]).trim();
    if (!id) continue;
    out[id] = String(marks[i][0]).trim() === 'In' ? 'In' : 'Out';
  }
  return out;
};

const readMatches = (sessionId) => {
  const sh = sheetOf(SHEETS.MATCHES);
  const last = lastRowOf(sh, MATCH_COL.SESSION);
  if (last < FIRST_DATA_ROW) return [];
  return sh
    .getRange(
      FIRST_DATA_ROW,
      MATCH_WRITE_FIRST_COL,
      last - FIRST_DATA_ROW + 1,
      MATCH_WRITE_WIDTH,
    )
    .getValues()
    .filter((r) => String(r[0]).trim() !== '')
    .filter((r) => !sessionId || String(r[0]).trim() === sessionId)
    .map((r) => ({
      sessionId: String(r[0]).trim(),
      division: String(r[1]).trim(),
      round: Number(r[2]) || 0,
      court: String(r[3]).trim(),
      teamA: [String(r[4]).trim(), String(r[5]).trim()],
      scoreA: r[6] === '' || r[6] === null ? null : Number(r[6]),
      scoreB: r[7] === '' || r[7] === null ? null : Number(r[7]),
      teamB: [String(r[8]).trim(), String(r[9]).trim()],
    }));
};

const readStandings = (division) => {
  const sh = sheetOf(SHEETS.STANDINGS);
  const last = lastRowOf(sh, 2);
  if (last < FIRST_DATA_ROW) return [];
  return sh
    .getRange(FIRST_DATA_ROW, 1, last - FIRST_DATA_ROW + 1, 15)
    .getValues()
    .filter((r) => String(r[1]).trim() !== '')
    .filter((r) => !division || String(r[3]).trim() === division)
    .map((r) => ({
      rank: Number(r[0]) || 0,
      playerId: String(r[1]).trim(),
      player: String(r[2]).trim(),
      division: String(r[3]).trim(),
      status: String(r[4]).trim(),
      sessions: Number(r[5]) || 0,
      matches: Number(r[6]) || 0,
      wins: Number(r[7]) || 0,
      losses: Number(r[8]) || 0,
      winPct: r[9] === '' ? null : Number(r[9]),
      pointsFor: Number(r[10]) || 0,
      pointsAgainst: Number(r[11]) || 0,
      diff: Number(r[12]) || 0,
      leaguePoints: Number(r[13]) || 0,
      perSession: Number(r[14]) || 0,
    }));
};

/** The session the admin most likely wants: today's, else the next one due. */
const defaultSessionId = (sessions) => {
  if (!sessions.length) return '';
  const today = Utilities.formatDate(
    new Date(),
    book().getSpreadsheetTimeZone(),
    'yyyy-MM-dd',
  );
  const exact = sessions.filter((s) => s.date === today)[0];
  if (exact) return exact.id;
  const upcoming = sessions
    .filter((s) => s.date >= today && s.status !== 'Cancelled')
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  return upcoming ? upcoming.id : sessions[sessions.length - 1].id;
};

const bootstrap = (requestedSession) => {
  const players = readPlayers();
  const sessions = readSessions();
  const sessionId = requestedSession || defaultSessionId(sessions);
  return {
    players,
    sessions,
    config: readConfig(),
    sessionId,
    attendance: sessionId ? readAttendance(sessionId) : {},
    matches: sessionId ? readMatches(sessionId) : [],
  };
};

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

const passcodeOk = (supplied) => {
  const expected = PropertiesService.getScriptProperties().getProperty(
    'ADMIN_PASSCODE',
  );
  if (!expected) {
    throw new Error(
      'ADMIN_PASSCODE is not set in Script Properties, so writes are refused.',
    );
  }
  return String(supplied || '') === String(expected);
};

const setAttendance = (sessionId, entries) => {
  if (!sessionId) throw new Error('setAttendance needs a sessionId.');
  if (!entries || !entries.length) return { updated: 0 };
  const col = attendanceColumnFor(sessionId);
  if (!col) throw new Error('Unknown session on Attendance: ' + sessionId);

  const sh = sheetOf(SHEETS.ATTENDANCE);
  const last = lastRowOf(sh, 1);
  const height = last - FIRST_DATA_ROW + 1;
  const ids = sh.getRange(FIRST_DATA_ROW, 1, height, 1).getValues();

  const rowFor = {};
  for (let i = 0; i < height; i++) {
    const id = String(ids[i][0]).trim();
    if (id) rowFor[id] = i;
  }

  // Read, patch, write once. One setValues beats one call per player when
  // the whole division gets toggled at the start of a session.
  const column = sh.getRange(FIRST_DATA_ROW, col, height, 1).getValues();
  let updated = 0;
  const unknown = [];
  entries.forEach((entry) => {
    const idx = rowFor[String(entry.playerId).trim()];
    if (idx === undefined) {
      unknown.push(entry.playerId);
      return;
    }
    column[idx][0] = entry.status === 'In' ? 'In' : 'Out';
    updated++;
  });
  sh.getRange(FIRST_DATA_ROW, col, height, 1).setValues(column);

  // Columns B, C and K are formulas and were never in range above.
  return { updated: updated, unknownPlayerIds: unknown };
};

/**
 * Highest row on Matches whose formula columns are filled down. Writing
 * B..K past this point produces rows with no #, no Won and no Check, which
 * look fine in the app and wrong in the Sheet.
 */
const matchesCapacityLastRow = (sh) => {
  const max = sh.getMaxRows();
  if (max < FIRST_DATA_ROW) return FIRST_DATA_ROW - 1;
  const formulas = sh
    .getRange(FIRST_DATA_ROW, MATCH_COL.WON, max - FIRST_DATA_ROW + 1, 1)
    .getFormulas();
  let last = FIRST_DATA_ROW - 1;
  for (let i = 0; i < formulas.length; i++) {
    if (formulas[i][0]) last = FIRST_DATA_ROW + i;
  }
  return last;
};

const fixtureRow = (sessionId, f) => [
  sessionId,
  f.division,
  f.round,
  f.court,
  f.teamA[0],
  f.teamA[1],
  '',
  '',
  f.teamB[0],
  f.teamB[1],
];

/**
 * Replace this session's fixtures. Idempotent: committing twice leaves one
 * copy, not two. Refuses once any score exists for the session, because
 * rewriting the block would discard results already played.
 */
const createFixtures = (sessionId, fixtures) => {
  if (!sessionId) throw new Error('createFixtures needs a sessionId.');
  if (!fixtures || !fixtures.length) throw new Error('No fixtures supplied.');

  const sh = sheetOf(SHEETS.MATCHES);
  const capacity = matchesCapacityLastRow(sh);
  const last = lastRowOf(sh, MATCH_COL.SESSION);
  const height = Math.max(0, last - FIRST_DATA_ROW + 1);

  const existing = height
    ? sh
        .getRange(FIRST_DATA_ROW, MATCH_WRITE_FIRST_COL, height, MATCH_WRITE_WIDTH)
        .getValues()
        .filter((r) => String(r[0]).trim() !== '')
    : [];

  const scored = existing.filter(
    (r) =>
      String(r[0]).trim() === sessionId &&
      (String(r[6]).trim() !== '' || String(r[7]).trim() !== ''),
  );
  if (scored.length) {
    throw new Error(
      'Session ' +
        sessionId +
        ' already has ' +
        scored.length +
        ' recorded score(s). Clear them in the Sheet before regenerating.',
    );
  }

  const kept = existing.filter((r) => String(r[0]).trim() !== sessionId);
  const rows = kept.concat(fixtures.map((f) => fixtureRow(sessionId, f)));

  if (FIRST_DATA_ROW + rows.length - 1 > capacity) {
    throw new Error(
      'Matches has formulas down to row ' +
        capacity +
        ' and this needs ' +
        (FIRST_DATA_ROW + rows.length - 1) +
        '. Fill A, L and M further down first.',
    );
  }

  const blank = ['', '', '', '', '', '', '', '', '', ''];
  const block = rows.slice();
  const total = Math.max(height, rows.length);
  while (block.length < total) block.push(blank.slice());

  if (total > 0) {
    sh.getRange(
      FIRST_DATA_ROW,
      MATCH_WRITE_FIRST_COL,
      total,
      MATCH_WRITE_WIDTH,
    ).setValues(block);
  }
  return { written: fixtures.length, sessionId: sessionId };
};

/**
 * Append one finished match, scores and all.
 *
 * This is what the admin screen uses: matches are recorded as they are
 * played rather than scheduled in advance, so there is no fixture to find.
 * The round number is assigned here, as the next one for that session and
 * division, so the operator never has to think about it.
 */
const addMatch = (payload) => {
  const { sessionId, division, court, teamA, teamB, scoreA, scoreB } = payload;
  if (!sessionId || !division) {
    throw new Error('addMatch needs a sessionId and a division.');
  }
  const names = (teamA || []).concat(teamB || []).map(function (n) {
    return String(n || '').trim();
  });
  if (names.length !== 4 || names.some(function (n) { return !n; })) {
    throw new Error('A match needs four players.');
  }
  const unique = {};
  for (let i = 0; i < names.length; i++) {
    const key = names[i].toLowerCase();
    if (unique[key]) throw new Error('The same player is in twice: ' + names[i]);
    unique[key] = true;
  }

  const a = Number(scoreA);
  const b = Number(scoreB);
  if (!isFinite(a) || !isFinite(b)) throw new Error('Scores must be numbers.');
  if (a === b) throw new Error('No draws in this league.');

  const sh = sheetOf(SHEETS.MATCHES);
  const capacity = matchesCapacityLastRow(sh);
  const last = lastRowOf(sh, MATCH_COL.SESSION);
  const target = Math.max(last + 1, FIRST_DATA_ROW);
  if (target > capacity) {
    throw new Error(
      'Matches has formulas down to row ' +
        capacity +
        ' and is full. Fill A, L and M further down.',
    );
  }

  // Next round number for this session and division.
  let round = 1;
  if (last >= FIRST_DATA_ROW) {
    const rows = sh
      .getRange(
        FIRST_DATA_ROW,
        MATCH_WRITE_FIRST_COL,
        last - FIRST_DATA_ROW + 1,
        MATCH_WRITE_WIDTH,
      )
      .getValues();
    for (let i = 0; i < rows.length; i++) {
      if (
        String(rows[i][0]).trim() === sessionId &&
        String(rows[i][1]).trim() === division
      ) {
        round = Math.max(round, (Number(rows[i][2]) || 0) + 1);
      }
    }
  }

  sh.getRange(target, MATCH_WRITE_FIRST_COL, 1, MATCH_WRITE_WIDTH).setValues([
    [
      sessionId,
      division,
      round,
      String(court || '').trim(),
      names[0],
      names[1],
      a,
      b,
      names[2],
      names[3],
    ],
  ]);

  return { row: target, round: round };
};

/** Two names as an order-independent key, for matching a team to a row. */
const teamKey = (pair) =>
  (pair || [])
    .map((name) => String(name).trim().toLowerCase())
    .sort()
    .join('|');

/**
 * Record one result in place, never as a new row: re-sending the same score
 * after a dropped connection updates what is already there.
 *
 * The spec names the idempotency key as session + division + round + court
 * but the recordScore payload it gives carries no court, which is ambiguous
 * the moment a division is allocated two courts and plays two matches in the
 * same round. So court is used when supplied and the team names settle it
 * otherwise. If both are absent and the round is ambiguous we refuse rather
 * than guess, because guessing writes a score onto the wrong match.
 *
 * Teams are matched unordered, and a row whose A and B are the other way
 * round to the request has its scores swapped to suit, so the result cannot
 * be recorded backwards.
 */
const recordScore = (payload) => {
  const { sessionId, division, round, court, teamA, teamB, scoreA, scoreB } =
    payload;
  if (!sessionId || !division || !round) {
    throw new Error('recordScore needs sessionId, division and round.');
  }
  const a = Number(scoreA);
  const b = Number(scoreB);
  if (!isFinite(a) || !isFinite(b)) throw new Error('Scores must be numbers.');
  if (a === b) throw new Error('No draws in this league.');

  const sh = sheetOf(SHEETS.MATCHES);
  const last = lastRowOf(sh, MATCH_COL.SESSION);
  if (last < FIRST_DATA_ROW) throw new Error('No fixtures to score yet.');
  const height = last - FIRST_DATA_ROW + 1;
  const rows = sh
    .getRange(FIRST_DATA_ROW, MATCH_WRITE_FIRST_COL, height, MATCH_WRITE_WIDTH)
    .getValues();

  const wantA = teamKey(teamA);
  const wantB = teamKey(teamB);

  const candidates = [];
  for (let i = 0; i < height; i++) {
    const r = rows[i];
    if (String(r[0]).trim() !== sessionId) continue;
    if (String(r[1]).trim() !== division) continue;
    if (Number(r[2]) !== Number(round)) continue;
    if (court && String(r[3]).trim() !== String(court).trim()) continue;

    const rowA = teamKey([r[4], r[5]]);
    const rowB = teamKey([r[8], r[9]]);
    if (wantA && wantB) {
      if (rowA === wantA && rowB === wantB) {
        candidates.push({ index: i, flipped: false });
      } else if (rowA === wantB && rowB === wantA) {
        candidates.push({ index: i, flipped: true });
      }
      continue;
    }
    candidates.push({ index: i, flipped: false });
  }

  const where = [sessionId, division, 'round ' + round]
    .concat(court ? [court] : [])
    .join(' / ');

  if (!candidates.length) {
    throw new Error('No fixture for ' + where + '. Commit the fixtures first.');
  }
  if (candidates.length > 1) {
    throw new Error(
      'That round has ' +
        candidates.length +
        ' matches for ' +
        where +
        '. Send the court or the team names so the right one is scored.',
    );
  }

  const hit = candidates[0];
  const values = hit.flipped ? [[b, a]] : [[a, b]];
  sh.getRange(FIRST_DATA_ROW + hit.index, MATCH_COL.SCORE_A, 1, 2).setValues(
    values,
  );
  return {
    row: FIRST_DATA_ROW + hit.index,
    scoreA: values[0][0],
    scoreB: values[0][1],
    flipped: hit.flipped,
  };
};

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    switch (p.type || 'bootstrap') {
      case 'bootstrap':
        return json(okResult(bootstrap(p.session)));
      case 'players':
        return json(okResult(readPlayers()));
      case 'sessions':
        return json(okResult(readSessions()));
      case 'config':
        return json(okResult(readConfig()));
      case 'attendance':
        return json(okResult(readAttendance(p.session)));
      case 'matches':
        return json(okResult(readMatches(p.session)));
      case 'standings':
        return json(okResult(readStandings(p.div)));
      default:
        return json(errResult('Unknown type: ' + p.type));
    }
  } catch (err) {
    return json(errResult(err && err.message ? err.message : err));
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Two phones on one session is the normal case, not the edge case.
    if (!lock.tryLock(20000)) {
      return json(errResult('The Sheet is busy. Try that again.'));
    }

    if (!e || !e.postData || !e.postData.contents) {
      return json(errResult('Empty request body.'));
    }
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return json(errResult('Body was not JSON: ' + parseErr));
    }

    if (!passcodeOk(body.passcode)) {
      return json(errResult('Wrong passcode.'));
    }

    switch (body.action) {
      case 'setAttendance':
        return json(okResult(setAttendance(body.sessionId, body.entries)));
      case 'createFixtures':
        return json(okResult(createFixtures(body.sessionId, body.fixtures)));
      case 'addMatch':
        return json(okResult(addMatch(body)));
      case 'recordScore':
        return json(okResult(recordScore(body)));
      default:
        return json(errResult('Unknown action: ' + body.action));
    }
  } catch (err) {
    return json(errResult(err && err.message ? err.message : err));
  } finally {
    try {
      lock.releaseLock();
    } catch (ignored) {
      // Lock was never taken; nothing to release.
    }
  }
}
