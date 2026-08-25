// The manager, wired.
//
// Every screen under ./screens is presentational and useSession.ts is the only
// writer. This file is the join: it holds the small amount of state that is
// genuinely about NAVIGATION (which step of the wizard, which court, which tab,
// is a sheet open) and nothing about the night itself.
//
// BOTH COURTS RUN AT ONCE, AND THAT IS WHY THIS FILE IS SHAPED LIKE THIS.
// The owner's sharpest complaint about the old shell was having to finish
// Court 1 before Court 2 could be looked at. The cause was not a missing
// button, it was that "which tab am I on", "which pane am I in" and "is score
// entry open" were single values shared by both courts, so walking to the
// other court dragged Court 1's screen along with it. Every one of those now
// lives in `uiByCourt`, keyed BY COURT NUMBER, and flipping the header chip
// only changes which entry is read. Frame 13's promise, "flip mid-match,
// mid-score, mid-anything, each court picks up exactly where it was", is that
// record. The next four are drawn for EVERY running court for the same reason:
// a court nobody is standing in front of is still playing.
//
// NOTHING HERE WORKS ANYTHING OUT. The schedule, the round, the ending, the
// bracket and the individual champion all arrive derived from useSession's
// views or from a pure engine function; this file chooses a screen and hands
// the answer over.

import { useMemo, useEffect, useState } from "react";
import { ensureManageFonts } from "./ui/fonts";
import { applyInstanceAccent, DangerButton, PrimaryButton, SecondaryButton, Sheet, T, Tag, TertiaryButton, type Tab } from "./ui/primitives";
import { recordedResultCount, storageKeyFor, useManageSession } from "./useSession";
import { useRoster } from "./roster/useRoster";
import { dedupeWalkIn } from "./roster/merge";
import { explainMatch, lawContextFor, validTargets, totalMatches } from "./engine/rotation";
import { legalSubstitutes, strandedPlayers } from "./engine/substitutes";
import { suggestSplit, suggestTarget, type SplitNote } from "./engine/split";
import { MIN_CS_FOR_A_C_MATCH, tierOf } from "./engine/tiers";
import { POINTS_PER_WIN, type StandingsRow } from "./engine/standings";
import { buildStages, isTrio, seedPairs } from "./engine/playoff";
import {
  endingFor, individualChampion, mayChooseEnding, oneMoreRoundChange,
  type CourtEndings,
} from "./engine/endings";
import type { Match, PlayerTier, PlayoffStage } from "./types";
import { Passcode, PasscodeFailed, HomeNothingRunning, HomeNightInProgress } from "./screens/door-home";
import { WhichNight, WhoIsHere, Courts, MatchesEach, Ready, Chip } from "./screens/setup";
import { CourtHeader, BalanceRule, CourtView, CourtSwitcher, Schedule, ScoreEntry , startValue } from "./screens/play";
import { CorrectOrVoid, Extend, LateArrival, LeavesEarly, MoveCourts, PlayersTab } from "./screens/people";
import { StandingsTab, TieBrokenByOrder, type StandingsTabRow } from "./screens/standings";
import {
  Bracket, Champion, HowThisCourtEnds, IndividualChampion, PlayoffMatch, PlayoffReadiness,
  joinPair,
} from "./screens/playoffs";
import {
  ConfirmDeletePlayoff,
  buildWhatsAppPayload, ConfirmEndNight, ConfirmVoidResult, SessionSummary,
  type SummaryChampion,
} from "./screens/summary-states";

const PASSCODE = "9999";
const NIGHTS = [
  { dayName: "Wednesday", isDefault: true },
  { dayName: "Sunday", isDefault: false },
];

/** Rough wall clock for one match. Only ever used to say what a choice costs. */
const MINUTES_PER_MATCH = 12;

/**
 * Fallback singular stage word per stage key, for a tie whose stage cannot be
 * found in the built bracket. The real word comes off `Stage.word`, because
 * the first stage's name depends on the shape: eight pairs open with
 * quarterfinals, six with play-ins, both stored under the key "playIn".
 */
const STAGE_WORD: Record<PlayoffStage, string> = {
  playIn: "Play-in",
  semi: "Semifinal",
  final: "Final",
};

type Step = "night" | "who" | "courts" | "target" | "ready";

/** What the match tab is showing for one court. */
type Pane = "match" | "schedule" | "why" | "bracket" | "playoffMatch";

/**
 * Everything the shell remembers about ONE court.
 *
 * Nothing in here is part of the night: the night is in useSession. This is
 * only where the operator had got to on this court, kept apart from the other
 * court so a flip of the header chip cannot disturb it.
 */
interface CourtUi {
  tab: Tab;
  pane: Pane;
  /**
   * Score entry: which box is focused AND the digits typed so far.
   *
   * Per court because frame 13 says the flip happens mid-score, and the
   * DIGITS live here too, which is a reversal worth explaining. They used to
   * die with the sheet on a flip, on the theory that a half-typed score is
   * not part of the night. Script 2 overruled it: the operator flips away
   * with one number staged and the sheet must come back exactly as left,
   * because on a real night the flip happens BECAUSE somebody shouted from
   * the other court, not because the number was wrong.
   */
  scoring: { matchId: string; side: "A" | "B"; a: string; b: string } | null;
  /**
   * The pager: which schedule slot the match card is showing, or null for the
   * live match. Past slots page back through recorded results; forward from
   * the live match shows exactly ONE projected row, labelled as such, and
   * nothing beyond it.
   */
  pagerSlot: number | null;
  /** A recorded result opened for correction (frame 16). */
  editingMatchId: string | null;
  /** The same result, one step further, at frame 28a. */
  voidingMatchId: string | null;
  /** Frame 16c, opened by the players tab's "Mark left". */
  leavingPlayerId: string | null;
  /** Frame B28, opened by the players tab's "Move courts". */
  movingPlayerId: string | null;
  /** Frame B29, opened by the players tab's "Set tier". */
  tierPlayerId: string | null;
  /** The row of the players tab showing its action (frame 14). */
  openPlayerId: string | null;
  /** Frame 18, opened off the standings row whose reason line is drawn. */
  tiePlayerId: string | null;
  /** The live unscored match opened for a swap or redraw. See ChangeMatchSheet. */
  changingMatchId: string | null;
  /** The seat chosen to step out, once the sheet's first question is answered. */
  changeOutId: string | null;
}

const FRESH_COURT_UI: CourtUi = {
  tab: "match",
  pane: "match",
  scoring: null,
  pagerSlot: null,
  editingMatchId: null,
  voidingMatchId: null,
  leavingPlayerId: null,
  movingPlayerId: null,
  tierPlayerId: null,
  openPlayerId: null,
  tiePlayerId: null,
  changingMatchId: null,
  changeOutId: null,
};

/** Night-wide overlays. One at a time, and none of them belongs to a court. */
type NightSheet = "nightMenu" | "summary" | "endNight" | "extend" | "lateArrival" | "courtSwitcher" | "deleteBracket" | "restartSetup" | "resetEverything";

/**
 * Frame 25b, the night menu.
 *
 * It lives here rather than in a slice because no slice owns it yet: the play
 * slice raises `onOpenNightMenu` and says the sheet belongs to summary-states,
 * and summary-states does not export one. Every word below is frame 25b's own.
 * When that slice grows a NightMenu this should move there unchanged.
 */
const NightMenu = ({
  dayLabel, onSessionSummary, onOneMoreRound, onRestartSetup, onStartOver, onEndNight, onClose,
  onDeleteBracket, onResetEverything,
}: {
  dayLabel: string;
  onSessionSummary: () => void;
  onOneMoreRound: () => void;
  /** Back to the wizard at the courts step, roster kept, results deleted. */
  onRestartSetup: () => void;
  onStartOver: () => void;
  onEndNight: () => void;
  onClose: () => void;
  /** Only passed while the active court has a seeded bracket. */
  onDeleteBracket?: () => void;
  /** The full wipe: players, tiers, games, brackets. Opens a confirm. */
  onResetEverything: () => void;
}) => (
  <Sheet onDismiss={onClose}>
    <p style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 18, margin: 0 }}>{dayLabel}</p>
    <p style={{ font: `400 14px/1.55 ${T.fontBody}`, color: T.mut, margin: 0 }}>
      One tap away from any screen, either court, all night.
    </p>
    <SecondaryButton onClick={onSessionSummary}>Session summary</SecondaryButton>
    <SecondaryButton onClick={onOneMoreRound}>One more round for a court</SecondaryButton>
    {/*
      Not on frame 25b. Start over keeps the night running, so a night whose
      COURTS were dealt wrong, the wrong split or the wrong targets, had no
      way back into the wizard without ending it and losing the roster's
      momentum. This is that way back, and it costs recorded results, so it
      wears the destructive outline and opens a confirm that counts them.
    */}
    <SecondaryButton onClick={onRestartSetup} style={{ borderColor: T.bad, color: T.redInk }}>
      Restart setup
    </SecondaryButton>
    {/* Frame 25b outlines this one in the destructive colour without making it
        the danger button. The roster survives, and the sentence under it is
        what carries the warning. */}
    <SecondaryButton onClick={onStartOver} style={{ borderColor: T.bad, color: T.redInk }}>
      Start tonight over
    </SecondaryButton>
    <p style={{
      font: `400 13.5px/1.5 ${T.fontBody}`, color: T.mut, margin: 0, textAlign: "center",
    }}>
      Start over clears every game and bracket. The roster and tiers stay.
    </p>
    {/*
      Not on frame 25b. It exists because a mistakenly seeded bracket had no
      way out at all: ConfirmDeletePlayoff was built and nothing opened it. It
      only renders while the active court actually has a bracket, so on most
      nights the menu is exactly the frame.
    */}
    {onDeleteBracket && (
      <SecondaryButton onClick={onDeleteBracket} style={{ borderColor: T.bad, color: T.redInk }}>
        Delete this court's bracket
      </SecondaryButton>
    )}
    <DangerButton onClick={onEndNight}>End the night</DangerButton>
    {/*
      Not on frame 25b either. Start over keeps the roster by design, which
      left no way to wipe a device clean: a test session, or the wrong club's
      roster, was permanent. This is the one action that loses the roster, so
      it opens a confirm that names exactly that.
    */}
    <TertiaryButton onClick={onResetEverything} style={{ color: T.redInk }}>
      Reset everything
    </TertiaryButton>
    <TertiaryButton onClick={onClose}>Close</TertiaryButton>
  </Sheet>
);

