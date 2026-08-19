// The Publish flow, as one hook, so the two manager pages stay thin.
//
// The whole sequence lives here: read what is already mapped, ask about
// whoever is not, hold those answers in memory, and commit them WITH the
// night in one call. Nothing is written until onPublish, so closing the
// tablet at any point before it leaves the database exactly as it was.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isCommittable,
  planAliases,
  resolveAliases,
  type AliasDecisions,
  type AliasResolution,
  type AliasRow,
  type EngineIdentity,
  type RosterName,
} from "./aliases";
import { fetchAliases, fetchRosterAsAdmin } from "./aliasStore";
import { publishSessionOrThrow, PublishFailed, type PublishCounts } from "./publish";
import type { PlanInput, PublishPlan } from "./plan";

export interface PublishFlowConfig {
  /** Everyone the night knows about, with the narrow identity shape. */
  people: EngineIdentity[];
  /** The venue this night should default to, or "" when the weekday says nothing. */
  defaultVenue: string;
  /** Builds the payload from the confirmed mapping. planV3Publish / planV4Publish. */
  buildPlan(input: PlanInput): PublishPlan;
  /** Record the published id on the session so Reset can be released. */
  onPublished(sessionId: string, counts: PublishCounts): void;
}

export interface PublishFlowState {
  open: boolean;
  /** Engine ids the admin set aside. The notes need it too. */
  skipped: string[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  venue: string;
  decisions: AliasDecisions;
  resolution: AliasResolution;
  plan: PublishPlan;
  counts: PublishCounts | null;
  openSheet(): void;
  closeSheet(): void;
  setVenue(v: string): void;
  decide(engineId: string, playerId: string | null): void;
  publish(): Promise<void>;
}

const EMPTY_RESOLUTION: AliasResolution = { resolved: [], questions: [], staleIds: [] };

export function usePublishFlow(config: PublishFlowConfig): PublishFlowState {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [venue, setVenue] = useState(config.defaultVenue);
  const [decisions, setDecisions] = useState<AliasDecisions>({});
  const [roster, setRoster] = useState<RosterName[]>([]);
  const [aliases, setAliases] = useState<AliasRow[]>([]);
  const [counts, setCounts] = useState<PublishCounts | null>(null);

  // Read on open, not on mount: a tablet sitting on the Courts tab all night
  // should not be holding a roster snapshot from three hours ago.
  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoading(true);
    setError(null);
    Promise.all([fetchRosterAsAdmin(), fetchAliases()])
      .then(([r, a]) => {
        if (!live) return;
        setRoster(r);
        setAliases(a);
      })
      .catch((e: unknown) => {
        if (!live) return;
        // Failing closed matters here: an empty alias list would re-ask about
        // every name and the second answer would overwrite the first.
        setError(
          e instanceof Error
            ? `${e.message} Nothing was published.`
            : "The roster could not be read, so nothing was published."
        );
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [open]);

  const resolution = useMemo(
    () => (roster.length === 0 ? EMPTY_RESOLUTION : resolveAliases({ engine: config.people, roster, aliases })),
    [config.people, roster, aliases]
  );

  const aliasPlan = useMemo(
    () => planAliases({ resolution, decisions, roster, aliases }),
    [resolution, decisions, roster, aliases]
  );

  const plan = useMemo<PublishPlan>(() => {
    // An unanswered name is an alias problem, and it has to reach the screen
    // as a refusal rather than as a payload with a hole in it.
    if (!isCommittable(aliasPlan)) {
      return {
        ok: false,
        refusals: aliasPlan.problems.map(describeProblem),
      };
    }
    return config.buildPlan({
      venue,
      mapping: aliasPlan.mapping,
      aliasRows: aliasPlan.rows,
      skipped: aliasPlan.skipped,
    });
  }, [aliasPlan, venue, config]);

  const publish = useCallback(async () => {
    if (!plan.ok) return;
    setBusy(true);
    setError(null);
    try {
      const result = await publishSessionOrThrow(plan.payload);
      setCounts(result);
      config.onPublished(plan.payload.session.session_id, result);
      setOpen(false);
    } catch (e) {
      setError(
        e instanceof PublishFailed
          ? `The night was NOT published — ${lower(e.message)} Nothing was written.`
          : `The night was NOT published. Nothing was written. ${String(e)}`
      );
    } finally {
      setBusy(false);
    }
  }, [plan, config]);

  return {
    open,
    skipped: aliasPlan.skipped,
    loading,
    busy,
    error,
    venue,
    decisions,
    resolution,
    plan,
    counts,
    openSheet: () => {
      setVenue(config.defaultVenue);
      setDecisions({});
      setCounts(null);
      setError(null);
      setOpen(true);
    },
    closeSheet: () => setOpen(false),
    setVenue,
    decide: (engineId, playerId) => setDecisions((d) => ({ ...d, [engineId]: playerId })),
    publish,
  };
}

const lower = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

function describeProblem(p: ReturnType<typeof planAliases>["problems"][number]): string {
  switch (p.kind) {
    case "unanswered":
      return "Some names still need an answer above.";
    case "unknown-roster-member":
      return "One of the chosen names is not on the roster any more. Pick again.";
    case "duplicate-person":
      return `Two people are both pointed at the same roster member. Only one of them can be.`;
  }
}
