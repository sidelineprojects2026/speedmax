"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { buttonStyles } from "./layout";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Server-action plumbing, in two shapes.
 *
 * `ActionForm` is an inline form with a submit button. `ActionDialog` is a
 * button that opens a modal containing one — used where an action commits to
 * something (accepting a quotation, approving a payment) or needs a reason
 * recorded, because those deserve a deliberate second step rather than a stray
 * click.
 *
 * Both surface the refusal text the action returned. That matters here: most
 * refusals in this system are business rules — "you prepared this record",
 * "this quotation expired" — and a disabled button with no explanation teaches
 * the user nothing.
 */

const initial: ActionResult = { ok: true };

export type ActionFn = (
  prev: ActionResult,
  form: FormData,
) => Promise<ActionResult>;

function Feedback({ state }: { state: ActionResult }) {
  if (state.ok && !state.message) return null;

  if (state.ok) {
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-sm border border-tone-success-br bg-tone-success-bg p-3 text-sm text-tone-success-fg"
      >
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{state.message}</span>
      </p>
    );
  }

  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-sm border border-tone-danger-br bg-tone-danger-bg p-3 text-sm text-tone-danger-fg"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{state.error}</span>
    </p>
  );
}

export function ActionForm({
  action,
  submitLabel,
  pendingLabel,
  hidden = {},
  variant = "primary",
  icon,
  children,
  className = "",
  /** Navigate here on success; `:id` is replaced with the returned id. */
  redirectTo,
  compact = false,
}: {
  action: ActionFn;
  submitLabel: string;
  pendingLabel?: string;
  hidden?: Record<string, string>;
  variant?: keyof typeof buttonStyles;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  redirectTo?: string;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const router = useRouter();
  const navigated = useRef(false);

  useEffect(() => {
    if (!redirectTo || navigated.current) return;
    if (state.ok && state.message) {
      navigated.current = true;
      router.push(redirectTo.replace(":id", state.id ?? ""));
    }
  }, [state, redirectTo, router]);

  return (
    <form action={formAction} className={className}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {children && <div className={compact ? "" : "mb-3"}>{children}</div>}

      <div className={compact ? "" : "mt-3"}>
        <Feedback state={state} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className={`${buttonStyles[variant]} ${compact ? "" : "mt-3"}`}
      >
        {icon}
        {pending ? (pendingLabel ?? "Working…") : submitLabel}
      </button>
    </form>
  );
}

export function ActionDialog({
  action,
  trigger,
  title,
  description,
  submitLabel,
  pendingLabel,
  hidden = {},
  variant = "accent",
  triggerVariant = "secondary",
  triggerIcon,
  children,
  disabled = false,
  disabledReason,
}: {
  action: ActionFn;
  trigger: string;
  title: string;
  description?: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  hidden?: Record<string, string>;
  variant?: keyof typeof buttonStyles;
  triggerVariant?: keyof typeof buttonStyles;
  triggerIcon?: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initial);
  const closedOnSuccess = useRef(false);

  // Close once the action reports success, so the dialog does not sit open over
  // a page that has already changed underneath it.
  useEffect(() => {
    if (open && state.ok && state.message && !closedOnSuccess.current) {
      closedOnSuccess.current = true;
      setOpen(false);
    }
    if (!open) closedOnSuccess.current = false;
  }, [state, open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        className={buttonStyles[triggerVariant]}
      >
        {triggerIcon}
        {trigger}
      </button>

      {/* Success feedback persists after the dialog closes. */}
      {!open && state.ok && state.message && (
        <div className="mt-3">
          <Feedback state={state} />
        </div>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-sm border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                {description && (
                  <div className="mt-1 text-sm text-slate-600">{description}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-slate-400 transition-colors hover:text-slate-700"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <form action={formAction}>
              {Object.entries(hidden).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}

              <div className="space-y-4 px-6 py-5">
                {children}
                <Feedback state={state} />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={buttonStyles.secondary}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className={buttonStyles[variant]}
                >
                  {pending ? (pendingLabel ?? "Working…") : submitLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Field primitives, so dialogs stay declarative                              */
/* -------------------------------------------------------------------------- */

const fieldClass =
  "mt-1.5 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400";

export function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  hint,
  defaultValue,
  step,
  min,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  defaultValue?: string;
  step?: string;
  min?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-800">
        {label}
        {required && <span className="ml-1 text-beacon-600">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        step={step}
        min={min}
        className={fieldClass}
      />
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function TextAreaField({
  label,
  name,
  required,
  placeholder,
  hint,
  rows = 3,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  rows?: number;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-800">
        {label}
        {required && <span className="ml-1 text-beacon-600">*</span>}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={fieldClass}
      />
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function SelectField({
  label,
  name,
  options,
  required,
  hint,
  defaultValue,
}: {
  label: string;
  name: string;
  options: readonly { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-800">
        {label}
        {required && <span className="ml-1 text-beacon-600">*</span>}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className={fieldClass}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function FileField({
  label,
  name,
  required,
  hint,
  accept = ".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt,.zip,.xlsx,.docx",
}: {
  label: string;
  name: string;
  required?: boolean;
  hint?: string;
  accept?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-800">
        {label}
        {required && <span className="ml-1 text-beacon-600">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type="file"
        required={required}
        accept={accept}
        className="mt-1.5 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-sm file:border-0 file:bg-ice-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
      />
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function CheckboxField({
  label,
  name,
  hint,
}: {
  label: React.ReactNode;
  name: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="flex items-start gap-2.5 text-sm text-slate-700">
        <input
          type="checkbox"
          name={name}
          className="mt-0.5 size-4 shrink-0 accent-steel-500"
        />
        <span>{label}</span>
      </label>
      {hint && <p className="mt-1.5 pl-6 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