/** A name row inside a sheet: the name, and a tier tag only where one was set. */
const NameOption = ({ name, tier, onPick }: {
  name: string; tier: PlayerTier | null; onPick: () => void;
}) => (
  <SecondaryButton
    onClick={onPick}
    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
  >
    {name}
    {/* Unassessed stays unlabelled, the same rule as every chip in the
        manager: the engine treats them as B, but that is a default it
        applies, not a judgement this row may claim somebody made. */}
    {tier != null && <Tag size="sm">{tier}</Tag>}
  </SecondaryButton>
);

/**
 * Change the live match: one seat swapped, or the whole four thrown back.
 *
 * It lives here for the same reason NightMenu does: the play slice raises the
 * tap and no slice exports the sheet yet. FLAG: this is an INVENTED entry
 * point with invented words. No frame draws a way to change a live lineup,
 * and the need is real: a player turns an ankle two points in, or the four on
 * the card are not the four who actually walked on. The schedule's live row
 * was the one tap in that list that did nothing but leave the screen, so the
 * tap is spent opening this rather than on a new control with words of its
 * own. When the play slice grows a ChangeMatch this should move there
 * unchanged.
 *
 * Two questions, one sheet: who steps out, then who steps in. The second list
 * is ONLY the legal substitutes, straight from engine/substitutes.ts, because
 * a name offered here that the next match would refuse means this file has
 * re-derived the laws by hand, which is exactly the drift that module exists
 * to prevent. An empty second list is said out loud rather than shown as a
 * blank, because this sheet refuses nothing silently.
 */
const ChangeMatchSheet = ({
  seats, out, substitutes, onPickOut, onPickIn, onRedraw, onBack, onClose,
}: {
  /** The four on court, team A's seats then team B's. */
  seats: { id: string; name: string; tier: PlayerTier | null }[];
  /** The seat stepping out, or null while the first question is open. */
  out: { id: string; name: string } | null;
  /** Everyone the laws allow into that seat. Empty is a real answer. */
  substitutes: { id: string; name: string; tier: PlayerTier | null }[];
  onPickOut: (playerId: string) => void;
  onPickIn: (playerId: string) => void;
  /** Deletes the live row and deals it fresh; all four rejoin the queue. */
  onRedraw: () => void;
  /** Back to the first question, sheet still open. */
  onBack: () => void;
  onClose: () => void;
}) => (
  <Sheet onDismiss={onClose}>
    {out == null ? (
      <>
        <p style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 18, margin: 0 }}>
          Change this match
        </p>
        <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0, textWrap: "pretty" }}>
          Tap who steps out. The other three stay where they stand.
        </p>
        {seats.map((p) => (
          <NameOption key={p.id} name={p.name} tier={p.tier} onPick={() => onPickOut(p.id)} />
        ))}
        <SecondaryButton onClick={onRedraw}>Redraw this match</SecondaryButton>
        <p style={{
          font: `400 13.5px/1.5 ${T.fontBody}`, color: T.mut, margin: 0, textAlign: "center",
        }}>
          Redraw sends all four back to the queue and deals the row fresh.
        </p>
        <TertiaryButton onClick={onClose}>Close</TertiaryButton>
      </>
    ) : (
      <>
        <p style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 18, margin: 0 }}>
          Who steps in for {out.name}?
        </p>
        <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0, textWrap: "pretty" }}>
          {substitutes.length > 0
            ? "Only players the balance laws allow are offered."
            : "Nobody waiting can legally take this seat. Pick a different seat, or redraw the match."}
        </p>
        {substitutes.map((p) => (
          <NameOption key={p.id} name={p.name} tier={p.tier} onPick={() => onPickIn(p.id)} />
        ))}
        <TertiaryButton onClick={onBack}>Back</TertiaryButton>
      </>
    )}
  </Sheet>
);

/** Frame B29's four options in its own order. Null is "Not assessed". */
const TIER_OPTIONS: (PlayerTier | null)[] = ["A", "B", "C", null];

/**
 * Frame B29, set a tier mid-night.
 *
 * It lives here for the same reason NightMenu does: the players tab raises the
 * callback and no slice exports the sheet yet. Every word is frame B29's own.
 * The frame draws the sheet over a screen headed "Roster", and the players tab
 * is the only roster a running night has, so that is where it opens from.
 * When the people slice grows a SetTier this should move there unchanged.
 */
const SetTierSheet = ({ playerName, draft, onSelect, onSave, onCancel }: {
  playerName: string;
  /** The choice as it stands on the sheet, committed only by Save. */
  draft: PlayerTier | null;
  onSelect: (tier: PlayerTier | null) => void;
  onSave: () => void;
  onCancel: () => void;
}) => (
  <Sheet onDismiss={onCancel}>
    <p style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 18, margin: 0 }}>
      {playerName}&#39;s tier
    </p>
    <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0, textWrap: "pretty" }}>
      A quiet note for you when splitting courts. It never shows on court, in games, or in standings.
    </p>
    <div role="radiogroup" style={{ display: "flex", gap: 10 }}>
      {TIER_OPTIONS.map((tier) => (
        <Chip
          key={tier ?? "none"}
          radio
          on={tier === draft}
          onClick={() => onSelect(tier)}
          // The frame draws the three letters as values in the display face
          // and gives "Not assessed" the wider chip, because it is a sentence
          // rather than a letter.
          style={tier == null
            ? { flex: 1.7, minHeight: 56, fontSize: 13.5, whiteSpace: "nowrap" }
            : { flex: 1, minHeight: 56, fontFamily: T.fontHead, fontWeight: 400, fontSize: 24 }}
        >
          {tier ?? "Not assessed"}
        </Chip>
      ))}
    </div>
    {/* The frame joins the two middle sentences with an em dash. Restructured
        to a full stop, no word changed. */}
    <p style={{ font: `400 13.5px/1.5 ${T.fontBody}`, color: T.mut, margin: 0, textWrap: "pretty" }}>
      Set it when you add someone to the roster, or change it any week from this
      same sheet. B this week can be A the next. Form moves, and nothing already
      played changes.
    </p>
    <PrimaryButton onClick={onSave}>Save tier</PrimaryButton>
    <TertiaryButton onClick={onCancel}>Cancel</TertiaryButton>
  </Sheet>
);

