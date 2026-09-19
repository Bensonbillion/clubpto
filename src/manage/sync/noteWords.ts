// The sentences a phone reads after a merge.
//
// 2026-09-18. These lived in a closure inside a useEffect in useSession.ts,
// where nothing could read them without rendering the app, and that is how a
// knockout walkover came to be printed as "null-null": a walkover carries no
// scores by design (types.ts, Match.walkover) and the result sentence
// interpolated scoreA and scoreB regardless. Out here they are a plain
// function of the note and the names, and a test reads them word for word.

import type { Match } from "../types";
import type { MergeNote } from "./merge";

export const mergeNoteWords = (n: MergeNote, nameOf: (id: string) => string): string => {
  const pair = (ids: readonly string[]) => ids.map(nameOf).join(" & ");
  // walkover "A" means teamA went through. Said as who went through, because
  // there is no score to say, and "null-null" is not a result anyone recorded.
  const through = (m: Match) => (m.walkover === "A" ? m.teamA : m.teamB);
  const out = (m: Match) => (m.walkover === "A" ? m.teamB : m.teamA);
  switch (n.kind) {
    case "nightReplaced":
      return "Another phone restarted the night. Your last change was not kept.";
    case "resultKept": {
      const who = `${pair(n.kept.teamA)} against ${pair(n.kept.teamB)}`;
      if (n.kept.status === "voided") {
        // This phone's lost result is said as what it was. A walkover has no
        // score, and "Your score for it" about one was the last false line
        // the adversarial pass on this change found (2026-09-18). The score
        // sentence stays word for word.
        return n.dropped.walkover
          ? `Court ${n.courtNumber}: another phone voided ${who}. Your walkover for ${pair(through(n.dropped))} was not kept.`
          : `Court ${n.courtNumber}: another phone voided ${who}. Your score for it was not kept.`;
      }
      // Past the void above, `kept` is the row's recorded result: a score or a
      // walkover. It can in principle be neither, if a row ever went from
      // played back to unplayed, and then this would print "null-null"
      // again. Nothing in the app can do that today (a played game only ever
      // becomes voided; onCourt and skipped only swap with each other), so it
      // is written down rather than worded. An undo-result feature would need
      // a sentence here.
      const did = n.kept.walkover
        ? `gave ${pair(through(n.kept))} a walkover against ${pair(out(n.kept))}`
        : `scored ${who} ${n.kept.scoreA}-${n.kept.scoreB}`;
      if (n.dropped.status === "voided") return `Court ${n.courtNumber}: another phone ${did} first, so your void was not kept. Void it again from the result if that is right.`;
      const yours = n.dropped.walkover
        ? `Your walkover for ${pair(through(n.dropped))}`
        : `Your ${n.dropped.scoreA}-${n.dropped.scoreB}`;
      return `Court ${n.courtNumber}: another phone ${did} first. ${yours} was not kept; tap the result to correct it.`;
    }
    case "gameDropped":
      return `Court ${n.courtNumber}: another phone dealt the next game first. The game you dealt was set aside.`;
    case "walkInFolded":
      return `${n.name} was added on both phones and is now one player.`;
    case "leaverDealtAround":
      return `Court ${n.courtNumber}: ${nameOf(n.playerId)} left on another phone. The game they were in was dealt again without them.`;
    case "fieldKept": {
      const field = n.field === "courtNumber" ? "court" : n.field === "knockoutPairs" ? "draw"
        : n.field === "teamsTarget" ? "games per pair" : n.field === "dayLabel" ? "name"
          : n.field === "targetMatches" ? "target" : n.field;
      if (n.entity === "player") return `Another phone set ${nameOf(n.id)}'s ${field} first.`;
      if (n.entity === "court") return `Another phone set Court ${n.id}'s ${field} first.`;
      return `Another phone changed the night's ${field} first.`;
    }
    default: {
      // tsconfig.app.json runs strict:false, so without this a new MergeNote
      // kind would compile and render as "undefined" on the operator's phone.
      const unworded: never = n;
      return unworded;
    }
  }
};
