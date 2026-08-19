// Court Manager v2 — dev route while the rebuild hardens (COURT-MANAGER.md).
// Never linked from the public site, robots-blocked.
// The legacy /manage and /manage2 are untouched and remain the live systems.
//
// ACCESS MODEL (owner's rule): the passcode guards ONLY the admin surfaces —
// Roster (add/edit players, tiers, generate the play) and Standings (the
// leaderboard/playoffs). Check-In and Courts are WIDE OPEN so day-of helpers
// can check people in and run both courts with no passcode. Tier labels are
// never shown on the open surfaces (§18).

import { useEffect, useRef, useState } from "react";
import { Lock, Delete, Settings, UserCheck, Monitor, BarChart3, RotateCcw } from "lucide-react";
import { useSessionV2 } from "@/court-manager/react/useSessionV2";
import { SessionSetup, CheckIn } from "@/components/manage-next/SetupCheckIn";
import RoundBoard from "@/components/manage-next/RoundBoard";
import StandingsPlayoffs from "@/components/manage-next/StandingsPlayoffs";
import { ManageErrorBoundary } from "@/components/manage-next/ManageErrorBoundary";
import AdminGate from "@/court-manager/auth/AdminGate";
import PublishConfirm, { ResetGuardPanel } from "@/components/manage-publish/PublishConfirm";
import { usePublishFlow } from "@/clubhouse/publish/usePublishFlow";
import { planV3Publish, publishIdOfV3 } from "@/clubhouse/publish/plan";
import { resetDecision } from "@/clubhouse/publish/resetGuard";
import { clubDate, defaultVenueFor } from "@/lib/clubDate";

/** "Wednesday 12 August" — what the confirm screen calls tonight. */
const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-CA", {
    weekday: "long", day: "numeric", month: "long",
  });

const tabs = [
  { id: "session", label: "Roster", icon: Settings, locked: true },
  { id: "checkin", label: "Check-In", icon: UserCheck, locked: false },
  { id: "courts", label: "Courts", icon: Monitor, locked: false },
  { id: "standings", label: "Standings & Playoffs", icon: BarChart3, locked: true },
] as const;

type Tab = (typeof tabs)[number]["id"];

const LOCKED_TABS: Tab[] = tabs.filter((t) => t.locked).map((t) => t.id);
const isLocked = (t: Tab) => LOCKED_TABS.includes(t);