/** "8:41", the way frame 18 writes a time. No meridiem is drawn, so none is. */
const clockTime = (at: number | null | undefined): string => {
  if (at == null) return "";
  const d = new Date(at);
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export interface ManageAppProps {
  /**
   * Which manager this is. /manage is instance 1 and /manage2 is instance 2,
   * and the club can run both at once, one court on each phone, because each
   * instance keeps its night under its own localStorage key. Instance 1 is
   * the key every phone already has a night under, so /manage is unchanged.
   */
  instance?: 1 | 2;
}

export default function ManageApp({ instance = 1 }: ManageAppProps) {
  useEffect(ensureManageFonts, []);
  // Manager 2 wears a different action colour on every screen, so two phones
  // or two tabs are told apart at a glance. Cleans up when the manager leaves.
  useEffect(() => applyInstanceAccent(instance), [instance]);

  const s = useManageSession(storageKeyFor(instance));
  // Named only on the second manager, on the door and at home, so two tabs on
  // one phone can be told apart. Once a night is running the court header is
  // the operator's bearings and the URL is the instance.
  const instanceLabel = instance === 1 ? undefined : `Manager ${instance}`;
  const roster = useRoster();

  // Navigation only. Nothing here is part of the night.
  const [entered, setEntered] = useState("");
  const [failed, setFailed] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [inSetup, setInSetup] = useState(false);
  const [step, setStep] = useState<Step>("night");
  const [night, setNight] = useState("Wednesday");
  const [query, setQuery] = useState("");
  const [courtCount, setCourtCount] = useState(2);
  const [tierPromptId, setTierPromptId] = useState<string | null>(null);
  const [court, setCourt] = useState(1);
  // Home is a destination you choose, not somewhere Start throws you.
  const [atCourt, setAtCourt] = useState(false);

  const [uiByCourt, setUiByCourt] = useState<Record<number, CourtUi>>({});
  const [sheet, setSheet] = useState<NightSheet | null>(null);
  const [lateName, setLateName] = useState("");
  const [lateCourt, setLateCourt] = useState<number | null>(null);
  const [lateTier, setLateTier] = useState<PlayerTier | null>(null);
  /** Frame B28's chosen destination, set on open so the title can name it. */
  const [moveTo, setMoveTo] = useState<number | null>(null);
  /** Frame B29's choice as it stands on the sheet. Save is what commits it. */
  const [tierDraft, setTierDraft] = useState<PlayerTier | null>(null);

  /**
   * Which ending each court picked (frame 19).
   *
   * engine/endings.ts owns the shape and both readers of it, so this holds the
   * map and nothing more. It is shell state rather than session state because
   * Session has no field for it; the CONSEQUENCE of the choice is written to
   * the session either way, the target rises or the bracket is seeded, so a
   * reload loses the question and never the answer.
   */
  // Derived from the session, not held here: the shell's memory dies with a
  // reload, and a refreshed phone used to be re-offered a choice the court had
  // already made.
  const endings: CourtEndings = useMemo(
    () => Object.fromEntries(
      s.session.courts.filter((c) => c.ending != null).map((c) => [c.number, c.ending!])),
    [s.session.courts]);

  const ui = uiByCourt[court] ?? FRESH_COURT_UI;
  const patch = (courtNumber: number, next: Partial<CourtUi>) =>
    setUiByCourt((prev) => ({
      ...prev,
      [courtNumber]: { ...(prev[courtNumber] ?? FRESH_COURT_UI), ...next },
    }));
  /** The common case: change something about the court currently on screen. */
  const here = (next: Partial<CourtUi>) => patch(court, next);

  /**
   * Opening the wizard, with the court count read back off the night.
   *
   * The wizard is reachable mid-night, and `courtCount` is local navigation
   * state that starts at 2. Walking back in on a three court night and pressing
   * Next through step 2 called setCourts([1, 2]), which drops court 3 and
   * orphans every match played on it. Reading the real count on the way in is
   * what stops a visit to the roster from quietly deleting a court.
   */
  const enterSetup = (to: Step = "night") => {
    // Starting on top of an ENDED night begins an EMPTY one. It used to keep
    // last week's people, and a live Wednesday showed what that does: the
    // who-step arrived pre-ticked, searching those names drew nothing, and
    // the walk-in button silently refused. "Start tonight" now means what it
    // says. Carrying the same people forward is the OTHER button, "Copy last
    // Wednesday", which preloads on purpose and says so.
    if (s.session.status === "ended") {
      s.resetEverything();
      setUiByCourt({});
    }
    if (s.session.courts.length > 0) setCourtCount(s.session.courts.length);
    setInSetup(true);
    setStep(to);
  };

  /**
   * The suggested split, applied (frames A07 and B31).
   *
   * engine/split.ts works out where everyone starts and what each court's
   * target should be; this only writes its answer into the session. Placement
   * normally touches only players with no court at this count, because tier
   * suggests and never gates: a name the operator has dragged stays where it
   * was dragged. `everyone` is the exception, for the court-count chips, where
   * every placement was made against a shape that no longer exists.
   *
   * Targets are seeded only while the night has not started. The wizard is
   * reachable mid-night as the way to the roster, and a running court's
   * target is the night's, possibly already extended, so re-seeding it would
   * rewrite a promise the room is playing to.
   */
  const applySuggestedSplit = (count: number, everyone: boolean) => {
    const suggestion = suggestSplit(s.session.players, count);
    const fresh = s.session.status !== "running";
    for (const p of s.session.players) {
      const to = suggestion.assignment.get(p.id);
      // A court number above the count points at a court that no longer
      // exists, so a player carrying one is unplaced, not placed.
      const placed = p.courtNumber != null && p.courtNumber <= count;
      if (to != null && ((everyone && fresh) || !placed)) s.assignCourt(p.id, to);
    }
    if (fresh) for (const [number, t] of suggestion.targets) s.setTarget(number, t);
  };

  /* ── keeping every court playing ───────────────────────────────── */
  //
  // Hoisted above the passcode gate because hooks cannot live under an early
  // return.

  const running = s.session.status === "running";
  const view = s.views.find((v) => v.court.number === court) ?? s.views[0];

  /**
   * Every running court with nobody on it and a row still to play.
   *
   * It used to be only the court on screen, which is the bug the owner felt:
   * Court 2's four were not put on until you walked over to it, so Court 2
   * effectively waited for Court 1. Courts in a playoff are excluded because
   * advancePlayoff mints those rows, and a finished court is excluded because
   * playNextSlot would find nothing anyway.
   *
   * Joined into a string so the effect fires on a change of the SET rather
   * than on every render; a fresh array each render would re-run it forever.
   */
  const fillKey = unlocked && !inSetup && running
    ? s.views
      .filter((v) => v.onCourt == null && !v.complete && !v.court.playoffSeeded)
      .map((v) => v.court.number)
      .join(",")
    : "";

  const { ensureOnCourt, advancePlayoff } = s;
  useEffect(() => {
    if (!fillKey) return;
    for (const n of fillKey.split(",")) ensureOnCourt(Number(n));
  }, [fillKey, ensureOnCourt]);

  /**
   * The same idea for a court in its playoff: whichever bracket row has both
   * sides resolved goes on court next.
   *
   * This replaces a setTimeout after each playoff score. The timeout existed
   * because advancePlayoff has to run AFTER the score commits; an effect keyed
   * on the committed state is that guarantee without the delay, and it covers
   * the second court, which the timeout never did.
   */
  const advanceKey = unlocked && !inSetup && running
    ? s.views
      .filter((v) => v.court.playoffSeeded && v.champion == null
        && !v.stages?.some((st) => st.ties.some((t) => t.live)))
      .map((v) => v.court.number)
      .join(",")
    : "";

  useEffect(() => {
    if (!advanceKey) return;
    for (const n of advanceKey.split(",")) advancePlayoff(Number(n));
  }, [advanceKey, advancePlayoff]);

  /* ── the door ──────────────────────────────────────────────────── */

  const digit = (d: string) => {
    setFailed(false);
    const next = entered + d;
    if (next.length < 4) { setEntered(next); return; }
    setEntered("");
    if (next === PASSCODE) setUnlocked(true);
    else setFailed(true);
  };

  if (!unlocked) {
    return failed
      ? <PasscodeFailed instanceLabel={instanceLabel} onDigit={digit} onDelete={() => setEntered((e) => e.slice(0, -1))} />
      : <Passcode entered={entered.length} instanceLabel={instanceLabel} onDigit={digit} onDelete={() => setEntered((e) => e.slice(0, -1))} />;
  }

  /* ── home ──────────────────────────────────────────────────────── */

  if (!inSetup && !running) {
    // After an ENDED night the session still holds the roster and the day it
    // ran, so the ghost has something real to copy. A fresh device has
    // neither, and null drops the ghost and its sentence together.
    const lastDay = s.session.status === "ended" ? s.session.dayLabel || null : null;
    return (
      <HomeNothingRunning
        instanceLabel={instanceLabel}
        loading={s.loading}
        lastSessionDayName={lastDay}
        onStartTonight={() => enterSetup()}
        onCopyLastSession={lastDay == null ? undefined : () => {
          // "Same people, new night", made literal: beginNewNight keeps the
          // roster and its tiers and clears the games, and the wizard opens
          // at WHO IS HERE so the list arrives already ticked. The away
          // flags are cleared by hand because away means "left early
          // TONIGHT", and tonight has not happened yet; carried over, last
          // week's early leavers arrived unticked on a list promising
          // everyone was in.
          s.beginNewNight();
          for (const p of s.session.players) {
            if (p.away) s.setAway(p.id, false);
          }
          setUiByCourt({});
          if (s.session.dayLabel) setNight(s.session.dayLabel);
          // Same guard as enterSetup: courtCount is local state that starts
          // at 2, and walking the wizard forward on a three court night
          // would otherwise quietly drop court 3.
          if (s.session.courts.length > 0) setCourtCount(s.session.courts.length);
          setInSetup(true);
          setStep("who");
        }}
      />
    );
  }

  if (!inSetup && running && !atCourt) {
    return (
      <HomeNightInProgress
        instanceLabel={instanceLabel}
        dayName={s.session.dayLabel || night}
        // Only a court with four people on it has anything to say here. From
        // Home the operator is standing at neither court, and "waiting on a
        // score" is the sentence for the court they are not at, so a court
        // that is playing is all this can honestly claim.
        courts={s.views.flatMap((v) => v.midMatch
          ? [{ courtNumber: v.court.number, state: "playing" as const, round: v.round }]
          : [])}
        onResume={() => setAtCourt(true)}
        onStartDifferentNight={() => enterSetup()}
        onOpenNightMenu={() => { setAtCourt(true); setSheet("nightMenu"); }}
      />
    );
  }

  /* ── the wizard ────────────────────────────────────────────────── */

  if (inSetup) {
    if (step === "night") {
      return (
        <WhichNight
          nights={NIGHTS}
          selected={night}
          onSelect={setNight}
          onBack={() => setInSetup(false)}
          onNext={() => { s.setDayLabel(night); setStep("who"); }}
        />
      );
    }

    if (step === "who") {
      // The roster is a CATALOGUE of people the club knows. The session is who
      // is actually here. Adding is the act that moves somebody from the first
      // into the second, which is why there is no local `ticked` map: the tick
      // state IS the session, and a screen that kept its own copy could say
      // "in tonight" about somebody the night had never heard of.
      const inNight = new Map(s.session.players.map((p) => [p.id, p]));
      const catalogued = new Set(roster.names.map((r) => r.playerId));

      const rows = [
        ...roster.names.map((r) => {
          const p = inNight.get(r.playerId);
          return {
            playerId: r.playerId,
            displayName: r.displayName,
            // `away` unticks the row, so this and the players tab's attendance
            // count are always the same number.
            ticked: p != null && !p.away,
            // The club list is the only list the app has: there is no booking
            // feed, so somebody the club knows counts as booked and a walk-in
            // does not. That keeps the row's second line true rather than
            // telling every regular they did not book.
            onBookingList: true,
            tier: p?.tier ?? null,
          };
        }),
        // Anybody in the night the catalogue does not carry: walk-ins, and a
        // resumed night whose roster row has since been hidden.
        ...s.session.players
          .filter((p) => !catalogued.has(p.id))
          .map((p) => ({
            playerId: p.id, displayName: p.name, ticked: !p.away,
            onBookingList: false, tier: p.tier ?? null,
          })),
      ].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" }) ||
        (a.playerId < b.playerId ? -1 : 1));

      // A typed name that already belongs to somebody on the roster adds that
      // person instead of minting a twin. Splitting one human across two ids
      // splits their night: half the games on one, half on the other, and a
      // standings table that adds up to nothing.
      const addTyped = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const hit = dedupeWalkIn(roster.names, trimmed);
        setTierPromptId(hit ? s.addRosterPlayer(hit) : s.addWalkIn(trimmed));
        // The query clears on add. It used to survive, a habit from the old
        // checkbox list where the leftover filter was the confirmation. In the
        // typeahead it re-drew the "Add as a walk-in" offer for a person just
        // added, and a double tap minted them twice. The confirmation now is
        // the tier strip and the count, both visible the moment the box empties.
        setQuery("");
      };

      const prompted = tierPromptId != null
        ? s.session.players.find((p) => p.id === tierPromptId)
        : undefined;

      return (
        <WhoIsHere
          rows={rows}
          rosterNote={roster.origin === "bundled"
            ? "Showing the club list saved on this device. Anyone missing, add them as a walk-in."
            : null}
          query={query}
          onQueryChange={setQuery}
          onAdd={(id) => {
            // Both branches clear the box the way addTyped does: the next name
            // is typed fresh, and the confirmation is the tier strip and the
            // count, not a leftover query.
            const p = inNight.get(id);
            // Here but marked away: the add brings them back rather than
            // putting a second copy of somebody already in the room.
            if (p) { s.setAway(id, false); setTierPromptId(id); setQuery(""); return; }
            const entry = roster.names.find((r) => r.playerId === id);
            if (entry) { setTierPromptId(s.addRosterPlayer(entry)); setQuery(""); }
          }}
          onAddWalkInNamed={addTyped}
          // A chip tapped in the cloud takes the person back out: the
          // operator asked for a way to undo a mis-add at the door. Safe in
          // setup because nothing has been dealt; on re-entry into a running
          // night, removePlayer's own guard refuses anyone the match log
          // points at, and the players tab remains the place with the wording
          // for what taking a fielded player out actually costs.
          onRemove={(id) => {
            s.removePlayer(id);
            if (tierPromptId === id) setTierPromptId(null);
          }}
          tierPrompt={prompted
            ? { playerId: prompted.id, displayName: prompted.name, tier: prompted.tier ?? null }
            : null}
          onSetTier={(playerId, tier) => { s.setTier(playerId, tier); setTierPromptId(null); }}
          onSkipTier={() => setTierPromptId(null)}
          onBack={() => setStep("night")}
          onNext={() => {
            // Adding already wrote to the session, so there is nothing left to
            // reconcile. This list is a view of the night, not a form.
            s.setCourts(Array.from({ length: courtCount }, (_, i) => i + 1));
            // The next screen opens on the suggested split, which is frame
            // A07's first sentence. Only the unplaced are moved, so walking
            // back through this step cannot undo a drag.
            applySuggestedSplit(courtCount, false);
            setStep("courts");
          }}
        />
      );
    }

    if (step === "courts") {
      const chips = (n: number) => s.session.players
        .filter((p) => p.courtNumber === n)
        .map((p) => ({ playerId: p.id, displayName: p.name, tier: p.tier ?? null }));
      const courts = Array.from({ length: courtCount }, (_, i) => ({
        courtNumber: i + 1, label: `Court ${i + 1}`, players: chips(i + 1),
      }));

      // The setup warnings, read off the split AS IT STANDS, drags included.
      // suggestSplit can only speak about its own assignment, so freezing the
      // notes it returned on the way in would keep warning about a court the
      // operator has already fixed. The same three facts are therefore derived
      // live, with the module's own constant and suggestTarget so the
      // thresholds cannot drift from engine/split.ts.
      const csIn = s.session.players.filter((p) => tierOf(p) === "C");
      const splitNotes: SplitNote[] = [];
      if (csIn.length > 0 && csIn.length < MIN_CS_FOR_A_C_MATCH) {
        splitNotes.push({ kind: "tooFewCs", cCount: csIn.length });
      }
      const cCourt = csIn.find((p) => p.courtNumber != null)?.courtNumber;
      if (csIn.length === MIN_CS_FOR_A_C_MATCH && cCourt != null) {
        splitNotes.push({ kind: "exactlyThreeCs", courtNumber: cCourt });
      }
      for (const c of courts) {
        // An empty court is not noted: the dashed card frame 27b draws in its
        // place already says nobody is on it and what to do about that.
        if (c.players.length > 0 && suggestTarget(c.players.length) === null) {
          splitNotes.push({ kind: "courtTooSmall", courtNumber: c.courtNumber, size: c.players.length });
        }
        // Stranding is created and cured by drags, so it is judged here after
        // every one of them, never frozen at suggestion time: a second B
        // dragged onto the C court, or a C left among A's, has to be named
        // NOW, because on the night the symptom is only a player whose name
        // never comes up. suggestSplit deliberately does not emit this note
        // (its comment in engine/split.ts says why), and a court below four
        // players is left to the courtTooSmall note above rather than
        // doubling one fact into two warnings.
        if (c.players.length >= 4) {
          const stuck = strandedPlayers(s.session.players, c.courtNumber);
          if (stuck.length > 0) {
            splitNotes.push({
              kind: "stranded",
              courtNumber: c.courtNumber,
              names: stuck.map((p) => p.name),
            });
          }
        }
      }

      return (
        <Courts
          courts={courts}
          notes={splitNotes}
          courtCount={courtCount}
          onCourtCountChange={(c) => {
            setCourtCount(c);
            s.setCourts(Array.from({ length: c }, (_, i) => i + 1));
            // The screen's contract: changing the count re-splits everyone,
            // because every drag so far answered a question that is no longer
            // being asked.
            applySuggestedSplit(c, true);
          }}
          onMovePlayer={(id) => {
            const p = s.session.players.find((x) => x.id === id);
            const now = p?.courtNumber ?? 0;
            s.assignCourt(id, now >= courtCount ? 1 : now + 1);
          }}
          // The empty court card's action. Only the unplaced move, so it can
          // never undo a drag; the suggestion decides where they land.
          onAssignPlayers={() => applySuggestedSplit(courtCount, false)}
          onBack={() => setStep("who")}
          onNext={() => setStep("target")}
        />
      );
    }

    if (step === "target") {
      // Targets are per court (frame B31): each card reads its own size off
      // the split and holds its own answer, seeded by applySuggestedSplit on
      // the way into the previous step.
      return (
        <MatchesEach
          courts={s.session.courts.map((c) => ({
            courtNumber: c.number,
            label: `Court ${c.number}`,
            size: s.session.players.filter((p) => p.courtNumber === c.number && !p.away).length,
            selected: c.targetMatches,
          }))}
          minutesPerMatch={MINUTES_PER_MATCH}
          onSelect={(courtNumber, t) => s.setTarget(courtNumber, t)}
          onBack={() => setStep("courts")}
          onNext={() => setStep("ready")}
        />
      );
    }

    const setupCourts = s.session.courts.map((c) => ({
      size: s.session.players.filter((p) => p.courtNumber === c.number && !p.away).length,
      target: c.targetMatches,
    }));
    return (
      <Ready
        dayName={night}
        playersIn={s.session.players.length}
        courtSizes={setupCourts.map((c) => c.size)}
        matchTargets={setupCourts.map((c) => c.target)}
        matchesInTotal={setupCourts.reduce(
          (sum, c) => sum + (validTargets(c.size).includes(c.target) ? totalMatches(c.size, c.target) : 0), 0)}
        pointsForAWin={POINTS_PER_WIN}
        onBack={() => setStep("target")}
        onStart={() => {
          s.start();
          s.session.courts.forEach((c) => s.ensureOnCourt(c.number));
          setInSetup(false);
          setAtCourt(true);
        }}
      />
    );
  }

  /* ── the night ─────────────────────────────────────────────────── */

  if (!view) return <div style={{ background: T.bg, minHeight: "100dvh" }} />;

  const courtNumber = view.court.number;
  const other = s.views.filter((v) => v.court.number !== courtNumber);
  const name = s.playerName;
  const pairOf = (ids: readonly string[]) => joinPair(ids.map(name));
  const tuple = (ids: readonly string[]) => [name(ids[0]), name(ids[1])] as [string, string];
  const live = view.onCourt;

  const stages = view.stages;

  /**
   * The number frame 16's eyebrow puts after "Round".
   *
   * A GROUP result names the round its four were playing. The view carries the
   * court's CURRENT round, and frame 16 opens on a result from earlier in the
   * evening, so this one is counted from the games those four had at the time.
   *
   * A BRACKET row belongs to no round at all, and its matchIndex is filed above
   * every group slot so that a tie can never land in one, which had the final
   * of an eight-game card reading "Round 11". The frame writes no wording for
   * a playoff correction, so the least wrong number is the row's place in the
   * bracket: the final of a full bracket is the third game of it.
   */
  const roundOfResult = (m: Match): number => {
    if (m.stage !== null) {
      const at = stages?.flatMap((st) => st.ties).findIndex((t) => t.matchId === m.id) ?? -1;
      return at >= 0 ? at + 1 : m.matchIndex;
    }
    const upTo = s.session.matches.filter((x) =>
      x.courtNumber === m.courtNumber && x.stage === null
      && x.status === "played" && x.matchIndex <= m.matchIndex);
    return Math.min(...[...m.teamA, ...m.teamB].map((id) =>
      upTo.filter((x) => x.teamA.includes(id) || x.teamB.includes(id)).length));
  };

  /**
   * The header chip row, for every court.
   *
   * `scoreDue` on the view means "a match is on court with no number against
   * it". The dot only rides the chip of a court the operator is NOT standing
   * at, because they can only score the court under their thumb: at Court 1
   * that state is a game in progress, at Court 2 it is a number nobody has
   * given you. Those are frame 13's two sentences.
   */
  const courtChips = s.views.map((v) => ({
    number: v.court.number,
    scoreDue: v.scoreDue && v.court.number !== courtNumber,
  }));

  /* ── the summary and the confirmations, night-wide ─────────────── */

  const summaryProps = {
    dayLabel: s.session.dayLabel || night,
    playersIn: s.session.players.length,
    instanceLabel,
    champions: s.views.flatMap<SummaryChampion>((v) => {
      // A court that ran a bracket is named by its winning side and the final's
      // numbers; a court that took the other ending is named by one person and
      // their points. engine/endings.ts decides the second, not this file.
      if (v.champion) {
        const last = s.session.matches.find(
          (m) => m.courtNumber === v.court.number && m.stage === "final" && m.status === "played");
        return [{
          courtNumber: v.court.number,
          players: v.champion.map(name),
          finalScore: last
            ? ([Math.max(last.scoreA ?? 0, last.scoreB ?? 0),
                Math.min(last.scoreA ?? 0, last.scoreB ?? 0)] as [number, number])
            : null,
        }];
      }
      if (endingFor(endings, v.court.number) !== "oneMoreRound" || !v.complete) return [];
      const top = individualChampion(v.standings);
      return top
        ? [{ courtNumber: v.court.number, players: [name(top.playerId)], points: top.points }]
        : [];
    }),
    standingsByCourt: s.views.map((v) => ({
      courtNumber: v.court.number,
      rows: v.standings.map((r) => ({
        rank: r.rank, playerName: name(r.playerId),
        points: r.points, diff: r.scoreDiff,
        // Same guard as the standings table. The summary is readable all night,
        // so most of it is rows on zero, and the engine separates those by
        // "reachedFirst" because it is the last key left. Passed through, every
        // one of them read "(first to score)" about a game they have not played.
        separatedBy: r.matchesPlayed > 0 ? r.separatedBy : null,
      })),
    })),
  };

  const copySummary = () => void navigator.clipboard?.writeText(buildWhatsAppPayload(summaryProps));

  if (sheet === "summary") {
    return (
      <SessionSummary
        {...summaryProps}
        activeTab={ui.tab}
        onCopy={(payload) => void navigator.clipboard?.writeText(payload)}
        onEndNight={() => setSheet("endNight")}
        // The frame draws no close control, so the tab tapped is the way out.
        onTabChange={(t) => { here({ tab: t }); setSheet(null); }}
      />
    );
  }

  if (sheet === "endNight") {
    return (
      <ConfirmEndNight
        dayLabel={s.session.dayLabel || night}
        // Copying leaves the sheet open: frame 28c keeps all three actions on
        // screen, so it is a step inside the decision rather than a way out.
        onCopyFirst={copySummary}
        onEndNight={() => { s.endNight(); setSheet(null); setAtCourt(false); }}
        onKeepPlaying={() => setSheet(null)}
      />
    );
  }

  /* ── the per-court overlays ────────────────────────────────────── */

  const scoringMatch = ui.scoring != null
    ? s.session.matches.find((m) => m.id === ui.scoring.matchId)
    : undefined;
  const editing = ui.editingMatchId != null
    ? s.session.matches.find((m) => m.id === ui.editingMatchId)
    : undefined;
  const voiding = ui.voidingMatchId != null
    ? s.session.matches.find((m) => m.id === ui.voidingMatchId)
    : undefined;
  const moving = ui.movingPlayerId != null
    ? s.session.players.find((p) => p.id === ui.movingPlayerId)
    : undefined;
  const tiering = ui.tierPlayerId != null
    ? s.session.players.find((p) => p.id === ui.tierPlayerId)
    : undefined;
  const changingHeld = ui.changingMatchId != null
    ? s.session.matches.find((m) => m.id === ui.changingMatchId)
    : undefined;
  // A score arriving closes the question: a recorded number belongs to the
  // four who played it, so a match carrying one shows no change affordance at
  // all, and the sheet vanishing the moment a number lands is that refusal
  // rather than a silent one. The writer refuses the same swap, so this guard
  // is about honesty on screen, not safety.
  const changing = changingHeld != null && changingHeld.status === "onCourt"
    && changingHeld.scoreA === null && changingHeld.scoreB === null
    ? changingHeld
    : undefined;
  /** The tier a sheet row may show: only one somebody actually set. */
  const tierShown = (id: string) => s.session.players.find((p) => p.id === id)?.tier ?? null;

  /**
   * One save path for every score on the night.
   *
   * Both numbers go in and the higher one takes the points (frame 12), so
   * nothing here decides a winner. A match that already carries a score is
   * being corrected rather than recorded, which is the only branch: the same
   * sheet serves a group match, a playoff row and a correction.
   */
  const saveScore = (matchId: string, scoreA: number, scoreB: number) => {
    const m = s.session.matches.find((x) => x.id === matchId);
    if (!m) return;
    // The writer refuses a draw, so closing the sheet here would look like a
    // save while nothing was saved. The sheet stays up with both numbers still
    // showing, which is the only honest thing a screen can do with a refusal
    // the frames draw no wording for.
    if (scoreA === scoreB) return;
    if (m.status === "played") s.correctScore(matchId, scoreA, scoreB);
    else s.recordScore(matchId, scoreA, scoreB);
    here({
      scoring: null,
      pagerSlot: null,
      // A scored bracket row goes back to the court's default view, which is
      // the bracket until the final lands and the champion once it has. Left
      // pinned to "bracket" the celebration never appeared: the operator would
      // score the final and be shown a table of completed rows.
      pane: m.stage !== null ? "match" : ui.pane,
    });
  };

  const headerProps = {
    courts: courtChips,
    activeCourtNumber: courtNumber,
    onOpenNightMenu: () => setSheet("nightMenu"),
  };

  /**
   * The court chip row for the screens that do not build their own header.
   * Every playoff-phase screen takes it as a slot, because a walk of the live
   * app found the operator trapped on a finished bracket: no tabs, no menu, no
   * way to the other court or to ending the night.
   */
  const courtHeader = <CourtHeader {...headerProps} onSelectCourt={setCourt} />;

  /**
   * The sheets. Rendered under every screen below, because frame 25b is one
   * tap from all of them and a correction can be opened from two places.
   */
  const overlays = (
    <>
      {sheet === "nightMenu" && (
        <NightMenu
          dayLabel={s.session.dayLabel || night}
          onSessionSummary={() => setSheet("summary")}
          onOneMoreRound={() => setSheet("extend")}
          onRestartSetup={() => setSheet("restartSetup")}
          // Start over clears every game and bracket, so every screen the
          // operator was on is about a night that no longer exists. The ending
          // each court had chosen goes with them.
          // startOverSession clears each court's stored ending itself.
          onStartOver={() => { s.startOver(); setSheet(null); setUiByCourt({}); }}
          onEndNight={() => setSheet("endNight")}
          onDeleteBracket={view.court.playoffSeeded
            ? () => setSheet("deleteBracket")
            : undefined}
          onResetEverything={() => setSheet("resetEverything")}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "restartSetup" && (() => {
        // Counted at render, not at tap, so the number on the sheet is the
        // number the button will actually delete even if a score lands on
        // the other court while the sheet is open.
        const results = recordedResultCount(s.session);
        return (
          <Sheet tone="danger" onDismiss={() => setSheet(null)}>
            <p style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 18, margin: 0 }}>
              Restart setup?
            </p>
            {/* Frame 26's guidance: every destructive action names exactly
                what will be lost. Here that is a count of results, and zero
                is said as zero rather than dressed up as a risk. */}
            <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0 }}>
              {results === 0
                ? "Tonight's roster stays, and no result has been recorded yet, so there is nothing to lose. "
                : results === 1
                  ? "Tonight's roster stays. One recorded result will be deleted, and nothing brings it back. "
                  : `Tonight's roster stays. ${results} recorded results will be deleted, and nothing brings them back. `}
              The wizard reopens at the courts step, every court and target as it was.
            </p>
            <SecondaryButton onClick={() => setSheet(null)}>Keep playing</SecondaryButton>
            <DangerButton onClick={() => {
              s.restartSetup();
              setSheet(null);
              // Every screen the operator was on is about matches that no
              // longer exist, so the per-court memory goes with them.
              setUiByCourt({});
              // Same guard as enterSetup: courtCount is local state that
              // starts at 2, and landing a three court night on the courts
              // step without it would quietly drop court 3.
              if (s.session.courts.length > 0) setCourtCount(s.session.courts.length);
              setInSetup(true);
              setStep("courts");
              setAtCourt(false);
            }}>
              Restart setup
            </DangerButton>
          </Sheet>
        );
      })()}

      {sheet === "resetEverything" && (
        <Sheet tone="danger" onDismiss={() => setSheet(null)}>
          <p style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 18, margin: 0 }}>
            Reset everything?
          </p>
          {/* Frame 26's guidance: every destructive action names exactly what
              will be lost. This one loses the most, so it says so plainly. */}
          <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0 }}>
            Every player, their tiers, every game and every bracket in this
            manager. The app goes back to a blank start. Nothing can bring it back.
          </p>
          <SecondaryButton onClick={() => setSheet(null)}>Keep the night</SecondaryButton>
          <DangerButton onClick={() => {
            s.resetEverything();
            setSheet(null);
            setUiByCourt({});
            setInSetup(false);
            setAtCourt(false);
          }}>
            Reset everything
          </DangerButton>
        </Sheet>
      )}
      {sheet === "deleteBracket" && (
        <ConfirmDeletePlayoff
          courtNumber={courtNumber}
          otherCourtNumber={other[0]?.court.number ?? null}
          onDelete={() => { s.deletePlayoff(courtNumber); setSheet(null); here({ pane: "match" }); }}
          onKeep={() => setSheet(null)}
        />
      )}
      {sheet === "extend" && (
        <Extend
          courtLabel={`Court ${courtNumber}`}
          targetNow={view.court.targetMatches}
          otherCourtLabels={other.map((v) => `Court ${v.court.number}`)}
          minutesPerRound={MINUTES_PER_MATCH}
          onAddRound={() => { s.extend(courtNumber, 1); setSheet(null); }}
          onDismiss={() => setSheet(null)}
        />
      )}

      {sheet === "courtSwitcher" && (
        <CourtSwitcher
          courts={s.views.map((v) => ({
            number: v.court.number,
            // A court with nobody on it gets no status line, which is what
            // frame 13 draws for it.
            activity: v.midMatch
              ? (v.court.number === courtNumber
                ? { kind: "midMatch" as const, round: v.round }
                : { kind: "scoreDue" as const, round: v.round })
              : undefined,
          }))}
          activeCourtNumber={courtNumber}
          onSelectCourt={(n) => { setCourt(n); setSheet(null); }}
          onDismiss={() => setSheet(null)}
        />
      )}

      {sheet === "lateArrival" && (
        <LateArrival
          name={lateName}
          onNameChange={setLateName}
          tier={lateTier}
          onSelectTier={setLateTier}
          courts={s.views.map((v) => ({
            courtNumber: v.court.number, label: `Court ${v.court.number}`,
            playingCount: v.players.filter((p) => !p.away).length,
          }))}
          selectedCourtNumber={lateCourt}
          onSelectCourt={setLateCourt}
          // The target only moves when the court's new size stops dividing at
          // the one it is running. engine/rotation.ts owns which targets divide,
          // so the answer is read off validTargets rather than worked out here.
          targetAfter={(() => {
            const to = s.views.find((v) => v.court.number === lateCourt);
            if (!to) return null;
            const size = to.players.filter((p) => !p.away).length + 1;
            if (validTargets(size).includes(to.court.targetMatches)) return null;
            return validTargets(size)[0] ?? null;
          })()}
          onCancel={() => { setSheet(null); setLateName(""); setLateTier(null); }}
          onAdd={() => {
            const typed = lateName.trim();
            if (typed) {
              const hit = dedupeWalkIn(roster.names, typed);
              const id = hit ? s.addRosterPlayer(hit) : s.addWalkIn(typed);
              // The sheet asks which court, so the answer has to be applied.
              // buildQueue only considers players whose courtNumber matches, so
              // without this a late arrival landed in no queue at all while the
              // sheet promised they were in the next match.
              if (lateCourt != null) s.assignCourt(id, lateCourt);
              if (lateTier != null) s.setTier(id, lateTier);
            }
            setSheet(null); setLateName(""); setLateTier(null);
          }}
        />
      )}

      {moving && moveTo != null && (
        <MoveCourts
          playerName={moving.name}
          fromCourtNumber={moving.courtNumber ?? courtNumber}
          courts={s.views.map((v) => ({
            courtNumber: v.court.number,
            label: `Court ${v.court.number}`,
            // Frame B28's chips show the room AFTER the move: every court's
            // count as it would stand once the mover lands on the selected
            // one. A mover already marked away moves without changing either
            // count, because they were not in either court's headcount.
            countAfterMove: v.players.filter((p) => !p.away && p.id !== moving.id).length
              + (v.court.number === moveTo && !moving.away ? 1 : 0),
          }))}
          selectedCourtNumber={moveTo}
          onSelectCourt={setMoveTo}
          onMove={() => {
            // assignCourt moves the person and nothing else. Matches reference
            // ids, so everything already played stays on the old court's
            // table, which is the honesty frame B28 promises out loud.
            s.assignCourt(moving.id, moveTo);
            here({ movingPlayerId: null, openPlayerId: null });
          }}
          onKeep={() => here({ movingPlayerId: null })}
        />
      )}

      {tiering && (
        <SetTierSheet
          playerName={tiering.name}
          draft={tierDraft}
          onSelect={setTierDraft}
          onSave={() => {
            s.setTier(tiering.id, tierDraft);
            here({ tierPlayerId: null });
          }}
          onCancel={() => here({ tierPlayerId: null })}
        />
      )}

      {ui.leavingPlayerId != null && (
        <LeavesEarly
          playerName={name(ui.leavingPlayerId)}
          playersStillHere={view.players.filter(
            (p) => !p.away && p.id !== ui.leavingPlayerId).length}
          onMarkLeft={() => {
            s.setAway(ui.leavingPlayerId, true);
            here({ leavingPlayerId: null, openPlayerId: null });
          }}
          onKeep={() => here({ leavingPlayerId: null })}
        />
      )}

      {editing && (
        <CorrectOrVoid
          match={{
            id: editing.id,
            roundNumber: roundOfResult(editing),
            courtLabel: `Court ${editing.courtNumber}`,
            sideA: tuple(editing.teamA), sideB: tuple(editing.teamB),
            scoreA: editing.scoreA ?? 0, scoreB: editing.scoreB ?? 0,
          }}
          onChangeScore={() => here({
            editingMatchId: null,
            scoring: { matchId: editing.id, side: "A",
              a: startValue(editing.scoreA), b: startValue(editing.scoreB) },
          })}
          onVoid={() => here({ editingMatchId: null, voidingMatchId: editing.id })}
          onDismiss={() => here({ editingMatchId: null })}
        />
      )}

      {voiding && (
        <ConfirmVoidResult
          courtNumber={voiding.courtNumber}
          pairA={tuple(voiding.teamA)} scoreA={voiding.scoreA ?? 0}
          pairB={tuple(voiding.teamB)} scoreB={voiding.scoreB ?? 0}
          onVoid={() => { s.voidMatch(voiding.id); here({ voidingMatchId: null }); }}
          onKeep={() => here({ voidingMatchId: null })}
        />
      )}

      {changing && (
        <ChangeMatchSheet
          seats={[...changing.teamA, ...changing.teamB].map((id) => ({
            id, name: name(id), tier: tierShown(id),
          }))}
          out={ui.changeOutId != null ? { id: ui.changeOutId, name: name(ui.changeOutId) } : null}
          // engine/substitutes.ts judges the exact lineup each swap would
          // create, under the same context the match was dealt in. Nothing
          // about who is legal is decided in this file.
          substitutes={ui.changeOutId != null
            ? legalSubstitutes(
              changing, ui.changeOutId, s.session.players,
              lawContextFor(s.session.players, changing.courtNumber),
            ).map((p) => ({ id: p.id, name: p.name, tier: p.tier ?? null }))
            : []}
          onPickOut={(id) => here({ changeOutId: id })}
          onPickIn={(id) => {
            // The guard repeats the render condition rather than asserting,
            // because a stale tap on a sheet mid-dismiss must change nothing.
            if (ui.changeOutId != null) s.swapInLiveMatch(changing.courtNumber, ui.changeOutId, id);
            here({ changingMatchId: null, changeOutId: null });
          }}
          onRedraw={() => {
            s.redrawLiveMatch(changing.courtNumber);
            here({ changingMatchId: null, changeOutId: null });
          }}
          onBack={() => here({ changeOutId: null })}
          onClose={() => here({ changingMatchId: null, changeOutId: null })}
        />
      )}
    </>
  );

  /** Score entry is a screen of its own, with the chip row still live. */
  if (scoringMatch) {
    return (
      <>
        <ScoreEntry
          {...headerProps}
          onSelectCourt={setCourt}
          pairA={pairOf(scoringMatch.teamA)}
          pairB={pairOf(scoringMatch.teamB)}
          side={ui.scoring.side}
          a={ui.scoring.a}
          b={ui.scoring.b}
          onEntry={(next) => here({ scoring: { matchId: scoringMatch.id, ...next } })}
          onSave={(a, b) => saveScore(scoringMatch.id, a, b)}
          onDismiss={() => here({ scoring: null })}
        />
        {overlays}
      </>
    );
  }

  /* ── the players tab ──────────────────────────────────────────── */

  if (ui.tab === "players") {
    const order = new Map(s.session.players.map((p, i) => [p.id, i]));
    const onCourtNow = live ? [...live.teamA, ...live.teamB] : [];
    return (
      <>
        <PlayersTab
          courtLabel={`Court ${courtNumber}`}
          players={view.players
            .map((p) => ({
              id: p.id,
              displayName: p.name,
              gamesPlayed: s.matchesPlayedBy(p.id),
              tier: p.tier,
              status: p.away ? ("left" as const)
                : onCourtNow.includes(p.id) ? ("on_court" as const)
                  : ("here" as const),
            }))
            // Whoever is owed a game sits at the top. Arrival order breaks the
            // tie so rows never jump when a score lands.
            .sort((a, b) => a.gamesPlayed - b.gamesPlayed
              || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))}
          attendanceCount={view.players.filter((p) => !p.away).length}
          openPlayerId={ui.openPlayerId}
          onOpenPlayer={(id) => here({ openPlayerId: id })}
          onMarkArrived={(id) => s.setAway(id, false)}
          // Frame 16c is where the consequence is explained and the decision is
          // actually taken, so this opens it rather than marking anyone away.
          onMarkLeft={(id) => here({ leavingPlayerId: id })}
          onMarkHere={(id) => s.setAway(id, false)}
          // Frame B28. On a one-court night there is nowhere to move anybody,
          // so the ghost is not offered at all. The sheet opens with the first
          // other court already chosen, because its title and its button both
          // name a destination.
          onMoveCourts={other.length > 0 ? (id) => {
            const from = s.session.players.find((x) => x.id === id)?.courtNumber;
            setMoveTo(s.views.map((v) => v.court.number).find((n) => n !== from) ?? courtNumber);
            here({ movingPlayerId: id });
          } : undefined}
          // Frame B29. The sheet opens on the assessment as it stands, and
          // only Save writes anything back.
          onSetTier={(id) => {
            setTierDraft(s.session.players.find((x) => x.id === id)?.tier ?? null);
            here({ tierPlayerId: id });
          }}
          onAddPlayer={() => {
            setLateName(""); setLateTier(null); setLateCourt(courtNumber); setSheet("lateArrival");
          }}
          onChangeTab={(t) => here({ tab: t })}
        />
        {overlays}
      </>
    );
  }

  /* ── the standings tab ────────────────────────────────────────── */

  if (ui.tab === "standings") {
    /**
     * The clock time a row reached its final total, for frames 17 and 18.
     *
     * row.reachedAt is a RECORDED-ORDER index: standings renumber the played
     * rows by completedAt, because the card can be played out of order and the
     * third tie-break is explicitly the order results were recorded. Looking
     * it up against matchIndex, a card SLOT number, printed the completion
     * time of whatever happened to sit in that slot.
     */
    const playedInRecordedOrder = s.session.matches
      .filter((m) => m.courtNumber === courtNumber && m.stage === null && m.status === "played")
      .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
    const reachedAt = (row: StandingsRow | undefined) =>
      clockTime(row ? playedInRecordedOrder[row.reachedAt - 1]?.completedAt : undefined);

    /**
     * Why this row sits where it does.
     *
     * `separatedBy` describes the gap to the row BELOW, so a row is "first to
     * this score" from its own value and "reached it later" from the value on
     * the row above it. Reading it in one direction only was what made the
     * table explain the wrong half of a tie.
     */
    const rowsIn = view.standings;
    // A row nobody has played yet explains nothing. Early in the night most of
    // the table is level on zero, and the engine separates those rows by
    // "reachedFirst" because that is the last key standing; read straight
    // through, every one of them printed "First to this score" against a blank
    // clock. Two wrong claims in one line: they did not get anywhere first, and
    // there is no time at which they did it.
    const explainable = (i: number) => rowsIn[i] != null && rowsIn[i].matchesPlayed > 0;
    const reasonFor = (i: number): StandingsTabRow["reason"] => {
      if (!explainable(i)) return null;
      const at = reachedAt(rowsIn[i]);
      if (at && rowsIn[i].separatedBy === "reachedFirst") {
        return { kind: "firstToThisScore", atClockTime: at };
      }
      if (at && rowsIn[i - 1]?.separatedBy === "reachedFirst") {
        return { kind: "reachedItLater", atClockTime: at };
      }
      if (rowsIn[i - 1]?.separatedBy === "diff") return { kind: "behindOnDiff" };
      return null;
    };
    const tiedWith = (i: number): string | null => {
      if (!explainable(i)) return null;
      if (rowsIn[i].separatedBy === "reachedFirst") return rowsIn[i + 1]?.playerId ?? null;
      if (rowsIn[i - 1]?.separatedBy === "reachedFirst") return rowsIn[i - 1].playerId;
      return null;
    };

    const rows: StandingsTabRow[] = rowsIn.map((r, i) => ({
      position: r.rank, playerId: r.playerId, displayName: name(r.playerId),
      matchesPlayed: r.matchesPlayed, wins: r.wins, losses: r.losses,
      pointDifference: r.scoreDiff, points: r.points,
      reason: reasonFor(i), tiedWithPlayerId: tiedWith(i),
    }));

    // Frame 18 explains one pair of rows, and it is always the pair an order
    // break separated. Whichever of the two was tapped, the higher of them
    // opens the sheet.
    const tapped = ui.tiePlayerId != null
      ? rowsIn.findIndex((r) => r.playerId === ui.tiePlayerId)
      : -1;
    const top = tapped < 0 ? -1
      : rowsIn[tapped].separatedBy === "reachedFirst" ? tapped : tapped - 1;

    // Only a pair an order break actually separated, which is the pair whose
    // reason line was drawn. Anything else has no times to put on the rows.
    if (top >= 0 && rows[top]?.reason != null && rows[top + 1]) {
      return (
        <>
          <TieBrokenByOrder
            courtLabel={`Court ${courtNumber}`}
            higher={{
              displayName: rows[top].displayName, position: rows[top].position,
              points: rows[top].points, winRecordedAtLabel: reachedAt(rowsIn[top]),
            }}
            lower={{
              displayName: rows[top + 1].displayName, position: rows[top + 1].position,
              points: rows[top + 1].points, winRecordedAtLabel: reachedAt(rowsIn[top + 1]),
            }}
            pointDifference={rows[top].pointDifference}
            onSelectTab={(t) => here({ tab: t, tiePlayerId: null })}
          />
          {overlays}
        </>
      );
    }

    const played = rowsIn.map((r) => r.matchesPlayed);
    return (
      <>
        <StandingsTab
          courtLabel={`Court ${courtNumber}`}
          tableFinal={view.complete}
          rows={rows}
          // "Everyone played three" is only true when they did. The frames draw
          // no wording for a court whose counts differ, so the sentence drops.
          matchesEach={played.length > 0 && played.every((n) => n === played[0]) ? played[0] : null}
          loading={s.loading}
          onOpenSessionSummary={() => setSheet("summary")}
          onSelectTab={(t) => here({ tab: t })}
          onOpenTie={(row) => here({ tiePlayerId: row.playerId })}
        />
        {overlays}
      </>
    );
  }

  /* ── the match tab: the two side trips ────────────────────────── */

  if (ui.pane === "why" && live) {
    return (
      <>
        <BalanceRule
          round={view.round}
          courtNumber={courtNumber}
          // engine/rotation.ts decided who is on and why. This reads its answer
          // back for the four already on court; nothing is worked out here.
          reason={explainMatch(
            s.session.players, s.session.matches, courtNumber, live.teamA, live.teamB)}
          onDismiss={() => here({ pane: "match" })}
        />
        {overlays}
      </>
    );
  }

  if (ui.pane === "schedule") {
    return (
      <>
        <Schedule
          courtLabel={`Court ${courtNumber}`}
          // The card is drawn up front by useSession, rows and statuses both,
          // so this only renames the fields. `rowId` is the tap target because
          // a row nobody has reached has no match to name yet.
          rows={view.schedule.map((slot) => ({
            matchId: slot.rowId,
            number: slot.slot,
            pairA: slot.teamA ? pairOf(slot.teamA) : "",
            pairB: slot.teamB ? pairOf(slot.teamB) : "",
            scoreA: slot.scoreA, scoreB: slot.scoreB,
            status: slot.status,
          }))}
          onSelectMatch={(rowId) => {
            const slot = view.schedule.find((r) => r.rowId === rowId);
            if (!slot) return;
            // A played row is history: frame 16 opens on it instead of moving
            // the court, and voiding the result is the way back onto it.
            if (slot.status === "played" && slot.matchId) {
              here({ editingMatchId: slot.matchId });
              return;
            }
            // The LIVE row opens the change sheet: swap one seat or redraw
            // the four. FLAG: an invented entry, no frame draws one, and it
            // is spent on this row because tapping it used to do nothing but
            // leave the list (goToMatch refuses a live slot). Only while no
            // score is in, because a recorded number belongs to the four who
            // played it, so a scored match shows no change affordance at all.
            if (slot.status === "live" && slot.matchId
              && slot.scoreA == null && slot.scoreB == null) {
              here({ changingMatchId: slot.matchId, changeOutId: null });
              return;
            }
            // Anything else jumps the court to that row. Whatever was on court
            // is parked as skipped and waits to be returned to.
            s.goToMatch(courtNumber, slot.slot);
            here({ pane: "match" });
          }}
          activeTab={ui.tab}
          onTabChange={(t) => here({ tab: t, pane: "match" })}
        />
        {overlays}
      </>
    );
  }

  /* ── the playoff, once this court has one ─────────────────────── */

  const livePlayoff = s.session.matches.find(
    (m) => m.courtNumber === courtNumber && m.stage !== null && m.status === "onCourt") ?? null;
  const tieOf = (matchId: string | null) =>
    stages?.flatMap((st) => st.ties).find((t) => t.matchId === matchId) ?? null;
  const wordOf = (key: PlayoffStage): string =>
    stages?.find((st) => st.key === key)?.word ?? STAGE_WORD[key];

  if (view.court.playoffSeeded && stages) {
    if (ui.pane === "playoffMatch" && livePlayoff) {
      const tie = tieOf(livePlayoff.id);
      const stage = stages.find((st) => st.key === tie?.stage);
      return (
        <>
          <PlayoffMatch
            header={courtHeader}
            courtNumber={courtNumber}
            stageLabel={tie ? wordOf(tie.stage) : wordOf("final")}
            stageMatchNumber={stage && stage.ties.length > 1
              ? stage.ties.findIndex((x) => x.id === tie?.id) + 1
              : null}
            teamA={{ name: pairOf(livePlayoff.teamA), seedLabel: tie?.sideA?.seeds.join("+") ?? "" }}
            teamB={{ name: pairOf(livePlayoff.teamB), seedLabel: tie?.sideB?.seeds.join("+") ?? "" }}
            scoreA={livePlayoff.scoreA}
            scoreB={livePlayoff.scoreB}
            onScoreSide={(side) => here({ scoring: { matchId: livePlayoff.id, side, a: "", b: "" } })}
            onSelectTab={(t) => here({ tab: t })}
            // This frame has no chip row, so the sheet is the way across. On a
            // one-court night there is nowhere to go and the chip is a label.
            onOpenCourtSwitcher={other.length > 0 ? () => setSheet("courtSwitcher") : undefined}
          />
          {overlays}
        </>
      );
    }

    // The celebration is where the match tab lands once the final is in, and
    // "Back to bracket" is what leaves it, so the bracket is the exception
    // rather than the default here.
    if (ui.pane !== "bracket" && view.champion) {
      const final = s.session.matches.find(
        (m) => m.courtNumber === courtNumber && m.stage === "final" && m.status === "played");
      const losing = final && (final.scoreA ?? 0) > (final.scoreB ?? 0) ? final.teamB : final?.teamA;
      return (
        <>
          <Champion
            header={courtHeader}
            courtNumber={courtNumber}
            championNames={view.champion.map(name)}
            scoreWinner={Math.max(final?.scoreA ?? 0, final?.scoreB ?? 0)}
            scoreLoser={Math.min(final?.scoreA ?? 0, final?.scoreB ?? 0)}
            runnerUpTeamName={losing ? pairOf(losing) : ""}
            onCopyForWhatsApp={copySummary}
            onBackToBracket={() => here({ pane: "bracket" })}
          />
          {overlays}
        </>
      );
    }

    const liveTie = tieOf(livePlayoff?.id ?? null);
    return (
      <>
        <Bracket
            header={courtHeader}
          courtNumber={courtNumber}
          stages={stages.map((st, stageIndex) => ({
            name: st.label,
            matches: st.ties.map((t) => {
              // What fills an unresolved side. Exactly one feed is provable
              // without restating engine/playoff.ts here: a final takes
              // semifinal 1 on side A and semifinal 2 on side B, in that order.
              // Every other feed depends on the crossing the engine applies to
              // the field, so those rows name the stage and no position rather
              // than printing a row number that could be the wrong one.
              const feeder = stages[stageIndex - 1];
              const waits = (which: "A" | "B") => feeder == null ? null : {
                stageLabel: feeder.word,
                position: st.key === "final" && feeder.key === "semi"
                  ? (which === "A" ? 1 : 2)
                  : null,
              };
              const side = (which: "A" | "B") => {
                const seeded = which === "A" ? t.sideA : t.sideB;
                return {
                  // Seeds come off the same object as the names, so a row can
                  // never show one pair's names beside another pair's seeds.
                  team: seeded
                    ? { name: pairOf(seeded.playerIds), seedLabel: seeded.seeds.join("+"),
                        trio: isTrio(seeded) }
                    : null,
                  waitsFor: seeded ? null : waits(which),
                };
              };
              return {
                // The tie's own id, not its position. Positions renumber when a
                // stage changes shape; the row has to keep its identity so a
                // score lands on the row that showed it.
                matchId: t.id,
                sideA: side("A"),
                sideB: side("B"),
                scoreA: t.scoreA, scoreB: t.scoreB,
                status: t.settled ? ("complete" as const)
                  : t.live ? ("live" as const)
                    : t.sideA && t.sideB ? ("next" as const)
                      : ("pending" as const),
                winnerSide: t.settled && t.scoreA != null && t.scoreB != null
                  ? (t.scoreA > t.scoreB ? ("A" as const) : ("B" as const)) : null,
              };
            }),
          }))}
          matchOnCourtId={liveTie?.id ?? null}
          liveStageName={liveTie ? wordOf(liveTie.stage) : undefined}
          loading={s.loading}
          onOpenMatch={() => here({ pane: "playoffMatch" })}
          onOpenResult={(id) => {
            const t = stages.flatMap((st) => st.ties).find((x) => x.id === id);
            if (t?.matchId) here({ editingMatchId: t.matchId });
          }}
          onScoreMatchOnCourt={() => here({ pane: "playoffMatch" })}
          onSelectTab={(t) => here({ tab: t })}
        />
        {overlays}
      </>
    );
  }

  /* ── how this court ends, and the ending that is not a bracket ── */

  if (!live) {
    const ending = endingFor(endings, courtNumber);
    const size = view.players.filter((p) => !p.away).length;

    if (view.complete && ending === "undecided"
      && mayChooseEnding(s.session.players, s.session.matches, courtNumber, view.court.targetMatches).mayChoose) {
      // Named once so the card and the choice handler read the SAME answer:
      // the card saying "two more each" while the handler extended by one is
      // exactly the kind of drift a second call invites.
      const oneMore = oneMoreRoundChange(size, view.court.targetMatches);
      return (
        <>
          <HowThisCourtEnds
            header={courtHeader}
            courtNumber={courtNumber}
            playersOnCourt={size}
            // The real shape for THIS headcount, from the same engine that
            // will build the bracket, so the card cannot promise eight-player
            // maths to a court of ten.
            bracketShape={(() => {
              const pairs = seedPairs(view.players.filter((pl) => !pl.away).map((pl) => pl.id)) ?? [];
              const stages = buildStages(pairs, []);
              // The engine names the first stage from its shape, so the card
              // reads the name off the stage rather than re-deriving the rule.
              const first = stages.find((st) => st.key === "playIn");
              const quarterfinals = first?.word === "Quarterfinal";
              return {
                pairs: pairs.length,
                matches: stages.reduce((sum, st) => sum + st.ties.length, 0),
                quarterfinals,
                playIns: quarterfinals ? 0 : first?.ties.length ?? 0,
                hasTrio: pairs.some(isTrio),
              };
            })()}
            // engine/endings.ts already carries the smallest add that divides
            // this court into fours and the target that raise reaches. Ten a
            // side is the case that bites: two more each, not one.
            oneMoreRound={oneMore}
            otherCourt={(() => {
              const o = other[0];
              if (!o) return null;
              const chosen = endingFor(endings, o.court.number);
              return chosen === "undecided" ? null : { courtNumber: o.court.number, ending: chosen };
            })()}
            onChooseDoublesBracket={() => s.setEnding(courtNumber, "doublesBracket")}
            // The whole ending is one number, and the number is the engine's:
            // the smallest add that keeps the schedule whole. Hardcoding 1
            // here is the bug this replaces, a court of ten promised "one
            // more" that its card could not deal.
            onChooseOneMoreRound={() => {
              s.setEnding(courtNumber, "oneMoreRound");
              s.extend(courtNumber, oneMore.addEach);
            }}
          />
          {overlays}
        </>
      );
    }

    if (view.complete && ending === "oneMoreRound") {
      const top = individualChampion(view.standings);
      if (top) {
        return (
          <>
            <IndividualChampion
            header={courtHeader}
              courtNumber={courtNumber}
              championName={name(top.playerId)}
              points={top.points}
              matchesPlayed={top.matchesPlayed}
              wonEveryMatch={top.wonEveryMatch}
              second={top.second ? { displayName: name(top.second.playerId), points: top.second.points } : null}
              third={top.third ? { displayName: name(top.third.playerId), points: top.third.points } : null}
              secondFromThird={top.secondFromThird}
              onCopyForWhatsApp={copySummary}
              onBackToStandings={() => here({ tab: "standings" })}
            />
            {overlays}
          </>
        );
      }
    }

    // Either the bracket has been chosen and is waiting to be seeded, or the
    // card has no row left that four people can stand on. PlayoffReadiness
    // covers both: the second is its "undrawn" hold, drawn as a spent button
    // and no card, because no frame writes words for it.
    const playable = view.schedule.some((r) => r.status !== "played" && r.teamA != null);
    if (view.complete || !playable) {
      return (
        <>
          <PlayoffReadiness
            header={courtHeader}
            courtNumber={courtNumber}
            // Frame 20a's card exists for exactly one blocker the operator can
            // act on: a match is on court and its score is not in. Everything
            // else that holds seeding has no drawn wording, so it stays the
            // spent-button hold.
            blocker={view.ready.ready ? null
              : live
                ? { kind: "outstandingScore", round: view.round,
                    teamA: pairOf(live.teamA), teamB: pairOf(live.teamB) }
                : { kind: "undrawn" }}
            playersOnCourt={size}
            matchesEach={view.court.targetMatches}
            // engine/playoff.ts splits adjacent seeds. The bar lists what it
            // will do rather than a shape typed out again here.
            seedPairs={seedPairs(view.ready.eligible)?.map((p) => p.seeds) ?? []}
            loading={s.loading}
            onResolveBlocker={() => s.ensureOnCourt(courtNumber)}
            onSeedPlayoff={() => { s.seedPlayoff(courtNumber); here({ pane: "bracket" }); }}
            onSelectTab={(t) => here({ tab: t })}
          />
          {overlays}
        </>
      );
    }

    // The fill effect is putting the next row on court. Hold the frame.
    return <div style={{ background: T.bg, minHeight: "100dvh" }} />;
  }

  /* ── the court, and the pager's coordinates ───────────────────── */

  const currentSlot = view.currentSlot ?? live.matchIndex;
  const playedSlots = view.schedule
    .filter((r) => r.status === "played")
    .map((r) => r.slot)
    .sort((x, y) => x - y);
  // A stale page (rows renumbered, result voided) silently falls back to the
  // live match rather than drawing a row that no longer exists.
  const paged = ui.pagerSlot != null && ui.pagerSlot !== currentSlot
    ? view.schedule.find((r) => r.slot === ui.pagerSlot) ?? null
    : null;

  return (
    <>
      <CourtView
        {...headerProps}
        // Tapping the court you are already on opens its card (frame 12b).
        // FLAG: no frame draws an entry point for the schedule, and this is the
        // one tap on the court view that does nothing today, so it is spent on
        // the list rather than on a new control with words of its own.
        onSelectCourt={(n) => (n === courtNumber ? here({ pane: "schedule" }) : setCourt(n))}
        matchNumber={paged ? paged.slot : (view.currentSlot ?? live.matchIndex)}
        matchesTotal={view.matchesTotal}
        round={view.round}
        pagerFlag={paged ? (paged.status === "played" ? "Result" : "Projected") : undefined}
        // The arrows are a PAGER, not a move (script 2's contract): back walks
        // the recorded results in order, forward from the live match shows
        // exactly one projected row, and nothing beyond it. Skipping a game is
        // the schedule's job and the change sheet's, not the arrows'.
        onPreviousMatch={() => {
          const at = ui.pagerSlot ?? currentSlot;
          const back = playedSlots.filter((n) => n < at).pop();
          if (ui.pagerSlot != null && ui.pagerSlot > currentSlot) here({ pagerSlot: null });
          else if (back != null) here({ pagerSlot: back });
        }}
        onNextMatch={() => {
          if (ui.pagerSlot == null) {
            // One look ahead. The projection past the live match, if any.
            const ahead = view.schedule.find((r) =>
              r.slot > currentSlot && r.status !== "played" && r.teamA != null);
            if (ahead) here({ pagerSlot: ahead.slot });
            return;
          }
          if (ui.pagerSlot > currentSlot) return; // never more than one ahead
          const fwd = playedSlots.find((n) => n > ui.pagerSlot!);
          here({ pagerSlot: fwd != null && fwd < currentSlot ? fwd : null });
        }}
        sideA={paged
          ? { pairLabel: pairOf(paged.teamA ?? []), score: paged.scoreA }
          : { pairLabel: pairOf(live.teamA), score: live.scoreA }}
        sideB={paged
          ? { pairLabel: pairOf(paged.teamB ?? []), score: paged.scoreB }
          : { pairLabel: pairOf(live.teamB), score: live.scoreB }}
        waiting={view.queue.slice(0, 6).map((q) => ({ playerId: q.playerId, name: q.name }))}
        onScore={(side) => {
          if (paged) {
            // A result opens its correction; a projection is a look, not a tap.
            if (paged.status === "played" && paged.matchId) {
              here({ editingMatchId: paged.matchId, pagerSlot: null });
            }
            return;
          }
          here({ scoring: { matchId: live.id, side, a: "", b: "" } });
        }}
        onWhyThisFour={() => here({ pane: "why" })}
        activeTab={ui.tab}
        onTabChange={(t) => here({ tab: t })}
      />
      {overlays}
    </>
  );
}
