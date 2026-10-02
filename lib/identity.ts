import "server-only";

import { cookies } from "next/headers";

import { readStore } from "@/lib/store/db";
import type { Profile, StoreData, UserRole } from "@/lib/store/schema";

/**
 * Demo identity.
 *
 * Authentication is not wired up, but "who am I" still has to be answerable and
 * changeable. Separation of duties is otherwise undemonstrable: proving that
 * Corazon cannot issue an invoice she prepared requires becoming Ramon and
 * watching the same button work. Likewise, walking a shipment from customer
 * request to agent milestone to finance close needs one person to be able to
 * step between roles.
 *
 * The active profile id lives in a cookie. When Supabase auth arrives, this
 * module reads the session instead and everything above it is unchanged.
 */

export const IDENTITY_COOKIE = "speedmax_identity";

/** Roles each workspace will accept, so a cookie cannot cross a boundary. */
export const WORKSPACE_ROLES: Record<string, readonly UserRole[]> = {
  portal: ["customer_requestor", "customer_approver", "customer_finance"],
  agent: ["agent_operator", "agent_manager"],
  finance: [
    "billing_officer",
    "collection_officer",
    "accounts_payable",
    "finance_approver",
    "finance_manager",
  ],
  ops: ["ops_coordinator", "pricing_officer", "admin"],
};

export type Workspace = keyof typeof WORKSPACE_ROLES;

/** Who each workspace signs in as before anyone picks someone else. */
const DEFAULT_PROFILE: Record<string, string> = {
  portal: "user-marisol",
  agent: "user-joel",
  finance: "user-corazon",
  ops: "user-dante",
};

export interface ActiveIdentity {
  profile: Profile;
  organizationName: string;
  /** Everyone this workspace could switch to, for the picker. */
  options: { id: string; fullName: string; jobTitle: string; role: UserRole }[];
}

/**
 * Resolve the signed-in profile for a workspace.
 *
 * A cookie naming someone outside this workspace's roles is ignored rather than
 * honoured — otherwise switching to a customer in the portal would carry over
 * into the finance workspace and silently grant the wrong permissions.
 */
export async function getIdentity(workspace: Workspace): Promise<ActiveIdentity> {
  const data = await readStore();
  const allowed = WORKSPACE_ROLES[workspace] ?? [];

  const candidates = data.profiles.filter(
    (p) => p.isActive && allowed.includes(p.role),
  );

  const cookieStore = await cookies();
  const requested = cookieStore.get(`${IDENTITY_COOKIE}_${workspace}`)?.value;

  const profile =
    candidates.find((p) => p.id === requested) ??
    candidates.find((p) => p.id === DEFAULT_PROFILE[workspace]) ??
    candidates[0];

  if (!profile) {
    throw new Error(`No active profile available for the ${workspace} workspace.`);
  }

  return {
    profile,
    organizationName: organizationNameOf(data, profile.organizationId),
    options: candidates.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      jobTitle: p.jobTitle ?? "",
      role: p.role,
    })),
  };
}

function organizationNameOf(data: StoreData, id: string): string {
  return data.organizations.find((o) => o.id === id)?.legalName ?? id;
}

/* -------------------------------------------------------------------------- */
/* Permissions — §13.1                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Role grants, mirroring the `role_permissions` rows seeded in
 * supabase/migrations/0002_identity.sql. The database is the authority once
 * connected; this exists so the interface can hide what the caller cannot do.
 *
 * Note the deliberate splits: a pricing officer prepares quotations but cannot
 * approve them, a billing officer prepares invoices but does not issue them,
 * accounts payable prepares vendor bills but does not approve them. Holding a
 * permission is still not enough to approve your own work — see
 * lib/domain/segregation.ts.
 */
const ROLE_PERMISSIONS: Record<UserRole, readonly string[]> = {
  customer_requestor: [
    "shipping_order.create", "shipping_order.view", "shipping_order.submit",
    "shipping_order.cancel", "quotation.view", "shipment.view",
    "document.upload", "document.view", "message.send", "claim.file",
    "exception.view",
  ],
  customer_approver: [
    "shipping_order.create", "shipping_order.view", "shipping_order.submit",
    "shipping_order.cancel", "quotation.view", "quotation.accept",
    "shipment.view", "document.upload", "document.view", "message.send",
    "claim.file", "exception.view",
  ],
  customer_finance: [
    "shipping_order.view", "quotation.view", "shipment.view", "invoice.view",
    "payment.submit", "document.upload", "document.view", "message.send",
    "exception.view",
  ],

  agent_operator: [
    "assignment.view", "assignment.acknowledge", "shipment.view_assigned",
    "milestone.post", "document.upload", "document.view", "task.complete",
    "expense.record", "message.send", "exception.view",
  ],
  agent_manager: [
    "assignment.view", "assignment.acknowledge", "shipment.view_assigned",
    "milestone.post", "document.upload", "document.view", "task.complete",
    "expense.record", "expense.submit", "message.send", "exception.view",
  ],

  ops_coordinator: [
    "shipping_order.view", "shipping_order.review", "quotation.view",
    "quotation.view_internal_cost", "quotation.approve", "quotation.release",
    "booking.release", "shipment.view", "shipment.manage",
    "shipment.assign_agent", "shipment.close", "milestone.post",
    "document.upload", "document.view", "document.verify", "customs.manage",
    "exception.view", "exception.manage", "claim.manage", "message.send",
    "enquiry.manage",
  ],
  pricing_officer: [
    "shipping_order.view", "quotation.view", "quotation.prepare",
    "quotation.view_internal_cost", "shipment.view", "document.view",
    "message.send",
  ],

  billing_officer: [
    "invoice.view", "invoice.prepare", "shipment.view", "quotation.view",
    "quotation.view_internal_cost", "report.view", "document.view",
  ],
  collection_officer: [
    "invoice.view", "payment.view", "payment.verify", "payment.allocate",
    "customer_account.view", "report.view",
  ],
  accounts_payable: [
    "vendor_bill.view", "vendor_bill.prepare", "expense.view",
    "settlement.prepare", "allocation.manage", "report.view",
  ],
  finance_approver: [
    "invoice.view", "invoice.issue", "vendor_bill.view", "vendor_bill.approve",
    "expense.view", "expense.approve", "settlement.approve", "payment.view",
    "shipment.close", "report.view",
  ],
  // Composite role so the demo can reach every finance section. The per-record
  // separation rule still applies on top of it.
  finance_manager: [
    "invoice.view", "invoice.prepare", "invoice.issue", "payment.view",
    "payment.verify", "payment.allocate", "customer_account.view",
    "vendor_bill.view", "vendor_bill.prepare", "vendor_bill.approve",
    "expense.view", "expense.approve", "settlement.prepare",
    "settlement.approve", "allocation.manage", "shipment.close",
    "shipment.view", "quotation.view", "quotation.view_internal_cost",
    "report.view", "document.view",
  ],

  admin: [
    "admin.manage", "audit.view", "shipping_order.view",
    "shipping_order.review", "quotation.view", "quotation.view_internal_cost",
    "quotation.approve", "quotation.release", "booking.release",
    "shipment.view", "shipment.manage", "shipment.assign_agent",
    "shipment.close", "milestone.post", "document.view", "document.verify",
    "customs.manage", "invoice.view", "invoice.prepare", "invoice.issue",
    "payment.verify", "expense.approve", "exception.view", "exception.manage",
    "claim.manage", "message.send", "report.view", "enquiry.manage",
  ],
};

export function roleCan(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: UserRole): readonly string[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
