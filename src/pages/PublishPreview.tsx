// The Publish confirm screen and the held Reset, on fixtures, with no gate.
//
// Everything past the passcode needs the owner's device, so this route exists
// to exercise the two surfaces themselves: the copy, the layout at 390px, the
// venue override, and the fact that a pre-selected name is a suggestion and
// not an answer. Same idea as /club/preview, which already does this for the
// clubhouse room. Robots-blocked with the rest of /manage; linked from
// nowhere.

import { useMemo, useState } from "react";
import PublishConfirm, { ResetGuardPanel } from "@/components/manage-publish/PublishConfirm";
import { planAliases, resolveAliases, type AliasDecisions } from "@/clubhouse/publish/aliases";
import { planV4Publish, publishNotesV4, type PublishPlan } from "@/clubhouse/publish/plan";
import { resetDecision } from "@/clubhouse/publish/resetGuard";
import { defaultVenueFor } from "@/lib/clubDate";
import type { AmericanoPlayer, AmericanoPool, AmericanoSession } from "@/types/americano";
import { DEFAULT_FORMAT } from "@/lib/americano/format";

const STARTED = Date.parse("2026-08-12T23:04:00Z"); // Wednesday, 7:04pm Toronto

const person = (id: string, name: string): AmericanoPlayer => ({
  playerId: id, displayName: name, tier: "B", status: "present",
  joinedAtMatchIndex: null, catchUpUsed: false,
});

const donePool = (id: string, label: "Court 1" | "Court 2", ids: string[]): AmericanoPool => ({
  id, label, playerIds: ids, targetMatches: 4, playoffMode: "none",
  status: "complete", matches: [], matchFormat: DEFAULT_FORMAT,
  champion: { kind: "individual", playerIds: [ids[0]], title: "Court 1 Champions", at: 1 },
});

const PEOPLE = [
  person("pl-1", "Benson"),
  person("pl-2", "Timi"),      // two roster members answer to this
  person("pl-3", "Shana"),
  person("csv_old_benson", ""), // a leftover reference from an id swap
];

const SESSION: AmericanoSession = {
  id: "night-2026-08-12", date: "2026-08-12", startedAtMs: STARTED, publishedId: null,
  sessionName: "", players: PEOPLE,
  pools: [donePool("court-2", "Court 2", ["pl-1", "pl-2"]), donePool("court-1", "Court 1", ["pl-3"])],
  defaultMatchFormat: DEFAULT_FORMAT, isPractice: false, status: "active",
};

const ROSTER = [
  { playerId: "p-benson", displayName: "Benson" },
  { playerId: "p-shana", displayName: "Shana" },
  { playerId: "p-timi", displayName: "Timi" },
  { playerId: "p-timi-olaoye", displayName: "Timi Olaoye" },
];

export default function PublishPreview() {
  const [venue, setVenue] = useState(defaultVenueFor("2026-08-12") ?? "");
  const [decisions, setDecisions] = useState<AliasDecisions>({});
  const [showReset, setShowReset] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const engine = PEOPLE.filter((p) => p.status !== "not_arrived").map((p) => ({
    id: p.playerId, name: p.displayName,
    staleReference: p.playerId.startsWith("csv_"),
  }));

  const resolution = useMemo(
    () => resolveAliases({ engine, roster: ROSTER, aliases: [] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const aliasPlan = useMemo(
    () => planAliases({ resolution, decisions, roster: ROSTER, aliases: [] }),
    [resolution, decisions],
  );

  const plan: PublishPlan = useMemo(() => {
    if (aliasPlan.problems.length > 0) {
      return { ok: false, refusals: ["Some names still need an answer above."] };
    }
    return planV4Publish(SESSION, {
      venue, mapping: aliasPlan.mapping, aliasRows: aliasPlan.rows, skipped: aliasPlan.skipped,
    });
  }, [aliasPlan, venue]);

  const gate = resetDecision({
    publishId: `night-2026-08-12-${STARTED}`,
    publishedId: null,
    hasContent: true,
    peopleCount: 3,
  });

  return (
    <>
      <PublishConfirm
        when="Wednesday 12 August"
        venue={venue}
        onVenueChange={setVenue}
        questions={resolution.questions}
        decisions={decisions}
        onDecide={(id, playerId) => setDecisions((d) => ({ ...d, [id]: playerId }))}
        notes={publishNotesV4(SESSION, venue, aliasPlan.skipped)}
        plan={plan}
        busy={false}
        error={null}
        onPublish={() =>
          setLog((l) => [
            ...l,
            `payload → ${JSON.stringify("payload" in plan ? plan.payload : {})}`,
          ])
        }
        onCancel={() => setShowReset(true)}
      />

      {showReset && !gate.allowed && (
        <ResetGuardPanel
          reason={gate.reason!}
          consequence={gate.consequence!}
          overrideLabel={gate.overrideLabel!}
          onPublishInstead={() => setShowReset(false)}
          onOverride={() => setLog((l) => [...l, "override → reset would run"])}
          onCancel={() => setShowReset(false)}
        />
      )}

      {/* A read-out for the harness; invisible weight, no styling budget. */}
      <pre id="publish-preview-log" style={{ display: "none" }}>{log.join("\n")}</pre>
      <pre id="publish-preview-plan" style={{ display: "none" }}>
        {JSON.stringify({ ok: plan.ok, payload: "payload" in plan ? plan.payload : null })}
      </pre>
    </>
  );
}
