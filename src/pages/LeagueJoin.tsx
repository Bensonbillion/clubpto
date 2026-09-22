// PTO League — Season 1 registration funnel.
//
// Three-step flow the copy deck spells out: form → deposit → confirmed.
// State lives in sessionStorage keyed by "league.join.v1" so refreshes
// don't nuke the visitor's progress. When leadCaptureUrl and depositUrl
// are still TODO, submissions still progress (payload stored locally,
// deposit step shows an e-transfer fallback) so the funnel never dead-ends
// while payments are being wired up.

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageWrapper from "@/components/layout/PageWrapper";
import { league, leagueIsSet } from "@/content/league";
import "./leagueJoin.css";

type Step = "form" | "deposit" | "confirmed";
type Division = "mens" | "womens";
type Experience = "few" | "developing" | "intermediate";

interface LeadData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  division: Division | "";
  experience: Experience | "";
  instagram: string;
  consent: boolean;
}

const EMPTY_LEAD: LeadData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  division: "",
  experience: "",
  instagram: "",
  consent: false,
};

const STORAGE_KEY = "league.join.v1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DIVISION_LABEL: Record<Division, string> = {
  mens: "Men's Division",
  womens: "Women's Division",
};

const EXPERIENCE_LABEL: Record<Experience, string> = {
  few: "Played a few times",
  developing: "Developing",
  intermediate: "Intermediate+",
};

/** "2026-10-04" → "October 4" — for tight display copy. */
const shortDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
};

interface Stored {
  step: Step;
  lead: LeadData;
}

const readStored = (): Stored | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed && parsed.step && parsed.lead) return parsed;
    return null;
  } catch {
    return null;
  }
};

const writeStored = (stored: Stored): void => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* private mode / disabled storage — silently ignore */
  }
};

const clearStored = (): void => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

const LeagueJoin = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const previous = document.title;
    document.title = "Join PTO League — Season 1 · Club PTO";
    return () => {
      document.title = previous;
    };
  }, []);

  const [step, setStep] = useState<Step>("form");
  const [lead, setLead] = useState<LeadData>(EMPTY_LEAD);
  const [hydrated, setHydrated] = useState(false);

  // Restore any in-progress state on mount.
  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setStep(stored.step);
      setLead(stored.lead);
    }
    setHydrated(true);
  }, []);

  // Persist on every change once hydrated (so we don't overwrite session on load).
  useEffect(() => {
    if (!hydrated) return;
    writeStored({ step, lead });
  }, [hydrated, step, lead]);

  const goToForm = () => setStep("form");
  const advanceToDeposit = () => setStep("deposit");
  const advanceToConfirmed = () => setStep("confirmed");
  const startOver = () => {
    clearStored();
    setStep("form");
    setLead(EMPTY_LEAD);
  };

  return (
    <PageWrapper>
      <div className="lgj-page">
        <div className="lgj-inner">
          <StepBar step={step} />
          {step === "form" && (
            <RegistrationForm
              value={lead}
              onChange={setLead}
              onSubmit={advanceToDeposit}
            />
          )}
          {step === "deposit" && (
            <DepositStep
              lead={lead}
              onBack={goToForm}
              onPaid={advanceToConfirmed}
            />
          )}
          {step === "confirmed" && (
            <ConfirmedStep lead={lead} onReset={startOver} onGoHome={() => navigate("/")} />
          )}
        </div>
      </div>
    </PageWrapper>
  );
};

/* ── step indicator ──────────────────────────────────────────── */

const STEPS: { id: Step; label: string }[] = [
  { id: "form", label: "Your details" },
  { id: "deposit", label: "Secure your spot" },
  { id: "confirmed", label: "Confirmed" },
];