const ManageNextInner = () => {
  // The admin tabs used to sit behind a second, client-side passcode. That
  // code is gone from the bundle: AdminGate now verifies the passcode against
  // a server-side secret, so anyone who reached this component is already a
  // member of engine_admins. A second gate here would only ask the same
  // person for the same secret twice.
  const adminUnlocked = true;
  // Default to the open Check-In tab so opening the app never shows a passcode.
  const [tab, setTab] = useState<Tab>("checkin");
  const [resetHeld, setResetHeld] = useState(false);
  const s = useSessionV2();

  // ── Publish (Step 2b) ────────────────────────────────────────────
  const attended = s.session.players.filter((p) => p.checkedIn || p.attending);
  const publishDate = s.session.sessionStartedAt ? clubDate(s.session.sessionStartedAt) : "";
  const flow = usePublishFlow({
    people: attended.map((p) => ({ id: p.id, name: p.name, lastName: p.lastName })),
    defaultVenue: publishDate ? defaultVenueFor(publishDate) ?? "" : "",
    buildPlan: (input) => planV3Publish(s.session, input),
    onPublished: (id) => s.markPublished(id),
  });

  // Reset nulls sessionStartedAt, which the publish id is derived from.
  const gate = resetDecision({
    publishId: publishIdOfV3(s.session),
    publishedId: s.session.publishedId ?? null,
    hasContent: attended.length > 0 || s.session.results.length > 0,
    peopleCount: attended.length,
  });

  const runReset = async () => {
    setResetHeld(false);
    try {
      // The night is archived first; if that fails, resetSession
      // rejects and NOTHING is cleared (C7).
      await s.resetSession();
      setTab("session");
    } catch (err) {
      window.alert(
        `The session was NOT reset — it could not be archived first, so nothing was cleared.\n\n${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  };

  // Follow the session: rounds → Courts (open). At playoffs/done, only send the
  // admin to the locked Standings tab — a no-passcode helper stays on the open
  // Courts tab (which shows a playoffs pointer) instead of being trapped at the
  // passcode gate the instant someone taps JUMP TO PLAYOFFS.
  // Fire ONLY when the phase actually changes. Keying this on adminUnlocked too
  // meant that entering the passcode mid-session re-ran the effect and yanked
  // the admin straight back off the tab they had just unlocked.
  const lastPhase = useRef<string | null>(null);
  useEffect(() => {
    if (s.loading) return;
    const phase = s.session.phase;
    if (lastPhase.current === phase) return;
    lastPhase.current = phase;
    if (phase === "rounds") setTab("courts");
    else if (phase === "playoffs" || phase === "done") setTab("courts");
  }, [s.loading, s.session.phase]);

  const gated = isLocked(tab) && !adminUnlocked;

  return (
    <div className="min-h-screen bg-dark text-cream">
      <header className="sticky top-0 z-20 bg-dark/95 backdrop-blur border-b border-dark-elevated">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="font-display text-xl text-accent whitespace-nowrap">PTO Court Manager · Next</h1>
          <nav className="flex gap-1">
            {tabs.map(({ id, label, icon: Icon, locked }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`min-h-[44px] px-4 rounded-none flex items-center gap-2 text-sm transition-colors ${
                  tab === id
                    ? "bg-accent/15 text-accent border-b-2 border-accent"
                    : "text-muted-foreground hover:text-cream"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                {locked && !adminUnlocked && <Lock className="w-3 h-3 opacity-50" />}
              </button>
            ))}
          </nav>
          {adminUnlocked ? (
            <>
            <button
              onClick={() => flow.openSheet()}
              className="min-h-[44px] px-3 flex items-center gap-2 text-sm text-gold hover:text-gold/80 transition-colors"
            >
              <span>{s.session.publishedId ? "Publish again" : "Publish"}</span>
            </button>
            <button
              onClick={async () => {
                if (!gate.allowed) { setResetHeld(true); return; }
                if (!window.confirm("Reset tonight's session? The roster is kept — check-ins, pairs, games, and results are cleared.")) return;
                await runReset();
              }}
              className="min-h-[44px] px-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-cream transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            </>
          ) : (
            <div className="w-4" />
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {s.loading ? (
          <div className="py-24 text-center text-muted-foreground animate-pulse">Loading session…</div>
        ) : gated ? (
          <div className="py-24 text-center text-muted-foreground">Checking access…</div>
        ) : (
          <>
            {tab === "session" && <SessionSetup s={s} />}
            {tab === "checkin" && <CheckIn s={s} />}
            {tab === "courts" &&
              (s.session.phase === "setup" ? (
                <div className="py-24 text-center text-muted-foreground">
                  Courts light up once the session starts. Check players in, then start it from the Roster tab.
                </div>
              ) : (
                // Rounds AND playoffs both render here — RoundBoard switches to the
                // playoff courts itself, so helpers keep running games either way.
                <RoundBoard s={s} />
              ))}
            {tab === "standings" && <StandingsPlayoffs s={s} />}
          </>
        )}
      </main>

      {flow.open && (
        <PublishConfirm
          when={publishDate ? longDate(publishDate) : "This night has not been started"}
          venue={flow.venue}
          onVenueChange={flow.setVenue}
          questions={flow.resolution.questions}
          decisions={flow.decisions}
          onDecide={flow.decide}
          notes={"notes" in flow.plan ? flow.plan.notes : []}
          plan={flow.plan}
          busy={flow.busy || flow.loading}
          error={flow.error}
          onPublish={() => void flow.publish()}
          onCancel={flow.closeSheet}
        />
      )}

      {resetHeld && !gate.allowed && (
        <ResetGuardPanel
          reason={gate.reason!}
          consequence={gate.consequence!}
          overrideLabel={gate.overrideLabel!}
          onPublishInstead={() => { setResetHeld(false); flow.openSheet(); }}
          onOverride={() => void runReset()}
          onCancel={() => setResetHeld(false)}
        />
      )}
    </div>
  );
};

// The boundary must sit OUTSIDE the component that calls useSessionV2, so a
// throw during that component's render is caught instead of white-screening.
//
// AdminGate sits outside both: game_state is admin-only in the database now,
// so an un-signed-in device cannot read the session at all and there is no
// point mounting the manager behind it. The 9999 passcode stays exactly where
// it was — it still separates admin surfaces from the day-of helper surfaces
// once you are through the door.
const ManageNext = () => (
  <AdminGate>
    <ManageErrorBoundary>
      <ManageNextInner />
    </ManageErrorBoundary>
  </AdminGate>
);

export default ManageNext;
