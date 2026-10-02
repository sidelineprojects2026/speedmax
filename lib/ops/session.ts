import "server-only";

import { getIdentity, roleCan } from "@/lib/identity";

/**
 * Operations workspace session.
 *
 * The internal side that reviews orders, prices quotations, releases bookings,
 * assigns agents and posts milestones — the middle of the loop that the
 * customer's Submit button previously ran into and stopped at.
 */

export type OpsRole = "ops_coordinator" | "pricing_officer" | "admin";

export interface OpsSession {
  readonly userId: string;
  readonly fullName: string;
  readonly email: string;
  readonly jobTitle: string;
  readonly role: OpsRole;
  readonly organizationName: string;
  readonly timezone: string;
  readonly locale: string;
  readonly baseCurrency: string;
  readonly isDemo: boolean;
}

export async function getOpsSession(): Promise<OpsSession> {
  const { profile, organizationName } = await getIdentity("ops");

  return {
    userId: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    jobTitle: profile.jobTitle ?? "",
    role: profile.role as OpsRole,
    organizationName,
    timezone: profile.timezone,
    locale: profile.locale,
    baseCurrency: "PHP",
    isDemo: true,
  };
}

export function opsCan(session: OpsSession, permission: string): boolean {
  return roleCan(session.role, permission);
}