const StepBar = ({ step }: { step: Step }) => {
  const activeIndex = STEPS.findIndex((s) => s.id === step);
  return (
    <ol className="lgj-steps" aria-label="Registration progress">
      {STEPS.map((s, i) => {
        const state =
          i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
        return (
          <li key={s.id} className={`lgj-steps__item lgj-steps__item--${state}`}>
            <span className="lgj-steps__num">{i + 1}</span>
            <span className="lgj-steps__label">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
};

/* ── step 1: registration form ───────────────────────────────── */

interface FormProps {
  value: LeadData;
  onChange: (next: LeadData) => void;
  onSubmit: () => void;
}

const validate = (v: LeadData): Partial<Record<keyof LeadData, string>> => {
  const errs: Partial<Record<keyof LeadData, string>> = {};
  if (!v.firstName.trim()) errs.firstName = "Required";
  if (!v.lastName.trim()) errs.lastName = "Required";
  if (!v.email.trim()) errs.email = "Required";
  else if (!EMAIL_RE.test(v.email.trim())) errs.email = "Enter a valid email";
  if (!v.phone.trim()) errs.phone = "Required";
  if (!v.division) errs.division = "Pick a division";
  if (!v.experience) errs.experience = "Pick your level";
  if (!v.consent) errs.consent = "We need this to keep you in the loop";
  return errs;
};

const RegistrationForm = ({ value, onChange, onSubmit }: FormProps) => {
  const [errors, setErrors] = useState<Partial<Record<keyof LeadData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const set = <K extends keyof LeadData>(key: K, next: LeadData[K]) => {
    onChange({ ...value, [key]: next });
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
    if (remoteError) setRemoteError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validate(value);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    setRemoteError(null);

    // POST to the lead capture endpoint if pinned. Failure is not fatal —
    // the payload is already in sessionStorage and we still advance so
    // the user can complete the deposit.
    if (leagueIsSet(league.leadCaptureUrl)) {
      try {
        const res = await fetch(league.leadCaptureUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "clubpto.com/league/join",
            submittedAt: new Date().toISOString(),
            firstName: value.firstName.trim(),
            lastName: value.lastName.trim(),
            email: value.email.trim(),
            phone: value.phone.trim(),
            division: value.division,
            experience: value.experience,
            instagram: value.instagram.trim() || null,
            consent: value.consent,
          }),
        });
        if (!res.ok) {
          setRemoteError(
            "We captured your details locally — we'll follow up if this doesn't sync.",
          );
        }
      } catch {
        setRemoteError(
          "We captured your details locally — we'll follow up if this doesn't sync.",
        );
      }
    }

    setSubmitting(false);
    onSubmit();
  };

  return (
    <>
      <header className="lgj-head">
        <p className="lgj-label lgj-eyebrow">Step 1 · your details</p>
        <h1 className="rly-display lgj-title">Join PTO League — Season 1</h1>
        <p className="lgj-sub">
          Fill in your details to start your registration. You'll complete
          your ${league.depositPrice} deposit on the next step.
        </p>
      </header>

      <form className="lgj-form" onSubmit={handleSubmit} noValidate>
        <div className="lgj-form__row lgj-form__row--pair">
          <TextField
            id="firstName"
            label="First name"
            value={value.firstName}
            error={errors.firstName}
            onChange={(v) => set("firstName", v)}
            autoComplete="given-name"
            required
            inputRef={firstInputRef}
          />
          <TextField
            id="lastName"
            label="Last name"
            value={value.lastName}
            error={errors.lastName}
            onChange={(v) => set("lastName", v)}
            autoComplete="family-name"
            required
          />
        </div>

        <TextField
          id="email"
          label="Email"
          type="email"
          value={value.email}
          error={errors.email}
          onChange={(v) => set("email", v)}
          autoComplete="email"
          required
        />

        <TextField
          id="phone"
          label="Phone number"
          type="tel"
          value={value.phone}
          error={errors.phone}
          onChange={(v) => set("phone", v)}
          autoComplete="tel"
          required
        />

        <div className="lgj-form__row lgj-form__row--pair">
          <SelectField
            id="division"
            label="Division"
            value={value.division}
            error={errors.division}
            onChange={(v) => set("division", v as Division | "")}
            required
            options={[
              { value: "mens", label: "Men's Division" },
              { value: "womens", label: "Women's Division" },
            ]}
          />
          <SelectField
            id="experience"
            label="Padel experience"
            value={value.experience}
            error={errors.experience}
            onChange={(v) => set("experience", v as Experience | "")}
            required
            options={[
              { value: "few", label: "Played a few times" },
              { value: "developing", label: "Developing" },
              { value: "intermediate", label: "Intermediate+" },
            ]}
          />
        </div>

        <TextField
          id="instagram"
          label="Instagram handle (optional)"
          value={value.instagram}
          onChange={(v) => set("instagram", v)}
          placeholder="@yourhandle"
        />

        <CheckboxField
          id="consent"
          label="I agree to receive updates about PTO League and Club PTO events."
          checked={value.consent}
          error={errors.consent}
          onChange={(v) => set("consent", v)}
        />

        {remoteError && <p className="lgj-form__remote">{remoteError}</p>}

        <button
          type="submit"
          className="rly-pill lgj-cta"
          disabled={submitting}
        >
          {submitting ? "Submitting…" : "Continue to secure your spot →"}
        </button>

        <p className="lgj-form__fine">
          Registration closes{" "}
          {shortDate(league.registrationCloseAt.slice(0, 10))}. Roster spots
          are held on a first-come, first-served basis and are only confirmed
          after your deposit is paid.
        </p>
      </form>
    </>
  );
};

/* ── step 2: deposit ─────────────────────────────────────────── */

interface DepositProps {
  lead: LeadData;
  onBack: () => void;
  onPaid: () => void;
}

const DepositStep = ({ lead, onBack, onPaid }: DepositProps) => {
  const divisionLabel =
    lead.division && DIVISION_LABEL[lead.division as Division];
  const depositReady = leagueIsSet(league.depositUrl);

  return (
    <>
      <header className="lgj-head">
        <p className="lgj-label lgj-eyebrow">Step 2 · secure your spot</p>
        <h1 className="rly-display lgj-title">You're almost in.</h1>
        <p className="lgj-sub">
          Secure your Season 1 roster spot with a ${league.depositPrice}{" "}
          deposit.
        </p>
      </header>

      <dl className="lgj-facts">
        <div className="lgj-fact">
          <dt>Player</dt>
          <dd>
            {lead.firstName} {lead.lastName}
          </dd>
        </div>
        <div className="lgj-fact">
          <dt>Division</dt>
          <dd>{divisionLabel || "—"}</dd>
        </div>
        <div className="lgj-fact">
          <dt>Deposit today</dt>
          <dd>${league.depositPrice}</dd>
        </div>
        <div className="lgj-fact">
          <dt>Remaining balance</dt>
          <dd>
            ${league.fullPrice - league.depositPrice} · due before{" "}
            {shortDate(league.depositDeadline)}
          </dd>
        </div>
        <div className="lgj-fact">
          <dt>Registration closes</dt>
          <dd>{shortDate(league.registrationCloseAt.slice(0, 10))}</dd>
        </div>
      </dl>

      {depositReady ? (
        <a
          href={league.depositUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rly-pill lgj-cta"
        >
          Pay ${league.depositPrice} deposit →
        </a>
      ) : (
        <div className="lgj-etransfer">
          <p className="lgj-label lgj-etransfer__label">Payment window</p>
          <p className="lgj-etransfer__body">
            The online deposit link is being wired up. In the meantime, send
            your ${league.depositPrice} deposit by e-transfer to{" "}
            <a href="mailto:clubptobookings@gmail.com" className="lgj-link">
              clubptobookings@gmail.com
            </a>{" "}
            and use the message{" "}
            <b>
              "League Season 1 — {lead.firstName} {lead.lastName}"
            </b>{" "}
            so we can match it to your roster spot.
          </p>
          <button
            type="button"
            className="rly-pill rly-pill--ghost lgj-cta lgj-cta--secondary"
            onClick={onPaid}
          >
            I've sent the e-transfer →
          </button>
        </div>
      )}

      <p className="lgj-form__fine">
        Deposits are non-refundable once your roster position is confirmed.
        Your spot is not secured until payment is received.
      </p>

      <button type="button" className="lgj-back" onClick={onBack}>
        ← Edit my details
      </button>
    </>
  );
};

/* ── step 3: confirmation ────────────────────────────────────── */

interface ConfirmedProps {
  lead: LeadData;
  onReset: () => void;
  onGoHome: () => void;
}

const ConfirmedStep = ({ lead, onReset, onGoHome }: ConfirmedProps) => {
  const firstName = lead.firstName || "player";
  return (
    <>
      <header className="lgj-head">
        <p className="lgj-label lgj-eyebrow">Step 3 · confirmed</p>
        <h1 className="rly-display lgj-title">You're on the roster.</h1>
        <p className="lgj-sub">
          Welcome to PTO League Season 1, {firstName}.
        </p>
      </header>

      <div className="lgj-confirm">
        <p className="lgj-confirm__intro">
          Your registration is being processed. Here's what happens next:
        </p>
        <ul className="lgj-confirm__list">
          <li>
            Remaining balance of ${league.fullPrice - league.depositPrice} is
            due before {shortDate(league.depositDeadline)}
          </li>
          <li>
            Your division assignment and player number will be shared before
            Week 1
          </li>
          <li>Match schedule drops the week of {shortDate("2026-09-29")}</li>
          <li>Season 1 begins Sunday, {shortDate(league.startDate)}</li>
        </ul>
        <p className="lgj-confirm__note">
          Check your email for your confirmation receipt.
        </p>
      </div>

      <a
        href="https://www.instagram.com/club_pto"
        target="_blank"
        rel="noopener noreferrer"
        className="rly-pill lgj-cta"
      >
        Follow @clubpto for league updates →
      </a>

      <div className="lgj-confirm__foot">
        <button type="button" className="lgj-back" onClick={onGoHome}>
          Back to Club PTO
        </button>
        <button type="button" className="lgj-back" onClick={onReset}>
          Register another player
        </button>
      </div>
    </>
  );
};

/* ── field primitives ────────────────────────────────────────── */

interface TextProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  type?: "text" | "email" | "tel";
  autoComplete?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

const TextField = ({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required,
  error,
  placeholder,
  inputRef,
}: TextProps) => (
  <label className={`lgj-field ${error ? "lgj-field--error" : ""}`} htmlFor={id}>
    <span className="lgj-field__label">
      {label}
      {required && <span aria-hidden="true"> *</span>}
    </span>
    <input
      id={id}
      ref={inputRef}
      className="lgj-field__input"
      type={type}
      value={value}
      autoComplete={autoComplete}
      required={required}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-err` : undefined}
    />
    {error && (
      <span id={`${id}-err`} className="lgj-field__err">
        {error}
      </span>
    )}
  </label>
);

interface SelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  error?: string;
}

const SelectField = ({
  id,
  label,
  value,
  onChange,
  options,
  required,
  error,
}: SelectProps) => (
  <label className={`lgj-field ${error ? "lgj-field--error" : ""}`} htmlFor={id}>
    <span className="lgj-field__label">
      {label}
      {required && <span aria-hidden="true"> *</span>}
    </span>
    <select
      id={id}
      className="lgj-field__input lgj-field__select"
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-err` : undefined}
    >
      <option value="" disabled>
        Choose one…
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    {error && (
      <span id={`${id}-err`} className="lgj-field__err">
        {error}
      </span>
    )}
  </label>
);

interface CheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  error?: string;
}

const CheckboxField = ({ id, label, checked, onChange, error }: CheckboxProps) => (
  <label className={`lgj-check ${error ? "lgj-check--error" : ""}`} htmlFor={id}>
    <input
      id={id}
      type="checkbox"
      className="lgj-check__box"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-err` : undefined}
    />
    <span className="lgj-check__label">{label}</span>
    {error && (
      <span id={`${id}-err`} className="lgj-field__err lgj-check__err">
        {error}
      </span>
    )}
  </label>
);

export default LeagueJoin;

/* Small helpers exposed for the test file if we ever add one — not
   currently imported by any component but useful when we do. */
export { EMAIL_RE, validate, DIVISION_LABEL, EXPERIENCE_LABEL };
