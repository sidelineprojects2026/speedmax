"use client";

import { useActionState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { submitQuoteRequest, type QuoteRequestState } from "./actions";

const initialState: QuoteRequestState = { status: "idle" };

const fieldBase =
  "w-full rounded-sm border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400";
const fieldOk = "border-slate-300";
const fieldBad = "border-tone-danger-br bg-tone-danger-bg/40";

function Field({
  label,
  name,
  errors,
  children,
  required,
  hint,
}: {
  label: string;
  name: string;
  errors?: Record<string, string>;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  const error = errors?.[name];
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-sm font-medium text-slate-800"
      >
        {label}
        {required && (
          <span className="ml-1 text-beacon-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-xs text-tone-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}

const handlingOptions = [
  { value: "hazardous", label: "Dangerous goods" },
  { value: "temperature", label: "Temperature controlled" },
  { value: "fragile", label: "Fragile" },
  { value: "oversized", label: "Oversized / out of gauge" },
  { value: "high_value", label: "High value" },
  { value: "controlled", label: "Controlled or licensed goods" },
];

export function QuoteForm() {
  const [state, formAction, pending] = useActionState(
    submitQuoteRequest,
    initialState,
  );

  if (state.status === "success") {
    return (
      <div className="rounded-sm border border-tone-success-br bg-tone-success-bg p-8">
        <CheckCircle2
          className="size-8 text-tone-success-fg"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <h2 className="mt-4 text-xl font-semibold text-tone-success-fg">
          Request received
        </h2>
        {state.reference && (
          <p className="mt-2 text-tone-success-fg/90">
            Your reference is{" "}
            <span className="ref font-medium">{state.reference}</span>. Quote it
            in any correspondence.
          </p>
        )}
        <p className="mt-4 text-sm text-tone-success-fg/90">
          A Speedmax coordinator will review the request, confirm feasibility and
          any missing requirements, and come back with route options, schedule
          and price. Restricted or special cargo is routed for qualified review
          before pricing.
        </p>
      </div>
    );
  }

  const errors = state.errors;

  return (
    <form action={formAction} className="space-y-10">
      {state.status === "error" && state.message && (
        <div
          role="alert"
          className="flex gap-3 rounded-sm border border-tone-danger-br bg-tone-danger-bg p-4"
        >
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0 text-tone-danger-fg"
            aria-hidden="true"
          />
          <p className="text-sm text-tone-danger-fg">{state.message}</p>
        </div>
      )}

      {/* Honeypot — visually and programmatically hidden from real users. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <fieldset>
        <legend className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
          Your details
        </legend>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Company" name="company" errors={errors} required>
            <input
              id="company"
              name="company"
              className={`${fieldBase} ${errors?.company ? fieldBad : fieldOk}`}
              aria-invalid={!!errors?.company}
              aria-describedby={errors?.company ? "company-error" : undefined}
            />
          </Field>
          <Field label="Contact name" name="contact_name" errors={errors} required>
            <input
              id="contact_name"
              name="contact_name"
              className={`${fieldBase} ${errors?.contact_name ? fieldBad : fieldOk}`}
              aria-invalid={!!errors?.contact_name}
            />
          </Field>
          <Field label="Email" name="email" errors={errors} required>
            <input
              id="email"
              name="email"
              type="email"
              className={`${fieldBase} ${errors?.email ? fieldBad : fieldOk}`}
              aria-invalid={!!errors?.email}
            />
          </Field>
          <Field label="Phone" name="phone" errors={errors}>
            <input id="phone" name="phone" className={`${fieldBase} ${fieldOk}`} />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
          Route and service
        </legend>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field
            label="Origin"
            name="origin"
            errors={errors}
            required
            hint="City and country, or port/airport code"
          >
            <input
              id="origin"
              name="origin"
              placeholder="Ningbo, China"
              className={`${fieldBase} ${errors?.origin ? fieldBad : fieldOk}`}
              aria-invalid={!!errors?.origin}
            />
          </Field>
          <Field
            label="Destination"
            name="destination"
            errors={errors}
            required
            hint="Final delivery point, not just the discharge port"
          >
            <input
              id="destination"
              name="destination"
              placeholder="Manila, Philippines"
              className={`${fieldBase} ${errors?.destination ? fieldBad : fieldOk}`}
              aria-invalid={!!errors?.destination}
            />
          </Field>
          <Field label="Mode" name="mode" errors={errors}>
            <select id="mode" name="mode" className={`${fieldBase} ${fieldOk}`}>
              <option value="">No preference — advise</option>
              <option value="sea">Ocean</option>
              <option value="air">Air</option>
              <option value="road">Road</option>
              <option value="rail">Rail</option>
              <option value="courier">Courier</option>
            </select>
          </Field>
          <Field label="Priority" name="priority" errors={errors}>
            <select
              id="priority"
              name="priority"
              className={`${fieldBase} ${fieldOk}`}
            >
              <option value="standard">Standard</option>
              <option value="express">Express</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>
          <Field
            label="Incoterm"
            name="incoterm"
            errors={errors}
            hint="If agreed with your supplier"
          >
            <select
              id="incoterm"
              name="incoterm"
              className={`${fieldBase} ${fieldOk}`}
            >
              <option value="">Not yet agreed</option>
              {["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"].map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field
            label="Cargo ready date"
            name="ready_date"
            errors={errors}
            hint="When goods will be available at origin"
          >
            <input
              id="ready_date"
              name="ready_date"
              type="date"
              className={`${fieldBase} ${fieldOk}`}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
          Cargo
        </legend>
        <div className="mt-5 space-y-5">
          <Field
            label="Cargo description"
            name="cargo_description"
            errors={errors}
            required
            hint="Commodity and, if known, HS code"
          >
            <textarea
              id="cargo_description"
              name="cargo_description"
              rows={3}
              className={`${fieldBase} ${errors?.cargo_description ? fieldBad : fieldOk}`}
              aria-invalid={!!errors?.cargo_description}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Gross weight (kg)" name="gross_weight_kg" errors={errors}>
              <input
                id="gross_weight_kg"
                name="gross_weight_kg"
                type="number"
                min="0"
                step="0.01"
                className={`tnum ${fieldBase} ${fieldOk}`}
              />
            </Field>
            <Field label="Volume (m³)" name="volume_cbm" errors={errors}>
              <input
                id="volume_cbm"
                name="volume_cbm"
                type="number"
                min="0"
                step="0.001"
                className={`tnum ${fieldBase} ${fieldOk}`}
              />
            </Field>
            <Field label="Packages" name="package_count" errors={errors}>
              <input
                id="package_count"
                name="package_count"
                type="number"
                min="0"
                step="1"
                className={`tnum ${fieldBase} ${fieldOk}`}
              />
            </Field>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-slate-800">
              Special handling
            </legend>
            <p className="mt-1 text-xs text-slate-500">
              Anything ticked here is routed for qualified review before pricing.
            </p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {handlingOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    name="handling"
                    value={opt.value}
                    className="size-4 rounded-xs border-slate-300 accent-steel-500"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Anything else we should know" name="notes" errors={errors}>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className={`${fieldBase} ${fieldOk}`}
            />
          </Field>
        </div>
      </fieldset>

      <div className="flex items-center gap-4 border-t border-slate-200 pt-6">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-beacon-500 px-7 py-3 font-medium text-white transition-colors hover:bg-beacon-600 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send request"}
        </button>
        <p className="text-xs text-slate-500">
          Fields marked <span className="text-beacon-600">*</span> are required.
        </p>
      </div>
    </form>
  );
}
