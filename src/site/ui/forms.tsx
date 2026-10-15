// The public site's forms. Every one of them now goes somewhere.
//
// - SiteForm (Book PTO, Partners media kit, Season 2 list) sends the entry
//   to the "PTO Website: form entries" Google Sheet, which adds a row and
//   emails clubptobookings@gmail.com (src/site/forms/submit.ts). If sending
//   fails, the visitor gets the same message pre-filled for their own email
//   app instead, so nothing is lost.
// - EmailCapture is the inline newsletter box (Home, Events). Sign-ups land
//   on the Sheet's Newsletter tab. The pop-up uses the same sender
//   (src/site/ui/NewsletterPopup.tsx).

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { club } from "@/site/content";
import { EMAIL_RE, buildPayload, sendEntry, type FormId } from "@/site/forms/submit";
import { markSubscribed } from "@/site/forms/popup";
import { joinNewsletter, type NewsletterSource } from "@/site/forms/newsletter";

export interface FormField {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "date" | "textarea" | "select";
  placeholder?: string;
  options?: readonly string[];
  required?: boolean;
  autoComplete?: string;
  /** Lay this field beside the next one on wide screens. */
  half?: boolean;
}

/** The fallback: the same entry as an email in the visitor's own app. */
export const composeMailto = (
  to: string,
  subject: string,
  fields: readonly FormField[],
  values: Record<string, string>,
): string => {
  const body = fields.map((f) => `${f.label}: ${(values[f.name] ?? "").trim()}`).join("\n");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

/** A field people never see. Bots fill it in; the Sheet drops those entries. */
export const Honeypot = () => (
  <label className="hp" aria-hidden="true">
    Leave this empty
    <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
  </label>
);

const pagePath = () => (typeof window === "undefined" ? "" : window.location.pathname + window.location.hash);

interface SiteFormProps {
  form: Exclude<FormId, "newsletter">;
  title?: string;
  fields: readonly FormField[];
  submitLabel: string;
  idPrefix: string;
  /** Field names that make up the person's name, in order ("first", "last"). */
  nameFrom: readonly string[];
  /** Field name holding the company or brand, if the form asks. */
  companyFrom?: string;
  /** Subject line for the email fallback. */
  subject: (values: Record<string, string>) => string;
  /** What the visitor sees once it has gone through. */
  done: { title: string; body: ReactNode };
}

type SendState = "idle" | "sending" | "done" | "failed";

export const SiteForm = ({
  form,
  title,
  fields,
  submitLabel,
  idPrefix,
  nameFrom,
  companyFrom,
  subject,
  done,
}: SiteFormProps) => {
  const [state, setState] = useState<SendState>("idle");
  const [error, setError] = useState("");
  const [fallback, setFallback] = useState("");
  const startedAt = useRef(Date.now());

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === "sending") return;
    const fd = new FormData(e.currentTarget);
    const values: Record<string, string> = {};
    for (const f of fields) values[f.name] = String(fd.get(f.name) ?? "").trim();
    const missing = fields.find((f) => f.required && !values[f.name]);
    if (missing) {
      setError(`Add your ${missing.label.toLowerCase()} so we can reply.`);
      return;
    }
    const emailField = fields.find((f) => f.type === "email");
    const email = emailField ? values[emailField.name] : "";
    if (!EMAIL_RE.test(email)) {
      setError("That email address doesn't look right.");
      return;
    }
    setError("");
    setState("sending");

    const own = new Set([...nameFrom, companyFrom ?? "", emailField?.name ?? ""]);
    const payload = buildPayload(
      {
        form,
        email,
        name: nameFrom.map((n) => values[n]).filter(Boolean).join(" "),
        company: companyFrom ? values[companyFrom] : undefined,
        fields: fields.filter((f) => !own.has(f.name)).map((f) => ({ label: f.label, value: values[f.name] })),
      },
      { startedAt: startedAt.current, now: Date.now(), page: pagePath(), honeypot: String(fd.get("website") ?? "") },
    );
    const result = await sendEntry(payload);
    if (result.ok) {
      setState("done");
      return;
    }
    setState("failed");
    setError(result.error ?? "That didn't go through.");
    setFallback(composeMailto(club.email, subject(values), fields, values));
  };

  if (state === "done") {
    return (
      <div className="form form-done" role="status">
        <h3 className="disp" style={{ fontSize: 32 }}>
          {done.title}
        </h3>
        <p className="body">{done.body}</p>
      </div>
    );
  }

  // Pair up fields marked `half` so they share a row on wide screens.
  const rows: FormField[][] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const next = fields[i + 1];
    if (f.half && next?.half) {
      rows.push([f, next]);
      i++;
    } else rows.push([f]);
  }

  const control = (f: FormField) => {
    const id = `${idPrefix}-${f.name}`;
    const common = {
      id,
      name: f.name,
      className: "input",
      required: f.required,
      autoComplete: f.autoComplete,
    };
    let input: ReactNode;
    if (f.type === "textarea") {
      input = <textarea {...common} rows={4} placeholder={f.placeholder} />;
    } else if (f.type === "select") {
      input = (
        <select {...common} defaultValue={f.options?.[0]}>
          {f.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
    } else {
      input = <input {...common} type={f.type ?? "text"} placeholder={f.placeholder} />;
    }
    return (
      <label key={f.name} className="lab" htmlFor={id}>
        {f.label}
        {input}
      </label>
    );
  };

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      {title ? (
        <h3 className="disp" style={{ fontSize: 32 }}>
          {title}
        </h3>
      ) : null}
      {rows.map((row) =>
        row.length === 2 ? (
          <div key={row[0].name} className="g2 keep-2" style={{ gap: 16 }}>
            {row.map(control)}
          </div>
        ) : (
          control(row[0])
        ),
      )}
      <Honeypot />
      {error ? (
        <p className="form-error" role="alert">
          {error}
          {fallback ? (
            <>
              {" "}
              <a href={fallback}>Send it from your email instead</a>.
            </>
          ) : null}
        </p>
      ) : null}
      <button className="btn btn-dark btn-block" type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Sending" : submitLabel}
      </button>
      <p className="form-note">Goes straight to the PTO team. We reply from {club.email}.</p>
    </form>
  );
};

