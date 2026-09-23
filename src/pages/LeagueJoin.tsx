// PTO League, Season 1 registration funnel.
//
// Two steps: details, then confirmation. Payment is deliberately NOT part
// of this flow. The job here is to capture the lead; deposits are arranged
// afterwards out of band, so no figure appears anywhere on these screens.
//
// Step and form data persist to sessionStorage under a versioned key so a
// refresh or a back tap doesn't lose the visitor's progress. Submitting
// writes the registration to the clubhouse league_registrations table
// (src/league/submitRegistration.ts). If that write fails the visitor stays
// on the form with a retry message; we only confirm what actually landed.

import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageWrapper from "@/components/layout/PageWrapper";
import { league } from "@/content/league";
import {
  submitLeagueRegistration,
  type Division,
  type Experience,
  type LeadData,
  type LeagueRegistration,
} from "@/league/submitRegistration";
import "./leagueJoin.css";

type Step = "form" | "confirmed";

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

const STORAGE_KEY = "league.join.v2";
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

/** "2026-10-04" to "October 4", for tight display copy. */
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
    /* private mode or disabled storage, nothing to do */
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
    document.title = "Join PTO League Season 1 · Club PTO";
    return () => {
      document.title = previous;
    };
  }, []);

  const [step, setStep] = useState<Step>("form");
  const [lead, setLead] = useState<LeadData>(EMPTY_LEAD);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setStep(stored.step);
      setLead(stored.lead);
    }
    setHydrated(true);
  }, []);

  // Persist once hydrated, so the empty initial state never overwrites a
  // restored session.
  useEffect(() => {
    if (!hydrated) return;
    writeStored({ step, lead });
  }, [hydrated, step, lead]);

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
              onSubmit={() => setStep("confirmed")}
            />
          )}
          {step === "confirmed" && (
            <ConfirmedStep
              lead={lead}
              onReset={startOver}
              onGoHome={() => navigate("/")}
            />
          )}
        </div>
      </div>
    </PageWrapper>
  );
};

/* ── step indicator ──────────────────────────────────────────── */

const STEPS: { id: Step; label: string }[] = [
  { id: "form", label: "Your details" },
  { id: "confirmed", label: "You're in" },
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
  const [errors, setErrors] = useState<Partial<Record<keyof LeadData, string>>>(
    {},
  );
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

    // validate() guarantees division and experience are picked.
    const result = await submitLeagueRegistration(value as LeagueRegistration);
    setSubmitting(false);
    if (!result.ok) {
      setRemoteError(
        "That didn't go through. Check your connection and try again.",
      );
      return;
    }
    onSubmit();
  };

  return (
    <>
      <header className="lgj-head">
        <p className="lgj-label lgj-eyebrow">Step 1 · your details</p>
        <h1 className="rly-display lgj-title">Join PTO League Season 1</h1>
        <p className="lgj-sub">
          Tell us who you are and we'll hold you a place on the founding
          roster. We'll be in touch with everything you need before the
          season starts.
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
              { value: "mens", label: DIVISION_LABEL.mens },
              { value: "womens", label: DIVISION_LABEL.womens },
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
              { value: "few", label: EXPERIENCE_LABEL.few },
              { value: "developing", label: EXPERIENCE_LABEL.developing },
              { value: "intermediate", label: EXPERIENCE_LABEL.intermediate },
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

        {remoteError && (
          <p className="lgj-form__remote" role="alert">
            {remoteError}
          </p>
        )}

        <button type="submit" className="rly-pill lgj-cta" disabled={submitting}>
          {submitting ? "Sending…" : "Join the founding roster →"}
        </button>

        <p className="lgj-form__fine">
          Registration closes{" "}
          {shortDate(league.registrationCloseAt.slice(0, 10))}. The founding
          roster is {league.totalRoster} players and places are held in the
          order they come in.
        </p>
      </form>
    </>
  );
};

/* ── step 2: confirmation ────────────────────────────────────── */

interface ConfirmedProps {
  lead: LeadData;
  onReset: () => void;
  onGoHome: () => void;
}

const ConfirmedStep = ({ lead, onReset, onGoHome }: ConfirmedProps) => {
  const firstName = lead.firstName || "player";
  const divisionLabel =
    lead.division && DIVISION_LABEL[lead.division as Division];

  return (
    <>
      <header className="lgj-head">
        <p className="lgj-label lgj-eyebrow">Step 2 · you're in</p>
        <h1 className="rly-display lgj-title">You're on the list.</h1>
        <p className="lgj-sub">
          Welcome to PTO League Season 1, {firstName}.
        </p>
      </header>

      <div className="lgj-confirm">
        <p className="lgj-confirm__intro">
          We've got your details{divisionLabel ? ` for the ${divisionLabel}` : ""}.
          Here's what happens next:
        </p>
        <ul className="lgj-confirm__list">
          <li>
            We'll email you at {lead.email || "your inbox"} to confirm your
            place and walk you through the last step
          </li>
          <li>
            Your division and player number land before Week 1
          </li>
          <li>Match schedule drops the week of {shortDate("2026-09-29")}</li>
          <li>Season 1 begins Sunday, {shortDate(league.startDate)}</li>
        </ul>
        <p className="lgj-confirm__note">
          Keep an eye on your inbox. If nothing arrives in a day or two,
          check your spam folder or reply to any Club PTO email.
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

const CheckboxField = ({
  id,
  label,
  checked,
  onChange,
  error,
}: CheckboxProps) => (
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

export { EMAIL_RE, validate, DIVISION_LABEL, EXPERIENCE_LABEL };
