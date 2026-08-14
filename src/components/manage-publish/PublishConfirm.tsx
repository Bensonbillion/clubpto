// The end of the night, on one screen.
//
// DESIGNED FOR 11PM. The admin has been running a room for three hours and is
// standing up holding a tablet. So: one screen, no wizard, everything that
// needs a decision visible at once, and the default path is a single press.
// Nothing destructive lives on this screen at all — Reset is somewhere else
// entirely, because the two must never be adjacent when someone is tired.

import { useMemo, useState } from "react";
import { AlertTriangle, Check, MapPin } from "lucide-react";
import type { AliasQuestion, AliasRow } from "@/clubhouse/publish/aliases";
import type { PublishPlan } from "@/clubhouse/publish/plan";
import { knownVenues } from "@/lib/clubDate";

export interface PublishConfirmProps {
  /** The night, in words: "Wednesday 12 August". */
  when: string;
  venue: string;
  onVenueChange(venue: string): void;
  /** Unmapped engine ids needing an explicit answer. */
  questions: AliasQuestion[];
  /** engineId -> rosterId, or null for "not one of ours". */
  decisions: Record<string, string | null>;
  onDecide(engineId: string, playerId: string | null): void;
  /** What this publish records and does not record. Not a warning. */
  notes: string[];
  /** The current plan: refusals block the button. */
  plan: PublishPlan;
  busy: boolean;
  error: string | null;
  onPublish(): void;
  onCancel(): void;
}