type CaptureState = "idle" | "sending" | "done" | "already";

interface EmailCaptureProps {
  buttonLabel: string;
  /** Where the sign-up came from: tagged in Mailchimp and noted in the Sheet. */
  source: Exclude<NewsletterSource, "popup">;
  /** Rendered on dark sections: swaps the button to lime. */
  dark?: boolean;
}

/** The inline newsletter box. */
export const EmailCapture = ({ buttonLabel, source, dark }: EmailCaptureProps) => {
  const [state, setState] = useState<CaptureState>("idle");
  const [error, setError] = useState("");
  const startedAt = useRef(Date.now());

  if (state === "done" || state === "already") {
    return (
      <p className="form-ok" role="status">
        {state === "already" ? "You're already on the list. See you on court." : "You're on the list. See you on court."}
      </p>
    );
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === "sending") return;
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
    setState("sending");
    const result = await joinNewsletter({
      firstName: first,
      email,
      source,
      startedAt: startedAt.current,
      honeypot: String(fd.get("website") ?? ""),
    });
    if (result.ok) {
      markSubscribed();
      setState(result.already ? "already" : "done");
    } else {
      setState("idle");
      setError(result.error ?? "That didn't go through.");
    }
  };

  const id = `capture-${source}`;
  const labelStyle = dark ? { color: "#F5EFE3" } : undefined;
  return (
    <form className="inline-form" onSubmit={onSubmit} noValidate>
      <label className="lab" htmlFor={`${id}-first`} style={labelStyle}>
        First name
        <input
          id={`${id}-first`}
          name="first"
          className="input input-first"
          autoComplete="given-name"
          placeholder="Your first name"
          required
        />
      </label>
      <label className="lab" htmlFor={id} style={labelStyle}>
        Email
        <input id={id} name="email" className="input" type="email" autoComplete="email" placeholder="you@email.com" required />
      </label>
      <Honeypot />
      <button className={`btn ${dark ? "btn-lime" : "btn-dark"}`} type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Adding you" : buttonLabel}
      </button>
      {error ? (
        <p className="form-error" role="alert" style={{ flexBasis: "100%" }}>
          {error}
        </p>
      ) : null}
    </form>
  );
};
