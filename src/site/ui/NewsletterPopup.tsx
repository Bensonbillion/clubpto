// The newsletter pop-up on the redesigned public pages. Shows once per visit
// at most, never to someone already signed up, and stays away for three
// weeks after "Not now" (rules in src/site/forms/popup.ts). Sign-ups land on
// the Newsletter tab of the "PTO Website: form entries" Sheet.

import { useEffect, useRef, useState, type FormEvent } from "react";
import { photos } from "@/site/photos";
import { Photo } from "@/site/ui/bits";
import { Honeypot } from "@/site/ui/forms";
import { EMAIL_RE } from "@/site/forms/submit";
import { joinNewsletter } from "@/site/forms/newsletter";
import {
  OPEN_AFTER_MS,
  OPEN_AT_SCROLL,
  markDismissed,
  markShown,
  markSubscribed,
  mayOffer,
  readMemory,
} from "@/site/forms/popup";

type Phase = "closed" | "open" | "sending" | "done";

const typingElsewhere = () => {
  const el = document.activeElement;
  return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
};

export const NewsletterPopup = () => {
  const [phase, setPhase] = useState<Phase>("closed");
  const [error, setError] = useState("");
  const [already, setAlready] = useState(false);
  const openedAt = useRef(0);
  const dialog = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  // Decide once per page view whether, and when, to open.
  useEffect(() => {
    if (!mayOffer(readMemory(), Date.now())) return;
    let done = false;
    let retry: number | undefined;
    const open = () => {
      if (done) return;
      if (typingElsewhere()) {
        retry = window.setTimeout(open, 8000);
        return;
      }
      if (!mayOffer(readMemory(), Date.now())) return;
      done = true;
      markShown();
      returnFocus.current = document.activeElement as HTMLElement | null;
      openedAt.current = Date.now();
      setPhase("open");
    };
    const timer = window.setTimeout(open, OPEN_AFTER_MS);
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= OPEN_AT_SCROLL) open();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      done = true;
      window.clearTimeout(timer);
      window.clearTimeout(retry);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const close = (snooze: boolean) => {
    if (snooze) markDismissed();
    setPhase("closed");
    returnFocus.current?.focus?.();
  };

  // Focus the first field on open; Esc closes; Tab stays inside.
  useEffect(() => {
    if (phase === "closed") return;
    const node = dialog.current;
    if (phase === "open") node?.querySelector<HTMLInputElement>("input[name='first']")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(phase !== "done");
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>("button, input:not([tabindex='-1']), a[href]")].filter(
        (el) => !el.hasAttribute("disabled"),
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (phase === "sending") return;
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const first = String(fd.get("first") ?? "").trim();
    if (!first) {
      setError("Add your first name so we know who we're writing to.");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError("That email address doesn't look right.");
      return;
    }
    setError("");
    setPhase("sending");
    const result = await joinNewsletter({
      firstName: first,
      email,
      source: "popup",
      startedAt: openedAt.current,
      honeypot: String(fd.get("website") ?? ""),
    });
    if (result.ok) {
      markSubscribed();
      setAlready(Boolean(result.already));
      setPhase("done");
    } else {
      setPhase("open");
      setError(result.error ?? "That didn't go through.");
    }
  };

  if (phase === "closed") return null;

  return (
    <div className="nl-pop" onMouseDown={(e) => e.target === e.currentTarget && close(phase !== "done")}>
      <div className="nl-card" role="dialog" aria-modal="true" aria-labelledby="nl-title" ref={dialog}>
        <button type="button" className="nl-x" aria-label="Close" onClick={() => close(phase !== "done")}>
          <span aria-hidden="true">×</span>
        </button>
        <div className="nl-photo">
          <Photo photo={photos.districtOverhead} sizes="(max-width: 600px) 100vw, 560px" focus="50% 18%" />
        </div>
        <div className="nl-body">
          {phase === "done" ? (
            <div role="status" className="stack" style={{ gap: 12 }}>
              <p className="eyebrow eyebrow-leaf">{already ? "Already on it" : "You're in"}</p>
              <h2 id="nl-title" className="disp nl-h">
                {already ? "You're already on the list." : "You're on the list."}
              </h2>
              <p className="body">See you on court.</p>
              <div>
                <button type="button" className="btn btn-dark" onClick={() => close(false)}>
                  Back to the site
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="eyebrow eyebrow-leaf">Thursday plans? Sorted.</p>
              <h2 id="nl-title" className="disp nl-h">
                Don't find out from <span className="it">someone's story.</span>
              </h2>
              <p className="body">Next week's meet, league news and event drops, straight to your inbox.</p>
              <form className="nl-form" onSubmit={onSubmit} noValidate>
                <div className="g2 keep-2" style={{ gap: 12 }}>
                  <label className="lab" htmlFor="nl-first">
                    First name
                    <input
                      id="nl-first"
                      name="first"
                      className="input"
                      autoComplete="given-name"
                      placeholder="Your first name"
                      required
                    />
                  </label>
                  <label className="lab" htmlFor="nl-email">
                    Email
                    <input
                      id="nl-email"
                      name="email"
                      className="input"
                      type="email"
                      autoComplete="email"
                      placeholder="you@email.com"
                      required
                    />
                  </label>
                </div>
                <Honeypot />
                {error ? (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <button className="btn btn-dark btn-block" type="submit" disabled={phase === "sending"}>
                  {phase === "sending" ? "Adding you" : "Get on the list"}
                </button>
              </form>
              <button type="button" className="nl-later" onClick={() => close(true)}>
                Not now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
