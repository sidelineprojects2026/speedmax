/**
 * Shared shape and guards for server actions.
 *
 * Every mutation in the application runs the same pipeline before it writes:
 *
 *   1. permission  — does this role hold the grant at all (§13.1)
 *   2. transition  — is the status change legal (§21, fails closed)
 *   3. separation  — is the actor someone other than the preparer (§13)
 *   4. write + audit, with a mandatory reason where §17.2 requires one
 *
 * The guards themselves live in lib/domain and are unit-tested. This module
 * exists so the actions read as a checklist rather than repeating the plumbing,
 * and so every refusal comes back in one shape the forms know how to render.
 */

import { canTransition, type LifecycleKey } from "@/lib/domain/status";
import { canApprove } from "@/lib/domain/segregation";
import { roleCan } from "@/lib/identity";
import type { UserRole } from "@/lib/store/schema";

export type ActionResult =
  | { ok: true; message?: string; id?: string; reference?: string }
  | { ok: false; error: string; field?: string };

export function ok(
  message?: string,
  extra?: { id?: string; reference?: string },
): ActionResult {
  return { ok: true, message, ...extra };
}

export function fail(error: string, field?: string): ActionResult {
  return { ok: false, error, field };
}

/** Thrown by guards; actions catch it and turn it into a refusal. */
export class ActionError extends Error {
  readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "ActionError";
    this.field = field;
  }
}

/** Run an action body, converting a thrown ActionError into a refusal. */
export async function attempt(
  body: () => Promise<ActionResult>,
): Promise<ActionResult> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof ActionError) return fail(error.message, error.field);
    // An unexpected failure is a bug, not a validation message. Say so plainly
    // rather than dressing it up as a business rule.
    const detail = error instanceof Error ? error.message : String(error);
    return fail(`Something went wrong and the change was not saved. ${detail}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Guards                                                                     */
/* -------------------------------------------------------------------------- */

export function requirePermission(role: UserRole, permission: string): void {
  if (!roleCan(role, permission)) {
    throw new ActionError(
      `Your role does not permit this action (${permission}).`,
    );
  }
}

/** §21 — refuse a status change the lifecycle does not allow. Fails closed. */
export function requireTransition(
  lifecycle: LifecycleKey,
  from: string,
  to: string,
): void {
  if (from === to) return;
  if (!canTransition(lifecycle, from, to)) {
    throw new ActionError(
      `A ${lifecycle.replace(/_/g, " ")} cannot move from "${from}" to "${to}".`,
    );
  }
}

/** §13 — the approver must be someone other than the preparer. */
export function requireSeparation(opts: {
  actorId: string;
  role: UserRole;
  permission: string;
  preparedById: string | null;
  action: string;
}): void {
  const decision = canApprove({
    actorId: opts.actorId,
    hasPermission: roleCan(opts.role, opts.permission),
    preparedById: opts.preparedById,
    action: opts.action,
  });
  if (!decision.allowed) throw new ActionError(decision.reason);
}

/** §17.2 — reject, override, reverse, cancel and reopen need a reason. */
export function requireReason(value: string | null | undefined): string {
  const reason = value?.trim() ?? "";
  if (reason.length < 4) {
    throw new ActionError(
      "A reason is required and is recorded on the audit trail.",
      "reason",
    );
  }
  return reason;
}

export function requireText(
  value: string | null | undefined,
  label: string,
  field?: string,
): string {
  const text = value?.trim() ?? "";
  if (!text) throw new ActionError(`${label} is required.`, field);
  return text;
}

/** A positive decimal amount, returned in canonical string form. */
export function requireAmount(
  value: string | null | undefined,
  label: string,
  field?: string,
  places = 2,
): string {
  const raw = value?.trim() ?? "";
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n <= 0) {
    throw new ActionError(`${label} must be a positive amount.`, field);
  }
  return n.toFixed(places);
}

/** Find a record or refuse — used everywhere a route parameter is trusted. */
export function requireFound<T>(record: T | undefined | null, label: string): T {
  if (record === undefined || record === null) {
    throw new ActionError(`${label} could not be found.`);
  }
  return record;
}

/* -------------------------------------------------------------------------- */
/* Form helpers                                                               */
/* -------------------------------------------------------------------------- */

export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function bool(form: FormData, key: string): boolean {
  return form.get(key) !== null;
}

export function num(form: FormData, key: string): number | null {
  const raw = str(form, key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function decimalOrNull(
  form: FormData,
  key: string,
  places: number,
): string | null {
  const n = num(form, key);
  return n === null || n < 0 ? null : n.toFixed(places);
}

export const nowIso = (): string => new Date().toISOString();
