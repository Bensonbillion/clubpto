// The public site's forms.
//
// Two honest kinds, and nothing in between:
// - MailtoForm composes a structured email in the visitor's own mail app.
//   Nothing is silently collected, and nothing can be lost by a backend that
//   is not there yet.
// - EmailCapture subscribes an address to the Klaviyo list once the Klaviyo
//   keys are set in the Vercel environment. Until then it renders a
//   follow-on-Instagram prompt rather than a form that goes nowhere.

import { useState, type FormEvent, type ReactNode } from "react";
import { club, emailCapture, emailCaptureReady } from "@/site/content";

export interface MailtoField {
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const composeMailto = (
  to: string,
  subject: string,
  fields: readonly MailtoField[],
  values: Record<string, string>,
): string => {
  const body = fields
    .map((f) => `${f.label}: ${(values[f.name] ?? "").trim()}`)
    .join("\n");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

interface MailtoFormProps {
  title?: string;
  fields: readonly MailtoField[];
  subject: (values: Record<string, string>) => string;
  submitLabel: string;
  note?: ReactNode;
  idPrefix: string;
}

export const MailtoForm = ({ title, fields, subject, submitLabel, note, idPrefix }: MailtoFormProps) => {
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const values: Record<string, string> = {};
    for (const f of fields) values[f.name] = String(fd.get(f.name) ?? "");
    const missing = fields.find((f) => f.required && !values[f.name].trim());
    if (missing) {
      setError(`Add your ${missing.label.toLowerCase()} so we can reply.`);
      return;
    }
    const email = fields.find((f) => f.type === "email");
    if (email && values[email.name] && !EMAIL_RE.test(values[email.name].trim())) {
      setError("That email address doesn't look right.");
      return;
    }
    setError("");
    setSent(true);
    window.location.href = composeMailto(club.email, subject(values), fields, values);
  };

  // Pair up fields marked `half` so they share a row on wide screens.
  const rows: MailtoField[][] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const next = fields[i + 1];
    if (f.half && next?.half) {
      rows.push([f, next]);
      i++;
    } else rows.push([f]);
  }

  const control = (f: MailtoField) => {
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
      {title ? <h3 className="disp" style={{ fontSize: 32 }}>{title}</h3> : null}
      {rows.map((row) =>
        row.length === 2 ? (
          <div key={row[0].name} className="g2 keep-2" style={{ gap: 16 }}>
            {row.map(control)}
          </div>
        ) : (
          control(row[0])
        ),
      )}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn btn-dark btn-block" type="submit">
        {submitLabel}
      </button>
      <p className="form-note">
        {sent ? (
          <>
            Your email app should open with this filled in. If it didn't, write to{" "}
            <a href={`mailto:${club.email}`}>{club.email}</a>.
          </>
        ) : (
          note ?? <>Sending opens your email app with everything filled in.</>
        )}
      </p>
    </form>
  );
};

type CaptureState = "idle" | "sending" | "done" | "error";

/** Klaviyo's public client endpoint. The company id is public by design. */
const subscribe = async (email: string, source: string): Promise<boolean> => {
  try {
    const res = await fetch(
      `https://a.klaviyo.com/client/subscriptions?company_id=${encodeURIComponent(emailCapture.companyId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/vnd.api+json", revision: "2024-10-15" },
        body: JSON.stringify({
          data: {
            type: "subscription",
            attributes: {
              custom_source: source,
              profile: { data: { type: "profile", attributes: { email } } },
            },
            relationships: { list: { data: { type: "list", id: emailCapture.listId } } },
          },
        }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
};

interface EmailCaptureProps {
  buttonLabel: string;
  source: string;
  /** Rendered on dark sections: swaps the button to lime. */
  dark?: boolean;
}

export const EmailCapture = ({ buttonLabel, source, dark }: EmailCaptureProps) => {
  const [state, setState] = useState<CaptureState>("idle");
  const [error, setError] = useState("");

  if (!emailCaptureReady()) {
    return (
      <div className="cta-row">
        <a className={`btn ${dark ? "btn-lime" : "btn-dark"}`} href={club.instagramUrl}>
          Follow {club.instagramHandle}
        </a>
      </div>
    );
  }

  if (state === "done") {
    return (
      <p className="form-ok" role="status">
        You're on the list. See you soon.
      </p>
    );
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!EMAIL_RE.test(email)) {
      setError("That email address doesn't look right.");
      return;
    }
    setError("");
    setState("sending");
    const ok = await subscribe(email, source);
    setState(ok ? "done" : "error");
    if (!ok) setError("That didn't go through. Try again in a moment.");
  };

  const id = `capture-${source.replace(/\W+/g, "-")}`;
  return (
    <form className="inline-form" onSubmit={onSubmit} noValidate>
      <label className="lab" htmlFor={id} style={dark ? { color: "#F5EFE3" } : undefined}>
        Email
        <input id={id} name="email" className="input" type="email" autoComplete="email" placeholder="you@email.com" />
      </label>
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
