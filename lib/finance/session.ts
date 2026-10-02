import "server-only";

import { getIdentity, roleCan } from "@/lib/identity";

/**
 * Finance workspace session.
 *
 * Internal to Speedmax, and the first surface that legitimately sees cost,
 * margin and partner rates — the fields BR-008 hides from the customer and
 * agent portals.
 */

export type FinanceRole =
  | "billing_officer"
  | "collection_officer"
  | "accounts_payable"
  | "finance_approver"
  | "finance_manager";

export interface FinanceSession {
  readonly userId: string;
  readonly fullName: string;
  readonly email: string;
  readonly jobTitle: string;
  readonly role: FinanceRole;
  readonly organizationName: string;
  readonly timezone: string;
  readonly locale: string;
  /** Speedmax's reporting currency. Transactions may be in any currency. */
  readonly baseCurrency: string;
  readonly isDemo: boolean;
}

export async function getFinanceSession(): Promise<FinanceSession> {
  const { profile, organizationName } = await getIdentity("finance");

  return {
    userId: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    jobTitle: profile.jobTitle ?? "",
    role: profile.role as FinanceRole,
    organizationName,
    timezone: profile.timezone,
    locale: profile.locale,
    baseCurrency: "PHP",
    isDemo: true,
  };
}

export function financeCan(
  session: FinanceSession,
  permission: string,
): boolean {
  return roleCan(session.role, permission);
}