const Chip = ({ label, on, onClick }: { label: string; on: boolean; onClick(): void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className={`min-h-[44px] px-3 rounded-md border-2 text-sm ${
      on ? "border-gold bg-gold/15 text-gold" : "border-border bg-dark-elevated text-muted-foreground"
    }`}
  >
    {label}
  </button>
);

export default function PublishConfirm(props: PublishConfirmProps) {
  const { plan, questions, decisions, notes } = props;
  const refusals = "refusals" in plan ? plan.refusals : [];
  const ready = plan.ok && !props.busy;

  const unanswered = useMemo(
    () => questions.filter((q) => !(q.engineId in decisions)).length,
    [questions, decisions]
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-dark text-cream">
      <div className="mx-auto max-w-2xl px-5 py-6 pb-40 space-y-6">
        <header className="space-y-1">
          <h1 className="font-display text-2xl text-accent">Publish tonight</h1>
          <p className="text-sm text-muted-foreground">{props.when}</p>
        </header>

        {/* ── venue: a suggestion the admin confirms, never a hidden derivation ── */}
        <section className="space-y-2">
          <label htmlFor="publish-venue" className="flex items-center gap-2 text-sm text-cream">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            Where this was played
          </label>
          <input
            id="publish-venue"
            value={props.venue}
            onChange={(e) => props.onVenueChange(e.target.value)}
            placeholder="Type the venue"
            className="w-full min-h-[52px] rounded-lg border border-border bg-dark-elevated px-4 text-base text-cream placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/60"
          />
          <div className="flex flex-wrap gap-2">
            {knownVenues().map((v) => (
              <Chip key={v} label={v} on={props.venue.trim() === v} onClick={() => props.onVenueChange(v)} />
            ))}
          </div>
        </section>

        {/* ── the names ─────────────────────────────────────────────── */}
        {questions.length > 0 && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
                Who these people are
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {unanswered > 0
                  ? `${unanswered} still to answer. Nothing is saved until you publish.`
                  : "All answered. They save when you publish."}
              </p>
            </div>

            {questions.map((q) => {
              const chosen = decisions[q.engineId];
              return (
                <div key={q.engineId} className="rounded-lg border border-border bg-dark-elevated p-3 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-base text-cream">{q.engineName || q.engineId}</span>
                    {q.stale && (
                      <span className="text-xs text-muted-foreground">left over from an earlier import</span>
                    )}
                  </div>

                  {q.candidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nobody on the roster answers to this name.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {q.candidates.map((c) => (
                        <Chip
                          key={c.playerId}
                          label={c.displayName}
                          on={chosen === c.playerId}
                          onClick={() => props.onDecide(q.engineId, c.playerId)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Pre-selected is a suggestion the admin taps, never applied
                      for them: two members share a first name at 66 people. */}
                  {q.preselected && chosen === undefined && (
                    <p className="text-xs text-muted-foreground">
                      Probably {q.candidates.find((c) => c.playerId === q.preselected)?.displayName}. Tap to confirm.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => props.onDecide(q.engineId, null)}
                    aria-pressed={chosen === null}
                    className={`min-h-[44px] text-sm underline ${
                      chosen === null ? "text-gold" : "text-muted-foreground"
                    }`}
                  >
                    Not one of ours — skip them tonight
                  </button>
                </div>
              );
            })}
          </section>
        )}

        {/* ── what this night records. An account, not a warning. ────── */}
        {notes.length > 0 && (
          <section className="rounded-lg border border-border bg-dark-elevated p-4 space-y-2">
            <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
              What gets recorded
            </h2>
            {notes.map((n) => (
              <p key={n} className="text-sm text-cream/90 leading-relaxed">
                {n}
              </p>
            ))}
          </section>
        )}

        {/* ── refusals: what is stopping it, named ───────────────────── */}
        {refusals.length > 0 && (
          <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
            <h2 className="flex items-center gap-2 text-sm text-amber-300">
              <AlertTriangle className="w-4 h-4" />
              Not ready to publish
            </h2>
            {refusals.map((r) => (
              <p key={r} className="text-sm text-cream/90 leading-relaxed">
                {r}
              </p>
            ))}
          </section>
        )}

        {props.error && (
          <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-cream/90">
            {props.error}
          </p>
        )}
      </div>

      {/* The primary action, thumb-height, alone. Cancel is text, and it is
          not a destructive control — it leaves the night exactly as it is. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-dark/95 backdrop-blur px-5 py-4 space-y-3">
        <div className="mx-auto max-w-2xl space-y-3">
          <button
            type="button"
            disabled={!ready}
            onClick={props.onPublish}
            className="w-full min-h-[56px] rounded-lg bg-gold text-dark text-base font-medium flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Check className="w-5 h-5" />
            {props.busy ? "Publishing…" : "Publish the night"}
          </button>
          <button
            type="button"
            onClick={props.onCancel}
            disabled={props.busy}
            className="w-full min-h-[44px] text-sm text-muted-foreground underline disabled:opacity-40"
          >
            Not yet — back to the night
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── the held Reset ──────────────────────────────────────────────── */

export interface ResetGuardPanelProps {
  reason: string;
  consequence: string;
  overrideLabel: string;
  onPublishInstead(): void;
  onOverride(): void;
  onCancel(): void;
}

/**
 * What Reset shows when the night has not been published.
 *
 * A block with a door. The way out is present and labelled with what it
 * costs — a disabled button with no path is its own trap on the night the
 * publish genuinely cannot happen. The override sits at the bottom, visually
 * separated from the two safe choices, and says the consequence above itself
 * rather than behind a second confirm nobody reads.
 */
export function ResetGuardPanel(props: ResetGuardPanelProps) {
  const [armed, setArmed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-5 pb-6 sm:items-center">
      <div className="w-full max-w-md rounded-xl border border-border bg-dark p-5 space-y-4">
        <h2 className="font-display text-xl text-accent">Hold on</h2>
        <p className="text-sm text-cream/90 leading-relaxed">{props.reason}</p>

        <button
          type="button"
          onClick={props.onPublishInstead}
          className="w-full min-h-[52px] rounded-lg bg-gold text-dark text-base font-medium"
        >
          Publish it first
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          className="w-full min-h-[44px] text-sm text-muted-foreground underline"
        >
          Leave the night alone
        </button>

        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-sm text-cream/80 leading-relaxed">{props.consequence}</p>
          {armed ? (
            <button
              type="button"
              onClick={props.onOverride}
              className="w-full min-h-[44px] rounded-lg border-2 border-amber-500/60 text-amber-300 text-sm"
            >
              Yes, {props.overrideLabel.toLowerCase()}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setArmed(true)}
              className="w-full min-h-[44px] text-sm text-muted-foreground underline"
            >
              {props.overrideLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
